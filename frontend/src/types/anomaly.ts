// Anomaly types for N3xFin

export interface Anomaly {
  id: string;
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  expectedRange: {
    min: number;
    max: number;
  };
  userFeedback?: 'legitimate' | 'fraudulent';
}
