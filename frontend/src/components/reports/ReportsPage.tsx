import { useState } from 'react';
import { MonthlyReportsList } from './MonthlyReportsList';
import { ReportDetailView } from './ReportDetailView';
import { apiService } from '../../services/api';

export const ReportsPage: React.FC = () => {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const handleExportPDF = async (_reportId: string) => {
    try {
      setExportError(null);
      setExportSuccess(null);
      
      // Note: PDF export is not yet implemented in the backend
      // This is a placeholder for future implementation
      setExportError('PDF export is not yet available. Please use CSV export.');
      
      // Future implementation:
      // const response = await apiService.exportReportPDF(reportId);
      // const blob = new Blob([response.data], { type: 'application/pdf' });
      // const url = window.URL.createObjectURL(blob);
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = `report-${reportId}.pdf`;
      // document.body.appendChild(link);
      // link.click();
      // document.body.removeChild(link);
      // window.URL.revokeObjectURL(url);
      // setExportSuccess('Report exported as PDF successfully!');
    } catch (err: any) {
      setExportError(err.response?.data?.error?.message || 'Failed to export PDF');
    }
  };

  const handleExportCSV = async (reportId: string) => {
    try {
      setExportError(null);
      setExportSuccess(null);
      
      const response = await apiService.exportReportCSV(reportId);
      
      // Create blob from response
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId}.csv`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setExportSuccess('Report exported as CSV successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err: any) {
      setExportError(err.response?.data?.error?.message || 'Failed to export CSV');
    }
  };

  const handleBack = () => {
    setSelectedReportId(null);
    setExportError(null);
    setExportSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Export notifications */}
        {exportError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {exportError}
          </div>
        )}
        {exportSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {exportSuccess}
          </div>
        )}

        {/* Main content */}
        {selectedReportId ? (
          <ReportDetailView
            reportId={selectedReportId}
            onBack={handleBack}
            onExportPDF={handleExportPDF}
            onExportCSV={handleExportCSV}
          />
        ) : (
          <MonthlyReportsList onSelectReport={setSelectedReportId} />
        )}
      </div>
    </div>
  );
};
