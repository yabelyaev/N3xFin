"""
Lambda function for submitting anomaly feedback.
"""

import json
from typing import Dict, Any

from analytics.analytics_service import AnalyticsService
from common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle anomaly feedback submission.
    
    Request body:
        - transactionId: Transaction identifier
        - isLegitimate: Boolean indicating if transaction is legitimate
        - notes: Optional user notes
    """
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        transaction_id = body.get('transactionId')
        is_legitimate = body.get('isLegitimate')
        notes = body.get('notes')
        
        # Validate required fields
        if not transaction_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'transactionId is required'})
            }
        
        if is_legitimate is None:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'isLegitimate is required'})
            }
        
        # Store feedback
        service = AnalyticsService()
        result = service.store_anomaly_feedback(user_id, transaction_id, is_legitimate, notes)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in submit_anomaly_feedback: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
