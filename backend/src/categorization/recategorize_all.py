"""
Lambda function to recategorize all existing transactions for a user.
This is used when category definitions change.
"""

import json
from typing import Dict, Any
from categorization.categorization_service import CategorizationService
from common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Recategorize all transactions for a user.
    
    Query parameters:
        - userId: User ID (required)
        - limit: Maximum transactions to process per invocation (default: 100)
    """
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
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
        limit = int(body.get('limit', 100))
        
        if limit < 1 or limit > 500:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Limit must be between 1 and 500'})
            }
        
        # Initialize service
        service = CategorizationService()
        
        # Recategorize all transactions
        result = service.recategorize_all_transactions(user_id, limit)
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(result)
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in recategorize_all: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Internal server error'})
        }
