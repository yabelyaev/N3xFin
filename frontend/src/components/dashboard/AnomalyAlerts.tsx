import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Anomaly } from '../../types/anomaly';

export const AnomalyAlerts = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);

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

  const handleFeedback = async (transactionId: string, isLegitimate: boolean) => {
    try {
      setSubmittingFeedback(transactionId);
      await apiService.submitAnomalyFeedback(transactionId, isLegitimate);
      
      // Update local state
      setAnomalies(prev =>
        prev.map(anomaly =>
          anomaly.transactionId === transactionId
            ? { ...anomaly, userFeedback: isLegitimate ? 'legitimate' : 'fraudulent' }
            : anomaly
        )
      );
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
                  {new Date(anomaly.date).toLocaleDateString()}
                </span>
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-1">
                {anomaly.description}
              </h4>
              
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Amount:</span>
                  <span className="text-lg font-bold">${Math.abs(anomaly.amount).toFixed(2)}</span>
                  <span className="text-gray-600">({anomaly.category})</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-medium">Expected range:</span>
                  <span>
                    ${anomaly.expectedRange.min.toFixed(2)} - ${anomaly.expectedRange.max.toFixed(2)}
                  </span>
                </div>
                
                <div className="mt-2 p-2 bg-white bg-opacity-50 rounded">
                  <span className="font-medium">Reason:</span> {anomaly.reason}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback buttons */}
          {!anomaly.userFeedback ? (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <p className="text-sm font-medium mb-2">Is this transaction legitimate?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback(anomaly.transactionId, true)}
                  disabled={submittingFeedback === anomaly.transactionId}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submittingFeedback === anomaly.transactionId ? 'Submitting...' : 'Yes, Legitimate'}
                </button>
                <button
                  onClick={() => handleFeedback(anomaly.transactionId, false)}
                  disabled={submittingFeedback === anomaly.transactionId}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submittingFeedback === anomaly.transactionId ? 'Submitting...' : 'No, Fraudulent'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <p className="text-sm">
                <span className="font-medium">Your feedback:</span>{' '}
                <span className={anomaly.userFeedback === 'legitimate' ? 'text-green-700' : 'text-red-700'}>
                  {anomaly.userFeedback === 'legitimate' ? 'Marked as legitimate' : 'Marked as fraudulent'}
                </span>
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
