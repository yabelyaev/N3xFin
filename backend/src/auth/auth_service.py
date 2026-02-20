"""Authentication service using AWS Cognito."""
import boto3
import re
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError
from ..common.config import config
from ..common.errors import ValidationError, AuthorizationError


class AuthService:
    """Handles user authentication with AWS Cognito."""
    
    def __init__(self):
        self.cognito = boto3.client('cognito-idp', region_name=config.BEDROCK_REGION)
        self.user_pool_id = config.COGNITO_USER_POOL_ID
        self.client_id = config.COGNITO_CLIENT_ID
    
    def validate_password(self, password: str) -> None:
        """
        Validate password complexity requirements.
        
        Requirements:
        - Minimum 12 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one number
        - At least one special character
        """
        if len(password) < config.PASSWORD_MIN_LENGTH:
            raise ValidationError(
                f'Password must be at least {config.PASSWORD_MIN_LENGTH} characters long',
                {'field': 'password', 'requirement': 'min_length'}
            )
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                'Password must contain at least one uppercase letter',
                {'field': 'password', 'requirement': 'uppercase'}
            )
        
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                'Password must contain at least one lowercase letter',
                {'field': 'password', 'requirement': 'lowercase'}
            )
        
        if not re.search(r'\d', password):
            raise ValidationError(
                'Password must contain at least one number',
                {'field': 'password', 'requirement': 'number'}
            )
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError(
                'Password must contain at least one special character',
                {'field': 'password', 'requirement': 'special_char'}
            )
    
    def validate_email(self, email: str) -> None:
        """Validate email format."""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValidationError(
                'Invalid email format',
                {'field': 'email'}
            )
    
    def register(self, email: str, password: str) -> Dict[str, Any]:
        """
        Register a new user.
        
        Args:
            email: User email address
            password: User password
            
        Returns:
            Dict containing user information
            
        Raises:
            ValidationError: If email or password is invalid
            AuthorizationError: If registration fails
        """
        # Validate inputs
        self.validate_email(email)
        self.validate_password(password)
        
        try:
            response = self.cognito.sign_up(
                ClientId=self.client_id,
                Username=email,
                Password=password,
                UserAttributes=[
                    {'Name': 'email', 'Value': email}
                ]
            )
            
            return {
                'userId': response['UserSub'],
                'email': email,
                'confirmed': False,
                'message': 'User registered successfully. Please check your email for verification.'
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'UsernameExistsException':
                raise AuthorizationError(
                    'An account with this email already exists',
                    {'email': email}
                )
            elif error_code == 'InvalidPasswordException':
                raise ValidationError(
                    error_message,
                    {'field': 'password'}
                )
            else:
                raise AuthorizationError(
                    f'Registration failed: {error_message}',
                    {'code': error_code}
                )
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user and return tokens.
        
        Args:
            email: User email address
            password: User password
            
        Returns:
            Dict containing access token, refresh token, and user info
            
        Raises:
            AuthorizationError: If authentication fails
        """
        try:
            response = self.cognito.initiate_auth(
                ClientId=self.client_id,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={
                    'USERNAME': email,
                    'PASSWORD': password
                }
            )
            
            auth_result = response['AuthenticationResult']
            
            return {
                'accessToken': auth_result['AccessToken'],
                'refreshToken': auth_result['RefreshToken'],
                'idToken': auth_result['IdToken'],
                'expiresIn': auth_result['ExpiresIn'],
                'tokenType': auth_result['TokenType']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code in ['NotAuthorizedException', 'UserNotFoundException']:
                raise AuthorizationError(
                    'Invalid credentials',
                    {'code': error_code}
                )
            elif error_code == 'UserNotConfirmedException':
                raise AuthorizationError(
                    'Email not verified. Please check your email for verification link.',
                    {'code': error_code, 'email': email}
                )
            else:
                raise AuthorizationError(
                    f'Authentication failed: {error_message}',
                    {'code': error_code}
                )
    
    def verify_token(self, access_token: str) -> Dict[str, Any]:
        """
        Verify access token and return user information.
        
        Args:
            access_token: JWT access token
            
        Returns:
            Dict containing user information
            
        Raises:
            AuthorizationError: If token is invalid
        """
        try:
            response = self.cognito.get_user(
                AccessToken=access_token
            )
            
            # Extract user attributes
            user_attributes = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}
            
            return {
                'userId': response['Username'],
                'email': user_attributes.get('email'),
                'emailVerified': user_attributes.get('email_verified') == 'true'
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            raise AuthorizationError(
                'Invalid or expired token',
                {'code': error_code}
            )
    
    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            Dict containing new access token
            
        Raises:
            AuthorizationError: If refresh fails
        """
        try:
            response = self.cognito.initiate_auth(
                ClientId=self.client_id,
                AuthFlow='REFRESH_TOKEN_AUTH',
                AuthParameters={
                    'REFRESH_TOKEN': refresh_token
                }
            )
            
            auth_result = response['AuthenticationResult']
            
            return {
                'accessToken': auth_result['AccessToken'],
                'idToken': auth_result['IdToken'],
                'expiresIn': auth_result['ExpiresIn'],
                'tokenType': auth_result['TokenType']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            raise AuthorizationError(
                'Failed to refresh token',
                {'code': error_code}
            )
    
    def logout(self, access_token: str) -> None:
        """
        Sign out user (invalidate tokens).
        
        Args:
            access_token: User's access token
            
        Raises:
            AuthorizationError: If logout fails
        """
        try:
            self.cognito.global_sign_out(
                AccessToken=access_token
            )
        except ClientError as e:
            error_code = e.response['Error']['Code']
            raise AuthorizationError(
                'Logout failed',
                {'code': error_code}
            )
    
    def confirm_email(self, email: str, confirmation_code: str) -> None:
        """
        Confirm user email with verification code.
        
        Args:
            email: User email
            confirmation_code: Verification code from email
            
        Raises:
            AuthorizationError: If confirmation fails
        """
        try:
            self.cognito.confirm_sign_up(
                ClientId=self.client_id,
                Username=email,
                ConfirmationCode=confirmation_code
            )
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'CodeMismatchException':
                raise AuthorizationError(
                    'Invalid verification code',
                    {'code': error_code}
                )
            else:
                raise AuthorizationError(
                    f'Email confirmation failed: {error_message}',
                    {'code': error_code}
                )
