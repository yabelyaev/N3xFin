// API Service Layer for N3xFin
import axios, { type AxiosInstance } from 'axios';
import { isDemoMode, demoModeService } from './demoMode';
import { API_BASE_URL } from '../config/aws-config';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: any) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error: any) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          this.clearToken();
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('tokenExpiry');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  setBaseURL(url: string) {
    this.client.defaults.baseURL = url;
  }

  // Auth endpoints
  async register(email: string, password: string) {
    return this.client.post('/auth/register', { email, password });
  }

  async login(email: string, password: string) {
    if (isDemoMode()) {
      return demoModeService.login();
    }
    return this.client.post('/auth/login', { email, password });
  }

  async verify(email: string, code: string) {
    return this.client.post('/auth/verify', { email, code });
  }

  async logout() {
    return this.client.post('/auth/logout');
  }

  // Upload endpoints
  async getUploadUrl(filename: string) {
    return this.client.post('/upload/url', { filename });
  }

  async verifyUpload(key: string) {
    return this.client.post('/upload/verify', { key });
  }

  async listFiles() {
    return this.client.get('/upload/files');
  }

  // Parser endpoints
  async parseStatement(key: string) {
    return this.client.post('/parser/parse', { key });
  }

  // Categorization endpoints
  async categorizeTransactions(transactionIds: string[]) {
    return this.client.post('/categorization/categorize', { transactionIds });
  }

  // Analytics endpoints
  async getAnalytics(type: string, startDate?: string, endDate?: string, granularity?: string) {
    if (isDemoMode()) {
      return demoModeService.getAnalytics(type);
    }
    return this.client.get('/analytics', {
      params: { type, startDate, endDate, granularity },
    });
  }

  async submitAnomalyFeedback(transactionId: string, isLegitimate: boolean) {
    if (isDemoMode()) {
      return demoModeService.submitAnomalyFeedback();
    }
    return this.client.post('/analytics/anomaly-feedback', {
      transactionId,
      isLegitimate,
    });
  }

  // Prediction endpoints
  async getPredictions(horizon: number = 30) {
    if (isDemoMode()) {
      return demoModeService.getPredictions();
    }
    return this.client.get('/predictions', { params: { horizon } });
  }

  async getAlerts() {
    if (isDemoMode()) {
      return demoModeService.getAnomalies();
    }
    return this.client.get('/predictions/alerts');
  }

  // Recommendation endpoints
  async getRecommendations() {
    if (isDemoMode()) {
      return demoModeService.getRecommendations();
    }
    return this.client.get('/recommendations');
  }

  // Conversation endpoints
  async askQuestion(question: string) {
    if (isDemoMode()) {
      return demoModeService.askQuestion(question);
    }
    return this.client.post('/conversation/ask', { question });
  }

  // Report endpoints
  async generateReport(month?: string) {
    if (isDemoMode()) {
      return demoModeService.getReports();
    }
    return this.client.post('/reports/generate', { month });
  }

  async getReport(reportId: string) {
    if (isDemoMode()) {
      return demoModeService.getReport(reportId);
    }
    return this.client.get(`/reports/${reportId}`);
  }

  async exportReportCSV(reportId: string) {
    return this.client.get(`/reports/${reportId}/export/csv`, {
      responseType: 'blob',
    });
  }

  // Account deletion endpoints
  async requestAccountDeletion() {
    return this.client.post('/account/delete/request');
  }

  async cancelAccountDeletion() {
    return this.client.post('/account/delete/cancel');
  }

  async getUserDataSummary() {
    return this.client.get('/account/data-summary');
  }

  // User preferences endpoints
  async getUserPreferences() {
    if (isDemoMode()) {
      return demoModeService.getPreferences();
    }
    return this.client.get('/user/preferences');
  }

  async updateUserPreferences(preferences: { alertThreshold: number; reportFrequency: string }) {
    if (isDemoMode()) {
      return demoModeService.updatePreferences(preferences);
    }
    return this.client.put('/user/preferences', preferences);
  }
}

export const apiService = new ApiService();
