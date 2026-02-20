import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface Report {
  reportId: string;
  userId: string;
  month: string;
  totalSpending: number;
  totalIncome: number;
  savingsRate: number;
  transactionCount: number;
  generatedAt: string;
}

interface MonthlyReportsListProps {
  onSelectReport: (reportId: string) => void;
}

export const MonthlyReportsList: React.FC<MonthlyReportsListProps> = ({ onSelectReport }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      // In a real implementation, there would be a list reports endpoint
      // For now, we'll just show an empty state
      setReports([]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const generateNewReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await apiService.generateReport();
      const newReport = response.data;
      setReports([newReport, ...reports]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Monthly Reports</h2>
        <button
          onClick={generateNewReport}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating...' : 'Generate New Report'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate your first monthly financial report to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div
              key={report.reportId}
              onClick={() => onSelectReport(report.reportId)}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {formatMonth(report.month)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated on {new Date(report.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Savings Rate</div>
                  <div
                    className={`text-2xl font-bold ${
                      report.savingsRate > 20
                        ? 'text-green-600'
                        : report.savingsRate > 10
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {report.savingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Income</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(report.totalIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Spending</div>
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(report.totalSpending)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Transactions</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {report.transactionCount}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
