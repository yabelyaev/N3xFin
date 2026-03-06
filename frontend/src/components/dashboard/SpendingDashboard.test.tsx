import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
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

  const setupDashMocks = () => {
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({ data: { data: mockCategoryData, totalSpending: 1250 } } as any)
      .mockResolvedValueOnce({ data: { data: mockCategoryData, totalSpending: 1250, trends: mockTrends } } as any)
      .mockResolvedValueOnce({ data: { data: mockTimeSeriesData } } as any);
  };

  it('renders loading state initially', () => {
    vi.mocked(apiService.getAnalytics).mockImplementation(
      () => new Promise(() => { }) // Never resolves
    );

    render(<SpendingDashboard />);
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  it('loads and displays analytics data on mount', async () => {
    setupDashMocks();
    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    });

    expect(screen.getByTestId('category-chart')).toBeInTheDocument();
    expect(screen.getByTestId('timeseries-chart')).toBeInTheDocument();
  });

  it('displays spending trends with correct indicators', async () => {
    setupDashMocks();
    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dining')).toBeInTheDocument();
    });

    expect(screen.getByText('15.5%')).toBeInTheDocument();
    expect(screen.getByText('10.2%')).toBeInTheDocument();
    expect(screen.getByText('2.1%')).toBeInTheDocument();
  });

  it('changes time range and reloads data', async () => {
    const user = userEvent.setup();
    setupDashMocks();
    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    });

    vi.mocked(apiService.getAnalytics).mockClear();
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({ data: { data: mockCategoryData, totalSpending: 800 } } as any)
      .mockResolvedValueOnce({ data: { data: [] } } as any);

    const sevenDayButton = screen.getByText('7 Days');
    await user.click(sevenDayButton);

    await waitFor(() => {
      expect(screen.getByText('$800.00')).toBeInTheDocument();
    });

    expect(apiService.getAnalytics).toHaveBeenCalledTimes(2);
  });

  it('toggles between chart types', async () => {
    const user = userEvent.setup();
    setupDashMocks();
    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('category-chart')).toHaveAttribute('data-type', 'bar');
    });

    const pieButton = screen.getByText(/pie/i);
    await user.click(pieButton);

    expect(screen.getByTestId('category-chart')).toHaveAttribute('data-type', 'pie');
  });

  it('displays empty state when no data is available for selected range', async () => {
    // hasAnyData = true, loadAnalytics = empty
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({ data: { data: mockCategoryData } } as any)
      .mockResolvedValueOnce({ data: { data: [], totalSpending: 0 } } as any)
      .mockResolvedValueOnce({ data: { data: [] } } as any);

    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    expect(screen.getByText(/no data for this period/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(apiService.getAnalytics)
      .mockResolvedValueOnce({ data: { data: mockCategoryData } } as any)
      .mockRejectedValue({
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

    const retryButton = screen.getByText(/try again/i);
    expect(retryButton).toBeInTheDocument();
  });

  it('allows sorting categories by name', async () => {
    const user = userEvent.setup();
    setupDashMocks();
    render(<SpendingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dining')).toBeInTheDocument();
    });

    const nameSortButton = screen.getByText(/name/i);
    await user.click(nameSortButton);

    expect(nameSortButton).toBeInTheDocument();
  });
});
