import React from 'react';

interface LeadScoreBadgeProps {
  score: number;
}

const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({ score }) => {
  const size = 36;
  const strokeWidth = 4;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const offset = circumference - (score / 100) * circumference;

  let colorClass = 'text-green-500';
  if (score < 40) {
    colorClass = 'text-red-500';
  } else if (score < 70) {
    colorClass = 'text-yellow-500';
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-200 dark:text-slate-700"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={center}
          cy={center}
        />
        <circle
          className={colorClass}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={center}
          cy={center}
        />
      </svg>
      <span className={`absolute text-xs font-bold ${colorClass}`}>
        {score}
      </span>
    </div>
  );
};

export default LeadScoreBadge;