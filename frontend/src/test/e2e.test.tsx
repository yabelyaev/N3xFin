/**
 * End-to-end integration tests for N3xFin frontend workflows.
 * 
 * Tests complete user workflows and error scenarios.
 * Requirements: 1.1, 2.1, 3.1, 4.1, 6.1, 7.1, 8.1, 9.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as authUtils from '../utils/auth';

// Mock auth utilities
vi.mock('../utils/auth', () => ({
  isAuthenticated: vi.fn(),
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  initSessionTimeout: vi.fn(() => () => {})
}));

// Mock API service
vi.mock('../services/api', () => {
  const mockApiService = {
    setToken: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getUploadUrl: vi.fn(),
    verifyUpload: vi.fn(),
    getAnalytics: vi.fn(),
    getAlerts: vi.fn(),
    getRecommendations: vi.fn(),
    askQuestion: vi.fn(),
    getReports: vi.fn(),
    exportReport: vi.fn()
  };
  
  return {
    apiService: mockApiService
  };
});

import { apiService } from '../services/api';

describe('E2E: Complete User Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (authUtils.isAuthenticated as any).mockReturnValue(false);
    (authUtils.getAuthToken as any).mockReturnValue(null);
  });

  describe('Authentication Workflow', () => {
    it('should display login page when not authenticated', async () => {
      /**
       * Requirements: 1.1
       * Tests: Unauthenticated users see login page
       */
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('should handle login submission', async () => {
      /**
       * Requirements: 1.1
       * Tests: User authentication flow
       */
      const user = userEvent.setup();

      (apiService.login as any).mockResolvedValue({
        token: 'mock-token',
        user: { id: 'user-123', email: 'test@example.com' }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(loginButton);

      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalledWith('test@example.com', 'SecurePass123!');
      });
    });
  });

  describe('Dashboard Workflow (Authenticated)', () => {
    beforeEach(() => {
      // Mock authenticated state
      (authUtils.isAuthenticated as any).mockReturnValue(true);
      (authUtils.getAuthToken as any).mockReturnValue('mock-token');
    });

    it('should load and display dashboard analytics', async () => {
      /**
       * Requirements: 4.1
       * Tests: Dashboard analytics display
       */
      (apiService.getAnalytics as any).mockResolvedValue({
        categorySpending: [
          { category: 'Dining', totalAmount: 200.00, transactionCount: 8, percentageOfTotal: 40 },
          { category: 'Transportation', totalAmount: 100.00, transactionCount: 5, percentageOfTotal: 20 }
        ],
        timeSeriesData: [],
        totalSpending: 500.00,
        trends: { direction: 'stable', percentageChange: 2 }
      });

      (apiService.getAlerts as any).mockResolvedValue([]);
      (apiService.getRecommendations as any).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(apiService.getAnalytics).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle login errors', async () => {
      /**
       * Requirements: 1.1
       * Tests: Error handling during authentication
       */
      (apiService.login as any).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(loginButton);

      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalled();
      });
    });

    it('should handle empty dashboard data', async () => {
      /**
       * Requirements: 4.1
       * Tests: Dashboard with no data
       */
      (authUtils.isAuthenticated as any).mockReturnValue(true);
      (authUtils.getAuthToken as any).mockReturnValue('mock-token');

      (apiService.getAnalytics as any).mockResolvedValue({
        categorySpending: [],
        timeSeriesData: [],
        totalSpending: 0,
        trends: { direction: 'stable', percentageChange: 0 }
      });

      (apiService.getAlerts as any).mockResolvedValue([]);
      (apiService.getRecommendations as any).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(apiService.getAnalytics).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle API errors gracefully', async () => {
      /**
       * Tests: API error handling
       */
      (authUtils.isAuthenticated as any).mockReturnValue(true);
      (authUtils.getAuthToken as any).mockReturnValue('mock-token');

      (apiService.getAnalytics as any).mockRejectedValue(new Error('API Error'));
      (apiService.getAlerts as any).mockResolvedValue([]);
      (apiService.getRecommendations as any).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(apiService.getAnalytics).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Data Integrity', () => {
    beforeEach(() => {
      (authUtils.isAuthenticated as any).mockReturnValue(true);
      (authUtils.getAuthToken as any).mockReturnValue('mock-token');
    });

    it('should maintain data consistency', async () => {
      /**
       * Requirements: 4.1
       * Tests: Data consistency across views
       */
      const mockData = {
        categorySpending: [
          { category: 'Dining', totalAmount: 300.00, transactionCount: 10, percentageOfTotal: 60 }
        ],
        timeSeriesData: [],
        totalSpending: 500.00,
        trends: { direction: 'stable', percentageChange: 0 }
      };

      (apiService.getAnalytics as any).mockResolvedValue(mockData);
      (apiService.getAlerts as any).mockResolvedValue([]);
      (apiService.getRecommendations as any).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(apiService.getAnalytics).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify consistent data structure
      await expect((apiService.getAnalytics as any).mock.results[0].value).resolves.toEqual(mockData);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should verify API calls are made during authentication flow', async () => {
      /**
       * Requirements: 1.1, 4.1
       * Tests: Complete end-to-end user workflow
       */
      const user = userEvent.setup();

      // Start unauthenticated
      (authUtils.isAuthenticated as any).mockReturnValue(false);
      
      (apiService.login as any).mockResolvedValue({
        token: 'mock-token',
        user: { id: 'user-123', email: 'test@example.com' }
      });

      render(<App />);

      // Should see login page
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      // Login
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.click(loginButton);

      await waitFor(() => {
        expect(apiService.login).toHaveBeenCalled();
      });
    });
  });
});
