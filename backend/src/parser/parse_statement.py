"""Lambda function to parse uploaded bank statements (async-safe)."""
import json
import uuid
import boto3
import os
from typing import Dict, Any
from common.errors import create_error_response, N3xFinError


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Parse uploaded bank statement and store transactions.

    Mode 1 - API call (returns immediately, triggers worker async):
        POST /parser/parse  { fileKey, bucket, useLLM }
        Returns: 202 { jobId, status: "processing" }

    Mode 2 - Async worker invocation (internal, from Mode 1):
        event contains: { _workerMode: true, fileKey, bucket, useLLM, userId, jobId }

    Mode 3 - S3 event trigger:
        event contains: { Records: [{ s3: {...} }] }
    """
    request_id = context.aws_request_id if hasattr(context, 'aws_request_id') else str(uuid.uuid4())

    # ── Mode 2: async worker ────────────────────────────────────────────────
    if event.get('_workerMode'):
        return _run_worker(event, request_id)

    # ── Mode 3: S3 trigger ──────────────────────────────────────────────────
    if 'Records' in event:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        file_key = record['s3']['object']['key']
        user_id = file_key.split('/')[1]
        return _run_worker({
            'fileKey': file_key,
            'bucket': bucket,
            'useLLM': True,
            'userId': user_id,
            'jobId': request_id,
        }, request_id)

    # ── Mode 1: API call ────────────────────────────────────────────────────
    try:
        authorizer_context = event.get('requestContext', {}).get('authorizer', {})
        user_id = authorizer_context.get('claims', {}).get('sub')

        if not user_id:
            return _response(401, {'error': {'code': 'UNAUTHORIZED', 'message': 'User authentication required'}})

        body = json.loads(event.get('body', '{}'))
        file_key = body.get('fileKey')
        bucket = body.get('bucket')
        use_llm = body.get('useLLM', False)

        if not file_key or not bucket:
            return _response(400, {'error': {'code': 'MISSING_FIELDS', 'message': 'fileKey and bucket are required'}})

        if not file_key.startswith(f'users/{user_id}/'):
            return _response(403, {'error': {'code': 'FORBIDDEN', 'message': 'Access denied to this file'}})

        job_id = str(uuid.uuid4())

        # Invoke self asynchronously so we don't block API Gateway
        lambda_client = boto3.client('lambda', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        lambda_client.invoke(
            FunctionName=context.function_name,
            InvocationType='Event',  # async — returns immediately
            Payload=json.dumps({
                '_workerMode': True,
                'fileKey': file_key,
                'bucket': bucket,
                'useLLM': use_llm,
                'userId': user_id,
                'jobId': job_id,
            }).encode('utf-8'),
        )

        return _response(202, {
            'message': 'Statement processing started',
            'jobId': job_id,
            'status': 'processing',
        })

    except Exception as e:
        import traceback
        print(f'Error in API handler: {str(e)}\n{traceback.format_exc()}')
        return _response(500, {'error': {'code': 'INTERNAL_ERROR', 'message': str(e)}})


def _run_worker(event: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    """Run the actual heavy parsing work."""
    from parser.parser_service import ParserService

    file_key = event['fileKey']
    bucket = event['bucket']
    use_llm = event.get('useLLM', False)
    user_id = event.get('userId') or file_key.split('/')[1]

    try:
        file_extension = file_key.lower().split('.')[-1]
        parser_service = ParserService()

        if file_extension == 'csv':
            transactions = parser_service.parse_csv(bucket, file_key, user_id)
        elif file_extension == 'pdf':
            if use_llm:
                transactions = parser_service.parse_pdf_with_llm(bucket, file_key, user_id)
            else:
                transactions = parser_service.parse_pdf(bucket, file_key, user_id)
        else:
            print(f'Unsupported file type: {file_extension}')
            return {'status': 'error', 'message': f'Unsupported file type: {file_extension}'}

        unique_transactions = parser_service.detect_duplicates(transactions, user_id)
        stored_count = parser_service.store_transactions(unique_transactions)

        print(f'Worker done: {stored_count} transactions stored for user {user_id}')
        return {
            'status': 'complete',
            'totalTransactions': len(transactions),
            'storedTransactions': stored_count,
        }

    except Exception as e:
        import traceback
        print(f'Worker error for {file_key}: {str(e)}\n{traceback.format_exc()}')
        return {'status': 'error', 'message': str(e)}


def _response(status_code: int, body: dict) -> dict:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body),
    }
