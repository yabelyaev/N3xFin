"""
Lambda function for retrieving spending alerts.
"""

import json
from typing import Dict, Any

from src.prediction.prediction_service import PredictionService
from src.common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle alert requests.
    
    Generates alerts for categories where predicted spending exceeds thresholds.
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
        service = PredictionService()
        
        # Generate alerts
        alerts = service.generate_alerts(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'alerts': alerts,
                'count': len(alerts)
            })
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in get_alerts: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
