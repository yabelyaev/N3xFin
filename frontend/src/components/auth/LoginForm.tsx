import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { setAuthToken, setUser } from '../../utils/auth';
import { validateEmail } from '../../utils/validation';

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.login(email, password);
      const responseData = 'data' in response ? response.data : response;
      
      // Backend returns: { accessToken, refreshToken, idToken, expiresIn, tokenType }
      const { accessToken, refreshToken, idToken, expiresIn } = responseData;

      // Decode idToken to get user info (JWT payload is base64 encoded)
      const tokenParts = idToken.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const user = {
        id: payload.sub,
        email: payload.email
      };

      // Store authentication data
      setAuthToken(accessToken, refreshToken, expiresIn);
      setUser(user);
      apiService.setToken(accessToken);

      // Force a full page reload to update App.tsx authentication state
      window.location.href = '/dashboard';
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign In</h2>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="your@email.com"
            disabled={isLoading}
            autoComplete="email"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="••••••••••••"
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-500 hover:text-blue-700 font-semibold">
              Sign up
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
