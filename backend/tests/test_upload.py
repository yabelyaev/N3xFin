"""Unit tests for upload service."""
import pytest
from src.upload.upload_service import UploadService
from src.common.errors import ValidationError
from src.common.config import config


class TestFileValidation:
    """Test file validation logic."""
    
    def test_valid_csv_file(self):
        """Test that valid CSV files pass validation."""
        service = UploadService()
        is_valid, file_type, error = service.validate_file('statement.csv', 1024000)
        assert is_valid is True
        assert file_type == 'csv'
        assert error == ''
    
    def test_valid_pdf_file(self):
        """Test that valid PDF files pass validation."""
        service = UploadService()
        is_valid, file_type, error = service.validate_file('statement.pdf', 2048000)
        assert is_valid is True
        assert file_type == 'pdf'
        assert error == ''
    
    def test_file_too_large(self):
        """Test that oversized files are rejected."""
        service = UploadService()
        max_size = config.MAX_FILE_SIZE_BYTES
        with pytest.raises(ValidationError) as exc_info:
            service.validate_file('large.csv', max_size + 1)
        assert 'exceeds' in str(exc_info.value.message).lower()
    
    def test_empty_file(self):
        """Test that empty files are rejected."""
        service = UploadService()
        with pytest.raises(ValidationError) as exc_info:
            service.validate_file('empty.csv', 0)
        assert 'empty' in str(exc_info.value.message).lower()
    
    def test_invalid_file_type(self):
        """Test that unsupported file types are rejected."""
        service = UploadService()
        with pytest.raises(ValidationError) as exc_info:
            service.validate_file('document.txt', 1024)
        assert 'invalid file type' in str(exc_info.value.message).lower()
    
    def test_invalid_filename_too_long(self):
        """Test that excessively long filenames are rejected."""
        service = UploadService()
        long_filename = 'a' * 256 + '.csv'
        with pytest.raises(ValidationError) as exc_info:
            service.validate_file(long_filename, 1024)
        assert 'filename' in str(exc_info.value.message).lower()
    
    def test_dangerous_filename_characters(self):
        """Test that filenames with dangerous characters are rejected."""
        service = UploadService()
        dangerous_filenames = [
            '../../../etc/passwd.csv',
            'file<script>.csv',
            'file|pipe.csv',
            'file?.csv'
        ]
        for filename in dangerous_filenames:
            with pytest.raises(ValidationError):
                service.validate_file(filename, 1024)
    
    def test_case_insensitive_extension(self):
        """Test that file extensions are case-insensitive."""
        service = UploadService()
        is_valid, file_type, error = service.validate_file('STATEMENT.CSV', 1024)
        assert is_valid is True
        assert file_type == 'csv'


class TestUploadServiceMocked:
    """Test UploadService with mocked S3 client."""
    
    @pytest.fixture
    def upload_service(self, mocker):
        """Create UploadService with mocked S3 client."""
        service = UploadService()
        service.s3 = mocker.Mock()
        service.bucket = 'test-bucket'
        return service
    
    def test_generate_upload_url_success(self, upload_service):
        """Test successful presigned URL generation."""
        upload_service.s3.generate_presigned_url.return_value = 'https://s3.amazonaws.com/presigned-url'
        
        result = upload_service.generate_upload_url('user-123', 'statement.csv', 1024000)
        
        assert 'uploadUrl' in result
        assert result['uploadUrl'] == 'https://s3.amazonaws.com/presigned-url'
        assert 'fileKey' in result
        assert result['fileKey'].startswith('users/user-123/statements/')
        assert result['fileType'] == 'csv'
        assert result['expiresIn'] == 900
    
    def test_generate_upload_url_invalid_file(self, upload_service):
        """Test URL generation with invalid file."""
        with pytest.raises(ValidationError):
            upload_service.generate_upload_url('user-123', 'invalid.txt', 1024)
    
    def test_verify_upload_success(self, upload_service):
        """Test successful upload verification."""
        from datetime import datetime
        upload_service.s3.head_object.return_value = {
            'ContentLength': 1024000,
            'ContentType': 'text/csv',
            'LastModified': datetime(2024, 2, 20, 12, 0, 0),
            'ServerSideEncryption': 'AES256',
            'Metadata': {
                'original-filename': 'statement.csv',
                'user-id': 'user-123'
            }
        }
        
        result = upload_service.verify_upload('users/user-123/statements/file.csv')
        
        assert result['fileKey'] == 'users/user-123/statements/file.csv'
        assert result['size'] == 1024000
        assert result['encrypted'] is True
    
    def test_verify_upload_file_not_found(self, upload_service, mocker):
        """Test verification when file doesn't exist."""
        # Create a proper exception class
        NoSuchKeyError = type('NoSuchKey', (Exception,), {})
        upload_service.s3.exceptions = mocker.Mock()
        upload_service.s3.exceptions.NoSuchKey = NoSuchKeyError
        
        # Make head_object raise the exception
        upload_service.s3.head_object.side_effect = NoSuchKeyError()
        
        with pytest.raises(ValidationError) as exc_info:
            upload_service.verify_upload('nonexistent.csv')
        assert 'not found' in str(exc_info.value.message).lower()
    
    def test_list_user_files(self, upload_service):
        """Test listing user files."""
        from datetime import datetime
        upload_service.s3.list_objects_v2.return_value = {
            'Contents': [
                {
                    'Key': 'users/user-123/statements/file1.csv',
                    'Size': 1024,
                    'LastModified': datetime(2024, 2, 20, 12, 0, 0)
                },
                {
                    'Key': 'users/user-123/statements/file2.pdf',
                    'Size': 2048,
                    'LastModified': datetime(2024, 2, 21, 12, 0, 0)
                }
            ]
        }
        
        files = upload_service.list_user_files('user-123')
        
        assert len(files) == 2
        assert files[0]['filename'] == 'file1.csv'
        assert files[1]['filename'] == 'file2.pdf'
    
    def test_delete_file(self, upload_service):
        """Test file deletion."""
        upload_service.s3.delete_object.return_value = {}
        
        # Should not raise exception
        upload_service.delete_file('users/user-123/statements/file.csv')
        
        upload_service.s3.delete_object.assert_called_once()
