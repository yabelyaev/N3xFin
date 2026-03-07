"""
Lambda handler for saving user profile
"""
import json
from common.errors import handle_errors
from auth.auth_service import AuthService
from profile.profile_service import ProfileService


@handle_errors
def lambda_handler(event, context):
    """Save or update user profile"""
    
    # Authenticate user
    user_id = AuthService.authenticate_request(event)
    
    # Parse request body
    body = json.loads(event.get('body', '{}'))
    
    # Validate required fields
    if not isinstance(body, dict):
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps({'error': 'Invalid request body'})
        }
    
    # Save profile
    profile = ProfileService.save_profile(user_id, body)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(profile)
    }
