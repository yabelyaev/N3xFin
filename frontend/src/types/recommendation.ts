// Recommendation types for N3xFin

export interface CategoryTrendPoint {
  month: string;   // e.g. 'Dec 2025'
  amount: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  potentialSavings: number;
  actionItems: string[];
  priority: number;
  isSpike?: boolean;
  categoryTrends?: CategoryTrendPoint[];
}
