
import React from 'react';

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/80 backdrop-blur-sm p-3 border border-slate-600 rounded-md shadow-lg">
        <p className="label text-slate-200 font-semibold">{`${label}`}</p>
        <p className="intro text-cyan-400">{`${payload[0].name} : ${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
};

export default CustomTooltip;
