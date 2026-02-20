// Prediction types for N3xFin

export interface Alert {
  id: string;
  userId: string;
  category: string;
  message: string;
  predictedAmount: number;
  historicalAverage: number;
  severity: 'info' | 'warning' | 'critical';
  recommendations: string[];
  createdAt: string;
}

export interface Prediction {
  category: string;
  predictedAmount: number;
  confidence: number;
  horizon: number;
  historicalAverage: number;
}
