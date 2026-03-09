import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface Report {
  reportId: string;
  month: string;          // 'YYYY-MM'
  totalSpending: number;
  totalIncome: number;
  savingsRate: number;
  transactionCount: number;
  generatedAt: string;
}

interface MonthlyReportsListProps {
  onSelectReport: (reportId: string) => void;
}

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export const MonthlyReportsList: React.FC<MonthlyReportsListProps> = ({ onSelectReport }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initReports();
  }, []);

  /**
   * On load:
   * 1. Fetch existing reports + months that have transactions
   * 2. Find months with data but no report yet
   * 3. Auto-generate missing reports sequentially
   */
  const initReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiService.listReports();
      const { reports: existingReports, monthsWithData } = res.data as {
        reports: Report[];
        monthsWithData: string[];
      };

      const reportedMonths = new Set(existingReports.map((r: Report) => r.month));
      const missing = (monthsWithData || []).filter((m: string) => !reportedMonths.has(m));

      setReports(existingReports);
      setLoading(false);

      if (missing.length === 0) return;

      // Auto-generate reports for months with data but no report
      setAutoGenerating(true);
      const generated: Report[] = [];

      for (const ym of missing) {
        setProgress(`Generating ${formatMonth(ym)}…`);
        try {
          const [yearStr, monthStr] = ym.split('-');
          const genRes = await apiService.generateReport(parseInt(yearStr), parseInt(monthStr));
          const report = genRes.data as Report;
          generated.push({
            reportId: report.reportId,
            month: report.month,
            totalSpending: report.totalSpending,
            totalIncome: report.totalIncome,
            savingsRate: report.savingsRate,
            transactionCount: report.transactionCount,
            generatedAt: report.generatedAt,
          });
        } catch (e) {
          console.warn(`Failed to generate report for ${ym}`, e);
        }
      }

      setReports(prev =>
        [...prev, ...generated].sort((a, b) => b.month.localeCompare(a.month))
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load reports');
      setLoading(false);
    } finally {
      setAutoGenerating(false);
      setProgress('');
    }
  };

  const refreshReport = async (month: string) => {
    const [yearStr, monthStr] = month.split('-');
    try {
      const res = await apiService.generateReport(parseInt(yearStr), parseInt(monthStr));
      const updated = res.data as Report;
      setReports(prev =>
        prev.map(r => r.month === month ? { ...r, ...updated, generatedAt: updated.generatedAt } : r)
      );
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to refresh report');
    }
  };



  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading your reports…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Reports</h2>
          {autoGenerating && (
            <p className="text-sm text-blue-600 mt-0.5 animate-pulse">
              ✨ {progress}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {reports.length === 0 && !autoGenerating ? (
        <div className="text-center py-16 bg-white rounded-xl shadow">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900">No reports yet</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            Upload a bank statement and your first monthly report will be generated automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Skeleton cards while generating */}
          {autoGenerating && reports.length === 0 && [0, 1].map(i => (
            <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-24 mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map(j => <div key={j} className="h-8 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}

          {reports.map((report) => (
            <div
              key={report.reportId}
              onClick={() => onSelectReport(report.reportId)}
              className="bg-white rounded-xl shadow hover:shadow-md transition-all cursor-pointer p-6 border border-transparent hover:border-blue-100"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {formatMonth(report.month)}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generated {new Date(
                      report.generatedAt.endsWith('Z') ? report.generatedAt : report.generatedAt + 'Z'
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Savings Rate</div>
                    <div className={`text-2xl font-bold ${report.savingsRate > 20 ? 'text-green-600'
                        : report.savingsRate > 10 ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                      {report.savingsRate.toFixed(1)}%
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshReport(report.month); }}
                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    title="Refresh this report"
                  >
                    ↻
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <div className="text-xs text-gray-500">Income</div>
                  <div className="text-base font-semibold text-green-600">
                    {formatCurrency(report.totalIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Spending</div>
                  <div className="text-base font-semibold text-red-600">
                    {formatCurrency(report.totalSpending)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Transactions</div>
                  <div className="text-base font-semibold text-gray-900">
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
