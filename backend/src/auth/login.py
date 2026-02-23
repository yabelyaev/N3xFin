"""Lambda function for user login."""
import json
import uuid
from typing import Dict, Any
from auth.auth_service import AuthService
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle user login requests.
    
    Expected event body:
    {
        "email": "user@example.com",
        "password": "SecurePassword123!"
    }
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        email = body.get('email')
        password = body.get('password')
        
        if not email or not password:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'MISSING_FIELDS',
                        'message': 'Email and password are required',
                        'requestId': request_id
                    }
                })
            }
        
        # Authenticate user
        auth_service = AuthService()
        result = auth_service.login(email, password)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 401)
    
    except Exception as e:
        print(f'Unexpected error in login: {str(e)}')
        return create_error_response(e, request_id, 500)
