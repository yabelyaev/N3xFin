"""
Lambda handler for getting user profile
"""
import json
from auth.auth_service import AuthService
from profile.profile_service import ProfileService


def lambda_handler(event, context):
    """Get user profile and goals"""
    
    try:
        # Authenticate user
        user_id = AuthService.authenticate_request(event)
        
        # Get profile
        profile = ProfileService.get_profile(user_id)
        
        if profile is None:
            # Return empty profile structure
            profile = {
                'occupation': '',
                'income_sources': [],
                'goals': [],
                'debts': [],
                'fixed_expenses': {}
            }
        
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
    except Exception as e:
        print(f"Error in get_profile: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps({'error': str(e)})
        }
