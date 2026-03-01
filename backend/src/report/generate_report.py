"""
Lambda function for generating monthly reports.
"""

import json
from datetime import datetime, UTC
from typing import Dict, Any

from report.report_service import ReportService
from common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle report generation requests.
    
    Query parameters:
        - year: Report year (optional, defaults to current year)
        - month: Report month 1-12 (optional, defaults to current month)
    """
    try:
        # Extract user ID from authorizer context
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        # Parse parameters from either body or query params
        query_params = event.get('queryStringParameters') or {}
        body = {}
        try:
            if event.get('body'):
                body = json.loads(event['body'])
        except Exception:
            pass
            
        # Default to current month if not specified
        now = datetime.now(UTC)
        year = int(body.get('year') or query_params.get('year', now.year))
        month = int(body.get('month') or query_params.get('month', now.month))
        
        # Initialize service
        service = ReportService()
        
        # Generate report
        report = service.generate_monthly_report(user_id, year, month)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(report)
        }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    
    except ValueError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid year or month parameter'})
        }
    
    except Exception as e:
        print(f"Error in generate_report: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
