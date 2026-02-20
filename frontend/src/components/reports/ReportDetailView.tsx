import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface CategoryData {
  total: number;
  count: number;
  percentage: number;
}

interface Trend {
  category: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
}

interface Recommendation {
  title: string;
  description: string;
  category: string;
  potentialSavings: number;
  actionItems: string[];
}

interface Report {
  reportId: string;
  userId: string;
  month: string;
  totalSpending: number;
  totalIncome: number;
  spendingByCategory: Record<string, CategoryData>;
  savingsRate: number;
  trends: Trend[];
  insights: string[];
  recommendations: Recommendation[];
  transactionCount: number;
  generatedAt: string;
}

interface ReportDetailViewProps {
  reportId: string;
  onBack: () => void;
  onExportPDF: (reportId: string) => void;
  onExportCSV: (reportId: string) => void;
}

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  reportId,
  onBack,
  onExportPDF,
  onExportCSV,
}) => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getReport(reportId);
      setReport(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load report');
    } finally {
      setLoading(false);
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

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return '↑';
      case 'decreasing':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← Back to Reports
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Report not found'}
        </div>
      </div>
    );
  }

  const sortedCategories = Object.entries(report.spendingByCategory).sort(
    ([, a], [, b]) => b.total - a.total
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 flex items-center mb-2"
          >
            ← Back to Reports
          </button>
          <h2 className="text-3xl font-bold text-gray-900">
            {formatMonth(report.month)} Report
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Generated on {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExportPDF(reportId)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
          <button
            onClick={() => onExportCSV(reportId)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(report.totalIncome)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Spending</div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(report.totalSpending)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Savings Rate</div>
          <div
            className={`text-2xl font-bold mt-2 ${
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Transactions</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {report.transactionCount}
          </div>
        </div>
      </div>

      {/* Spending by Category */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Spending by Category
        </h3>
        <div className="space-y-3">
          {sortedCategories.map(([category, data]) => (
            <div key={category} className="flex items-center">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {category}
                  </span>
                  <span className="text-sm text-gray-600">
                    {formatCurrency(data.total)} ({data.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${data.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trends */}
      {report.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Trends</h3>
          <div className="space-y-3">
            {report.trends.map((trend, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b last:border-b-0"
              >
                <span className="text-gray-700">{trend.category}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${getTrendColor(trend.direction)}`}>
                    {getTrendIcon(trend.direction)} {Math.abs(trend.percentageChange).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 capitalize">
                    {trend.direction}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {report.insights.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Insights</h3>
          <ul className="space-y-2">
            {report.insights.map((insight, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span className="text-gray-700">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Savings Recommendations
          </h3>
          <div className="space-y-4">
            {report.recommendations.map((rec, index) => (
              <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                  <span className="text-green-600 font-semibold">
                    Save {formatCurrency(rec.potentialSavings)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                <ul className="space-y-1">
                  {rec.actionItems.map((action, actionIndex) => (
                    <li key={actionIndex} className="text-sm text-gray-700 flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
