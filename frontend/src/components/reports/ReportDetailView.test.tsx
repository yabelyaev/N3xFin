import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportDetailView } from './ReportDetailView';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({
  apiService: {
    getReport: vi.fn(),
  },
}));

describe('ReportDetailView', () => {
  const mockOnBack = vi.fn();
  const mockOnExportPDF = vi.fn();
  const mockOnExportCSV = vi.fn();

  const mockReport = {
    reportId: 'test-2024-01',
    userId: 'user123',
    month: '2024-01',
    totalSpending: 1500,
    totalIncome: 3000,
    spendingByCategory: {
      Dining: { total: 500, count: 10, percentage: 33.3 },
      Transportation: { total: 300, count: 5, percentage: 20.0 },
      Utilities: { total: 700, count: 3, percentage: 46.7 },
    },
    savingsRate: 50,
    trends: [
      {
        category: 'Overall Spending',
        direction: 'increasing' as const,
        percentageChange: 15.5,
      },
    ],
    insights: [
      'Your savings rate of 50% is excellent!',
      'Utilities is your highest spending category.',
    ],
    recommendations: [
      {
        title: 'Reduce Utilities Spending',
        description: 'You spent $700 on Utilities this month.',
        category: 'Utilities',
        potentialSavings: 105,
        actionItems: ['Review your Utilities expenses', 'Set a monthly budget for Utilities'],
      },
    ],
    transactionCount: 18,
    generatedAt: '2024-01-31T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(apiService.getReport).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    expect(screen.getByText(/loading report/i)).toBeInTheDocument();
  });

  it('loads and displays report data', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/january 2024 report/i)).toBeInTheDocument();
    });

    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('displays spending by category with progress bars', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/spending by category/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
    expect(screen.getByText('$500.00 (33.3%)')).toBeInTheDocument();
  });

  it('displays trends with correct icons and colors', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/trends/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Spending')).toBeInTheDocument();
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/15.5%/)).toBeInTheDocument();
  });

  it('displays insights', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/insights/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/your savings rate of 50% is excellent/i)).toBeInTheDocument();
    expect(screen.getByText(/utilities is your highest spending category/i)).toBeInTheDocument();
  });

  it('displays recommendations with action items', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/savings recommendations/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Reduce Utilities Spending')).toBeInTheDocument();
    expect(screen.getByText('Save $105.00')).toBeInTheDocument();
    expect(screen.getByText(/review your utilities expenses/i)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/january 2024 report/i)).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back to reports/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onExportPDF when export PDF button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/january 2024 report/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export pdf/i });
    await user.click(exportButton);

    expect(mockOnExportPDF).toHaveBeenCalledWith('test-2024-01');
  });

  it('calls onExportCSV when export CSV button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/january 2024 report/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportButton);

    expect(mockOnExportCSV).toHaveBeenCalledWith('test-2024-01');
  });

  it('displays error message when report fails to load', async () => {
    vi.mocked(apiService.getReport).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Report not found',
          },
        },
      },
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/report not found/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to reports/i })).toBeInTheDocument();
  });

  it('sorts categories by spending amount', async () => {
    vi.mocked(apiService.getReport).mockResolvedValue({
      data: mockReport,
    });

    render(
      <ReportDetailView
        reportId="test-2024-01"
        onBack={mockOnBack}
        onExportPDF={mockOnExportPDF}
        onExportCSV={mockOnExportCSV}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/spending by category/i)).toBeInTheDocument();
    });

    const categories = screen.getAllByText(/Dining|Transportation|Utilities/);
    // Utilities (700) should be first, then Dining (500), then Transportation (300)
    expect(categories[0]).toHaveTextContent('Utilities');
  });
});
