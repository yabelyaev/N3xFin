"""
Lambda function for retrieving spending predictions.
"""

import json
from typing import Dict, Any

from src.prediction.prediction_service import PredictionService
from src.common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle prediction requests.
    
    Query parameters:
        - category: Category to predict (optional, if omitted returns all categories)
        - horizon: Number of days to predict (optional, default 30)
    """
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Parse query parameters
        params = event.get('queryStringParameters') or {}
        category = params.get('category')
        horizon = int(params.get('horizon', 30))
        
        # Validate horizon
        if horizon < 1 or horizon > 365:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Horizon must be between 1 and 365 days'})
            }
        
        # Initialize service
        service = PredictionService()
        
        if category:
            # Single category prediction
            prediction = service.predict_spending(user_id, category, horizon)
            data = prediction
        else:
            # Predict for all categories (common categories)
            categories = ['Dining', 'Transportation', 'Utilities', 'Entertainment', 
                         'Shopping', 'Healthcare', 'Housing']
            predictions = []
            for cat in categories:
                pred = service.predict_spending(user_id, cat, horizon)
                if pred['confidence'] > 0:  # Only include if we have data
                    predictions.append(pred)
            data = predictions
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'predictions': data if isinstance(data, list) else [data],
                'horizon': horizon
            })
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in get_predictions: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
