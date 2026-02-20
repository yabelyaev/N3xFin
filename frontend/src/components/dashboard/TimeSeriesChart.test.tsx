import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeSeriesChart } from './TimeSeriesChart';
import type { TimeSeriesData } from '../../types/analytics';

describe('TimeSeriesChart', () => {
  const mockData: TimeSeriesData[] = [
    { timestamp: '2024-01-01', amount: 100 },
    { timestamp: '2024-01-02', amount: 150 },
    { timestamp: '2024-01-03', amount: 200 },
    { timestamp: '2024-01-04', amount: 120 },
    { timestamp: '2024-01-05', amount: 180 },
  ];

  it('renders time series chart with data', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows empty state when no data provided', () => {
    render(<TimeSeriesChart data={[]} />);

    expect(screen.getByText(/no time series data available/i)).toBeInTheDocument();
  });

  it('renders correct number of data points', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(mockData.length);
  });

  it('renders line path connecting data points', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('d');
    expect(path?.getAttribute('d')).toContain('M'); // Move command
    expect(path?.getAttribute('d')).toContain('L'); // Line command
  });

  it('renders grid lines for y-axis', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const gridLines = container.querySelectorAll('line');
    expect(gridLines.length).toBe(5); // 0, 0.25, 0.5, 0.75, 1.0
  });

  it('displays y-axis labels with dollar amounts', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const labels = container.querySelectorAll('text');
    const yAxisLabels = Array.from(labels).filter(label => 
      label.textContent?.startsWith('$')
    );
    
    expect(yAxisLabels.length).toBeGreaterThan(0);
  });

  it('displays date labels on x-axis', () => {
    const { container } = render(<TimeSeriesChart data={mockData} />);

    const labels = container.querySelectorAll('text');
    const dateLabels = Array.from(labels).filter(label => 
      label.textContent?.includes('Jan')
    );
    
    expect(dateLabels.length).toBeGreaterThan(0);
  });

  it('handles single data point', () => {
    const singlePoint: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: 100 },
    ];

    const { container } = render(<TimeSeriesChart data={singlePoint} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(1);
  });

  it('handles negative amounts', () => {
    const negativeData: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: -50 },
      { timestamp: '2024-01-02', amount: 100 },
      { timestamp: '2024-01-03', amount: -30 },
    ];

    const { container } = render(<TimeSeriesChart data={negativeData} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('handles zero amounts', () => {
    const zeroData: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: 0 },
      { timestamp: '2024-01-02', amount: 0 },
    ];

    const { container } = render(<TimeSeriesChart data={zeroData} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('handles large datasets', () => {
    const largeData: TimeSeriesData[] = Array.from({ length: 100 }, (_, i) => ({
      timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
      amount: Math.random() * 1000,
    }));

    const { container } = render(<TimeSeriesChart data={largeData} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(100);
  });

  it('handles very large amounts', () => {
    const largeAmounts: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: 999999 },
      { timestamp: '2024-01-02', amount: 1000000 },
    ];

    const { container } = render(<TimeSeriesChart data={largeAmounts} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('scales chart correctly based on data range', () => {
    const wideRangeData: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: 10 },
      { timestamp: '2024-01-02', amount: 1000 },
    ];

    const { container } = render(<TimeSeriesChart data={wideRangeData} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);

    // Verify circles have different y positions
    const circle1 = circles[0] as SVGCircleElement;
    const circle2 = circles[1] as SVGCircleElement;
    
    expect(circle1.getAttribute('cy')).not.toBe(circle2.getAttribute('cy'));
  });

  it('handles data with category information', () => {
    const dataWithCategory: TimeSeriesData[] = [
      { timestamp: '2024-01-01', amount: 100, category: 'Dining' },
      { timestamp: '2024-01-02', amount: 150, category: 'Transportation' },
    ];

    const { container } = render(<TimeSeriesChart data={dataWithCategory} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });
});
