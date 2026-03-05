import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Recommendation, CategoryTrendPoint } from '../../types/recommendation';

// ─── Mini bar chart for category drill-down ───────────────────────────────────
const CategoryTrendChart = ({ trends }: { trends: CategoryTrendPoint[] }) => {
  if (!trends || trends.length === 0) return null;

  const max = Math.max(...trends.map(t => t.amount), 1);
  const avg = trends.slice(0, -1).reduce((s, t) => s + t.amount, 0) / Math.max(trends.length - 1, 1);
  const latestMonth = trends[trends.length - 1]?.month;

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Month-by-month spend</span>
        <span className="text-xs text-gray-400">avg (prior months): ${avg.toFixed(0)}</span>
      </div>
      <div className="flex items-end gap-2 h-24">
        {trends.map((point, i) => {
          const isLatest = point.month === latestMonth;
          const heightPct = (point.amount / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-xs text-gray-500 font-medium">${point.amount.toFixed(0)}</span>
              <div className="w-full flex flex-col justify-end" style={{ height: '60px' }}>
                <div
                  className={`w-full rounded-t-sm transition-all ${isLatest ? 'bg-red-400' : 'bg-blue-300'
                    }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${point.month}: $${point.amount.toFixed(2)}`}
                />
              </div>
              <span className={`text-xs truncate w-full text-center ${isLatest ? 'font-bold text-red-600' : 'text-gray-400'}`}>
                {point.month.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
      {/* Average line label */}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="inline-block w-6 h-px bg-blue-400 border-t border-dashed border-blue-400" />
        <span>Prior months average</span>
        <span className="ml-4 inline-block w-3 h-3 rounded-sm bg-red-400 inline-block" />
        <span>Latest (spike)</span>
      </div>
    </div>
  );
};

// ─── Priority badge helpers ───────────────────────────────────────────────────
const getPriorityColor = (priority: number, isSpike?: boolean) => {
  if (isSpike) return 'border-orange-300 bg-orange-50';
  if (priority >= 8) return 'border-red-300 bg-red-50';
  if (priority >= 5) return 'border-yellow-300 bg-yellow-50';
  return 'border-blue-300 bg-blue-50';
};

const getPriorityBadge = (priority: number, isSpike?: boolean) => {
  if (isSpike) return 'bg-orange-500 text-white';
  if (priority >= 8) return 'bg-red-600 text-white';
  if (priority >= 5) return 'bg-yellow-600 text-white';
  return 'bg-blue-600 text-white';
};

const getPriorityLabel = (priority: number, isSpike?: boolean) => {
  if (isSpike) return '⚠️ Spending Spike';
  if (priority >= 8) return 'High Priority';
  if (priority >= 5) return 'Medium Priority';
  return 'Low Priority';
};

// ─── Main component ───────────────────────────────────────────────────────────
export const SavingsRecommendations = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-gray-500 text-sm animate-pulse">Your advisor is reviewing your spending…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button onClick={loadRecommendations} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
          Try again
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-800 font-medium">No recommendations yet</div>
        <p className="text-sm text-gray-600 mt-1">Upload a few months of statements to get personalised advice.</p>
      </div>
    );
  }

  const totalPotentialSavings = recommendations
    .filter(r => !r.isSpike && r.potentialSavings > 0 && r.category.toLowerCase() !== 'savings')
    .reduce((sum, rec) => sum + rec.potentialSavings, 0);

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Your Financial Advisor</h3>
            <p className="text-indigo-200 text-sm">
              Based on up to 6 months of your spending data
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-indigo-300 mb-1">Potential monthly savings</div>
            <div className="text-3xl font-bold">${totalPotentialSavings.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {recommendations.map((rec, index) => {
          const hasTrends = rec.isSpike && rec.categoryTrends && rec.categoryTrends.length > 0;
          const isExpanded = expandedId === rec.id;

          return (
            <div
              key={rec.id}
              className={`border rounded-xl p-5 transition-all ${getPriorityColor(rec.priority, rec.isSpike)}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-700 font-bold text-sm shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 text-base leading-snug">
                      {rec.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(rec.priority, rec.isSpike)}`}>
                        {getPriorityLabel(rec.priority, rec.isSpike)}
                      </span>
                      <span className="text-xs text-gray-500">{rec.category}</span>
                    </div>
                  </div>
                </div>

                {rec.potentialSavings > 0 && (
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-xs text-gray-500">
                      {rec.isSpike ? 'Extra spent' : 'Potential savings'}
                    </div>
                    <div className={`text-xl font-bold ${rec.isSpike ? 'text-orange-600' : 'text-green-700'}`}>
                      ${rec.potentialSavings.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">per month</div>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-700 text-sm mb-4 leading-relaxed">{rec.description}</p>

              {/* Action items */}
              {rec.actionItems && rec.actionItems.length > 0 && (
                <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3">
                  <h5 className="font-medium text-gray-800 text-xs uppercase tracking-wide mb-2">Action Steps</h5>
                  <ul className="space-y-1.5">
                    {rec.actionItems.map((action, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">→</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Drill-down toggle */}
              {hasTrends && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  className="text-sm font-medium text-orange-600 hover:text-orange-800 flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? '▲ Hide month-by-month' : '▼ See month-by-month breakdown'}
                </button>
              )}

              {/* Trend chart */}
              {hasTrends && isExpanded && (
                <CategoryTrendChart trends={rec.categoryTrends!} />
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center">
        Recommendations are generated by AI and are for informational purposes only. Always consult a qualified financial advisor before making major financial decisions.
      </p>
    </div>
  );
};
