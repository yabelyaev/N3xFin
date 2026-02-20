import type { TimeSeriesData } from '../../types/analytics';

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
}

export const TimeSeriesChart = ({ data }: TimeSeriesChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No time series data available
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount));
  const minAmount = Math.min(...data.map(d => d.amount), 0);
  const range = maxAmount - minAmount;
  const padding = 50;
  const width = 800;
  const height = 400;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((item.amount - minAmount) / range) * chartHeight;
    return { x, y, ...item };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 sm:h-72 md:h-80 lg:h-96">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + chartHeight * (1 - ratio);
          const value = minAmount + range * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={padding - 10}
                y={y + 5}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                ${value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Line chart */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
            {index % Math.ceil(data.length / 6) === 0 && (
              <text
                x={point.x}
                y={height - padding + 25}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
