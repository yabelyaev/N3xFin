import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthlyReportsList } from './MonthlyReportsList';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({
  apiService: {
    generateReport: vi.fn(),
  },
}));

describe('MonthlyReportsList', () => {
  const mockOnSelectReport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no reports exist', async () => {
    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByText(/no reports yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/generate your first monthly financial report/i)).toBeInTheDocument();
  });

  it('displays generate new report button', async () => {
    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
    });
  });

  it('generates new report when button is clicked', async () => {
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

    vi.mocked(apiService.generateReport).mockResolvedValue({
      data: mockReport,
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate new report/i });
    await user.click(generateButton);

    expect(apiService.generateReport).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });
  });

  it('displays error message when report generation fails', async () => {
    const user = userEvent.setup();

    vi.mocked(apiService.generateReport).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Failed to generate report',
          },
        },
      },
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate new report/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to generate report/i)).toBeInTheDocument();
    });
  });

  it('disables generate button while generating', async () => {
    const user = userEvent.setup();

    vi.mocked(apiService.generateReport).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate new report/i });
    await user.click(generateButton);

    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
  });

  it('calls onSelectReport when report is clicked', async () => {
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

    vi.mocked(apiService.generateReport).mockResolvedValue({
      data: mockReport,
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate new report/i })).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate new report/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/january 2024/i)).toBeInTheDocument();
    });

    const reportCard = screen.getByText(/january 2024/i).closest('div[class*="cursor-pointer"]');
    if (reportCard) {
      await user.click(reportCard);
      expect(mockOnSelectReport).toHaveBeenCalledWith('test-2024-01');
    }
  });

  it('formats currency correctly', async () => {
    const mockReport = {
      reportId: 'test-2024-01',
      userId: 'user123',
      month: '2024-01',
      totalSpending: 1234.56,
      totalIncome: 5678.90,
      savingsRate: 78.3,
      transactionCount: 42,
      generatedAt: '2024-01-31T12:00:00Z',
    };

    vi.mocked(apiService.generateReport).mockResolvedValue({
      data: mockReport,
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    const generateButton = await screen.findByRole('button', { name: /generate new report/i });
    await userEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
      expect(screen.getByText('$5,678.90')).toBeInTheDocument();
    });
  });

  it('displays savings rate with appropriate color coding', async () => {
    const highSavingsReport = {
      reportId: 'test-2024-01',
      userId: 'user123',
      month: '2024-01',
      totalSpending: 1000,
      totalIncome: 5000,
      savingsRate: 80,
      transactionCount: 10,
      generatedAt: '2024-01-31T12:00:00Z',
    };

    vi.mocked(apiService.generateReport).mockResolvedValue({
      data: highSavingsReport,
    });

    render(<MonthlyReportsList onSelectReport={mockOnSelectReport} />);

    const generateButton = await screen.findByRole('button', { name: /generate new report/i });
    await userEvent.click(generateButton);

    await waitFor(() => {
      const savingsRate = screen.getByText('80.0%');
      expect(savingsRate).toHaveClass('text-green-600');
    });
  });
});
