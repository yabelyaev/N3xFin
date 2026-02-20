import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

// Test component that uses toast
const TestComponent = () => {
  const { showToast } = useToast();
  
  return (
    <div>
      <button onClick={() => showToast('Success message', 'success')}>
        Show Success
      </button>
      <button onClick={() => showToast('Error message', 'error')}>
        Show Error
      </button>
      <button onClick={() => showToast('Info message', 'info')}>
        Show Info
      </button>
      <button onClick={() => showToast('Warning message', 'warning')}>
        Show Warning
      </button>
    </div>
  );
};

describe('Toast', () => {
  it('shows success toast when triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('shows error toast when triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('dismisses toast when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info message')).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss notification');
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText('Info message')).not.toBeInTheDocument();
    });
  });

  it('shows multiple toasts', async () => {
    const user = userEvent.setup();
    
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Success'));
    await user.click(screen.getByText('Show Error'));
    
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within ToastProvider');

    console.error = originalError;
  });
});
