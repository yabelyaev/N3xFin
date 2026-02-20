// Recommendation types for N3xFin

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  potentialSavings: number;
  actionItems: string[];
  priority: number;
}
