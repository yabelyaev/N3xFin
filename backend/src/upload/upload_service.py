"""Upload service for handling file uploads to S3."""
import boto3
import uuid
import mimetypes
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple
from common.config import config
from common.errors import ValidationError


class UploadService:
    """Handles file validation and S3 upload operations."""
    
    def __init__(self):
        self.s3 = boto3.client('s3', region_name=config.BEDROCK_REGION)
        self.bucket = config.S3_BUCKET
    
    def validate_file(self, filename: str, file_size: int) -> Tuple[bool, str, str]:
        """
        Validate uploaded file.
        
        Args:
            filename: Name of the file
            file_size: Size of the file in bytes
            
        Returns:
            Tuple of (is_valid, file_type, error_message)
            
        Raises:
            ValidationError: If file is invalid
        """
        errors = []
        
        # Check file size
        if file_size > config.MAX_FILE_SIZE_BYTES:
            max_mb = config.MAX_FILE_SIZE_MB
            actual_mb = file_size / (1024 * 1024)
            raise ValidationError(
                f'File size exceeds {max_mb}MB limit. Your file is {actual_mb:.2f}MB.',
                {'field': 'file', 'maxSize': config.MAX_FILE_SIZE_BYTES, 'actualSize': file_size}
            )
        
        if file_size == 0:
            raise ValidationError(
                'File is empty. Please upload a valid file.',
                {'field': 'file', 'size': 0}
            )
        
        # Detect file type from extension
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        if file_extension not in config.ALLOWED_FILE_TYPES:
            raise ValidationError(
                f'Invalid file type. Only {", ".join(config.ALLOWED_FILE_TYPES).upper()} files are allowed.',
                {'field': 'file', 'extension': file_extension, 'allowed': config.ALLOWED_FILE_TYPES}
            )
        
        # Validate filename
        if not filename or len(filename) > 255:
            raise ValidationError(
                'Invalid filename. Filename must be between 1 and 255 characters.',
                {'field': 'filename', 'length': len(filename)}
            )
        
        # Check for potentially dangerous characters
        dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
        if any(char in filename for char in dangerous_chars):
            raise ValidationError(
                'Filename contains invalid characters.',
                {'field': 'filename', 'filename': filename}
            )
        
        return True, file_extension, ''
    
    def generate_upload_url(self, user_id: str, filename: str, file_size: int) -> Dict[str, Any]:
        """
        Generate presigned URL for direct S3 upload.
        
        Args:
            user_id: User ID
            filename: Original filename
            file_size: File size in bytes
            
        Returns:
            Dict containing presigned URL and file metadata
            
        Raises:
            ValidationError: If file validation fails
        """
        # Validate file
        is_valid, file_type, error = self.validate_file(filename, file_size)
        
        # Generate unique file key
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = filename.replace(' ', '_')
        s3_key = f'users/{user_id}/statements/{timestamp}-{unique_id}-{safe_filename}'
        
        # Determine content type
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        # Generate presigned URL (valid for 15 minutes)
        try:
            presigned_url = self.s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': s3_key,
                    'ContentType': content_type,
                    'ServerSideEncryption': 'AES256',
                    'Metadata': {
                        'original-filename': filename,
                        'user-id': user_id,
                        'upload-timestamp': datetime.utcnow().isoformat()
                    }
                },
                ExpiresIn=900  # 15 minutes
            )
            
            return {
                'uploadUrl': presigned_url,
                'fileKey': s3_key,
                'bucket': self.bucket,
                'expiresIn': 900,
                'contentType': content_type,
                'fileType': file_type
            }
            
        except Exception as e:
            raise ValidationError(
                f'Failed to generate upload URL: {str(e)}',
                {'error': str(e)}
            )
    
    def verify_upload(self, file_key: str) -> Dict[str, Any]:
        """
        Verify that file was successfully uploaded to S3.
        
        Args:
            file_key: S3 object key
            
        Returns:
            Dict containing file metadata
            
        Raises:
            ValidationError: If file not found or verification fails
        """
        try:
            response = self.s3.head_object(
                Bucket=self.bucket,
                Key=file_key
            )
            
            return {
                'fileKey': file_key,
                'size': response['ContentLength'],
                'contentType': response.get('ContentType'),
                'lastModified': response['LastModified'].isoformat(),
                'encrypted': response.get('ServerSideEncryption') == 'AES256',
                'metadata': response.get('Metadata', {})
            }
            
        except self.s3.exceptions.NoSuchKey:
            raise ValidationError(
                'File not found in storage.',
                {'fileKey': file_key}
            )
        except Exception as e:
            raise ValidationError(
                f'Failed to verify upload: {str(e)}',
                {'fileKey': file_key, 'error': str(e)}
            )
    
    def get_file_url(self, file_key: str, expires_in: int = 3600) -> str:
        """
        Generate presigned URL for downloading a file.
        
        Args:
            file_key: S3 object key
            expires_in: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Presigned download URL
        """
        try:
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': file_key
                },
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            raise ValidationError(
                f'Failed to generate download URL: {str(e)}',
                {'fileKey': file_key, 'error': str(e)}
            )
    
    def delete_file(self, file_key: str) -> None:
        """
        Delete file from S3.
        
        Args:
            file_key: S3 object key
            
        Raises:
            ValidationError: If deletion fails
        """
        try:
            self.s3.delete_object(
                Bucket=self.bucket,
                Key=file_key
            )
        except Exception as e:
            raise ValidationError(
                f'Failed to delete file: {str(e)}',
                {'fileKey': file_key, 'error': str(e)}
            )
    
    def list_user_files(self, user_id: str, max_files: int = 100) -> list:
        """
        List all files for a user.
        
        Args:
            user_id: User ID
            max_files: Maximum number of files to return
            
        Returns:
            List of file metadata
        """
        try:
            prefix = f'users/{user_id}/statements/'
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
                MaxKeys=max_files
            )
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'fileKey': obj['Key'],
                    'size': obj['Size'],
                    'lastModified': obj['LastModified'].isoformat(),
                    'filename': obj['Key'].split('/')[-1]
                })
            
            return files
            
        except Exception as e:
            raise ValidationError(
                f'Failed to list files: {str(e)}',
                {'userId': user_id, 'error': str(e)}
            )
