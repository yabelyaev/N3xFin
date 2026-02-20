"""
Lambda function for retrieving analytics data.
"""

import json
from datetime import datetime, timedelta
from typing import Dict, Any

from src.analytics.analytics_service import AnalyticsService
from src.common.errors import ValidationError, NotFoundError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle analytics requests.
    
    Query parameters:
        - type: 'category' | 'timeseries' | 'anomalies' | 'trends'
        - startDate: ISO format date (optional, defaults to 30 days ago)
        - endDate: ISO format date (optional, defaults to now)
        - granularity: 'day' | 'week' | 'month' (for timeseries)
        - category: category name (for trends)
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
        analytics_type = params.get('type', 'category')
        
        # Parse date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        if 'startDate' in params:
            try:
                start_date = datetime.fromisoformat(params['startDate'].replace('Z', '+00:00'))
            except ValueError:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Invalid startDate format. Use ISO 8601.'})
                }
        
        if 'endDate' in params:
            try:
                end_date = datetime.fromisoformat(params['endDate'].replace('Z', '+00:00'))
            except ValueError:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Invalid endDate format. Use ISO 8601.'})
                }
        
        # Validate date range
        if start_date >= end_date:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'startDate must be before endDate'})
            }
        
        # Initialize service
        service = AnalyticsService()
        
        # Route to appropriate method
        if analytics_type == 'category':
            data = service.get_spending_by_category(user_id, start_date, end_date)
        
        elif analytics_type == 'timeseries':
            granularity = params.get('granularity', 'day')
            data = service.get_spending_over_time(user_id, start_date, end_date, granularity)
        
        elif analytics_type == 'anomalies':
            data = service.detect_anomalies(user_id)
        
        elif analytics_type == 'trends':
            category = params.get('category')
            data = service.calculate_trends(user_id, category)
        
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': f'Invalid analytics type: {analytics_type}',
                    'validTypes': ['category', 'timeseries', 'anomalies', 'trends']
                })
            }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'type': analytics_type,
                'data': data,
                'dateRange': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            })
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except NotFoundError as e:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': str(e)})
        }
    
    except Exception as e:
        print(f"Error in get_analytics: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
