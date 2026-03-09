import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Anomaly } from '../../types/anomaly';


// DynamoDB stores amounts as strings — parse safely
const safeAmount = (value: string | number | undefined): number => {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(n) ? 0 : n;
};

// Handle ISO dates with or without timezone info
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Unknown date';
  const normalized = dateStr.includes('+') || dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString();
};

// Convert technical "N standard deviations" language into plain English
const friendlyReason = (
  amount: string | number | undefined,
  category: string | undefined,
  zScore: number | undefined,
  expectedRange: { min: number; max: number }
): string => {
  const abs = Math.abs(safeAmount(amount));
  const avg = Math.abs((expectedRange.min + expectedRange.max) / 2) || 1;
  const mult = (abs / avg).toFixed(1);
  const cat = category || 'this category';
  const z = zScore ?? 0;

  if (z >= 4) return `This charge is ${mult}× your usual ${cat} spend — much higher than normal.`;
  if (z >= 3) return `This charge is ${mult}× your typical ${cat} spend — noticeably higher than usual.`;
  if (z >= 2) return `This is a bit higher than your typical ${cat} purchases (about ${mult}× your average).`;
  return `This charge looks slightly different from your usual ${cat} spending pattern.`;
};

export const AnomalyAlerts = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);
  // Local feedback state because backend does not return it on anomaly objects
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'legitimate' | 'fraudulent'>>({});


  useEffect(() => {
    loadAnomalies();
  }, []);

  const loadAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAnalytics('anomalies');
      setAnomalies(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (transactionId: string | undefined, isLegitimate: boolean) => {
    if (!transactionId) return;
    try {
      setSubmittingFeedback(transactionId);
      await apiService.submitAnomalyFeedback(transactionId, isLegitimate);
      setFeedbackMap(prev => ({ ...prev, [transactionId]: isLegitimate ? 'legitimate' : 'fraudulent' }));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      case 'low':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-600">Loading anomalies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadAnomalies}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <div className="text-green-800 font-medium">No anomalies detected</div>
        <p className="text-sm text-green-600 mt-1">
          Your spending patterns look normal
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.id}
          className={`border rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(anomaly.severity)}`}>
                  {anomaly.severity.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">
                  {formatDate(anomaly.transaction?.date)}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-gray-900">
                  ${Math.abs(safeAmount(anomaly.transaction?.amount)).toFixed(2)}
                </span>
                <span className="text-sm text-gray-600">
                  • {anomaly.transaction?.category}
                </span>
              </div>

              <h4 className="font-medium text-gray-800 mb-2">
                {anomaly.transaction?.description}
              </h4>

              <div className="text-sm space-y-1">

                <div className="flex items-center gap-2">
                  <span className="font-medium">Expected range:</span>
                  <span>
                    ${Math.abs(anomaly.expectedRange.min).toFixed(2)} - ${Math.abs(anomaly.expectedRange.max).toFixed(2)}
                  </span>
                </div>

                <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-sm">
                  {friendlyReason(anomaly.transaction?.amount, anomaly.transaction?.category, anomaly.zScore, anomaly.expectedRange)}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback buttons */}
          {!feedbackMap[anomaly.transaction?.id] ? (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <p className="text-sm font-medium mb-2">Is this transaction legitimate?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback(anomaly.transaction?.id, true)}
                  disabled={submittingFeedback === anomaly.transaction?.id}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submittingFeedback === anomaly.transaction?.id ? 'Submitting...' : 'Yes, Legitimate'}
                </button>
                <button
                  onClick={() => handleFeedback(anomaly.transaction?.id, false)}
                  disabled={submittingFeedback === anomaly.transaction?.id}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submittingFeedback === anomaly.transaction?.id ? 'Submitting...' : 'No, Fraudulent'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <p className="text-sm">
                <span className="font-medium">Your feedback:</span>{' '}
                <span className={feedbackMap[anomaly.transaction?.id] === 'legitimate' ? 'text-green-700' : 'text-red-700'}>
                  {feedbackMap[anomaly.transaction?.id] === 'legitimate' ? 'Marked as legitimate' : 'Marked as fraudulent'}
                </span>
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
