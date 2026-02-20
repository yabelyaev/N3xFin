import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountDeletionDialog } from './AccountDeletionDialog';
import { apiService } from '../../services/api';
import * as authUtils from '../../utils/auth';

// Mock dependencies
vi.mock('../../services/api', () => ({
  apiService: {
    requestAccountDeletion: vi.fn(),
  },
}));

vi.mock('../../utils/auth', () => ({
  clearAuth: vi.fn(),
}));

describe('AccountDeletionDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnDeleteComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (isOpen = true) => {
    return render(
      <AccountDeletionDialog
        isOpen={isOpen}
        onClose={mockOnClose}
        onDeleteComplete={mockOnDeleteComplete}
      />
    );
  };

  it('does not render when isOpen is false', () => {
    renderComponent(false);
    expect(screen.queryByText('Delete Account')).not.toBeInTheDocument();
  });

  it('renders confirmation step initially', () => {
    renderComponent();

    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete your account/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('delete my account')).toBeInTheDocument();
  });

  it('shows error when confirmation text is incorrect', () => {
    renderComponent();

    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'wrong text' } });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(screen.getByText('Please type "delete my account" to confirm')).toBeInTheDocument();
  });

  it('proceeds to verification step when confirmation text is correct', () => {
    renderComponent();

    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(screen.getByText('Final Confirmation')).toBeInTheDocument();
    expect(screen.getByText(/This is your last chance to cancel/)).toBeInTheDocument();
  });

  it('closes dialog when cancel is clicked', () => {
    renderComponent();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('deletes account successfully and calls onDeleteComplete', async () => {
    vi.mocked(apiService.requestAccountDeletion).mockResolvedValue({});

    renderComponent();

    // Move to verification step
    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    // Click delete button
    const deleteButton = screen.getByText('Delete Account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(apiService.requestAccountDeletion).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(authUtils.clearAuth).toHaveBeenCalled();
    });

    expect(mockOnDeleteComplete).toHaveBeenCalled();
  });

  it('displays error when deletion fails', async () => {
    const errorMessage = 'Failed to delete account';
    vi.mocked(apiService.requestAccountDeletion).mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });

    renderComponent();

    // Move to verification step
    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    // Click delete button
    const deleteButton = screen.getByText('Delete Account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(mockOnDeleteComplete).not.toHaveBeenCalled();
  });

  it('disables buttons while deletion is in progress', async () => {
    vi.mocked(apiService.requestAccountDeletion).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderComponent();

    // Move to verification step
    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    // Click delete button
    const deleteButton = screen.getByText('Delete Account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('resets state when dialog is closed and reopened', () => {
    const { rerender } = renderComponent();

    // Enter confirmation text
    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });

    // Close dialog
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Reopen dialog
    rerender(
      <AccountDeletionDialog
        isOpen={true}
        onClose={mockOnClose}
        onDeleteComplete={mockOnDeleteComplete}
      />
    );

    // Should be back at confirmation step with empty input
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    const newInput = screen.getByPlaceholderText('delete my account') as HTMLInputElement;
    expect(newInput.value).toBe('');
  });
});
