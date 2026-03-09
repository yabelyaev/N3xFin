"""
Lambda function for generating and listing monthly reports.
"""

import json
from datetime import datetime, UTC
from typing import Dict, Any

from report.report_service import ReportService
from common.errors import ValidationError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle report generation and listing requests.

    GET  ?action=list          — list all reports + months with data
    GET  /reports/{reportId}   — get a specific report by ID
    POST ?year=YYYY&month=M    — generate (or regenerate) a specific month's report
    GET  (default)             — generate for current month
    """
    try:
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return {'statusCode': 401, 'body': json.dumps({'error': 'Unauthorized'})}

        http_method = event.get('httpMethod', 'GET')
        query_params = event.get('queryStringParameters') or {}
        action = query_params.get('action', '')
        path_params = event.get('pathParameters') or {}

        service = ReportService()

        # ── Get specific report by ID ─────────────────────────────────────
        if path_params.get('reportId'):
            report_id = path_params['reportId']
            
            # DELETE request - delete the report
            if http_method == 'DELETE':
                success = service.delete_report(user_id, report_id)
                if not success:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'body': json.dumps({'error': 'Report not found or could not be deleted'})
                    }
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'message': 'Report deleted successfully'})
                }
            
            # GET request - get the report
            report = service.get_report_by_id(user_id, report_id)
            if not report:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Report not found'})
                }
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(report)
            }

        # ── List all reports + available months ──────────────────────────
        if action == 'list':
            existing_reports = service.list_reports(user_id)
            months_with_data = service.get_months_with_data(user_id)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'reports': existing_reports,
                    'monthsWithData': months_with_data
                })
            }

        # ── Generate / refresh a report ───────────────────────────────────
        body = {}
        try:
            if event.get('body'):
                body = json.loads(event['body'])
        except Exception:
            pass

        now = datetime.now(UTC)
        year = int(body.get('year') or query_params.get('year', now.year))
        month = int(body.get('month') or query_params.get('month', now.month))

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
        return {'statusCode': 400, 'body': json.dumps({'error': str(e)})}
    except ValueError:
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid year or month parameter'})}
    except Exception as e:
        print(f"Error in generate_report: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal server error'})}
