"""
Lambda handler for getting user profile
"""
import json
from profile.profile_service import ProfileService


def lambda_handler(event, context):
    """Get user profile and goals"""
    
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
        
        # Get profile
        profile = ProfileService.get_profile(user_id)
        
        if profile is None:
            # Return empty profile structure
            profile = {
                'occupation': '',
                'currency': 'USD',
                'income_sources': [],
                'goals': [],
                'debts': [],
                'fixed_expenses': {}
            }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(profile)
        }
    except Exception as e:
        print(f"Error in get_profile: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
