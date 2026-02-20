import type { CategorySpending } from '../../types/analytics';

interface CategoryChartProps {
  data: CategorySpending[];
  type?: 'pie' | 'bar';
}

export const CategoryChart = ({ data, type = 'bar' }: CategoryChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No spending data available
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.totalAmount));
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-gray-500'
  ];

  if (type === 'bar') {
    return (
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.category} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">{item.category}</span>
              <span className="text-gray-600">
                ${item.totalAmount.toFixed(2)} ({item.percentageOfTotal.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`${colors[index % colors.length]} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${(item.totalAmount / maxAmount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Simple pie chart representation
  const total = data.reduce((sum, item) => sum + item.totalAmount, 0);
  let currentAngle = 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64">
        {data.map((item, index) => {
          const percentage = (item.totalAmount / total) * 100;
          const angle = (percentage / 100) * 360;
          const startAngle = currentAngle;
          currentAngle += angle;

          const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = 100 + 80 * Math.cos((currentAngle - 90) * Math.PI / 180);
          const y2 = 100 + 80 * Math.sin((currentAngle - 90) * Math.PI / 180);
          const largeArc = angle > 180 ? 1 : 0;

          const colorMap: Record<string, string> = {
            'bg-blue-500': '#3b82f6',
            'bg-green-500': '#22c55e',
            'bg-yellow-500': '#eab308',
            'bg-red-500': '#ef4444',
            'bg-purple-500': '#a855f7',
            'bg-pink-500': '#ec4899',
            'bg-indigo-500': '#6366f1',
            'bg-teal-500': '#14b8a6',
            'bg-orange-500': '#f97316',
            'bg-gray-500': '#6b7280'
          };

          const color = colorMap[colors[index % colors.length]];

          return (
            <path
              key={item.category}
              d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm w-full max-w-md">
        {data.map((item, index) => {
          const colorMap: Record<string, string> = {
            'bg-blue-500': '#3b82f6',
            'bg-green-500': '#22c55e',
            'bg-yellow-500': '#eab308',
            'bg-red-500': '#ef4444',
            'bg-purple-500': '#a855f7',
            'bg-pink-500': '#ec4899',
            'bg-indigo-500': '#6366f1',
            'bg-teal-500': '#14b8a6',
            'bg-orange-500': '#f97316',
            'bg-gray-500': '#6b7280'
          };
          const color = colorMap[colors[index % colors.length]];

          return (
            <div key={item.category} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-700 truncate">{item.category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
