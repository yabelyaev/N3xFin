import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpendingDashboard } from './SpendingDashboard';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    getAnalytics: vi.fn(),
  },
}));

// Mock child components
vi.mock('./CategoryChart', () => ({
  CategoryChart: ({ data, type }: any) => (
    <div data-testid="category-chart" data-type={type}>
      {data.length > 0 ? `Chart with ${data.length} categories` : 'No data'}
    </div>
  ),
}));

vi.mock('./TimeSeriesChart', () => ({
  TimeSeriesChart: ({ data }: any) => (
    <div data-testid="timeseries-chart">
      {data.length > 0 ? `Chart with ${data.length} points` : 'No data'}
    </div>
  ),
}));

vi.mock('./TimeRangeSelector', () => ({
  TimeRangeSelector: ({ value, onChange }: any) => (
    <div data-testid="time-range-selector">
      <button onClick={() => onChange('7d')}>7 Days</button>
      <button onClick={() => onChange('30d')}>30 Days</button>
      <button onClick={() => onChange('3m')}>3 Months</button>
    </div>
  ),
}));

describe('SpendingDashboard', () => {
  const mockCategoryData = [
    { category: 'Dining', totalAmount: 500, transactionCount: 10, percentageOfTotal: 40 },
    { category: 'Transportation', totalAmount: 300, transactionCount: 5, percentageOfTotal: 24 },
    { category: 'Utilities', totalAmount: 450, transactionCount: 3, percentageOfTotal: 36 },
  ];

  const mockTimeSeriesData = [
    { timestamp: '2024-01-01', amount: 100 },
    { timestamp: '2024-01-02', amount: 150 },
    { timestamp: '2024-01-03', amount: 200 },
  ];

  const mockTrends = {
    Dining: { direction: 'increasing' as const, percentageChange: 15.5, comparisonPeriod: 'last month' },
    Transportation: { direction: 'decreasing' as const, percentageChange: -10.2, comparisonPeriod: 'last month' },
    Utilities: { direction: 'stable' as const, percentageChange: 2.1, comparisonPeriod: 'last month' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiService.getAnalytics).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SpendingDashboard />);
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  it('loads and displays analytics data on mount', async () => {
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({
        data: {
          data: mockCategoryData,
          totalSpending: 1250,
          trends: mockTrends,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockTimeSeriesData,
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$1250.00')).toBeInTheDocument();
    });

    expect(screen.getByTestId('category-chart')).toBeInTheDocument();
    expect(screen.getByTestId('timeseries-chart')).toBeInTheDocument();
  });

  it('displays spending trends with correct indicators', async () => {
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({
        data: {
          data: mockCategoryData,
          totalSpending: 1250,
          trends: mockTrends,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockTimeSeriesData,
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/dining/i)).toBeInTheDocument();
    });

    // Check for trend indicators
    expect(screen.getByText(/↑/)).toBeInTheDocument(); // Increasing
    expect(screen.getByText(/↓/)).toBeInTheDocument(); // Decreasing
    expect(screen.getByText(/→/)).toBeInTheDocument(); // Stable
    expect(screen.getByText(/15.5%/)).toBeInTheDocument();
    expect(screen.getByText(/10.2%/)).toBeInTheDocument();
  });

  it('changes time range when selector is used', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValue({
        data: {
          data: mockCategoryData,
          totalSpending: 1250,
          trends: mockTrends,
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });

    // Initial load (30d default)
    expect(apiService.getAnalytics).toHaveBeenCalledTimes(2);

    // Change to 7 days
    const sevenDaysButton = screen.getByText('7 Days');
    await user.click(sevenDaysButton);

    await waitFor(() => {
      expect(apiService.getAnalytics).toHaveBeenCalledTimes(4); // 2 more calls
    });
  });

  it('toggles between bar and pie chart types', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({
        data: {
          data: mockCategoryData,
          totalSpending: 1250,
          trends: mockTrends,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockTimeSeriesData,
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/spending by category/i)).toBeInTheDocument();
    });

    // Default is bar chart
    const categoryChart = screen.getByTestId('category-chart');
    expect(categoryChart).toHaveAttribute('data-type', 'bar');

    // Switch to pie chart
    const pieButton = screen.getByRole('button', { name: /pie/i });
    await user.click(pieButton);

    expect(categoryChart).toHaveAttribute('data-type', 'pie');

    // Switch back to bar chart
    const barButton = screen.getByRole('button', { name: /bar/i });
    await user.click(barButton);

    expect(categoryChart).toHaveAttribute('data-type', 'bar');
  });

  it('displays error message when API call fails', async () => {
    vi.mocked(apiService.getAnalytics).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Failed to fetch analytics',
          },
        },
      },
    });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch analytics/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('retries loading data when try again button is clicked', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.getAnalytics)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: {
          data: mockCategoryData,
          totalSpending: 1250,
          trends: mockTrends,
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockTimeSeriesData,
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load analytics data/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('$1250.00')).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', async () => {
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({
        data: {
          data: [],
          totalSpending: 0,
          trends: {},
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
        },
      });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    expect(screen.getByTestId('category-chart')).toHaveTextContent('No data');
    expect(screen.getByTestId('timeseries-chart')).toHaveTextContent('No data');
  });

  it('calculates correct start date for different time ranges', async () => {
    vi.mocked(apiService.getAnalytics).mockResolvedValue({
      data: {
        data: mockCategoryData,
        totalSpending: 1250,
        trends: mockTrends,
      },
    });

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(apiService.getAnalytics).toHaveBeenCalled();
    });

    const calls = vi.mocked(apiService.getAnalytics).mock.calls;
    const startDate = calls[0][1];
    const endDate = calls[0][2];

    // Verify dates are in correct format (YYYY-MM-DD)
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify start date is before end date
    expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
  });
});
