import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LoginPage, RegisterPage, DashboardPage } from './pages';
import { isAuthenticated, getAuthToken, initSessionTimeout } from './utils/auth';
import { apiService } from './services/api';
import { isDemoMode } from './services/demoMode';
import { FileUpload } from './components/upload';
import { ChatInterface } from './components/conversation';
import { ReportsPage } from './components/reports';
import { SettingsPage } from './components/settings';
import { Navigation } from './components/layout';
import { ErrorBoundary, ToastProvider, LoadingSpinner } from './components/common';

// Placeholder components - to be implemented
const UploadPage = () => (
  <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Bank Statement</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload your CSV or PDF bank statement to analyze your spending
        </p>
      </div>
      <FileUpload
        onUploadComplete={(key) => {
          console.log('Upload complete:', key);
          // TODO: Navigate to processing/dashboard page
        }}
        onUploadError={(error) => {
          console.error('Upload error:', error);
        }}
      />
    </div>
  </div>
);
const AnalyticsPage = () => <div className="p-8">Analytics Page - To be implemented</div>;
const ConversationPage = () => (
  <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Financial Assistant</h1>
        <p className="mt-2 text-sm text-gray-600">
          Ask questions about your spending patterns and get personalized insights
        </p>
      </div>
      <div className="h-[calc(100vh-16rem)]">
        <ChatInterface />
      </div>
    </div>
  </div>
);
// ReportsPage now imported from components
const SettingsPageWrapper = () => (
  <div className="bg-gray-50">
    <SettingsPage />
  </div>
);

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      // Check if demo mode is enabled
      const demoMode = isDemoMode();
      const authStatus = demoMode || isAuthenticated();
      setAuthenticated(authStatus);
      
      // Set token in API service if authenticated
      if (authStatus) {
        const token = getAuthToken();
        if (token) {
          apiService.setToken(token);
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Initialize session timeout
  useEffect(() => {
    if (authenticated) {
      const cleanup = initSessionTimeout(() => {
        setAuthenticated(false);
        window.location.href = '/login';
      }, 30); // 30 minutes timeout

      return cleanup;
    }
  }, [authenticated]);

  // Protected route wrapper with Navigation
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }
    return authenticated ? (
      <>
        <Navigation />
        {children}
      </>
    ) : (
      <Navigate to="/login" replace />
    );
  };

  // Public route wrapper (redirect to dashboard if already authenticated)
  const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }
    return authenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conversation"
                element={
                  <ProtectedRoute>
                    <ConversationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPageWrapper />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
