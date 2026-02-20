"""Lambda function to parse uploaded bank statements."""
import json
import uuid
from typing import Dict, Any
from .parser_service import ParserService
from ..common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Parse uploaded bank statement and store transactions.
    
    Expected event body:
    {
        "fileKey": "users/user-123/statements/file.csv",
        "bucket": "n3xfin-data"
    }
    
    Or triggered by S3 event:
    {
        "Records": [{
            "s3": {
                "bucket": {"name": "n3xfin-data"},
                "object": {"key": "users/user-123/statements/file.csv"}
            }
        }]
    }
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Check if this is an S3 event or API call
        if 'Records' in event:
            # S3 event trigger
            record = event['Records'][0]
            bucket = record['s3']['bucket']['name']
            file_key = record['s3']['object']['key']
        else:
            # API call
            # Extract user ID from authorizer context
            authorizer_context = event.get('requestContext', {}).get('authorizer', {})
            user_id = authorizer_context.get('claims', {}).get('sub')
            
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': {
                            'code': 'UNAUTHORIZED',
                            'message': 'User authentication required',
                            'requestId': request_id
                        }
                    })
                }
            
            # Parse request body
            body = json.loads(event.get('body', '{}'))
            file_key = body.get('fileKey')
            bucket = body.get('bucket')
            
            if not file_key or not bucket:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': {
                            'code': 'MISSING_FIELDS',
                            'message': 'fileKey and bucket are required',
                            'requestId': request_id
                        }
                    })
                }
            
            # Verify file belongs to user
            if not file_key.startswith(f'users/{user_id}/'):
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': {
                            'code': 'FORBIDDEN',
                            'message': 'Access denied to this file',
                            'requestId': request_id
                        }
                    })
                }
        
        # Extract user ID from file key
        user_id = file_key.split('/')[1]
        
        # Determine file type
        file_extension = file_key.lower().split('.')[-1]
        
        # Parse file
        parser_service = ParserService()
        
        if file_extension == 'csv':
            transactions = parser_service.parse_csv(bucket, file_key, user_id)
        elif file_extension == 'pdf':
            return {
                'statusCode': 501,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'NOT_IMPLEMENTED',
                        'message': 'PDF parsing not yet implemented',
                        'requestId': request_id
                    }
                })
            }
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'INVALID_FILE_TYPE',
                        'message': f'Unsupported file type: {file_extension}',
                        'requestId': request_id
                    }
                })
            }
        
        # Filter duplicates
        unique_transactions = parser_service.detect_duplicates(transactions, user_id)
        
        # Store transactions
        stored_count = parser_service.store_transactions(unique_transactions)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Statement parsed successfully',
                'totalTransactions': len(transactions),
                'uniqueTransactions': len(unique_transactions),
                'storedTransactions': stored_count,
                'duplicatesSkipped': len(transactions) - len(unique_transactions)
            })
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 400)
    
    except Exception as e:
        print(f'Unexpected error in parse_statement: {str(e)}')
        import traceback
        traceback.print_exc()
        return create_error_response(e, request_id, 500)
