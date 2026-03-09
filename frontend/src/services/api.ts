// API Service Layer for N3xFin
import axios, { type AxiosInstance } from 'axios';
import { isDemoMode, demoModeService } from './demoMode';
import { API_BASE_URL } from '../config/aws-config';
import { cache, CACHE_TTL, CACHE_STALE_TIME } from '../utils/cache';

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
        // Don't auto-redirect on 401 - let components handle it
        // if (error.response?.status === 401) {
        //   this.clearToken();
        //   localStorage.removeItem('authToken');
        //   localStorage.removeItem('refreshToken');
        //   localStorage.removeItem('tokenExpiry');
        //   localStorage.removeItem('user');
        //   window.location.href = '/login';
        // }
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

  // Cache management
  clearCache() {
    cache.clearAll();
  }

  clearAnalyticsCache() {
    cache.clearPattern('analytics:');
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
    const response = await this.client.post('/parser/parse', { key });
    
    // Clear all caches when new data is uploaded
    cache.clearPattern('analytics:');
    cache.clearPattern('predictions');
    cache.clearPattern('recommendations');
    cache.clearPattern('alerts');
    
    return response;
  }

  // Categorization endpoints
  async categorizeTransactions(transactionIds: string[]) {
    return this.client.post('/categorization/categorize', { transactionIds });
  }

  async getCategorizationStatus() {
    return this.client.get('/categorization/status');
  }

  // Statement management endpoints
  async deleteStatement(fileKey?: string) {
    const params: Record<string, string> = {};
    if (fileKey) {
      params.fileKey = fileKey;
    } else {
      params.all = 'true';
    }
    return this.client.delete('/upload/files', { params });
  }

  // Analytics endpoints
  async getAnalytics(type: string, startDate?: string, endDate?: string, granularity?: string) {
    if (isDemoMode()) {
      return demoModeService.getAnalytics(type);
    }
    
    // Create cache key
    const cacheKey = `analytics:${type}:${startDate}:${endDate}:${granularity}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      // If data is stale, fetch fresh data in background
      if (cached.isStale) {
        // Background refresh (don't await)
        this.client.get('/analytics', {
          params: { type, startDate, endDate, granularity },
        }).then(response => {
          cache.set(cacheKey, response.data, CACHE_TTL.ANALYTICS, CACHE_STALE_TIME.ANALYTICS);
        }).catch(() => {
          // Silently fail - user already has cached data
        });
      }
      
      // Return cached data immediately
      return { data: cached.data };
    }
    
    // No cache - fetch from API
    const response = await this.client.get('/analytics', {
      params: { type, startDate, endDate, granularity },
    });
    
    // Cache the result
    cache.set(cacheKey, response.data, CACHE_TTL.ANALYTICS, CACHE_STALE_TIME.ANALYTICS);
    
    return response;
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
    
    // Create cache key
    const cacheKey = `predictions:${horizon}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      // If data is stale, fetch fresh data in background
      if (cached.isStale) {
        this.client.get('/predictions', { params: { horizon } })
          .then(response => {
            cache.set(cacheKey, response.data, CACHE_TTL.PREDICTIONS, CACHE_STALE_TIME.PREDICTIONS);
          })
          .catch(() => {});
      }
      return { data: cached.data };
    }
    
    // No cache - fetch from API
    const response = await this.client.get('/predictions', { params: { horizon } });
    
    // Cache the result
    cache.set(cacheKey, response.data, CACHE_TTL.PREDICTIONS, CACHE_STALE_TIME.PREDICTIONS);
    
    return response;
  }

  async getAlerts() {
    if (isDemoMode()) {
      return demoModeService.getAnomalies();
    }
    
    // Create cache key
    const cacheKey = 'alerts';
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      // If data is stale, fetch fresh data in background
      if (cached.isStale) {
        this.client.get('/predictions/alerts')
          .then(response => {
            cache.set(cacheKey, response.data, CACHE_TTL.PREDICTIONS, CACHE_STALE_TIME.PREDICTIONS);
          })
          .catch(() => {});
      }
      return { data: cached.data };
    }
    
    // No cache - fetch from API
    const response = await this.client.get('/predictions/alerts');
    
    // Cache the result
    cache.set(cacheKey, response.data, CACHE_TTL.PREDICTIONS, CACHE_STALE_TIME.PREDICTIONS);
    
    return response;
  }

  // Recommendation endpoints
  async getRecommendations() {
    if (isDemoMode()) {
      return demoModeService.getRecommendations();
    }
    
    // Create cache key
    const cacheKey = 'recommendations';
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      // If data is stale, fetch fresh data in background
      if (cached.isStale) {
        this.client.get('/recommendations')
          .then(response => {
            cache.set(cacheKey, response.data, CACHE_TTL.RECOMMENDATIONS, CACHE_STALE_TIME.RECOMMENDATIONS);
          })
          .catch(() => {});
      }
      return { data: cached.data };
    }
    
    // No cache - fetch from API
    const response = await this.client.get('/recommendations');
    
    // Cache the result
    cache.set(cacheKey, response.data, CACHE_TTL.RECOMMENDATIONS, CACHE_STALE_TIME.RECOMMENDATIONS);
    
    return response;
  }

  // Conversation endpoints
  async askQuestion(question: string) {
    if (isDemoMode()) {
      return demoModeService.askQuestion(question);
    }
    return this.client.post('/conversation/ask', { question });
  }

  // Report endpoints
  async listReports() {
    if (isDemoMode()) {
      return demoModeService.getReports();
    }
    return this.client.get('/reports/generate?action=list');
  }

  async generateReport(year: number, month: number) {
    if (isDemoMode()) {
      return demoModeService.getReports();
    }
    return this.client.post('/reports/generate', { year, month });
  }

  async getReport(reportId: string) {
    if (isDemoMode()) {
      return demoModeService.getReport(reportId);
    }
    return this.client.get(`/reports/${reportId}`);
  }

  async deleteReport(reportId: string) {
    if (isDemoMode()) {
      throw new Error('Cannot delete reports in demo mode');
    }
    return this.client.delete(`/reports/${reportId}`);
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

  // Profile endpoints
  async getProfile() {
    return this.client.get('/profile');
  }

  async saveProfile(profile: any) {
    return this.client.post('/profile', profile);
  }
}

export const apiService = new ApiService();
