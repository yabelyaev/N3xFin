"""
Lambda handler for saving user profile
"""
import json
from profile.profile_service import ProfileService


def lambda_handler(event, context):
    """Save or update user profile"""
    
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        if not isinstance(body, dict):
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Invalid request body'})
            }
        
        # Save profile
        profile = ProfileService.save_profile(user_id, body)
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(profile)
        }
    except Exception as e:
        print(f"Error in save_profile: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
