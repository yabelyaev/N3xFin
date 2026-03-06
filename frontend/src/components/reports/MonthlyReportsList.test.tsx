import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MonthlyReportsList } from './MonthlyReportsList';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({
  apiService: {
    listReports: vi.fn(),
    generateReport: vi.fn(),
  },
}));

describe('MonthlyReportsList', () => {
  const mockOnSelectReport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  const emptyReportsResponse = {
    data: {
      reports: [],
      monthsWithData: []
    }
  };

  it('renders empty state when no reports exist', async () => {
    vi.mocked(apiService.listReports).mockResolvedValueOnce(emptyReportsResponse as any);
    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByText(/no reports yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/upload a bank statement/i)).toBeInTheDocument();
  });

  it('displays monthly reports title', async () => {
    vi.mocked(apiService.listReports).mockResolvedValueOnce(emptyReportsResponse as any);
    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByText(/monthly reports/i)).toBeInTheDocument();
    });
  });

  it('auto-generates missing reports on mount', async () => {
    const mockReport = {
      reportId: 'test-2024-01',
      userId: 'user123',
      month: '2024-01',
      totalSpending: 1500,
      totalIncome: 3000,
      savingsRate: 50,
      transactionCount: 25,
      generatedAt: '2024-01-31T12:00:00Z',
    };

    vi.mocked(apiService.listReports)
      .mockResolvedValueOnce({
        data: { reports: [], monthsWithData: ['2024-01'] }
      } as any)
      .mockResolvedValueOnce({
        data: { reports: [mockReport], monthsWithData: ['2024-01'] }
      } as any);

    vi.mocked(apiService.generateReport).mockResolvedValueOnce({
      data: mockReport,
    } as any);

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(apiService.generateReport).toHaveBeenCalledWith(2024, 1);
    });

    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });
  });

  it('displays error message when report loading fails', async () => {
    vi.mocked(apiService.listReports).mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Failed to load reports',
          },
        },
      },
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load reports/i)).toBeInTheDocument();
    });
  });

  it('shows progress while auto-generating', async () => {
    vi.mocked(apiService.listReports).mockResolvedValueOnce({
      data: { reports: [], monthsWithData: ['2024-01'] }
    } as any);

    let resolveGenerate: any;
    const generatePromise = new Promise((resolve) => {
      resolveGenerate = resolve;
    });

    vi.mocked(apiService.generateReport).mockReturnValueOnce(generatePromise as any);

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.queryByText(/Generating/i)).toBeInTheDocument();
    });

    const mockReport = {
      reportId: 'test-2024-01',
      userId: 'user123',
      month: '2024-01',
      totalSpending: 1500,
      totalIncome: 3000,
      savingsRate: 50,
      transactionCount: 25,
      generatedAt: '2024-01-31T12:00:00Z',
    };

    // Before resolving, update listReports to return the report
    vi.mocked(apiService.listReports).mockResolvedValueOnce({
      data: { reports: [mockReport], monthsWithData: ['2024-01'] }
    } as any);

    resolveGenerate({ data: mockReport });

    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });
  });

  it('calls onSelectReport when a report is clicked', async () => {
    const user = userEvent.setup();
    const mockReport = {
      reportId: 'test-2024-01',
      userId: 'user123',
      month: '2024-01',
      totalSpending: 1500,
      totalIncome: 3000,
      savingsRate: 50,
      transactionCount: 25,
      generatedAt: '2024-01-31T12:00:00Z',
    };

    vi.mocked(apiService.listReports).mockResolvedValueOnce({
      data: { reports: [mockReport], monthsWithData: ['2024-01'] }
    } as any);

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/january 2024/i));
    expect(mockOnSelectReport).toHaveBeenCalledWith(mockReport.reportId);
  });
});
