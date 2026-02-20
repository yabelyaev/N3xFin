// Analytics types for N3xFin

export interface CategorySpending {
  category: string;
  totalAmount: number;
  transactionCount: number;
  percentageOfTotal: number;
}

export interface TimeSeriesData {
  timestamp: string;
  amount: number;
  category?: string;
}

export interface Trend {
  direction: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
  comparisonPeriod: string;
}

export interface AnalyticsData {
  categorySpending?: CategorySpending[];
  timeSeriesData?: TimeSeriesData[];
  totalSpending?: number;
  trends?: Record<string, Trend>;
}
