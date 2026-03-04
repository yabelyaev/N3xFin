"""Lambda function to delete uploaded statements and their transactions."""
import json
import uuid
from typing import Dict, Any
from upload.upload_service import UploadService
from common.errors import create_error_response, N3xFinError, ValidationError

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Delete a statement (or all statements) and all associated transactions.

    Query parameters:
    - fileKey: S3 key of the statement to delete (single delete)
    - all: 'true' to delete all statements for the user
    """
    request_id = context.request_id if hasattr(context, 'request_id') else str(uuid.uuid4())

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        user_id = (event.get('requestContext', {})
                      .get('authorizer', {})
                      .get('claims', {})
                      .get('sub'))
        if not user_id:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Unauthorized'}),
            }

        params = event.get('queryStringParameters') or {}
        delete_all = params.get('all', '').lower() == 'true'
        file_key = params.get('fileKey')

        if not delete_all and not file_key:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Provide either ?fileKey=... or ?all=true'}),
            }

        upload_service = UploadService()

        if delete_all:
            files = upload_service.list_user_files(user_id)
            deleted_files = []
            total_transactions_deleted = 0
            for f in files:
                key = f['fileKey']
                tx_count = upload_service.delete_statement_transactions(user_id, key)
                upload_service.delete_file(key)
                deleted_files.append(key)
                total_transactions_deleted += tx_count

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'message': f'Deleted {len(deleted_files)} statements and {total_transactions_deleted} transactions',
                    'deletedFiles': deleted_files,
                    'transactionsDeleted': total_transactions_deleted,
                }),
            }
        else:
            # Validate the file belongs to this user
            if not file_key.startswith(f'users/{user_id}/'):
                return {
                    'statusCode': 403,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Access denied to this file'}),
                }

            tx_count = upload_service.delete_statement_transactions(user_id, file_key)
            upload_service.delete_file(file_key)

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'message': f'Deleted statement and {tx_count} associated transactions',
                    'fileKey': file_key,
                    'transactionsDeleted': tx_count,
                }),
            }

    except N3xFinError as e:
        return create_error_response(e, request_id, 400)
    except Exception as e:
        print(f'Error in delete_statement: {str(e)}')
        return create_error_response(e, request_id, 500)
