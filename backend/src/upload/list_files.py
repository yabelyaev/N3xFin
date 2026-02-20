"""Lambda function to list user's uploaded files."""
import json
import uuid
from typing import Dict, Any
from .upload_service import UploadService
from ..common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    List all files uploaded by the user.
    
    Query parameters:
    - maxFiles: Maximum number of files to return (default 100)
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
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
        
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        max_files = int(query_params.get('maxFiles', 100))
        
        # List files
        upload_service = UploadService()
        files = upload_service.list_user_files(user_id, max_files)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'files': files,
                'count': len(files)
            })
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 400)
    
    except Exception as e:
        print(f'Unexpected error in list_files: {str(e)}')
        return create_error_response(e, request_id, 500)
