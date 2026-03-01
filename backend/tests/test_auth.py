"""Unit tests for authentication service."""
import pytest
from botocore.exceptions import ClientError
from auth.auth_service import AuthService
from common.errors import ValidationError, AuthorizationError


class TestPasswordValidation:
    """Test password complexity validation."""
    
    def test_valid_password(self):
        """Test that valid passwords pass validation."""
        auth = AuthService()
        # Should not raise any exception
        auth.validate_password('SecurePass123!')
        auth.validate_password('MyP@ssw0rd2024')
        auth.validate_password('C0mpl3x!Pass')
    
    def test_password_too_short(self):
        """Test that short passwords are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_password('Short1!')
        assert 'at least 12 characters' in str(exc_info.value.message)
    
    def test_password_no_uppercase(self):
        """Test that passwords without uppercase are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_password('lowercase123!')
        assert 'uppercase letter' in str(exc_info.value.message)
    
    def test_password_no_lowercase(self):
        """Test that passwords without lowercase are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_password('UPPERCASE123!')
        assert 'lowercase letter' in str(exc_info.value.message)
    
    def test_password_no_number(self):
        """Test that passwords without numbers are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_password('NoNumbersHere!')
        assert 'number' in str(exc_info.value.message)
    
    def test_password_no_special_char(self):
        """Test that passwords without special characters are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_password('NoSpecialChar123')
        assert 'special character' in str(exc_info.value.message)


class TestEmailValidation:
    """Test email format validation."""
    
    def test_valid_emails(self):
        """Test that valid emails pass validation."""
        auth = AuthService()
        # Should not raise any exception
        auth.validate_email('user@example.com')
        auth.validate_email('test.user@domain.co.uk')
        auth.validate_email('name+tag@company.org')
    
    def test_invalid_email_no_at(self):
        """Test that emails without @ are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_email('userexample.com')
        assert 'Invalid email format' in str(exc_info.value.message)
    
    def test_invalid_email_no_domain(self):
        """Test that emails without domain are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_email('user@')
        assert 'Invalid email format' in str(exc_info.value.message)
    
    def test_invalid_email_no_tld(self):
        """Test that emails without TLD are rejected."""
        auth = AuthService()
        with pytest.raises(ValidationError) as exc_info:
            auth.validate_email('user@domain')
        assert 'Invalid email format' in str(exc_info.value.message)


class TestAuthServiceMocked:
    """Test AuthService with mocked Cognito client."""
    
    @pytest.fixture
    def auth_service(self, mocker):
        """Create AuthService with mocked Cognito client."""
        service = AuthService()
        service.cognito = mocker.Mock()
        service.client_id = 'test-client-id'
        service.user_pool_id = 'test-pool-id'
        return service
    
    def test_register_success(self, auth_service):
        """Test successful user registration."""
        auth_service.cognito.sign_up.return_value = {
            'UserSub': 'user-123',
            'CodeDeliveryDetails': {
                'Destination': 'u***@example.com',
                'DeliveryMedium': 'EMAIL'
            }
        }
        
        result = auth_service.register('user@example.com', 'SecurePass123!')
        
        assert result['userId'] == 'user-123'
        assert result['email'] == 'user@example.com'
        assert result['confirmed'] is False
        assert 'verification' in result['message'].lower()
    
    def test_register_duplicate_email(self, auth_service):
        """Test registration with existing email."""
        auth_service.cognito.sign_up.side_effect = ClientError(
            {'Error': {'Code': 'UsernameExistsException', 'Message': 'User already exists'}},
            'SignUp'
        )
        
        with pytest.raises(AuthorizationError) as exc_info:
            auth_service.register('existing@example.com', 'SecurePass123!')
        assert 'already exists' in str(exc_info.value.message)
    
    def test_login_success(self, auth_service):
        """Test successful login."""
        auth_service.cognito.initiate_auth.return_value = {
            'AuthenticationResult': {
                'AccessToken': 'access-token-123',
                'RefreshToken': 'refresh-token-123',
                'IdToken': 'id-token-123',
                'ExpiresIn': 3600,
                'TokenType': 'Bearer'
            }
        }
        
        result = auth_service.login('user@example.com', 'SecurePass123!')
        
        assert result['accessToken'] == 'access-token-123'
        assert result['refreshToken'] == 'refresh-token-123'
        assert result['expiresIn'] == 3600
    
    def test_login_invalid_credentials(self, auth_service):
        """Test login with invalid credentials."""
        auth_service.cognito.initiate_auth.side_effect = ClientError(
            {'Error': {'Code': 'NotAuthorizedException', 'Message': 'Incorrect username or password'}},
            'InitiateAuth'
        )
        
        with pytest.raises(AuthorizationError) as exc_info:
            auth_service.login('user@example.com', 'WrongPassword')
        assert 'Invalid credentials' in str(exc_info.value.message)
    
    def test_verify_token_success(self, auth_service):
        """Test successful token verification."""
        auth_service.cognito.get_user.return_value = {
            'Username': 'user-123',
            'UserAttributes': [
                {'Name': 'email', 'Value': 'user@example.com'},
                {'Name': 'email_verified', 'Value': 'true'}
            ]
        }
        
        result = auth_service.verify_token('valid-token')
        
        assert result['userId'] == 'user-123'
        assert result['email'] == 'user@example.com'
        assert result['emailVerified'] is True
    
    def test_verify_token_invalid(self, auth_service):
        """Test verification with invalid token."""
        auth_service.cognito.get_user.side_effect = ClientError(
            {'Error': {'Code': 'NotAuthorizedException', 'Message': 'Invalid token'}},
            'GetUser'
        )
        
        with pytest.raises(AuthorizationError) as exc_info:
            auth_service.verify_token('invalid-token')
        assert 'Invalid or expired token' in str(exc_info.value.message)
