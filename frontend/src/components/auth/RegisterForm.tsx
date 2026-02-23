import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { validateEmail, validatePassword } from '../../utils/validation';

export function RegisterForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    // Validate password in real-time
    const validation = validatePassword(value);
    setPasswordErrors(validation.errors);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError('Password does not meet complexity requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.register(email, password);
      
      // Registration successful - AWS Cognito will send verification email
      // Show success message and redirect to login
      alert(response.data.message || 'Registration successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.error?.code === 'UsernameExistsException') {
        setError('An account with this email already exists');
      } else if (err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('An error occurred during registration. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Create Account</h2>

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

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="••••••••••••"
            disabled={isLoading}
            autoComplete="new-password"
          />
          
          {/* Password requirements */}
          {password && passwordErrors.length > 0 && (
            <div className="mt-2 text-xs">
              <p className="text-gray-600 font-semibold mb-1">Password must contain:</p>
              <ul className="list-disc list-inside space-y-1">
                <li className={password.length >= 12 ? 'text-green-600' : 'text-red-600'}>
                  At least 12 characters
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-red-600'}>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(password) ? 'text-green-600' : 'text-red-600'}>
                  One lowercase letter
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-600' : 'text-red-600'}>
                  One number
                </li>
                <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600' : 'text-red-600'}>
                  One special character
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="••••••••••••"
            disabled={isLoading}
            autoComplete="new-password"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading || passwordErrors.length > 0}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-500 hover:text-blue-700 font-semibold">
              Sign in
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
