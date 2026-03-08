"""Lambda function to get categorization status."""
import json
from typing import Dict, Any
from boto3.dynamodb.conditions import Key, Attr
import boto3
from common.config import Config


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Get categorization status for a user.
    
    Returns:
        - totalTransactions: Total number of transactions
        - categorizedTransactions: Number of categorized transactions
        - uncategorizedTransactions: Number of uncategorized transactions
        - percentageCategorized: Percentage of transactions categorized
    """
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
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Query DynamoDB for transaction counts
        dynamodb = boto3.resource('dynamodb')
        transactions_table = dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        
        # Count total transactions
        total_response = transactions_table.query(
            KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') & Key('SK').begins_with('TRANSACTION#'),
            Select='COUNT'
        )
        total_count = total_response.get('Count', 0)
        
        # Count uncategorized transactions
        uncategorized_response = transactions_table.query(
            KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') & Key('SK').begins_with('TRANSACTION#'),
            FilterExpression=Attr('category').not_exists() | Attr('category').eq('Uncategorized'),
            Select='COUNT'
        )
        uncategorized_count = uncategorized_response.get('Count', 0)
        
        categorized_count = total_count - uncategorized_count
        percentage = (categorized_count / total_count * 100) if total_count > 0 else 100
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'totalTransactions': total_count,
                'categorizedTransactions': categorized_count,
                'uncategorizedTransactions': uncategorized_count,
                'percentageCategorized': round(percentage, 1),
                'isComplete': uncategorized_count == 0
            })
        }
        
    except Exception as e:
        print(f'Error getting categorization status: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }
