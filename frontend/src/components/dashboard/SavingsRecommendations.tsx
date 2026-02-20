import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Recommendation } from '../../types/recommendation';

export const SavingsRecommendations = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRecommendations();
      setRecommendations(response.data.recommendations || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'border-red-300 bg-red-50';
    if (priority >= 5) return 'border-yellow-300 bg-yellow-50';
    return 'border-blue-300 bg-blue-50';
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return 'bg-red-600 text-white';
    if (priority >= 5) return 'bg-yellow-600 text-white';
    return 'bg-blue-600 text-white';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High Priority';
    if (priority >= 5) return 'Medium Priority';
    return 'Low Priority';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-600">Loading recommendations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadRecommendations}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-800 font-medium">No recommendations available</div>
        <p className="text-sm text-gray-600 mt-1">
          We need more transaction data to generate personalized recommendations
        </p>
      </div>
    );
  }

  const totalPotentialSavings = recommendations.reduce(
    (sum, rec) => sum + rec.potentialSavings,
    0
  );

  return (
    <div className="space-y-6">
      {/* Total Potential Savings */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Total Potential Savings</h3>
        <div className="text-4xl font-bold">
          ${totalPotentialSavings.toFixed(2)}
          <span className="text-lg font-normal ml-2">per month</span>
        </div>
        <p className="text-sm mt-2 text-green-100">
          Based on {recommendations.length} personalized recommendation{recommendations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div
            key={rec.id}
            className={`border rounded-lg p-5 ${getPriorityColor(rec.priority)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-700 font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">
                    {rec.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(rec.priority)}`}>
                      {getPriorityLabel(rec.priority)}
                    </span>
                    <span className="text-sm text-gray-600">{rec.category}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">Potential Savings</div>
                <div className="text-2xl font-bold text-green-700">
                  ${rec.potentialSavings.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">per month</div>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">
              {rec.description}
            </p>
            
            {/* Action Items */}
            {rec.actionItems && rec.actionItems.length > 0 && (
              <div className="bg-white bg-opacity-60 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 text-sm mb-2">
                  Action Items:
                </h5>
                <ul className="space-y-2">
                  {rec.actionItems.map((action, actionIndex) => (
                    <li
                      key={actionIndex}
                      className="text-sm text-gray-700 flex items-start gap-2"
                    >
                      <span className="text-green-600 font-bold mt-0.5">✓</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
