"""
Unit tests for Report Service.
"""

import pytest
import json
from datetime import datetime, timedelta, UTC
from decimal import Decimal
from moto import mock_aws
import boto3

from report.report_service import ReportService
from report.generate_report import lambda_handler
from common.errors import ValidationError
from common.config import Config


@pytest.fixture
def report_service():
    """Create ReportService instance with mocked AWS services."""
    with mock_aws():
        # Create DynamoDB tables
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        
        # Transactions table
        transactions_table = dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_TRANSACTIONS,
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # Reports table
        reports_table = dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_REPORTS,
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        yield ReportService()


def create_transaction(user_id, date, amount, category='Dining', description='Test'):
    """Helper to create a transaction."""
    txn_date = date.isoformat()
    txn_id = f"txn-{txn_date}-{amount}"
    return {
        'PK': f'USER#{user_id}',
        'SK': f'TRANSACTION#{txn_date}#{txn_id}',
        'userId': user_id,
        'date': txn_date,
        'amount': Decimal(str(amount)),
        'category': category,
        'description': description,
        'id': txn_id
    }


class TestReportService:
    """Test ReportService functionality."""
    
    def test_generate_report_no_transactions(self, report_service):
        """Test report generation with no transactions."""
        report = report_service.generate_monthly_report('user123', 2024, 1)
        
        assert report['userId'] == 'user123'
        assert report['month'] == '2024-01'
        assert report['totalSpending'] == 0.0
        assert report['totalIncome'] == 0.0
        assert report['spendingByCategory'] == {}
        assert report['savingsRate'] == 0.0
        assert report['transactionCount'] == 0
        assert 'No transactions found' in report['insights'][0]
    
    def test_generate_report_with_transactions(self, report_service):
        """Test report generation with transactions."""
        user_id = 'user123'
        
        # Add transactions for January 2024
        transactions = [
            create_transaction(user_id, datetime(2024, 1, 5), -50.00, 'Dining'),
            create_transaction(user_id, datetime(2024, 1, 10), -100.00, 'Shopping'),
            create_transaction(user_id, datetime(2024, 1, 15), -30.00, 'Dining'),
            create_transaction(user_id, datetime(2024, 1, 20), 2000.00, 'Income')
        ]
        
        table = report_service.transactions_table
        for txn in transactions:
            table.put_item(Item=txn)
        
        report = report_service.generate_monthly_report(user_id, 2024, 1)
        
        assert report['userId'] == user_id
        assert report['month'] == '2024-01'
        assert report['totalSpending'] == 180.0
        assert report['totalIncome'] == 2000.0
        assert report['savingsRate'] == 91.0  # (2000-180)/2000 * 100
        assert report['transactionCount'] == 4
        
        # Check category breakdown
        assert 'Dining' in report['spendingByCategory']
        assert report['spendingByCategory']['Dining']['total'] == 80.0
        assert report['spendingByCategory']['Dining']['count'] == 2
        assert 'Shopping' in report['spendingByCategory']
        assert report['spendingByCategory']['Shopping']['total'] == 100.0
    
    def test_invalid_month(self, report_service):
        """Test validation of month parameter."""
        with pytest.raises(ValidationError, match="Month must be between 1 and 12"):
            report_service.generate_monthly_report('user123', 2024, 13)
        
        with pytest.raises(ValidationError, match="Month must be between 1 and 12"):
            report_service.generate_monthly_report('user123', 2024, 0)

    
    def test_calculate_spending_and_income(self, report_service):
        """Test spending and income calculation."""
        transactions = [
            {'amount': Decimal('-50.00')},
            {'amount': Decimal('-100.00')},
            {'amount': Decimal('2000.00')},
            {'amount': Decimal('500.00')}
        ]
        
        result = report_service._calculate_spending_and_income(transactions)
        
        assert result['totalSpending'] == 150.0
        assert result['totalIncome'] == 2500.0
    
    def test_calculate_category_breakdown(self, report_service):
        """Test category breakdown calculation."""
        transactions = [
            {'amount': Decimal('-50.00'), 'category': 'Dining'},
            {'amount': Decimal('-100.00'), 'category': 'Shopping'},
            {'amount': Decimal('-30.00'), 'category': 'Dining'},
            {'amount': Decimal('2000.00'), 'category': 'Income'}  # Should be ignored
        ]
        
        breakdown = report_service._calculate_category_breakdown(transactions)
        
        assert len(breakdown) == 2
        assert breakdown['Dining']['total'] == 80.0
        assert breakdown['Dining']['count'] == 2
        assert breakdown['Dining']['percentage'] == 44.4  # 80/180 * 100
        assert breakdown['Shopping']['total'] == 100.0
        assert breakdown['Shopping']['count'] == 1
        assert breakdown['Shopping']['percentage'] == 55.6
    
    def test_calculate_savings_rate(self, report_service):
        """Test savings rate calculation."""
        # Positive savings
        rate = report_service._calculate_savings_rate(2000.0, 1500.0)
        assert rate == 25.0
        
        # No savings
        rate = report_service._calculate_savings_rate(2000.0, 2000.0)
        assert rate == 0.0
        
        # Negative savings (overspending)
        rate = report_service._calculate_savings_rate(2000.0, 2500.0)
        assert rate == -25.0
        
        # No income
        rate = report_service._calculate_savings_rate(0.0, 100.0)
        assert rate == 0.0
    
    def test_calculate_monthly_trends(self, report_service):
        """Test monthly trend calculation."""
        user_id = 'user123'
        
        # Add transactions for December 2023
        prev_transactions = [
            create_transaction(user_id, datetime(2023, 12, 5), -100.00, 'Dining'),
            create_transaction(user_id, datetime(2023, 12, 10), -200.00, 'Shopping')
        ]
        
        table = report_service.transactions_table
        for txn in prev_transactions:
            table.put_item(Item=txn)
        
        # Current month data (January 2024)
        current_data = {
            'totalSpending': 450.0,  # 50% increase
            'totalIncome': 2000.0
        }
        
        trends = report_service._calculate_monthly_trends(user_id, 2024, 1, current_data)
        
        assert len(trends) == 1
        assert trends[0]['category'] == 'Overall Spending'
        assert trends[0]['direction'] == 'increasing'
        assert trends[0]['percentageChange'] == 50.0
    
    def test_calculate_monthly_trends_no_previous_data(self, report_service):
        """Test trend calculation with no previous month data."""
        current_data = {
            'totalSpending': 450.0,
            'totalIncome': 2000.0
        }
        
        trends = report_service._calculate_monthly_trends('user123', 2024, 1, current_data)
        
        assert trends == []
    
    def test_generate_fallback_insights(self, report_service):
        """Test fallback insights generation."""
        spending_data = {'totalSpending': 1500.0, 'totalIncome': 2000.0}
        category_breakdown = {
            'Dining': {'total': 500.0, 'count': 10, 'percentage': 33.3},
            'Shopping': {'total': 300.0, 'count': 5, 'percentage': 20.0}
        }
        savings_rate = 25.0
        
        insights = report_service._generate_fallback_insights(
            spending_data,
            category_breakdown,
            savings_rate
        )
        
        assert len(insights) >= 3
        assert any('25.0%' in insight for insight in insights)
        assert any('Dining' in insight for insight in insights)
    
    def test_generate_recommendations(self, report_service):
        """Test recommendations generation."""
        category_breakdown = {
            'Dining': {'total': 500.0, 'count': 10, 'percentage': 50.0},
            'Shopping': {'total': 300.0, 'count': 5, 'percentage': 30.0},
            'Transportation': {'total': 200.0, 'count': 8, 'percentage': 20.0}
        }
        
        recommendations = report_service._generate_recommendations(category_breakdown, 1000.0)
        
        assert len(recommendations) == 2
        assert recommendations[0]['category'] == 'Dining'
        assert recommendations[0]['potentialSavings'] == 75.0  # 15% of 500
        assert recommendations[1]['category'] == 'Shopping'
        assert len(recommendations[0]['actionItems']) >= 3
    
    def test_export_to_csv(self, report_service):
        """Test CSV export functionality."""
        report = {
            'reportId': 'user123-2024-01',
            'userId': 'user123',
            'month': '2024-01',
            'totalSpending': 180.0,
            'totalIncome': 2000.0,
            'spendingByCategory': {
                'Dining': {'total': 80.0, 'count': 2, 'percentage': 44.4},
                'Shopping': {'total': 100.0, 'count': 1, 'percentage': 55.6}
            },
            'savingsRate': 91.0,
            'trends': [
                {'category': 'Overall Spending', 'direction': 'increasing', 'percentageChange': 20.0}
            ],
            'insights': ['Great savings rate!', 'Dining is your top category'],
            'recommendations': [
                {
                    'title': 'Reduce Dining',
                    'potentialSavings': 12.0,
                    'actionItems': ['Review expenses', 'Set budget']
                }
            ],
            'transactionCount': 3,
            'generatedAt': '2024-01-31T12:00:00'
        }
        
        csv_output = report_service.export_to_csv(report)
        
        assert 'N3xFin Monthly Financial Report' in csv_output
        assert '2024-01' in csv_output
        assert '$180.00' in csv_output
        assert '$2000.00' in csv_output
        assert '91.0%' in csv_output
        assert 'Dining' in csv_output
        assert 'Shopping' in csv_output
        assert 'Great savings rate!' in csv_output
        assert 'Reduce Dining' in csv_output


class TestGenerateReportLambda:
    """Test generate_report Lambda function."""
    
    def test_lambda_handler_success(self):
        """Test successful report generation via Lambda."""
        with mock_aws():
            # Setup DynamoDB
            dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_TRANSACTIONS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_REPORTS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            
            event = {
                'requestContext': {
                    'authorizer': {
                        'claims': {
                            'sub': 'user123'
                        }
                    }
                },
                'queryStringParameters': {
                    'year': '2024',
                    'month': '1'
                }
            }
            
            response = lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['userId'] == 'user123'
            assert body['month'] == '2024-01'
    
    def test_lambda_handler_default_month(self):
        """Test Lambda with default month (current month)."""
        with mock_aws():
            # Setup DynamoDB
            dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_TRANSACTIONS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_REPORTS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            
            event = {
                'requestContext': {
                    'authorizer': {
                        'claims': {
                            'sub': 'user123'
                        }
                    }
                },
                'queryStringParameters': None
            }
            
            response = lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['userId'] == 'user123'
            # Should use current month
            now = datetime.now(UTC)
            assert body['month'] == f"{now.year}-{now.month:02d}"
    
    def test_lambda_handler_unauthorized(self):
        """Test Lambda without authorization."""
        event = {
            'requestContext': {},
            'queryStringParameters': None
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Unauthorized' in body['error']
    
    def test_lambda_handler_invalid_month(self):
        """Test Lambda with invalid month."""
        with mock_aws():
            # Setup DynamoDB
            dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_TRANSACTIONS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_REPORTS,
                KeySchema=[
                    {'AttributeName': 'PK', 'KeyType': 'HASH'},
                    {'AttributeName': 'SK', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'PK', 'AttributeType': 'S'},
                    {'AttributeName': 'SK', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            
            event = {
                'requestContext': {
                    'authorizer': {
                        'claims': {
                            'sub': 'user123'
                        }
                    }
                },
                'queryStringParameters': {
                    'year': '2024',
                    'month': '13'
                }
            }
            
            response = lambda_handler(event, None)
            
            assert response['statusCode'] == 400
            body = json.loads(response['body'])
            assert 'error' in body
