import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with small size', () => {
    render(<LoadingSpinner size="sm" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with large size', () => {
    render(<LoadingSpinner size="lg" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
