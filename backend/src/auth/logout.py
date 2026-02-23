"""Lambda function for user logout."""
import json
import uuid
from typing import Dict, Any
from auth.auth_service import AuthService
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle user logout (invalidate tokens).
    
    Expected headers:
    {
        "Authorization": "Bearer <access_token>"
    }
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Extract token from Authorization header
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization') or headers.get('authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'MISSING_TOKEN',
                        'message': 'Authorization header with Bearer token required',
                        'requestId': request_id
                    }
                })
            }
        
        access_token = auth_header.split(' ')[1]
        
        # Logout user
        auth_service = AuthService()
        auth_service.logout(access_token)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Logged out successfully'
            })
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 401)
    
    except Exception as e:
        print(f'Unexpected error in logout: {str(e)}')
        return create_error_response(e, request_id, 500)
