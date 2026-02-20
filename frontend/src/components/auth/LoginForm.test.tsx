import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    setToken: vi.fn(),
  },
}));

// Mock the navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth utilities
vi.mock('../../utils/auth', () => ({
  setAuthToken: vi.fn(),
  setUser: vi.fn(),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
  };

  it('renders login form with all fields', () => {
    renderComponent();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup();
    renderComponent();

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(await screen.findByText(/please enter both email and password/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderComponent();

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Type an email that passes HTML5 validation but fails our custom validation
    // (HTML5 allows emails without dots after @, but our regex requires them)
    await user.type(emailInput, 'test@invalid');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('successfully logs in user with valid credentials', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      data: {
        user: { id: '123', email: 'test@example.com' },
        token: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          expiresIn: 3600,
        },
      },
    };

    vi.mocked(apiService.login).mockResolvedValue(mockResponse);

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error for invalid credentials', async () => {
    const user = userEvent.setup();
    const mockError = {
      response: {
        status: 401,
        data: { error: { message: 'Invalid credentials' } },
      },
    };

    vi.mocked(apiService.login).mockRejectedValue(mockError);

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('shows generic error on login failure', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.login).mockRejectedValue(new Error('Network error'));

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(await screen.findByText(/an error occurred during login/i)).toBeInTheDocument();
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.login).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });

  it('disables form inputs during login', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.login).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});
