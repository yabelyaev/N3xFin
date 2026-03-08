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
  const range = maxAmount - minAmount || 1;
  const padding = 60;
  const width = 900;
  const height = 400;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((item.amount - minAmount) / range) * chartHeight;
    return { x, y, ...item };
  });

  // Create smooth curve using cubic bezier
  const createSmoothPath = (points: typeof points) => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      
      path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
      path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    
    return path;
  };

  const smoothPath = createSmoothPath(points);
  
  // Create area fill path
  const areaPath = smoothPath + ` L ${points[points.length - 1].x} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 sm:h-72 md:h-80 lg:h-96">
        <defs>
          {/* Gradient for area fill */}
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
          
          {/* Shadow filter */}
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

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
                strokeDasharray={ratio === 0 ? "0" : "4 4"}
                opacity={ratio === 0 ? "1" : "0.5"}
              />
              <text
                x={padding - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="13"
                fill="#6b7280"
                fontWeight="500"
              >
                {formatCurrency(value)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
        />

        {/* Smooth line chart */}
        <path
          d={smoothPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#shadow)"
        />

        {/* Data points */}
        {points.map((point, index) => {
          const showLabel = index % Math.max(1, Math.ceil(data.length / 8)) === 0 || 
                           index === 0 || 
                           index === points.length - 1;
          
          return (
            <g key={index}>
              {/* Point circle with hover effect */}
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="#3b82f6"
                strokeWidth="3"
                className="transition-all hover:r-6"
                style={{ cursor: 'pointer' }}
              />
              
              {/* Date labels */}
              {showLabel && (
                <text
                  x={point.x}
                  y={height - padding + 30}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6b7280"
                  fontWeight="500"
                >
                  {new Date(point.timestamp).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
