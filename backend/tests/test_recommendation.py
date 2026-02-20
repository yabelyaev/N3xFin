"""
Tests for Recommendation Service
"""

import json
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from moto import mock_aws
import boto3
from unittest.mock import patch, MagicMock

from src.recommendation.recommendation_service import RecommendationService
from src.recommendation.get_recommendations import lambda_handler
from src.common.config import Config


@pytest.fixture
def recommendation_service():
    """Create recommendation service instance."""
    with mock_aws():
        # Create DynamoDB table
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_TRANSACTIONS,
            KeySchema=[
                {'AttributeName': 'userId', 'KeyType': 'HASH'},
                {'AttributeName': 'date', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'date', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        yield RecommendationService()


@pytest.fixture
def sample_transactions():
    """Create sample transaction data."""
    transactions = []
    base_date = datetime.utcnow() - timedelta(days=25)
    
    # High dining spending
    for i in range(15):
        transactions.append({
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i)).isoformat(),
            'description': 'Restaurant',
            'amount': Decimal('-80.00'),
            'category': 'Dining',
            'id': f'dining-{i}'
        })
    
    # Moderate transportation
    for i in range(10):
        transactions.append({
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i * 2)).isoformat(),
            'description': 'Gas',
            'amount': Decimal('-50.00'),
            'category': 'Transportation',
            'id': f'transport-{i}'
        })
    
    # Lower shopping
    for i in range(5):
        transactions.append({
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i * 4)).isoformat(),
            'description': 'Store',
            'amount': Decimal('-100.00'),
            'category': 'Shopping',
            'id': f'shop-{i}'
        })
    
    return transactions


@patch('src.recommendation.recommendation_service.boto3.client')
def test_generate_recommendations_with_ai(mock_boto_client, recommendation_service, sample_transactions):
    """Test recommendation generation with AI."""
    # Mock Bedrock response
    mock_bedrock = MagicMock()
    mock_response = {
        'body': MagicMock()
    }
    ai_recommendations = [
        {
            "title": "Reduce Dining Out Frequency",
            "description": "You're spending $1,200/month on dining. Cooking at home 3 more times per week could save significantly.",
            "category": "Dining",
            "potentialSavings": 400.0,
            "actionItems": [
                "Plan meals for the week",
                "Cook in batches on weekends",
                "Limit dining out to special occasions"
            ],
            "priority": 5
        },
        {
            "title": "Optimize Transportation Costs",
            "description": "Consider carpooling or public transit to reduce gas expenses.",
            "category": "Transportation",
            "potentialSavings": 150.0,
            "actionItems": [
                "Use public transit twice a week",
                "Carpool with coworkers"
            ],
            "priority": 3
        }
    ]
    mock_response['body'].read.return_value = json.dumps({
        'content': [{
            'text': json.dumps(ai_recommendations)
        }]
    }).encode()
    mock_bedrock.invoke_model.return_value = mock_response
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = recommendation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    # Generate recommendations
    recommendations = recommendation_service.generate_recommendations('test-user')
    
    assert len(recommendations) > 0
    
    # Check structure
    rec = recommendations[0]
    assert 'id' in rec
    assert 'title' in rec
    assert 'description' in rec
    assert 'category' in rec
    assert 'potentialSavings' in rec
    assert 'actionItems' in rec
    assert 'priority' in rec
    assert isinstance(rec['actionItems'], list)
    assert len(rec['actionItems']) > 0


def test_generate_recommendations_insufficient_data(recommendation_service):
    """Test recommendations with insufficient data."""
    # Add only a few transactions
    table = recommendation_service.transactions_table
    base_date = datetime.utcnow() - timedelta(days=10)
    
    for i in range(3):
        table.put_item(Item={
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i)).isoformat(),
            'description': 'Test',
            'amount': Decimal('-50.00'),
            'category': 'Dining',
            'id': f'txn-{i}'
        })
    
    recommendations = recommendation_service.generate_recommendations('test-user')
    
    assert len(recommendations) == 1
    assert recommendations[0]['id'] == 'insufficient-data'
    assert 'Insufficient' in recommendations[0]['title']


def test_generate_recommendations_no_data(recommendation_service):
    """Test recommendations with no transaction data."""
    recommendations = recommendation_service.generate_recommendations('test-user')
    
    assert len(recommendations) == 1
    assert recommendations[0]['id'] == 'insufficient-data'


@patch('src.recommendation.recommendation_service.boto3.client')
def test_generate_recommendations_fallback(mock_boto_client, recommendation_service, sample_transactions):
    """Test fallback recommendations when AI fails."""
    # Mock Bedrock failure
    mock_bedrock = MagicMock()
    mock_bedrock.invoke_model.side_effect = Exception("Bedrock error")
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = recommendation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    recommendations = recommendation_service.generate_recommendations('test-user')
    
    # Should return fallback recommendations
    assert len(recommendations) > 0
    assert all('id' in rec for rec in recommendations)
    assert all('title' in rec for rec in recommendations)
    assert all('potentialSavings' in rec for rec in recommendations)


def test_rank_recommendations(recommendation_service):
    """Test recommendation ranking by potential savings."""
    recommendations = [
        {
            'id': '1',
            'title': 'Low savings',
            'potentialSavings': 50.0,
            'priority': 3
        },
        {
            'id': '2',
            'title': 'High savings',
            'potentialSavings': 500.0,
            'priority': 5
        },
        {
            'id': '3',
            'title': 'Medium savings',
            'potentialSavings': 200.0,
            'priority': 4
        }
    ]
    
    ranked = recommendation_service.rank_recommendations(recommendations)
    
    # Should be sorted by savings (descending)
    assert ranked[0]['id'] == '2'  # Highest savings
    assert ranked[1]['id'] == '3'  # Medium savings
    assert ranked[2]['id'] == '1'  # Lowest savings


def test_rank_recommendations_by_priority(recommendation_service):
    """Test ranking when savings are equal."""
    recommendations = [
        {
            'id': '1',
            'title': 'Low priority',
            'potentialSavings': 100.0,
            'priority': 2
        },
        {
            'id': '2',
            'title': 'High priority',
            'potentialSavings': 100.0,
            'priority': 5
        }
    ]
    
    ranked = recommendation_service.rank_recommendations(recommendations)
    
    # Should be sorted by priority when savings are equal
    assert ranked[0]['id'] == '2'  # Higher priority
    assert ranked[1]['id'] == '1'  # Lower priority


def test_analyze_category_spending(recommendation_service, sample_transactions):
    """Test category spending analysis."""
    category_data = recommendation_service._analyze_category_spending(sample_transactions)
    
    assert 'Dining' in category_data
    assert 'Transportation' in category_data
    assert 'Shopping' in category_data
    
    # Check Dining data
    dining = category_data['Dining']
    assert dining['count'] == 15
    assert float(dining['total']) == 1200.0  # 15 * 80
    
    # Check Transportation data
    transport = category_data['Transportation']
    assert transport['count'] == 10
    assert float(transport['total']) == 500.0  # 10 * 50


def test_analyze_category_spending_excludes_income(recommendation_service):
    """Test that income is excluded from spending analysis."""
    transactions = [
        {
            'userId': 'test-user',
            'date': datetime.utcnow().isoformat(),
            'description': 'Salary',
            'amount': Decimal('3000.00'),  # Positive (income)
            'category': 'Income',
            'id': 'income-1'
        },
        {
            'userId': 'test-user',
            'date': datetime.utcnow().isoformat(),
            'description': 'Restaurant',
            'amount': Decimal('-50.00'),  # Negative (expense)
            'category': 'Dining',
            'id': 'dining-1'
        }
    ]
    
    category_data = recommendation_service._analyze_category_spending(transactions)
    
    # Income should not be in the analysis
    assert 'Income' not in category_data
    assert 'Dining' in category_data


def test_generate_fallback_recommendations(recommendation_service):
    """Test fallback recommendation generation."""
    category_spending = {
        'Dining': {
            'total': Decimal('1000.00'),
            'count': 20,
            'transactions': []
        },
        'Transportation': {
            'total': Decimal('500.00'),
            'count': 10,
            'transactions': []
        },
        'Shopping': {
            'total': Decimal('300.00'),
            'count': 5,
            'transactions': []
        }
    }
    total_spending = Decimal('1800.00')
    
    recommendations = recommendation_service._generate_fallback_recommendations(
        category_spending,
        total_spending
    )
    
    # Should generate recommendations for top 3 categories
    assert len(recommendations) == 3
    
    # First recommendation should be for highest spending (Dining)
    assert recommendations[0]['category'] == 'Dining'
    assert recommendations[0]['potentialSavings'] > 0
    assert recommendations[0]['priority'] == 5  # Highest priority
    
    # Check structure
    for rec in recommendations:
        assert 'id' in rec
        assert 'title' in rec
        assert 'description' in rec
        assert 'actionItems' in rec
        assert len(rec['actionItems']) > 0


@patch('src.recommendation.recommendation_service.boto3.client')
def test_lambda_handler(mock_boto_client, recommendation_service, sample_transactions):
    """Test recommendations Lambda handler."""
    # Mock Bedrock
    mock_bedrock = MagicMock()
    mock_response = {
        'body': MagicMock()
    }
    mock_response['body'].read.return_value = json.dumps({
        'content': [{
            'text': '[{"title": "Test", "description": "Test", "category": "Dining", "potentialSavings": 100, "actionItems": ["Action 1"], "priority": 5}]'
        }]
    }).encode()
    mock_bedrock.invoke_model.return_value = mock_response
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = recommendation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    event = {
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user'
                }
            }
        }
    }
    
    response = lambda_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'recommendations' in body
    assert 'count' in body
    assert len(body['recommendations']) > 0


def test_lambda_handler_unauthorized():
    """Test Lambda handler without authorization."""
    event = {
        'requestContext': {}
    }
    
    response = lambda_handler(event, None)
    
    assert response['statusCode'] == 401
