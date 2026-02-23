"""Lambda function to generate presigned upload URL."""
import json
import uuid
from typing import Dict, Any
from upload.upload_service import UploadService
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Generate presigned URL for file upload.
    
    Expected event body:
    {
        "filename": "statement.csv",
        "fileSize": 1024000
    }
    
    Expected headers:
    {
        "Authorization": "Bearer <access_token>"
    }
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Extract user ID from authorizer context (set by API Gateway Cognito authorizer)
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
        filename = body.get('filename')
        file_size = body.get('fileSize')
        
        if not filename or not file_size:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'MISSING_FIELDS',
                        'message': 'Filename and fileSize are required',
                        'requestId': request_id
                    }
                })
            }
        
        # Generate upload URL
        upload_service = UploadService()
        result = upload_service.generate_upload_url(user_id, filename, file_size)
        
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
        print(f'Unexpected error in get_upload_url: {str(e)}')
        return create_error_response(e, request_id, 500)
