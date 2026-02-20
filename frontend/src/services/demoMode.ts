// Demo mode service - provides mock API responses
import { mockAnalytics, mockAnomalies, mockPredictions, mockRecommendations, mockReports } from './mockData';

export const demoModeService = {
  // Auth
  login: async () => {
    return {
      token: 'demo-token-12345',
      user: { id: 'demo-user', email: 'demo@n3xfin.com' },
    };
  },

  // Analytics
  getAnalytics: async (type: string) => {
    if (type === 'category') {
      return { 
        data: {
          data: mockAnalytics.categorySpending,
          totalSpending: 1932.79,
          trends: {
            'Dining': { direction: 'increasing' as const, percentageChange: 15 },
            'Shopping': { direction: 'stable' as const, percentageChange: 2 },
          }
        }
      };
    }
    if (type === 'timeseries') {
      return { 
        data: {
          data: mockAnalytics.timeSeriesData
        }
      };
    }
    return { data: { data: [] } };
  },

  // Anomalies
  getAnomalies: async () => {
    return { data: mockAnomalies };
  },

  submitAnomalyFeedback: async () => {
    return { success: true };
  },

  // Predictions
  getPredictions: async () => {
    return { data: mockPredictions };
  },

  // Recommendations
  getRecommendations: async () => {
    return { data: mockRecommendations };
  },

  // Reports
  getReports: async () => {
    return { data: mockReports };
  },

  getReport: async (_month: string) => {
    return { data: mockReports[0] };
  },

  // Conversation
  askQuestion: async (question: string) => {
    // Simple mock responses based on keywords
    let answer = "Based on your spending data, ";
    
    if (question.toLowerCase().includes('spend') || question.toLowerCase().includes('spent')) {
      answer += "you've spent $1,932.79 this month. Your largest expense is housing at $1,200, followed by shopping at $305.30.";
    } else if (question.toLowerCase().includes('save') || question.toLowerCase().includes('saving')) {
      answer += "your savings rate is 35.6% this month, which is excellent! You're saving $1,067.21 from your $3,000 income.";
    } else if (question.toLowerCase().includes('dining') || question.toLowerCase().includes('food')) {
      answer += "you spent $87 on dining this month across 3 transactions. This is 15% higher than your usual spending in this category.";
    } else {
      answer += "I can help you understand your spending patterns. Try asking about your spending, savings, or specific categories like dining or transportation.";
    }

    return {
      data: {
        answer,
        timestamp: new Date().toISOString(),
        confidence: 0.9,
        sources: ['Your transaction history', 'Spending analytics'],
      },
    };
  },

  // Upload (mock)
  uploadFile: async () => {
    return {
      data: {
        fileKey: 'demo-file-key',
        message: 'File uploaded successfully (demo mode)',
      },
    };
  },

  // Settings
  getPreferences: async () => {
    return {
      data: {
        alertThreshold: 120,
        reportFrequency: 'monthly',
      },
    };
  },

  updatePreferences: async (prefs: any) => {
    return { success: true, data: prefs };
  },
};

// Check if demo mode is enabled
export const isDemoMode = () => {
  return localStorage.getItem('demoMode') === 'true';
};

// Enable demo mode
export const enableDemoMode = () => {
  localStorage.setItem('demoMode', 'true');
  localStorage.setItem('authToken', 'demo-token-12345');
  localStorage.setItem('user', JSON.stringify({ id: 'demo-user', email: 'demo@n3xfin.com' }));
};

// Disable demo mode
export const disableDemoMode = () => {
  localStorage.removeItem('demoMode');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};
