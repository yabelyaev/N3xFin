import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportsPage } from './ReportsPage';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({
  apiService: {
    generateReport: vi.fn(),
    getReport: vi.fn(),
    exportReportCSV: vi.fn(),
  },
}));

vi.mock('./MonthlyReportsList', () => ({
  MonthlyReportsList: ({ onSelectReport }: any) => (
    <div data-testid="monthly-reports-list">
      <button onClick={() => onSelectReport('test-report-123')}>
        Select Report
      </button>
    </div>
  ),
}));

vi.mock('./ReportDetailView', () => ({
  ReportDetailView: ({ reportId, onBack, onExportPDF, onExportCSV }: any) => (
    <div data-testid="report-detail-view">
      <div>Report ID: {reportId}</div>
      <button onClick={onBack}>Back</button>
      <button onClick={() => onExportPDF(reportId)}>Export PDF</button>
      <button onClick={() => onExportCSV(reportId)}>Export CSV</button>
    </div>
  ),
}));

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders MonthlyReportsList by default', () => {
    render(<ReportsPage />);
    expect(screen.getByTestId('monthly-reports-list')).toBeInTheDocument();
  });

  it('switches to ReportDetailView when a report is selected', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    expect(screen.getByTestId('report-detail-view')).toBeInTheDocument();
    expect(screen.getByText('Report ID: test-report-123')).toBeInTheDocument();
  });

  it('switches back to MonthlyReportsList when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    expect(screen.getByTestId('report-detail-view')).toBeInTheDocument();

    // Click back
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    expect(screen.getByTestId('monthly-reports-list')).toBeInTheDocument();
  });

  it('displays error message when PDF export is attempted', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Try to export PDF
    const exportPDFButton = screen.getByRole('button', { name: /export pdf/i });
    await user.click(exportPDFButton);

    await waitFor(() => {
      expect(screen.getByText(/pdf export is not yet available/i)).toBeInTheDocument();
    });
  });

  it('successfully exports CSV and displays success message', async () => {
    const user = userEvent.setup();
    const mockCSVData = 'Date,Description,Amount\n2024-01-01,Test,100.00';
    
    vi.mocked(apiService.exportReportCSV).mockResolvedValue({
      data: mockCSVData,
    } as any);

    // Mock document.body methods
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Export CSV
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(apiService.exportReportCSV).toHaveBeenCalledWith('test-report-123');
    });

    await waitFor(() => {
      expect(screen.getByText(/report exported as csv successfully/i)).toBeInTheDocument();
    });

    // Verify download link was created and clicked
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('displays error message when CSV export fails', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.exportReportCSV).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Export failed',
          },
        },
      },
    });

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Try to export CSV
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    });
  });

  it('clears error messages when switching back to list view', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.exportReportCSV).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Export failed',
          },
        },
      },
    });

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Try to export CSV to trigger error
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(screen.getByText(/export failed/i)).toBeInTheDocument();
    });

    // Go back
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Error should be cleared
    expect(screen.queryByText(/export failed/i)).not.toBeInTheDocument();
  });

  it('creates correct CSV blob with proper MIME type', async () => {
    const user = userEvent.setup();
    const mockCSVData = 'Date,Description,Amount\n2024-01-01,Test,100.00';
    
    vi.mocked(apiService.exportReportCSV).mockResolvedValue({
      data: mockCSVData,
    } as any);

    let capturedBlob: Blob | null = null;
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Export CSV
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(capturedBlob).not.toBeNull();
    });

    expect(capturedBlob?.type).toBe('text/csv');
  });

  it('sets correct filename for CSV download', async () => {
    const user = userEvent.setup();
    const mockCSVData = 'Date,Description,Amount\n2024-01-01,Test,100.00';
    
    vi.mocked(apiService.exportReportCSV).mockResolvedValue({
      data: mockCSVData,
    } as any);

    let capturedLink: HTMLAnchorElement | null = null;
    const originalAppendChild = document.body.appendChild;
    document.body.appendChild = vi.fn((node: any) => {
      if (node.tagName === 'A') {
        capturedLink = node;
      }
      return originalAppendChild.call(document.body, node);
    }) as any;

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Export CSV
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(capturedLink).not.toBeNull();
    });

    expect(capturedLink?.download).toBe('report-test-report-123.csv');
    expect(capturedLink?.href).toBe('blob:mock-url');

    document.body.appendChild = originalAppendChild;
  });

  it('handles CSV export with generic error message when no specific error provided', async () => {
    const user = userEvent.setup();
    
    vi.mocked(apiService.exportReportCSV).mockRejectedValue(new Error('Network error'));

    render(<ReportsPage />);

    // Select a report
    const selectButton = screen.getByRole('button', { name: /select report/i });
    await user.click(selectButton);

    // Try to export CSV
    const exportCSVButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportCSVButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to export csv/i)).toBeInTheDocument();
    });
  });
});
