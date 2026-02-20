import { useState, useEffect } from 'react';
import { CategoryChart } from './CategoryChart';
import { TimeSeriesChart } from './TimeSeriesChart';
import { TimeRangeSelector } from './TimeRangeSelector';
import { apiService } from '../../services/api';
import type { AnalyticsData } from '../../types/analytics';

export const SpendingDashboard = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar');
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'percentage'>('amount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = calculateStartDate(timeRange);

      // Load category spending
      const categoryResponse = await apiService.getAnalytics(
        'category',
        startDate,
        endDate
      );

      // Load time series data
      const timeSeriesResponse = await apiService.getAnalytics(
        'timeseries',
        startDate,
        endDate,
        'day'
      );

      setAnalyticsData({
        categorySpending: categoryResponse.data.data || [],
        timeSeriesData: timeSeriesResponse.data.data || [],
        totalSpending: categoryResponse.data.totalSpending || 0,
        trends: categoryResponse.data.trends || {},
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStartDate = (range: string): string => {
    const date = new Date();
    switch (range) {
      case '7d':
        date.setDate(date.getDate() - 7);
        break;
      case '30d':
        date.setDate(date.getDate() - 30);
        break;
      case '3m':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6m':
        date.setMonth(date.getMonth() - 6);
        break;
      case '1y':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const categoryData = analyticsData?.categorySpending || [];
  const timeSeriesData = analyticsData?.timeSeriesData || [];
  const totalSpending = analyticsData?.totalSpending || 0;
  const trends = analyticsData?.trends || {};

  // Sort category data based on selected sort option and order
  const sortedCategoryData = [...categoryData].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'amount':
        comparison = b.totalAmount - a.totalAmount;
        break;
      case 'name':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'percentage':
        comparison = b.percentageOfTotal - a.percentageOfTotal;
        break;
    }
    return sortOrder === 'asc' ? -comparison : comparison;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Time Range</h3>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Spending Totals */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Total Spending</h3>
        <div className="text-2xl md:text-3xl font-bold text-gray-900">
          ${totalSpending.toFixed(2)}
        </div>
        {Object.keys(trends).length > 0 && (
          <div className="mt-4 space-y-2">
            {Object.entries(trends).map(([category, trend]) => (
              <div key={category} className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-gray-600">{category}</span>
                <span
                  className={`font-medium ${
                    trend.direction === 'increasing'
                      ? 'text-red-600'
                      : trend.direction === 'decreasing'
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}
                >
                  {trend.direction === 'increasing' && '↑'}
                  {trend.direction === 'decreasing' && '↓'}
                  {trend.direction === 'stable' && '→'}
                  {' '}
                  {Math.abs(trend.percentageChange).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Spending Chart */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h3 className="text-base md:text-lg font-semibold text-gray-900">Spending by Category</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'amount' | 'name' | 'percentage')}
              className="px-3 py-1 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="amount">Sort by Amount</option>
              <option value="percentage">Sort by Percentage</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 flex items-center gap-1"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'pie'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Pie
              </button>
            </div>
          </div>
        </div>
        <CategoryChart data={sortedCategoryData} type={chartType} />
      </div>

      {/* Time Series Chart */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Spending Over Time</h3>
        <TimeSeriesChart data={timeSeriesData} />
      </div>
    </div>
  );
};
