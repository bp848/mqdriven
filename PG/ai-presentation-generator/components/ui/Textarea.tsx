
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => {
  return (
    <div>
      <label htmlFor={props.name} className="block text-sm font-medium text-slate-400 mb-2">
        {label}
      </label>
      <textarea
        id={props.name}
        {...props}
        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
      />
    </div>
  );
};
