"""Configuration management for N3xFin."""
import os


class Config:
    """Application configuration."""
    
    # DynamoDB Tables
    DYNAMODB_TABLE_USERS = os.environ.get('DYNAMODB_TABLE_USERS', 'n3xfin-users')
    DYNAMODB_TABLE_TRANSACTIONS = os.environ.get('DYNAMODB_TABLE_TRANSACTIONS', 'n3xfin-transactions')
    DYNAMODB_TABLE_REPORTS = os.environ.get('DYNAMODB_TABLE_REPORTS', 'n3xfin-reports')
    DYNAMODB_TABLE_CONVERSATIONS = os.environ.get('DYNAMODB_TABLE_CONVERSATIONS', 'n3xfin-conversations')
    
    # S3
    S3_BUCKET = os.environ.get('S3_BUCKET', 'n3xfin-data')
    
    # Cognito
    COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID', '')
    COGNITO_CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID', '')
    
    # File Upload
    MAX_FILE_SIZE_MB = 10
    MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
    ALLOWED_FILE_TYPES = ['csv', 'pdf']
    
    # Authentication
    PASSWORD_MIN_LENGTH = 12
    SESSION_TIMEOUT_MINUTES = 30
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15
    
    # Analytics
    ANOMALY_THRESHOLD_STD_DEV = 2.5
    MIN_HISTORICAL_DAYS = 30
    ALERT_THRESHOLD_PERCENTAGE = 120
    
    # AI/Bedrock
    BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    BEDROCK_REGION = os.environ.get('AWS_REGION', 'us-east-1')
    CATEGORY_CONFIDENCE_THRESHOLD = 0.7
    MAX_CONVERSATION_HISTORY = 10
    CONVERSATION_TIMEOUT_SECONDS = 5
    
    # Batch Processing
    CATEGORIZATION_BATCH_SIZE = 50


config = Config()
