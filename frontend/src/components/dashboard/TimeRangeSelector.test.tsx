import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { TimeRangeSelector } from './TimeRangeSelector';

describe('TimeRangeSelector', () => {
  it('renders all time range options', () => {
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 3 Months')).toBeInTheDocument();
    expect(screen.getByText('Last 6 Months')).toBeInTheDocument();
    expect(screen.getByText('Last Year')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('highlights the selected time range', () => {
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    const selectedButton = screen.getByText('Last 30 Days');
    expect(selectedButton).toHaveClass('bg-blue-600', 'text-white');
  });

  it('does not highlight unselected time ranges', () => {
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    const unselectedButton = screen.getByText('Last 7 Days');
    expect(unselectedButton).toHaveClass('bg-white', 'text-gray-700');
  });

  it('calls onChange when a time range is clicked', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    const sevenDaysButton = screen.getByText('Last 7 Days');
    await user.click(sevenDaysButton);

    expect(mockOnChange).toHaveBeenCalledWith('7d');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with correct value for each button', async () => {
    const user = userEvent.setup();
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    await user.click(screen.getByText('Last 7 Days'));
    expect(mockOnChange).toHaveBeenLastCalledWith('7d');

    await user.click(screen.getByText('Last 30 Days'));
    expect(mockOnChange).toHaveBeenLastCalledWith('30d');

    await user.click(screen.getByText('Last 3 Months'));
    expect(mockOnChange).toHaveBeenLastCalledWith('3m');

    await user.click(screen.getByText('Last 6 Months'));
    expect(mockOnChange).toHaveBeenLastCalledWith('6m');

    await user.click(screen.getByText('Last Year'));
    expect(mockOnChange).toHaveBeenLastCalledWith('1y');

    await user.click(screen.getByText('All Time'));
    expect(mockOnChange).toHaveBeenLastCalledWith('all');

    expect(mockOnChange).toHaveBeenCalledTimes(6);
  });

  it('updates visual state when value prop changes', () => {
    const mockOnChange = vi.fn();
    const { rerender } = render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    expect(screen.getByText('Last 30 Days')).toHaveClass('bg-blue-600');
    expect(screen.getByText('Last 7 Days')).toHaveClass('bg-white');

    rerender(<TimeRangeSelector value="7d" onChange={mockOnChange} />);

    expect(screen.getByText('Last 7 Days')).toHaveClass('bg-blue-600');
    expect(screen.getByText('Last 30 Days')).toHaveClass('bg-white');
  });

  it('renders buttons with correct accessibility attributes', () => {
    const mockOnChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={mockOnChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);

    buttons.forEach(button => {
      expect(button).toBeEnabled();
    });
  });
});
