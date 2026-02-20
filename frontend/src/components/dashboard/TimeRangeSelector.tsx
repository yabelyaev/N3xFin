interface TimeRangeSelectorProps {
  value: string;
  onChange: (range: string) => void;
}

export const TimeRangeSelector = ({ value, onChange }: TimeRangeSelectorProps) => {
  const ranges = [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 3 Months', value: '3m' },
    { label: 'Last 6 Months', value: '6m' },
    { label: 'Last Year', value: '1y' },
  ];

  return (
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Time range selection">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            value === range.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
          aria-pressed={value === range.value}
          aria-label={`Select ${range.label}`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};
