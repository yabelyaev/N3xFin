// Authentication types

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  token: AuthToken;
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}
