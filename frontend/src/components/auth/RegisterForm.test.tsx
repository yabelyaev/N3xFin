import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    register: vi.fn(),
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

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <RegisterForm />
      </BrowserRouter>
    );
  };

  it('renders registration form with all fields', () => {
    renderComponent();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup();
    renderComponent();

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    await user.click(submitButton);

    expect(await screen.findByText(/please fill in all fields/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderComponent();

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    // Type an email that passes HTML5 validation but fails our custom validation
    // (HTML5 allows emails without dots after @, but our regex requires them)
    await user.type(emailInput, 'test@invalid');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'ValidPassword123!');
    await user.click(submitButton);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('validates password complexity - minimum length', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'Short1!');

    expect(await screen.findByText(/at least 12 characters/i)).toBeInTheDocument();
  });

  it('validates password complexity - uppercase letter', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'nouppercase123!');

    expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
  });

  it('validates password complexity - lowercase letter', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'NOLOWERCASE123!');

    expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
  });

  it('validates password complexity - number', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'NoNumberHere!');

    expect(screen.getByText(/one number/i)).toBeInTheDocument();
  });

  it('validates password complexity - special character', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'NoSpecialChar123');

    expect(screen.getByText(/one special character/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'DifferentPassword123!');
    await user.click(submitButton);

    // Use getAllByText since the error appears in two places (inline and in error banner)
    const errors = await screen.findAllByText(/passwords do not match/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('disables submit button when password has errors', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'short');

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    expect(submitButton).toBeDisabled();
  });

  it('successfully registers user with valid data', async () => {
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

    vi.mocked(apiService.register).mockResolvedValue(mockResponse);

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'ValidPassword123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiService.register).toHaveBeenCalledWith('test@example.com', 'ValidPassword123!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error when email already exists', async () => {
    const user = userEvent.setup();
    const mockError = {
      response: {
        status: 409,
        data: { error: { message: 'Email already exists' } },
      },
    };

    vi.mocked(apiService.register).mockRejectedValue(mockError);

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await user.type(emailInput, 'existing@example.com');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'ValidPassword123!');
    await user.click(submitButton);

    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
  });

  it('shows generic error on registration failure', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.register).mockRejectedValue(new Error('Network error'));

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'ValidPassword123!');
    await user.click(submitButton);

    expect(await screen.findByText(/an error occurred during registration/i)).toBeInTheDocument();
  });

  it('shows loading state during registration', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.register).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderComponent();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'ValidPassword123!');
    await user.click(submitButton);

    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
  });
});
