"""Lambda function for user registration."""
import json
import uuid
from typing import Dict, Any
from .auth_service import AuthService
from ..common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle user registration requests.
    
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
        
        # Register user
        auth_service = AuthService()
        result = auth_service.register(email, password)
        
        return {
            'statusCode': 201,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except N3xFinError as e:
        status_code = 400 if e.code == 'VALIDATION_ERROR' else 401
        return create_error_response(e, request_id, status_code)
    
    except Exception as e:
        print(f'Unexpected error in registration: {str(e)}')
        return create_error_response(e, request_id, 500)
