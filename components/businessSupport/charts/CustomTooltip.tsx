import React from 'react';

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length > 0) {
    const point = payload[0];
    return (
      <div className="bg-slate-800/80 backdrop-blur-sm p-3 border border-slate-600 rounded-md shadow-lg text-slate-100">
        <p className="font-semibold">{label}</p>
        <p className="text-cyan-300 mt-1">
          {point.name}: {point.value}
        </p>
      </div>
    );
  }
  return null;
};

export default CustomTooltip;
