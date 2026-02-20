// Authentication utilities for session management

const TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';
const USER_KEY = 'user';

/**
 * Store authentication token and user data
 */
export function setAuthToken(accessToken: string, refreshToken: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  
  // Calculate expiry timestamp
  const expiryTime = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
}

/**
 * Get stored authentication token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) return true;
  
  return Date.now() >= parseInt(expiryTime, 10);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  return !!token && !isTokenExpired();
}

/**
 * Store user data
 */
export function setUser(user: { id: string; email: string }): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user data
 */
export function getUser(): { id: string; email: string } | null {
  const userData = localStorage.getItem(USER_KEY);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

/**
 * Clear all authentication data
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Initialize session timeout tracking
 * Returns a cleanup function
 */
export function initSessionTimeout(onTimeout: () => void, timeoutMinutes: number = 30): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      clearAuth();
      onTimeout();
    }, timeoutMinutes * 60 * 1000);
  };
  
  // Reset timeout on user activity
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, resetTimeout);
  });
  
  // Initial timeout
  resetTimeout();
  
  // Return cleanup function
  return () => {
    clearTimeout(timeoutId);
    events.forEach(event => {
      document.removeEventListener(event, resetTimeout);
    });
  };
}
