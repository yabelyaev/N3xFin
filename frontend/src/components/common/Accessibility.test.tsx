import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';

describe('Accessibility Tests', () => {
  describe('LoadingSpinner', () => {
    it('has proper ARIA role and label', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('provides screen reader text', () => {
      const { container } = render(<LoadingSpinner />);
      const srText = container.querySelector('.sr-only');
      expect(srText).toBeInTheDocument();
      expect(srText?.textContent).toBe('Loading...');
    });
  });

  describe('ErrorBoundary', () => {
    it('renders children without errors', () => {
      render(
        <ErrorBoundary>
          <div role="main">Test content</div>
        </ErrorBoundary>
      );
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('provides accessible error UI with button', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();

      console.error = originalError;
    });
  });
});
