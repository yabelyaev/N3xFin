import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from './SettingsPage';
import { apiService } from '../../services/api';
import * as authUtils from '../../utils/auth';

// Mock dependencies
vi.mock('../../services/api', () => ({
  apiService: {
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
  },
}));

vi.mock('../../utils/auth', () => ({
  getUser: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SettingsPage', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockPreferences = {
    alertThreshold: 120,
    reportFrequency: 'monthly' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authUtils.getUser).mockReturnValue(mockUser);
    vi.mocked(apiService.getUserPreferences).mockResolvedValue({
      data: mockPreferences,
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );
  };

  it('renders settings page with user information', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('Account Information')).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText(mockUser.id)).toBeInTheDocument();
  });

  it('loads and displays user preferences', async () => {
    renderComponent();

    await waitFor(() => {
      expect(apiService.getUserPreferences).toHaveBeenCalled();
    });

    const alertThresholdSlider = screen.getByLabelText('Alert Threshold (%)') as HTMLInputElement;
    expect(alertThresholdSlider.value).toBe('120');

    const reportFrequencySelect = screen.getByLabelText('Report Frequency') as HTMLSelectElement;
    expect(reportFrequencySelect.value).toBe('monthly');
  });

  it('updates alert threshold when slider is moved', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('Alert Threshold (%)') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '150' } });

    expect(slider.value).toBe('150');
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('updates report frequency when dropdown is changed', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Report Frequency') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'weekly' } });

    expect(select.value).toBe('weekly');
  });

  it('saves preferences successfully', async () => {
    vi.mocked(apiService.updateUserPreferences).mockResolvedValue({});

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('Alert Threshold (%)');
    fireEvent.change(slider, { target: { value: '150' } });

    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiService.updateUserPreferences).toHaveBeenCalledWith({
        alertThreshold: 150,
        reportFrequency: 'monthly',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully')).toBeInTheDocument();
    });
  });

  it('displays error when save fails', async () => {
    const errorMessage = 'Failed to save preferences';
    vi.mocked(apiService.updateUserPreferences).mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('opens delete account dialog when delete button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete My Account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete your account/)).toBeInTheDocument();
    });
  });

  it('uses default preferences when loading fails', async () => {
    vi.mocked(apiService.getUserPreferences).mockRejectedValue(new Error('Load failed'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const alertThresholdSlider = screen.getByLabelText('Alert Threshold (%)') as HTMLInputElement;
    expect(alertThresholdSlider.value).toBe('120');
  });
});
