// Anomaly types for N3xFin

export interface AnomalyTransaction {
  id: string;
  date: string;
  description: string;
  amount: string | number;
  category: string;
  sourceFile?: string;
}

export interface Anomaly {
  transaction: AnomalyTransaction;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  expectedRange: {
    min: number;
    max: number;
  };
  zScore?: number;
  // legacy flat fields (keep for safety)
  id?: string;
  transactionId?: string;
  userFeedback?: 'legitimate' | 'fraudulent';
}
