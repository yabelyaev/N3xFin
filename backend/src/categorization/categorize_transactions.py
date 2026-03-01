"""Lambda function to categorize transactions using AI."""
import json
import uuid
from typing import Dict, Any
from categorization.categorization_service import CategorizationService
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Categorize user's uncategorized transactions.
    
    Query parameters:
    - limit: Maximum number of transactions to process (default 100)
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())
    
    try:
        # Extract user ID from authorizer context
        authorizer_context = event.get('requestContext', {}).get('authorizer', {})
        user_id = authorizer_context.get('claims', {}).get('sub')
        
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': {
                        'code': 'UNAUTHORIZED',
                        'message': 'User authentication required',
                        'requestId': request_id
                    }
                })
            }
        
        # Get parameters from either body or query params
        query_params = event.get('queryStringParameters') or {}
        body = {}
        try:
            if event.get('body'):
                body = json.loads(event['body'])
        except Exception:
            pass
            
        transaction_ids = body.get('transactionIds')
        limit = int(body.get('limit') or query_params.get('limit', 100))
        
        # Categorize transactions
        categorization_service = CategorizationService()
        
        if transaction_ids:
            result = categorization_service.categorize_transactions_by_id(user_id, transaction_ids)
        else:
            result = categorization_service.categorize_user_transactions(user_id, limit)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
        
    except N3xFinError as e:
        return create_error_response(e, request_id, 400)
    
    except Exception as e:
        print(f'Unexpected error in categorize_transactions: {str(e)}')
        import traceback
        traceback.print_exc()
        return create_error_response(e, request_id, 500)
