"""
Lambda function for retrieving savings recommendations.
"""

import json
from typing import Dict, Any

from src.recommendation.recommendation_service import RecommendationService
from src.common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle recommendation requests.
    
    Generates personalized savings recommendations based on spending patterns.
    """
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Initialize service
        service = RecommendationService()
        
        # Generate recommendations
        recommendations = service.generate_recommendations(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'recommendations': recommendations,
                'count': len(recommendations)
            })
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in get_recommendations: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
