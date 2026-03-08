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
  // Track whether the user has ANY data at all (vs just an empty date range)
  const [hasAnyData, setHasAnyData] = useState<boolean | null>(null);

  useEffect(() => {
    // On mount, check if the user has any data at all (all-time query)
    checkHasAnyData();
    // Preload data for other tabs in the background
    preloadTabData();
    // Preload all time ranges in the background
    preloadTimeRanges();
  }, []);

  useEffect(() => {
    loadAnalytics();
    // Preload adjacent time ranges when user changes selection
    preloadAdjacentRanges(timeRange);
  }, [timeRange]);

  const checkHasAnyData = async () => {
    try {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const response = await apiService.getAnalytics(
        'category',
        fiveYearsAgo.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      const data = response.data.data || [];
      setHasAnyData(data.length > 0 || (response.data.totalSpending || 0) > 0);
    } catch {
      setHasAnyData(false);
    }
  };

  const preloadTabData = async () => {
    // Preload recommendations, predictions, and alerts in the background
    // This will cache them so other tabs load instantly
    try {
      await Promise.all([
        apiService.getRecommendations().catch(() => null),
        apiService.getPredictions().catch(() => null),
        apiService.getAlerts().catch(() => null),
      ]);
    } catch (error) {
      // Silently fail - this is just for preloading
      console.log('Background preload completed');
    }
  };

  const preloadTimeRanges = async () => {
    // Preload all common time ranges in the background
    // This makes time range switching instant
    const endDate = new Date().toISOString().split('T')[0];
    const ranges = ['7d', '30d', '3m', '6m', '1y', 'all'];
    
    try {
      // Preload category data for all ranges
      const categoryPromises = ranges.map(range => {
        const startDate = calculateStartDate(range);
        return apiService.getAnalytics('category', startDate, endDate).catch(() => null);
      });
      
      // Preload timeseries data for all ranges
      const timeseriesPromises = ranges.map(range => {
        const startDate = calculateStartDate(range);
        return apiService.getAnalytics('timeseries', startDate, endDate, 'day').catch(() => null);
      });
      
      // Load all in parallel (don't await - background only)
      Promise.all([...categoryPromises, ...timeseriesPromises]).then(() => {
        console.log('All time ranges preloaded');
      });
    } catch (error) {
      // Silently fail
    }
  };

  const preloadAdjacentRanges = (currentRange: string) => {
    // Preload likely next time ranges based on current selection
    const rangeOrder = ['7d', '30d', '3m', '6m', '1y', 'all'];
    const currentIndex = rangeOrder.indexOf(currentRange);
    
    if (currentIndex === -1) return;
    
    const endDate = new Date().toISOString().split('T')[0];
    const rangesToPreload: string[] = [];
    
    // Preload previous and next ranges
    if (currentIndex > 0) rangesToPreload.push(rangeOrder[currentIndex - 1]);
    if (currentIndex < rangeOrder.length - 1) rangesToPreload.push(rangeOrder[currentIndex + 1]);
    
    // Preload in background
    rangesToPreload.forEach(range => {
      const startDate = calculateStartDate(range);
      apiService.getAnalytics('category', startDate, endDate).catch(() => null);
      apiService.getAnalytics('timeseries', startDate, endDate, 'day').catch(() => null);
    });
  };

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
      // Don't show error for 404 (no data) - this is expected for new users
      if (err.response?.status === 404) {
        setAnalyticsData({
          categorySpending: [],
          timeSeriesData: [],
          totalSpending: 0,
          trends: {},
        });
      } else {
        setError(err.response?.data?.error?.message || 'Failed to load analytics data');
      }
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
      case 'all':
        // Go back 5 years for "all time"
        date.setFullYear(date.getFullYear() - 5);
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

  const categoryData = analyticsData?.categorySpending || [];
  const timeSeriesData = analyticsData?.timeSeriesData || [];
  const totalSpending = analyticsData?.totalSpending || 0;
  const trends = analyticsData?.trends || {};

  // Only show welcome screen when user has never uploaded any data
  const hasNoData = !loading && !error && hasAnyData === false && categoryData.length === 0 && totalSpending === 0;
  // Show "no data in this range" message when user has data but selected range is empty
  const hasNoDataInRange = !loading && !error && hasAnyData === true && categoryData.length === 0 && totalSpending === 0;

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

  // Show welcome message for new users (truly no data at all)
  if (hasNoData) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to N3xFin!</h3>
          <p className="text-gray-600 mb-6">
            Get started by uploading your first bank statement to see your spending insights, detect anomalies, and discover savings opportunities.
          </p>
          <a
            href="/upload"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Upload Bank Statement
          </a>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">What you'll get:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div>
                <div className="text-2xl mb-2">📈</div>
                <h4 className="font-semibold text-gray-900 text-sm">Spending Analytics</h4>
                <p className="text-xs text-gray-600">Track spending by category and over time</p>
              </div>
              <div>
                <div className="text-2xl mb-2">🔍</div>
                <h4 className="font-semibold text-gray-900 text-sm">Anomaly Detection</h4>
                <p className="text-xs text-gray-600">Identify unusual transactions automatically</p>
              </div>
              <div>
                <div className="text-2xl mb-2">💰</div>
                <h4 className="font-semibold text-gray-900 text-sm">Savings Tips</h4>
                <p className="text-xs text-gray-600">Get personalized recommendations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show "no data in this range" when user has data but selected period is empty
  if (hasNoDataInRange) {
    return (
      <>
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Time Range</h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions in this period</h3>
          <p className="text-gray-500 text-sm mb-4">
            Your statements don't have data for this time range. Try selecting a wider range.
          </p>
          <button
            onClick={() => setTimeRange('all')}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition-colors text-sm"
          >
            View All Time
          </button>
        </div>
      </>
    );
  }

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

  // Calculate trend percentage for total spending
  const calculateTrendPercentage = () => {
    const allTrends = Object.values(trends);
    if (allTrends.length === 0) return null;
    const avgChange = allTrends.reduce((sum, t) => sum + t.percentageChange, 0) / allTrends.length;
    return avgChange;
  };

  const trendPercentage = calculateTrendPercentage();

  return (
    <div className="space-y-6">
      {/* Header with Time Range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Balance</h2>
          <p className="text-sm text-gray-500 mt-1">Here's an overview of all of your balances.</p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Spending Over Time</h3>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  ${totalSpending.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  chartType === 'pie'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pie
              </button>
            </div>
          </div>
          <TimeSeriesChart data={timeSeriesData} />
        </div>

        {/* Right Column - Summary Cards */}
        <div className="space-y-4">
          {/* Total Balance Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Spending</p>
              <p className="text-3xl font-bold text-gray-900">${totalSpending.toFixed(2)}</p>
              {trendPercentage !== null && (
                <p className={`text-sm mt-2 ${trendPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
                </p>
              )}
            </div>
          </div>

          {/* Category Breakdown Cards */}
          {sortedCategoryData.slice(0, 3).map((cat, idx) => {
            const icons = ['🛒', '🏠', '🚗', '🍔', '💳'];
            const colors = ['bg-cyan-50 text-cyan-600', 'bg-purple-50 text-purple-600', 'bg-yellow-50 text-yellow-600'];
            
            return (
              <div key={cat.category} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${colors[idx % colors.length].split(' ')[0]} rounded-xl flex items-center justify-center text-2xl`}>
                    {icons[idx % icons.length]}
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">{cat.category}</p>
                  <p className="text-2xl font-bold text-gray-900">${cat.totalAmount.toFixed(2)}</p>
                  <p className={`text-sm mt-2 ${
                    trends[cat.category]?.direction === 'increasing' ? 'text-red-600' :
                    trends[cat.category]?.direction === 'decreasing' ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    {trends[cat.category]?.direction === 'increasing' && '+'}
                    {trends[cat.category]?.direction === 'decreasing' && '-'}
                    {trends[cat.category] ? Math.abs(trends[cat.category].percentageChange).toFixed(1) : '0.0'}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Spending by Category</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'amount' | 'name' | 'percentage')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 transition-colors"
            >
              <option value="amount">Sort by Amount</option>
              <option value="percentage">Sort by Percentage</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 transition-colors flex items-center gap-1"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>
        </div>
        <CategoryChart data={sortedCategoryData} type={chartType} />
      </div>
    </div>
  );
};
