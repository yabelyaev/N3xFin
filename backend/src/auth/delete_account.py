"""
Lambda function for requesting account deletion.
"""

import json
from typing import Dict, Any

from src.auth.deletion_service import DeletionService
from src.common.errors import ValidationError, NotFoundError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle account deletion requests.
    
    POST /account/delete - Request account deletion
    POST /account/delete/cancel - Cancel deletion request
    POST /account/delete/execute - Execute deletion (admin only)
    GET /account/data - Get user data summary
    """
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Get access token from headers
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization') or headers.get('authorization', '')
        access_token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else ''
        
        # Determine action from path
        path = event.get('path', '')
        http_method = event.get('httpMethod', '')
        
        service = DeletionService()
        
        # Request account deletion
        if http_method == 'POST' and path.endswith('/delete') and not path.endswith('/cancel') and not path.endswith('/execute'):
            result = service.request_account_deletion(user_id, access_token)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result)
            }
        
        # Cancel deletion request
        elif http_method == 'POST' and path.endswith('/delete/cancel'):
            result = service.cancel_account_deletion(user_id)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result)
            }
        
        # Execute deletion (typically called by scheduled job, not directly by user)
        elif http_method == 'POST' and path.endswith('/delete/execute'):
            # In production, this should be restricted to admin/system role
            result = service.execute_account_deletion(user_id)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result)
            }
        
        # Get user data summary
        elif http_method == 'GET' and path.endswith('/data'):
            result = service.get_user_data_summary(user_id)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result)
            }
        
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Not found'})
            }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except NotFoundError as e:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in delete_account: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
