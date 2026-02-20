// Conversation types for N3xFin

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationResponse {
  answer: string;
  confidence: number;
  sources?: string[];
  timestamp: string;
}

export interface ConversationError {
  message: string;
  isUnanswerable?: boolean;
  suggestedQuestions?: string[];
}
