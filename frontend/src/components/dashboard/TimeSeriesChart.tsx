import { useState } from 'react';
import type { TimeSeriesData } from '../../types/analytics';

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
}

export const TimeSeriesChart = ({ data }: TimeSeriesChartProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

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
  const createSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 2) return '';
    
    let path = `M ${pts[0].x} ${pts[0].y}`;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
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

  // Format full currency for tooltip
  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format date for tooltip
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full relative">
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
          const isHovered = hoveredPoint === index;
          
          return (
            <g key={index}>
              {/* Invisible larger circle for easier hover */}
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              
              {/* Point circle with hover effect */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? "6" : "4"}
                fill="white"
                stroke="#3b82f6"
                strokeWidth={isHovered ? "4" : "3"}
                style={{ 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none'
                }}
              />
              
              {/* Tooltip on hover */}
              {isHovered && (
                <g>
                  {/* Tooltip background */}
                  <rect
                    x={point.x - 80}
                    y={point.y - 70}
                    width="160"
                    height="55"
                    rx="8"
                    fill="white"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    filter="url(#shadow)"
                  />
                  {/* Tooltip date */}
                  <text
                    x={point.x}
                    y={point.y - 48}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                    fontWeight="500"
                  >
                    {formatDate(point.timestamp)}
                  </text>
                  {/* Tooltip amount */}
                  <text
                    x={point.x}
                    y={point.y - 28}
                    textAnchor="middle"
                    fontSize="16"
                    fill="#111827"
                    fontWeight="700"
                  >
                    {formatFullCurrency(point.amount)}
                  </text>
                </g>
              )}
              
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
