"""
Tests for Conversation Service
"""

import json
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from moto import mock_aws
import boto3
from unittest.mock import patch, MagicMock

from src.conversation.conversation_service import ConversationService
from src.conversation.ask_question import lambda_handler
from src.common.config import Config
from src.common.errors import ValidationError


@pytest.fixture
def conversation_service():
    """Create conversation service instance."""
    with mock_aws():
        # Create DynamoDB tables
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        
        # Transactions table
        dynamodb.create_table(
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
        
        # Conversations table
        dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_CONVERSATIONS,
            KeySchema=[
                {'AttributeName': 'userId', 'KeyType': 'HASH'},
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        yield ConversationService()


@pytest.fixture
def sample_transactions():
    """Create sample transaction data."""
    transactions = []
    base_date = datetime.utcnow() - timedelta(days=20)
    
    # Dining transactions
    for i in range(10):
        transactions.append({
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i * 2)).isoformat(),
            'description': f'Restaurant {i}',
            'amount': Decimal('-50.00'),
            'category': 'Dining',
            'id': f'dining-{i}'
        })
    
    # Transportation
    for i in range(5):
        transactions.append({
            'userId': 'test-user',
            'date': (base_date + timedelta(days=i * 3)).isoformat(),
            'description': 'Gas Station',
            'amount': Decimal('-40.00'),
            'category': 'Transportation',
            'id': f'transport-{i}'
        })
    
    return transactions


def test_detect_time_range_this_month(conversation_service):
    """Test time range detection for 'this month'."""
    result = conversation_service._detect_time_range("How much did I spend this month?")
    
    assert result['description'] == 'this month'
    assert result['start'].day == 1
    assert result['start'].month == datetime.utcnow().month


def test_detect_time_range_last_month(conversation_service):
    """Test time range detection for 'last month'."""
    result = conversation_service._detect_time_range("What was my spending last month?")
    
    # Should detect last month
    assert 'last month' in result['description'] or 'month' in result['description']
    # Start date should be in the past
    assert result['start'] < datetime.utcnow()


def test_detect_time_range_this_week(conversation_service):
    """Test time range detection for 'this week'."""
    result = conversation_service._detect_time_range("Show me this week's expenses")
    
    assert result['description'] == 'this week'
    # Should be within last 7 days
    days_diff = (result['end'] - result['start']).days
    assert days_diff <= 7


def test_detect_time_range_default(conversation_service):
    """Test default time range (last 30 days)."""
    result = conversation_service._detect_time_range("What did I spend on dining?")
    
    assert result['description'] == 'last 30 days'
    days_diff = (result['end'] - result['start']).days
    assert days_diff >= 29 and days_diff <= 31


def test_get_relevant_context(conversation_service, sample_transactions):
    """Test retrieving relevant financial context."""
    # Insert transactions
    table = conversation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    context = conversation_service.get_relevant_context(
        'test-user',
        "How much did I spend on dining?"
    )
    
    assert 'timeRange' in context
    assert 'transactionCount' in context
    assert 'totalSpending' in context
    assert 'categoryTotals' in context
    assert 'recentTransactions' in context
    
    # Check category totals
    assert 'Dining' in context['categoryTotals']
    assert 'Transportation' in context['categoryTotals']


def test_get_relevant_context_no_data(conversation_service):
    """Test context retrieval with no transaction data."""
    context = conversation_service.get_relevant_context(
        'test-user',
        "How much did I spend?"
    )
    
    assert context['transactionCount'] == 0
    assert context['totalSpending'] == 0.0
    assert len(context['categoryTotals']) == 0


def test_calculate_category_totals(conversation_service, sample_transactions):
    """Test category totals calculation."""
    category_data = conversation_service._calculate_category_totals(sample_transactions)
    
    assert 'Dining' in category_data
    assert 'Transportation' in category_data
    
    # Check Dining totals
    dining = category_data['Dining']
    assert float(dining['total']) == 500.0  # 10 * 50
    assert dining['count'] == 10
    
    # Check Transportation totals
    transport = category_data['Transportation']
    assert float(transport['total']) == 200.0  # 5 * 40
    assert transport['count'] == 5


def test_calculate_confidence(conversation_service):
    """Test confidence calculation based on data availability."""
    # No data
    assert conversation_service._calculate_confidence({'transactionCount': 0}) == 0.0
    
    # Few transactions
    assert conversation_service._calculate_confidence({'transactionCount': 3}) == 0.3
    
    # Moderate data
    assert conversation_service._calculate_confidence({'transactionCount': 15}) == 0.6
    
    # Good data
    assert conversation_service._calculate_confidence({'transactionCount': 30}) == 0.8
    
    # Excellent data
    assert conversation_service._calculate_confidence({'transactionCount': 100}) == 0.95


def test_build_context_summary(conversation_service):
    """Test building context summary text."""
    context = {
        'timeRange': {
            'description': 'last 30 days'
        },
        'totalSpending': 750.0,
        'transactionCount': 15,
        'categoryTotals': {
            'Dining': {
                'total': 500.0,
                'count': 10,
                'percentage': 66.7
            },
            'Transportation': {
                'total': 250.0,
                'count': 5,
                'percentage': 33.3
            }
        },
        'recentTransactions': [
            {
                'date': '2024-01-15',
                'description': 'Restaurant',
                'amount': -50.0,
                'category': 'Dining'
            }
        ]
    }
    
    summary = conversation_service._build_context_summary(context)
    
    assert 'last 30 days' in summary
    assert '$750.00' in summary
    assert '15' in summary
    assert 'Dining' in summary
    assert 'Transportation' in summary


@patch('src.conversation.conversation_service.boto3.client')
def test_ask_question_success(mock_boto_client, conversation_service, sample_transactions):
    """Test asking a question successfully."""
    # Mock Bedrock response
    mock_bedrock = MagicMock()
    mock_response = {
        'body': MagicMock()
    }
    mock_response['body'].read.return_value = json.dumps({
        'content': [{
            'text': 'You spent $500 on dining in the last 30 days, which represents 10 transactions averaging $50 each.'
        }]
    }).encode()
    mock_bedrock.invoke_model.return_value = mock_response
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = conversation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    # Ask question
    response = conversation_service.ask_question(
        'test-user',
        "How much did I spend on dining?"
    )
    
    assert 'answer' in response
    assert 'confidence' in response
    assert 'sources' in response
    assert 'context' in response
    # Response should have an answer (even if fallback)
    assert len(response['answer']) > 0


def test_ask_question_empty(conversation_service):
    """Test asking an empty question."""
    with pytest.raises(ValidationError):
        conversation_service.ask_question('test-user', "")


def test_ask_question_whitespace_only(conversation_service):
    """Test asking a whitespace-only question."""
    with pytest.raises(ValidationError):
        conversation_service.ask_question('test-user', "   ")


@patch('src.conversation.conversation_service.boto3.client')
def test_ask_question_with_history(mock_boto_client, conversation_service, sample_transactions):
    """Test asking a question with conversation history."""
    # Mock Bedrock
    mock_bedrock = MagicMock()
    mock_response = {
        'body': MagicMock()
    }
    mock_response['body'].read.return_value = json.dumps({
        'content': [{
            'text': 'Based on our previous conversation, your dining spending is higher than usual.'
        }]
    }).encode()
    mock_bedrock.invoke_model.return_value = mock_response
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = conversation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    # Conversation history
    history = [
        {'role': 'user', 'content': 'How much did I spend on dining?'},
        {'role': 'assistant', 'content': 'You spent $500 on dining.'}
    ]
    
    response = conversation_service.ask_question(
        'test-user',
        "Is that more than usual?",
        history
    )
    
    assert 'answer' in response


@patch('src.conversation.conversation_service.boto3.client')
def test_ask_question_bedrock_failure(mock_boto_client, conversation_service, sample_transactions):
    """Test fallback when Bedrock fails."""
    # Mock Bedrock failure
    mock_bedrock = MagicMock()
    mock_bedrock.invoke_model.side_effect = Exception("Bedrock error")
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = conversation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    response = conversation_service.ask_question(
        'test-user',
        "How much did I spend?"
    )
    
    # Should return fallback response
    assert 'answer' in response
    assert response['confidence'] == 0.0
    assert 'trouble' in response['answer'].lower() or 'try' in response['answer'].lower()


@patch('src.conversation.conversation_service.boto3.client')
def test_lambda_handler(mock_boto_client, conversation_service, sample_transactions):
    """Test conversation Lambda handler."""
    # Mock Bedrock
    mock_bedrock = MagicMock()
    mock_response = {
        'body': MagicMock()
    }
    mock_response['body'].read.return_value = json.dumps({
        'content': [{
            'text': 'You spent $500 on dining.'
        }]
    }).encode()
    mock_bedrock.invoke_model.return_value = mock_response
    mock_boto_client.return_value = mock_bedrock
    
    # Insert transactions
    table = conversation_service.transactions_table
    for txn in sample_transactions:
        table.put_item(Item=txn)
    
    event = {
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user'
                }
            }
        },
        'body': json.dumps({
            'question': 'How much did I spend on dining?'
        })
    }
    
    response = lambda_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'answer' in body
    assert 'confidence' in body


def test_lambda_handler_unauthorized():
    """Test Lambda handler without authorization."""
    event = {
        'requestContext': {},
        'body': json.dumps({'question': 'Test'})
    }
    
    response = lambda_handler(event, None)
    
    assert response['statusCode'] == 401


def test_lambda_handler_missing_question():
    """Test Lambda handler without question."""
    event = {
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user'
                }
            }
        },
        'body': json.dumps({})
    }
    
    response = lambda_handler(event, None)
    
    assert response['statusCode'] == 400
