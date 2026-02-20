"""Error handling utilities."""
from typing import Optional, Dict, Any
from datetime import datetime
import json


class N3xFinError(Exception):
    """Base exception for N3xFin errors."""
    
    def __init__(self, message: str, code: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(N3xFinError):
    """Validation error."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 'VALIDATION_ERROR', details)


class ProcessingError(N3xFinError):
    """Processing error."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 'PROCESSING_ERROR', details)


class ExternalServiceError(N3xFinError):
    """External service error."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 'EXTERNAL_SERVICE_ERROR', details)


class AuthorizationError(N3xFinError):
    """Authorization error."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 'AUTHORIZATION_ERROR', details)


class NotFoundError(N3xFinError):
    """Resource not found error."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 'NOT_FOUND', details)


def create_error_response(error: Exception, request_id: str, status_code: int = 500) -> dict:
    """Create standardized error response."""
    if isinstance(error, N3xFinError):
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': {
                    'code': error.code,
                    'message': error.message,
                    'details': error.details,
                    'timestamp': datetime.utcnow().isoformat(),
                    'requestId': request_id
                }
            })
        }
    
    # Generic error
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'An unexpected error occurred',
                'details': {},
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': request_id
            }
        })
    }
