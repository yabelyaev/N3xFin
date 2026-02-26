"""
Account Deletion Service for N3xFin

Handles secure account deletion with 30-day grace period and complete data removal.
"""

from datetime import datetime, timedelta
from typing import Dict, List
import boto3
from boto3.dynamodb.conditions import Key
import json

from common.config import Config
from common.errors import ValidationError, NotFoundError


class DeletionService:
    """Service for managing account deletion and data privacy."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.cognito = boto3.client('cognito-idp', region_name=Config.BEDROCK_REGION)
        self.s3 = boto3.client('s3')
        
        # DynamoDB tables
        self.users_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_USERS)
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.reports_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_REPORTS)
        self.conversations_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_CONVERSATIONS)
    
    def request_account_deletion(self, user_id: str, access_token: str) -> Dict:
        """
        Request account deletion with 30-day grace period.
        
        Args:
            user_id: User identifier
            access_token: User's access token for verification
            
        Returns:
            Deletion request details with scheduled deletion date
        """
        # Verify user exists in Cognito
        try:
            self.cognito.get_user(AccessToken=access_token)
        except Exception as e:
            raise ValidationError(f"Invalid user or token: {str(e)}")
        
        # Calculate deletion date (30 days from now)
        deletion_date = datetime.utcnow() + timedelta(days=30)
        
        # Mark user for deletion in DynamoDB
        try:
            self.users_table.put_item(
                Item={
                    'userId': user_id,
                    'deletionRequested': True,
                    'deletionRequestedAt': datetime.utcnow().isoformat(),
                    'scheduledDeletionDate': deletion_date.isoformat(),
                    'status': 'pending_deletion'
                }
            )
        except Exception as e:
            print(f"Error marking user for deletion: {str(e)}")
            # Continue even if this fails
        
        return {
            'userId': user_id,
            'deletionRequested': True,
            'scheduledDeletionDate': deletion_date.isoformat(),
            'gracePeriodDays': 30,
            'message': 'Account deletion scheduled. You have 30 days to cancel this request.'
        }
    
    def cancel_account_deletion(self, user_id: str) -> Dict:
        """
        Cancel a pending account deletion request.
        
        Args:
            user_id: User identifier
            
        Returns:
            Cancellation confirmation
        """
        try:
            # Check if deletion was requested
            response = self.users_table.get_item(Key={'userId': user_id})
            
            if 'Item' not in response:
                raise NotFoundError(f"User {user_id} not found")
            
            user = response['Item']
            
            if not user.get('deletionRequested'):
                return {
                    'userId': user_id,
                    'message': 'No pending deletion request found'
                }
            
            # Cancel deletion
            self.users_table.update_item(
                Key={'userId': user_id},
                UpdateExpression='SET #status = :status REMOVE deletionRequested, deletionRequestedAt, scheduledDeletionDate',
                ExpressionAttributeNames={
                    '#status': 'status'
                },
                ExpressionAttributeValues={
                    ':status': 'active'
                }
            )
            
            return {
                'userId': user_id,
                'deletionCancelled': True,
                'message': 'Account deletion request cancelled successfully'
            }
            
        except Exception as e:
            print(f"Error cancelling deletion: {str(e)}")
            raise
    
    def execute_account_deletion(self, user_id: str) -> Dict:
        """
        Execute complete account deletion (called after grace period).
        
        Args:
            user_id: User identifier
            
        Returns:
            Deletion summary with counts of deleted items
        """
        deletion_summary = {
            'userId': user_id,
            'deletedAt': datetime.utcnow().isoformat(),
            'transactions': 0,
            'reports': 0,
            'conversations': 0,
            's3Files': 0,
            'cognitoUser': False
        }
        
        # 1. Delete all transactions
        try:
            transactions = self._get_all_user_items(self.transactions_table, user_id)
            for txn in transactions:
                self.transactions_table.delete_item(
                    Key={'userId': user_id, 'date': txn['date']}
                )
            deletion_summary['transactions'] = len(transactions)
        except Exception as e:
            print(f"Error deleting transactions: {str(e)}")
        
        # 2. Delete all reports
        try:
            reports = self._get_all_user_items(self.reports_table, user_id)
            for report in reports:
                self.reports_table.delete_item(
                    Key={'userId': user_id, 'month': report['month']}
                )
            deletion_summary['reports'] = len(reports)
        except Exception as e:
            print(f"Error deleting reports: {str(e)}")
        
        # 3. Delete all conversations
        try:
            conversations = self._get_all_user_items(self.conversations_table, user_id)
            for conv in conversations:
                self.conversations_table.delete_item(
                    Key={'userId': user_id, 'timestamp': conv['timestamp']}
                )
            deletion_summary['conversations'] = len(conversations)
        except Exception as e:
            print(f"Error deleting conversations: {str(e)}")
        
        # 4. Delete all S3 files
        try:
            file_count = self._delete_user_s3_files(user_id)
            deletion_summary['s3Files'] = file_count
        except Exception as e:
            print(f"Error deleting S3 files: {str(e)}")
        
        # 5. Delete user from Cognito
        try:
            # Admin delete user (requires admin credentials)
            self.cognito.admin_delete_user(
                UserPoolId=Config.COGNITO_USER_POOL_ID,
                Username=user_id
            )
            deletion_summary['cognitoUser'] = True
        except Exception as e:
            print(f"Error deleting Cognito user: {str(e)}")
        
        # 6. Delete user record from users table
        try:
            self.users_table.delete_item(Key={'userId': user_id})
        except Exception as e:
            print(f"Error deleting user record: {str(e)}")
        
        return deletion_summary
    
    def get_user_data_summary(self, user_id: str) -> Dict:
        """
        Get summary of all user data (for transparency/GDPR compliance).
        
        Args:
            user_id: User identifier
            
        Returns:
            Summary of all stored user data
        """
        summary = {
            'userId': user_id,
            'dataCategories': {}
        }
        
        # Count transactions
        try:
            transactions = self._get_all_user_items(self.transactions_table, user_id)
            summary['dataCategories']['transactions'] = {
                'count': len(transactions),
                'description': 'Financial transaction records',
                'fields': ['date', 'amount', 'description', 'category']
            }
        except Exception as e:
            print(f"Error counting transactions: {str(e)}")
            summary['dataCategories']['transactions'] = {'count': 0, 'error': str(e)}
        
        # Count reports
        try:
            reports = self._get_all_user_items(self.reports_table, user_id)
            summary['dataCategories']['reports'] = {
                'count': len(reports),
                'description': 'Monthly financial reports',
                'fields': ['month', 'totalSpending', 'totalIncome', 'insights']
            }
        except Exception as e:
            print(f"Error counting reports: {str(e)}")
            summary['dataCategories']['reports'] = {'count': 0, 'error': str(e)}
        
        # Count conversations
        try:
            conversations = self._get_all_user_items(self.conversations_table, user_id)
            summary['dataCategories']['conversations'] = {
                'count': len(conversations),
                'description': 'AI conversation history',
                'fields': ['question', 'answer', 'timestamp']
            }
        except Exception as e:
            print(f"Error counting conversations: {str(e)}")
            summary['dataCategories']['conversations'] = {'count': 0, 'error': str(e)}
        
        # Count S3 files
        try:
            file_count = self._count_user_s3_files(user_id)
            summary['dataCategories']['uploadedFiles'] = {
                'count': file_count,
                'description': 'Uploaded bank statements',
                'fields': ['filename', 'uploadDate', 'fileSize']
            }
        except Exception as e:
            print(f"Error counting S3 files: {str(e)}")
            summary['dataCategories']['uploadedFiles'] = {'count': 0, 'error': str(e)}
        
        return summary
    
    def _get_all_user_items(self, table, user_id: str) -> List[Dict]:
        """Query all items for a user from a DynamoDB table."""
        items = []
        
        try:
            response = table.query(
                KeyConditionExpression=Key('userId').eq(user_id)
            )
            items.extend(response.get('Items', []))
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = table.query(
                    KeyConditionExpression=Key('userId').eq(user_id),
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                items.extend(response.get('Items', []))
        except Exception as e:
            print(f"Error querying table: {str(e)}")
        
        return items
    
    def _delete_user_s3_files(self, user_id: str) -> int:
        """Delete all S3 files for a user."""
        prefix = f"users/{user_id}/"
        deleted_count = 0
        
        try:
            # List all objects with user prefix
            paginator = self.s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=Config.S3_BUCKET,
                Prefix=prefix
            )
            
            for page in pages:
                if 'Contents' not in page:
                    continue
                
                # Delete objects in batches
                objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
                
                if objects_to_delete:
                    self.s3.delete_objects(
                        Bucket=Config.S3_BUCKET,
                        Delete={'Objects': objects_to_delete}
                    )
                    deleted_count += len(objects_to_delete)
        
        except Exception as e:
            print(f"Error deleting S3 files: {str(e)}")
        
        return deleted_count
    
    def _count_user_s3_files(self, user_id: str) -> int:
        """Count S3 files for a user."""
        prefix = f"users/{user_id}/"
        count = 0
        
        try:
            paginator = self.s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=Config.S3_BUCKET,
                Prefix=prefix
            )
            
            for page in pages:
                count += len(page.get('Contents', []))
        
        except Exception as e:
            print(f"Error counting S3 files: {str(e)}")
        
        return count
