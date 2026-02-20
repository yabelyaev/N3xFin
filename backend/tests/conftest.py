"""Pytest configuration and fixtures."""
import pytest
import boto3
from moto import mock_aws
import os


@pytest.fixture
def aws_credentials():
    """Mock AWS credentials for testing."""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'


@pytest.fixture
def dynamodb_client(aws_credentials):
    """Create mock DynamoDB client."""
    with mock_aws():
        yield boto3.client('dynamodb', region_name='us-east-1')


@pytest.fixture
def s3_client(aws_credentials):
    """Create mock S3 client."""
    with mock_aws():
        yield boto3.client('s3', region_name='us-east-1')


@pytest.fixture
def cognito_client(aws_credentials):
    """Create mock Cognito client."""
    with mock_aws():
        yield boto3.client('cognito-idp', region_name='us-east-1')
