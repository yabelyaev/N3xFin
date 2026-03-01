"""End-to-end integration tests for N3xFin workflows.

Tests complete user workflows from upload through analysis and reporting.
Requirements: 1.1, 2.1, 3.1, 4.1, 6.1, 7.1, 8.1, 9.1
"""
import pytest
import boto3
from moto import mock_aws
from datetime import datetime, timedelta, UTC
import json
import io
import csv
from decimal import Decimal

from auth.auth_service import AuthService
from upload.upload_service import UploadService
from parser.parser_service import ParserService
from categorization.categorization_service import CategorizationService
from analytics.analytics_service import AnalyticsService
from prediction.prediction_service import PredictionService
from recommendation.recommendation_service import RecommendationService
from conversation.conversation_service import ConversationService
from report.report_service import ReportService


@pytest.fixture
def setup_aws_resources(aws_credentials):
    """Set up all required AWS resources for E2E tests."""
    with mock_aws():
        # Create DynamoDB tables
        dynamodb = boto3.client('dynamodb', region_name='us-east-1')
        
        # Users table
        dynamodb.create_table(
            TableName='n3xfin-users',
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
        
        # Transactions table
        dynamodb.create_table(
            TableName='n3xfin-transactions',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1SK', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'CategoryIndex',
                    'KeySchema': [
                        {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                        {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'}
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # Reports table
        dynamodb.create_table(
            TableName='n3xfin-reports',
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
        
        # Create S3 bucket
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='n3xfin-data-test')
        
        yield {
            'dynamodb': dynamodb,
            's3': s3
        }


def create_sample_csv():
    """Create a sample CSV bank statement."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Description', 'Amount', 'Balance'])
    
    # Generate 30 days of transactions
    base_date = datetime.now() - timedelta(days=30)
    balance = 5000.0
    
    transactions = [
        (base_date + timedelta(days=0), 'Starbucks Coffee', -5.50),
        (base_date + timedelta(days=1), 'Uber Ride', -15.00),
        (base_date + timedelta(days=2), 'Whole Foods', -85.30),
        (base_date + timedelta(days=3), 'Netflix Subscription', -15.99),
        (base_date + timedelta(days=5), 'Shell Gas Station', -45.00),
        (base_date + timedelta(days=7), 'Amazon Purchase', -125.00),
        (base_date + timedelta(days=10), 'Salary Deposit', 3000.00),
        (base_date + timedelta(days=12), 'Electric Bill', -120.00),
        (base_date + timedelta(days=15), 'Restaurant Dinner', -75.00),
        (base_date + timedelta(days=18), 'Gym Membership', -50.00),
    ]
    
    for date, desc, amount in transactions:
        balance += amount
        writer.writerow([
            date.strftime('%Y-%m-%d'),
            desc,
            f'{amount:.2f}',
            f'{balance:.2f}'
        ])
    
    return output.getvalue()


@pytest.mark.integration
class TestCompleteUserWorkflow:
    """Test complete user workflows from registration to reporting."""
    
    def test_full_workflow_upload_to_dashboard(self, setup_aws_resources):
        """
        Test complete workflow: Register -> Upload -> Parse -> Categorize -> View Dashboard
        Requirements: 1.1, 2.1, 3.1, 4.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-001'
        
        # Step 1: Upload CSV file
        upload_service = UploadService()
        
        csv_content = create_sample_csv()
        csv_bytes = csv_content.encode('utf-8')
        
        # Validate and upload file
        is_valid, file_type, error = upload_service.validate_file('statement.csv', len(csv_bytes))
        assert is_valid is True
        assert file_type == 'csv'
        
        # Store file directly in S3 for testing
        s3_key = f'users/{user_id}/statements/test-statement.csv'
        resources['s3'].put_object(
            Bucket='n3xfin-data-test',
            Key=s3_key,
            Body=csv_bytes
        )
        
        s3_location = {
            'bucket': 'n3xfin-data-test',
            'key': s3_key
        }
        
        # Step 2: Parse CSV
        parser_service = ParserService()
        
        transactions = parser_service.parse_csv(s3_location['bucket'], s3_location['key'], user_id)
        assert len(transactions) > 0
        assert hasattr(transactions[0], 'date')
        assert hasattr(transactions[0], 'description')
        assert hasattr(transactions[0], 'amount')
        
        # Step 3: Categorize transactions (mocked)
        categorization_service = CategorizationService()
        
        # Mock categorization for testing
        for transaction in transactions:
            if 'coffee' in transaction.description.lower():
                category = 'Dining'
            elif 'uber' in transaction.description.lower():
                category = 'Transportation'
            elif 'netflix' in transaction.description.lower():
                category = 'Entertainment'
            elif 'salary' in transaction.description.lower():
                category = 'Income'
            else:
                category = 'Other'
            
            # Update transaction object (since it's a Pydantic-like model or has these attributes)
            # Assuming Transaction model has these fields based on common.models
            # In common.models, it's likely a dataclass or class with these attributes
            transaction.category = category
        
        # Store categorized transactions
        parser_service.store_transactions(transactions)
        
        # Step 4: Get analytics dashboard data
        analytics_service = AnalyticsService()
        
        # Get spending by category
        end_date = datetime.now(UTC) + timedelta(days=1)
        start_date = end_date - timedelta(days=40)
        
        category_spending = analytics_service.get_spending_by_category(
            user_id,
            start_date,
            end_date
        )
        
        
        assert len(category_spending) > 0
        assert any(c['category'] == 'Dining' for c in category_spending)
        
        # Get spending over time
        time_series = analytics_service.get_spending_over_time(
            user_id,
            start_date,
            end_date,
            'day'
        )
        
        assert len(time_series) > 0
        assert all('timestamp' in t for t in time_series)
        assert all('amount' in t for t in time_series)
    
    def test_full_workflow_predictions_and_alerts(self, setup_aws_resources):
        """
        Test workflow: Historical data -> Predictions -> Alerts
        Requirements: 6.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-002'
        
        # Create historical transaction data
        dynamodb = resources['dynamodb']
        base_date = datetime.now(UTC) - timedelta(days=60)
        
        # Create consistent spending pattern
        for i in range(60):
            date = base_date + timedelta(days=i)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': 'Daily Coffee'},
                    'amount': {'N': '-5.00'},
                    'category': {'S': 'Dining'},
                    'categoryConfidence': {'N': '0.9'}
                }
            )
        
        # Get predictions
        prediction_service = PredictionService()
        
        predictions = prediction_service.predict_spending(user_id, 'Dining', 30)
        assert predictions is not None
        assert 'predictedAmount' in predictions
        assert 'historicalAverage' in predictions
        
        # Generate alerts
        alerts = prediction_service.generate_alerts(user_id)
        assert isinstance(alerts, list)
    
    def test_full_workflow_recommendations(self, setup_aws_resources):
        """
        Test workflow: Spending analysis -> Personalized recommendations
        Requirements: 7.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-003'
        
        # Create spending data with savings opportunities
        dynamodb = resources['dynamodb']
        base_date = datetime.now() - timedelta(days=30)
        
        # High dining spending
        for i in range(20):
            date = base_date + timedelta(days=i)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': 'Restaurant'},
                    'amount': {'N': '-50.00'},
                    'category': {'S': 'Dining'},
                    'categoryConfidence': {'N': '0.9'}
                }
            )
        
        # Get recommendations
        recommendation_service = RecommendationService()
        
        recommendations = recommendation_service.generate_recommendations(user_id)
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        # Verify recommendations are ranked
        if len(recommendations) > 1:
            for i in range(len(recommendations) - 1):
                assert recommendations[i]['priority'] >= recommendations[i + 1]['priority']
    
    def test_full_workflow_conversational_qa(self, setup_aws_resources):
        """
        Test workflow: User question -> Context retrieval -> AI response
        Requirements: 8.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-004'
        
        # Create transaction data
        dynamodb = resources['dynamodb']
        base_date = datetime.now() - timedelta(days=30)
        
        for i in range(10):
            date = base_date + timedelta(days=i * 3)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': 'Coffee Shop'},
                    'amount': {'N': '-5.50'},
                    'category': {'S': 'Dining'},
                    'categoryConfidence': {'N': '0.9'}
                }
            )
        
        # Ask question
        conversation_service = ConversationService()
        
        question = "How much did I spend on dining last month?"
        context = conversation_service.get_relevant_context(user_id, question)
        
        assert context is not None
        assert 'relevantTransactions' in context or 'categoryTotals' in context
    
    def test_full_workflow_monthly_report(self, setup_aws_resources):
        """
        Test workflow: Monthly data -> Report generation -> Export
        Requirements: 9.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-005'
        
        # Create month of transaction data
        dynamodb = resources['dynamodb']
        report_month = datetime.now(UTC).replace(day=1) - timedelta(days=1)
        
        for i in range(30):
            date = report_month.replace(day=1) + timedelta(days=i)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': f'Transaction {i}'},
                    'amount': {'N': '-25.00'},
                    'category': {'S': 'Shopping'},
                    'categoryConfidence': {'N': '0.9'}
                }
            )
        
        # Generate report
        report_service = ReportService()
        
        report = report_service.generate_monthly_report(
            user_id,
            report_month.year,
            report_month.month
        )
        
        assert report is not None
        assert 'totalSpending' in report
        assert 'spendingByCategory' in report
        assert 'month' in report
        
        # Export to CSV
        csv_export = report_service.export_to_csv(report)
        assert csv_export is not None
        assert len(csv_export) > 0


@pytest.mark.integration
class TestErrorScenarios:
    """Test error handling across workflows."""
    
    def test_invalid_file_upload(self, setup_aws_resources):
        """
        Test error handling for invalid file uploads.
        Requirements: 1.1
        """
        resources = setup_aws_resources
        upload_service = UploadService()
        
        # Test oversized file
        large_content = b'x' * (11 * 1024 * 1024)  # 11MB
        
        from common.errors import ValidationError
        with pytest.raises(ValidationError) as exc_info:
            upload_service.validate_file('large.csv', len(large_content))
        assert 'size' in str(exc_info.value).lower()
        
        # Test unsupported format
        with pytest.raises(ValidationError) as exc_info:
            upload_service.validate_file('file.txt', 100)
        assert 'type' in str(exc_info.value).lower() or 'format' in str(exc_info.value).lower()
    
    def test_malformed_csv_parsing(self, setup_aws_resources):
        """
        Test error handling for malformed CSV files.
        Requirements: 2.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-error-001'
        
        # Upload malformed CSV
        upload_service = UploadService()
        
        malformed_csv = b'Invalid,CSV,Data\nNo,Proper,Structure'
        s3_key = f'users/{user_id}/statements/bad.csv'
        resources['s3'].put_object(
            Bucket='n3xfin-data-test',
            Key=s3_key,
            Body=malformed_csv
        )
        
        s3_location = {
            'bucket': 'n3xfin-data-test',
            'key': s3_key
        }
        
        # Attempt to parse
        parser_service = ParserService()
        
        with pytest.raises(Exception) as exc_info:
            parser_service.parse_csv(s3_location, user_id)
        
        assert exc_info.value is not None
    
    def test_empty_data_analytics(self, setup_aws_resources):
        """
        Test analytics with no transaction data.
        Requirements: 4.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-empty'
        
        analytics_service = AnalyticsService()
        
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=30)
        
        # Should return empty results, not error
        category_spending = analytics_service.get_spending_by_category(
            user_id,
            start_date,
            end_date
        )
        
        assert category_spending == [] or len(category_spending) == 0
    
    def test_insufficient_data_predictions(self, setup_aws_resources):
        """
        Test predictions with insufficient historical data.
        Requirements: 6.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-new'
        
        # Create only 5 days of data (insufficient for predictions)
        dynamodb = resources['dynamodb']
        base_date = datetime.now(UTC) - timedelta(days=5)
        
        for i in range(5):
            date = base_date + timedelta(days=i)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': 'Transaction'},
                    'amount': {'N': '-10.00'},
                    'category': {'S': 'Dining'},
                    'categoryConfidence': {'N': '0.9'}
                }
            )
        
        prediction_service = PredictionService()
        
        # Should handle gracefully
        predictions = prediction_service.predict_spending(user_id, 'Dining', 30)
        # Either returns None or low confidence prediction
        assert predictions is not None
    
    def test_unanswerable_conversation_query(self, setup_aws_resources):
        """
        Test conversational interface with unanswerable questions.
        Requirements: 8.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-conv'
        
        conversation_service = ConversationService()
        
        # Ask question about data that doesn't exist
        question = "What was my spending on travel in 2020?"
        context = conversation_service.get_relevant_context(user_id, question)
        
        # Should return empty or minimal context
        assert context is not None
        if 'relevantTransactions' in context:
            assert len(context['relevantTransactions']) == 0


@pytest.mark.integration
class TestDataIntegrity:
    """Test data integrity across workflows."""
    
    def test_duplicate_transaction_prevention(self, setup_aws_resources):
        """
        Test that duplicate transactions are not stored.
        Requirements: 2.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-dup'
        
        parser_service = ParserService()
        
        # Create duplicate transactions
        from common.models import Transaction
        transactions = [
            Transaction(
                id='txn-1',
                userId=user_id,
                date=datetime.now(UTC),
                description='Coffee Shop',
                amount=-5.50,
                sourceFile='test.csv',
                rawData='{}',
                createdAt=datetime.now(UTC)
            ),
            Transaction(
                id='txn-2',
                userId=user_id,
                date=datetime.now(UTC),
                description='Coffee Shop',
                amount=-5.50,
                sourceFile='test.csv',
                rawData='{}',
                createdAt=datetime.now(UTC)
            )
        ]
        
        # Detect duplicates
        unique_transactions = parser_service.detect_duplicates(transactions, user_id)
        
        # Should only have one transaction
        assert len(unique_transactions) == 1
    
    def test_category_aggregation_accuracy(self, setup_aws_resources):
        """
        Test that category totals sum correctly.
        Requirements: 4.1
        """
        resources = setup_aws_resources
        user_id = 'test-user-agg'
        
        # Create known transaction amounts
        dynamodb = resources['dynamodb']
        base_date = datetime.now() - timedelta(days=10)
        
        expected_total = 0
        transactions_data = [
            ('Dining', -25.00),
            ('Dining', -30.00),
            ('Transportation', -15.00),
            ('Shopping', -100.00)
        ]
        
        for i, (category, amount) in enumerate(transactions_data):
            expected_total += abs(amount)
            date = base_date + timedelta(days=i)
            dynamodb.put_item(
                TableName='n3xfin-transactions',
                Item={
                    'PK': {'S': f'USER#{user_id}'},
                    'SK': {'S': f'TRANSACTION#{date.isoformat()}#{i}'},
                    'id': {'S': f'txn-{i}'},
                    'date': {'S': date.isoformat()},
                    'description': {'S': f'Transaction {i}'},
                    'amount': {'N': str(amount)},
                    'category': {'S': category},
                    'categoryConfidence': {'N': '0.9'},
                    'createdAt': {'S': datetime.now(UTC).isoformat()},
                    'GSI1PK': {'S': f'USER#{user_id}#CATEGORY#{category}'},
                    'GSI1SK': {'S': f'DATE#{date.isoformat()}'}
                }
            )
        
        # Get analytics
        analytics_service = AnalyticsService()
        
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=30)
        
        category_spending = analytics_service.get_spending_by_category(
            user_id,
            start_date,
            end_date
        )
        
        # Sum all category totals
        actual_total = sum(abs(c['totalAmount']) for c in category_spending)
        
        # Should match expected total
        assert abs(actual_total - expected_total) < 0.01  # Allow for floating point errors
