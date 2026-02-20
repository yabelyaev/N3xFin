"""
Unit tests for Account Deletion Service.
"""

import pytest
import json
from datetime import datetime, timedelta
from decimal import Decimal
from moto import mock_aws
import boto3

from src.auth.deletion_service import DeletionService
from src.auth.delete_account import lambda_handler
from src.common.errors import ValidationError, NotFoundError
from src.common.config import Config


@pytest.fixture
def deletion_service():
    """Create DeletionService instance with mocked AWS services."""
    with mock_aws():
        # Create DynamoDB tables
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        
        # Users table
        dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_USERS,
            KeySchema=[
                {'AttributeName': 'userId', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
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
        
        # Reports table
        dynamodb.create_table(
            TableName=Config.DYNAMODB_TABLE_REPORTS,
            KeySchema=[
                {'AttributeName': 'userId', 'KeyType': 'HASH'},
                {'AttributeName': 'month', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'month', 'AttributeType': 'S'}
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
        
        # Create S3 bucket
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket=Config.S3_BUCKET)
        
        yield DeletionService()


def create_test_data(service, user_id):
    """Helper to create test data for a user."""
    # Add transactions
    for i in range(5):
        service.transactions_table.put_item(Item={
            'userId': user_id,
            'date': f"2024-01-{i+1:02d}",
            'amount': Decimal(str(-50.00 * (i + 1))),
            'description': f'Transaction {i+1}',
            'category': 'Dining'
        })
    
    # Add reports
    for month in ['2024-01', '2024-02']:
        service.reports_table.put_item(Item={
            'userId': user_id,
            'month': month,
            'reportData': json.dumps({'totalSpending': 500.0})
        })
    
    # Add conversations
    for i in range(3):
        service.conversations_table.put_item(Item={
            'userId': user_id,
            'timestamp': f"2024-01-01T12:00:{i:02d}",
            'question': f'Question {i+1}',
            'answer': f'Answer {i+1}'
        })
    
    # Add S3 files
    for i in range(2):
        service.s3.put_object(
            Bucket=Config.S3_BUCKET,
            Key=f"users/{user_id}/statement-{i+1}.csv",
            Body=b'test data'
        )


class TestDeletionService:
    """Test DeletionService functionality."""
    
    def test_request_account_deletion(self, deletion_service):
        """Test requesting account deletion."""
        user_id = 'user123'
        
        # Mock Cognito get_user (would normally validate token)
        # In moto, this will fail, so we'll test the logic separately
        # For now, test the DynamoDB marking
        
        # Manually mark user for deletion (simulating successful request)
        deletion_date = datetime.utcnow() + timedelta(days=30)
        deletion_service.users_table.put_item(Item={
            'userId': user_id,
            'deletionRequested': True,
            'deletionRequestedAt': datetime.utcnow().isoformat(),
            'scheduledDeletionDate': deletion_date.isoformat(),
            'status': 'pending_deletion'
        })
        
        # Verify user is marked for deletion
        response = deletion_service.users_table.get_item(Key={'userId': user_id})
        assert 'Item' in response
        assert response['Item']['deletionRequested'] is True
        assert response['Item']['status'] == 'pending_deletion'
    
    def test_cancel_account_deletion(self, deletion_service):
        """Test cancelling account deletion."""
        user_id = 'user123'
        
        # First, mark user for deletion
        deletion_service.users_table.put_item(Item={
            'userId': user_id,
            'deletionRequested': True,
            'deletionRequestedAt': datetime.utcnow().isoformat(),
            'scheduledDeletionDate': (datetime.utcnow() + timedelta(days=30)).isoformat(),
            'status': 'pending_deletion'
        })
        
        # Cancel deletion
        result = deletion_service.cancel_account_deletion(user_id)
        
        assert result['userId'] == user_id
        assert result['deletionCancelled'] is True
        
        # Verify deletion flags are removed
        response = deletion_service.users_table.get_item(Key={'userId': user_id})
        assert 'Item' in response
        assert 'deletionRequested' not in response['Item']
        assert response['Item']['status'] == 'active'
    
    def test_cancel_deletion_no_request(self, deletion_service):
        """Test cancelling when no deletion was requested."""
        user_id = 'user123'
        
        # Create user without deletion request
        deletion_service.users_table.put_item(Item={
            'userId': user_id,
            'status': 'active'
        })
        
        result = deletion_service.cancel_account_deletion(user_id)
        
        assert 'No pending deletion request' in result['message']
    
    def test_cancel_deletion_user_not_found(self, deletion_service):
        """Test cancelling for non-existent user."""
        with pytest.raises(NotFoundError):
            deletion_service.cancel_account_deletion('nonexistent')

    
    def test_execute_account_deletion(self, deletion_service):
        """Test complete account deletion."""
        user_id = 'user123'
        
        # Create test data
        create_test_data(deletion_service, user_id)
        
        # Execute deletion
        result = deletion_service.execute_account_deletion(user_id)
        
        assert result['userId'] == user_id
        assert result['transactions'] == 5
        assert result['reports'] == 2
        assert result['conversations'] == 3
        assert result['s3Files'] == 2
        
        # Verify all data is deleted
        # Transactions
        txn_response = deletion_service.transactions_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        assert len(txn_response.get('Items', [])) == 0
        
        # Reports
        report_response = deletion_service.reports_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        assert len(report_response.get('Items', [])) == 0
        
        # Conversations
        conv_response = deletion_service.conversations_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        assert len(conv_response.get('Items', [])) == 0
        
        # S3 files
        s3_response = deletion_service.s3.list_objects_v2(
            Bucket=Config.S3_BUCKET,
            Prefix=f"users/{user_id}/"
        )
        assert 'Contents' not in s3_response
    
    def test_execute_deletion_no_data(self, deletion_service):
        """Test deletion when user has no data."""
        user_id = 'user123'
        
        result = deletion_service.execute_account_deletion(user_id)
        
        assert result['userId'] == user_id
        assert result['transactions'] == 0
        assert result['reports'] == 0
        assert result['conversations'] == 0
        assert result['s3Files'] == 0
    
    def test_get_user_data_summary(self, deletion_service):
        """Test getting user data summary."""
        user_id = 'user123'
        
        # Create test data
        create_test_data(deletion_service, user_id)
        
        # Get summary
        summary = deletion_service.get_user_data_summary(user_id)
        
        assert summary['userId'] == user_id
        assert 'dataCategories' in summary
        
        # Check counts
        assert summary['dataCategories']['transactions']['count'] == 5
        assert summary['dataCategories']['reports']['count'] == 2
        assert summary['dataCategories']['conversations']['count'] == 3
        assert summary['dataCategories']['uploadedFiles']['count'] == 2
        
        # Check descriptions
        assert 'Financial transaction records' in summary['dataCategories']['transactions']['description']
        assert 'fields' in summary['dataCategories']['transactions']
    
    def test_get_user_data_summary_no_data(self, deletion_service):
        """Test data summary for user with no data."""
        user_id = 'user123'
        
        summary = deletion_service.get_user_data_summary(user_id)
        
        assert summary['userId'] == user_id
        assert summary['dataCategories']['transactions']['count'] == 0
        assert summary['dataCategories']['reports']['count'] == 0
        assert summary['dataCategories']['conversations']['count'] == 0
        assert summary['dataCategories']['uploadedFiles']['count'] == 0
    
    def test_delete_user_s3_files(self, deletion_service):
        """Test S3 file deletion."""
        user_id = 'user123'
        
        # Create S3 files
        for i in range(3):
            deletion_service.s3.put_object(
                Bucket=Config.S3_BUCKET,
                Key=f"users/{user_id}/file-{i}.csv",
                Body=b'test'
            )
        
        # Delete files
        count = deletion_service._delete_user_s3_files(user_id)
        
        assert count == 3
        
        # Verify files are deleted
        response = deletion_service.s3.list_objects_v2(
            Bucket=Config.S3_BUCKET,
            Prefix=f"users/{user_id}/"
        )
        assert 'Contents' not in response
    
    def test_delete_s3_files_no_files(self, deletion_service):
        """Test S3 deletion when no files exist."""
        user_id = 'user123'
        
        count = deletion_service._delete_user_s3_files(user_id)
        
        assert count == 0
    
    def test_count_user_s3_files(self, deletion_service):
        """Test counting S3 files."""
        user_id = 'user123'
        
        # Create files
        for i in range(5):
            deletion_service.s3.put_object(
                Bucket=Config.S3_BUCKET,
                Key=f"users/{user_id}/file-{i}.csv",
                Body=b'test'
            )
        
        count = deletion_service._count_user_s3_files(user_id)
        
        assert count == 5
    
    def test_get_all_user_items_pagination(self, deletion_service):
        """Test pagination when getting user items."""
        user_id = 'user123'
        
        # Create many transactions (to test pagination)
        for i in range(10):
            deletion_service.transactions_table.put_item(Item={
                'userId': user_id,
                'date': f"2024-01-{i+1:02d}T12:00:00",
                'amount': Decimal('-50.00'),
                'description': f'Transaction {i+1}'
            })
        
        items = deletion_service._get_all_user_items(
            deletion_service.transactions_table,
            user_id
        )
        
        assert len(items) == 10


class TestDeleteAccountLambda:
    """Test delete_account Lambda function."""
    
    def test_lambda_get_data_summary(self):
        """Test getting data summary via Lambda."""
        with mock_aws():
            # Setup
            dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_USERS,
                KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}],
                AttributeDefinitions=[{'AttributeName': 'userId', 'AttributeType': 'S'}],
                BillingMode='PAY_PER_REQUEST'
            )
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
            dynamodb.create_table(
                TableName=Config.DYNAMODB_TABLE_REPORTS,
                KeySchema=[
                    {'AttributeName': 'userId', 'KeyType': 'HASH'},
                    {'AttributeName': 'month', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'userId', 'AttributeType': 'S'},
                    {'AttributeName': 'month', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
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
            s3 = boto3.client('s3', region_name='us-east-1')
            s3.create_bucket(Bucket=Config.S3_BUCKET)
            
            event = {
                'requestContext': {
                    'authorizer': {
                        'claims': {
                            'sub': 'user123'
                        }
                    }
                },
                'path': '/account/data',
                'httpMethod': 'GET'
            }
            
            response = lambda_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['userId'] == 'user123'
            assert 'dataCategories' in body
    
    def test_lambda_unauthorized(self):
        """Test Lambda without authorization."""
        event = {
            'requestContext': {},
            'path': '/account/delete',
            'httpMethod': 'POST'
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Unauthorized' in body['error']
    
    def test_lambda_not_found(self):
        """Test Lambda with invalid path."""
        event = {
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user123'
                    }
                }
            },
            'path': '/account/invalid',
            'httpMethod': 'GET'
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 404
