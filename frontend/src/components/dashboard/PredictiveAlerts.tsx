import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Alert } from '../../types/prediction';

export const PredictiveAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAlerts();
      setAlerts(response.data.alerts || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-300';
      case 'warning':
        return 'bg-yellow-100 border-yellow-300';
      case 'info':
        return 'bg-blue-100 border-blue-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📊';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-600 text-white';
      case 'info':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-600">Loading alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadAlerts}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <div className="text-green-800 font-medium">No spending alerts</div>
        <p className="text-sm text-green-600 mt-1">
          Your predicted spending is within normal ranges
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">{getSeverityIcon(alert.severity)}</div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">{alert.category}</span>
              </div>
              
              <h4 className="font-semibold text-gray-900 mb-2">
                {alert.message}
              </h4>
              
              {/* Predicted vs Historical Comparison */}
              <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600 mb-1">Predicted Spending</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${alert.predictedAmount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 mb-1">Historical Average</div>
                    <div className="text-xl font-bold text-gray-700">
                      ${alert.historicalAverage.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Increase</span>
                    <span className="font-bold text-red-600">
                      +{((alert.predictedAmount - alert.historicalAverage) / alert.historicalAverage * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min((alert.predictedAmount / alert.historicalAverage) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Recommendations */}
              {alert.recommendations && alert.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-900 text-sm">Recommendations:</h5>
                  <ul className="space-y-1">
                    {alert.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
