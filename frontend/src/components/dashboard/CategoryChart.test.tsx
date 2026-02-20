import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryChart } from './CategoryChart';
import type { CategorySpending } from '../../types/analytics';

describe('CategoryChart', () => {
  const mockData: CategorySpending[] = [
    { category: 'Dining', totalAmount: 500, transactionCount: 10, percentageOfTotal: 40 },
    { category: 'Transportation', totalAmount: 300, transactionCount: 5, percentageOfTotal: 24 },
    { category: 'Utilities', totalAmount: 450, transactionCount: 3, percentageOfTotal: 36 },
  ];

  describe('Bar Chart', () => {
    it('renders bar chart with category data', () => {
      render(<CategoryChart data={mockData} type="bar" />);

      expect(screen.getByText('Dining')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
    });

    it('displays amounts and percentages correctly', () => {
      render(<CategoryChart data={mockData} type="bar" />);

      expect(screen.getByText(/\$500\.00/)).toBeInTheDocument();
      expect(screen.getByText(/40\.0%/)).toBeInTheDocument();
      expect(screen.getByText(/\$300\.00/)).toBeInTheDocument();
      expect(screen.getByText(/24\.0%/)).toBeInTheDocument();
    });

    it('renders progress bars for each category', () => {
      const { container } = render(<CategoryChart data={mockData} type="bar" />);

      const progressBars = container.querySelectorAll('.bg-gray-200');
      expect(progressBars.length).toBe(3);
    });

    it('scales bar widths relative to max amount', () => {
      const { container } = render(<CategoryChart data={mockData} type="bar" />);

      const bars = container.querySelectorAll('.bg-gray-200 > div');
      
      // Dining has max amount (500), should be 100% width
      const diningBar = bars[0] as HTMLElement;
      expect(diningBar.style.width).toBe('100%');

      // Transportation (300) should be 60% of max (500)
      const transportBar = bars[1] as HTMLElement;
      expect(transportBar.style.width).toBe('60%');

      // Utilities (450) should be 90% of max (500)
      const utilitiesBar = bars[2] as HTMLElement;
      expect(utilitiesBar.style.width).toBe('90%');
    });

    it('shows empty state when no data provided', () => {
      render(<CategoryChart data={[]} type="bar" />);

      expect(screen.getByText(/no spending data available/i)).toBeInTheDocument();
    });
  });

  describe('Pie Chart', () => {
    it('renders pie chart with category data', () => {
      render(<CategoryChart data={mockData} type="pie" />);

      expect(screen.getByText('Dining')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
    });

    it('renders SVG pie chart', () => {
      const { container } = render(<CategoryChart data={mockData} type="pie" />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 200 200');
    });

    it('creates correct number of pie slices', () => {
      const { container } = render(<CategoryChart data={mockData} type="pie" />);

      const paths = container.querySelectorAll('path');
      expect(paths.length).toBe(3);
    });

    it('renders legend with colored indicators', () => {
      const { container } = render(<CategoryChart data={mockData} type="pie" />);

      const legendItems = container.querySelectorAll('.w-3.h-3.rounded');
      expect(legendItems.length).toBe(3);
    });

    it('shows empty state when no data provided', () => {
      render(<CategoryChart data={[]} type="pie" />);

      expect(screen.getByText(/no spending data available/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles single category', () => {
      const singleCategory: CategorySpending[] = [
        { category: 'Dining', totalAmount: 500, transactionCount: 10, percentageOfTotal: 100 },
      ];

      render(<CategoryChart data={singleCategory} type="bar" />);

      expect(screen.getByText('Dining')).toBeInTheDocument();
      expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
    });

    it('handles many categories', () => {
      const manyCategories: CategorySpending[] = Array.from({ length: 15 }, (_, i) => ({
        category: `Category ${i + 1}`,
        totalAmount: 100 * (i + 1),
        transactionCount: i + 1,
        percentageOfTotal: 100 / 15,
      }));

      render(<CategoryChart data={manyCategories} type="bar" />);

      expect(screen.getByText('Category 1')).toBeInTheDocument();
      expect(screen.getByText('Category 15')).toBeInTheDocument();
    });

    it('handles zero amounts', () => {
      const zeroData: CategorySpending[] = [
        { category: 'Dining', totalAmount: 0, transactionCount: 0, percentageOfTotal: 0 },
      ];

      render(<CategoryChart data={zeroData} type="bar" />);

      expect(screen.getByText(/\$0\.00/)).toBeInTheDocument();
    });

    it('handles very large amounts', () => {
      const largeAmounts: CategorySpending[] = [
        { category: 'Housing', totalAmount: 999999.99, transactionCount: 1, percentageOfTotal: 100 },
      ];

      render(<CategoryChart data={largeAmounts} type="bar" />);

      expect(screen.getByText(/\$999999\.99/)).toBeInTheDocument();
    });

    it('defaults to bar chart when type not specified', () => {
      const { container } = render(<CategoryChart data={mockData} />);

      // Bar chart has progress bars with bg-gray-200 class
      const progressBars = container.querySelectorAll('.bg-gray-200');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });
});
