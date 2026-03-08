import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface CategorizationStatus {
  totalTransactions: number;
  categorizedTransactions: number;
  uncategorizedTransactions: number;
  percentageCategorized: number;
  isComplete: boolean;
}

export const CategorizationStatusBanner = () => {
  const [status, setStatus] = useState<CategorizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    loadStatus();
    
    // Poll every 5 seconds if categorization is in progress
    const interval = setInterval(() => {
      if (status && !status.isComplete) {
        loadStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status?.isComplete]);

  const loadStatus = async () => {
    try {
      const response = await apiService.getCategorizationStatus();
      setStatus(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load categorization status');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorizeNow = async () => {
    setCategorizing(true);
    try {
      // Trigger multiple batches to handle large numbers of transactions
      const batchPromises = [];
      for (let i = 0; i < 10; i++) {
        batchPromises.push(
          apiService.categorizeTransactions([]).catch(() => {
            // Ignore individual batch errors
          })
        );
      }
      await Promise.all(batchPromises);
      
      // Wait a moment then reload status
      setTimeout(() => {
        loadStatus();
        setCategorizing(false);
      }, 2000);
    } catch (err) {
      setCategorizing(false);
    }
  };

  // Don't show banner if everything is categorized or if there are no transactions
  if (loading || error || !status || status.isComplete || status.totalTransactions === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-blue-900">
              Categorizing transactions...
            </h3>
            <button
              onClick={handleCategorizeNow}
              disabled={categorizing}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {categorizing ? 'Processing...' : 'Categorize Now'}
            </button>
          </div>
          <p className="mt-1 text-sm text-blue-700">
            {status.categorizedTransactions} of {status.totalTransactions} transactions categorized (
            {status.percentageCategorized}%)
          </p>
          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${status.percentageCategorized}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-600">
            This may take a few minutes for large uploads. Your dashboard will update automatically.
          </p>
        </div>
      </div>
    </div>
  );
};
