// Type definitions for N3xFin

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  category?: string;
  categoryConfidence?: number;
  isAnomaly?: boolean;
  anomalyScore?: number;
  hash: string;
  rawData: string;
  createdAt: string;
}

export interface SpendingByCategory {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface SpendingOverTime {
  date: string;
  amount: number;
  category?: string;
}

export interface Anomaly {
  transactionId: string;
  transaction: Transaction;
  score: number;
  reason: string;
  detectedAt: string;
}

export interface Prediction {
  category: string;
  predictedAmount: number;
  historicalAverage: number;
  confidence: number;
  horizon: number;
}

export interface Alert {
  id: string;
  userId: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  predictedAmount: number;
  historicalAverage: number;
  recommendations: string[];
  createdAt: string;
}

export interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
  actionItems: string[];
}

export interface Report {
  id: string;
  userId: string;
  month: string;
  totalSpending: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  categoryBreakdown: SpendingByCategory[];
  trends: {
    spendingChange: number;
    incomeChange: number;
  };
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FileUpload {
  filename: string;
  uploadUrl: string;
  key: string;
}
