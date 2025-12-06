import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => (
  <div>
    <label htmlFor={props.name} className="block text-sm font-medium text-slate-300 mb-2">
      {label}
    </label>
    <textarea
      {...props}
      id={props.name}
      className={`w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition ${
        props.disabled ? 'opacity-70 cursor-not-allowed' : ''
      }`}
    />
  </div>
);
