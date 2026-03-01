"""Lambda function to verify file upload."""
import json
import uuid
from typing import Dict, Any
from upload.upload_service import UploadService
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Verify that file was successfully uploaded.
    
    Expected event body:
    {
        "fileKey": "users/user-123/statements/20240220-abc123-statement.csv"
    }
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Log the incoming event for debugging (safely)
        print(f'Verify upload called for user')
        
        # Extract user ID from authorizer context
        authorizer_context = event.get('requestContext', {}).get('authorizer', {})
        user_id = authorizer_context.get('claims', {}).get('sub')
        
        print(f'Extracted user_id: {user_id}')
        
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
        
        print(f'Parsed body: {body}')
        print(f'File key: {file_key}')
        
        if not file_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'MISSING_FIELDS',
                        'message': 'fileKey is required',
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
        
        # Verify upload
        upload_service = UploadService()
        result = upload_service.verify_upload(file_key)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 400)
    
    except Exception as e:
        print(f'Unexpected error in verify_upload: {str(e)}')
        return create_error_response(e, request_id, 500)
