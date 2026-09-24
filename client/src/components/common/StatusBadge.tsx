import React from 'react';
import type { BusStatus } from '../../types.js';

interface StatusBadgeProps {
  status: BusStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showPulse = true
}) => {
  const getStyles = () => {
    switch (status) {
      case 'On Time':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          pulse: false
        };
      case 'Delayed':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          pulse: false
        };
      case 'Emergency':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
          dot: 'bg-rose-600',
          pulse: true
        };
      case 'Completed':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          pulse: false
        };
      case 'Not Started':
      default:
        return {
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
          pulse: false
        };
    }
  };

  const style = getStyles();
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-sm ${style.bg} ${sizeClasses} ${
        style.pulse && showPulse ? 'pulse-emergency' : ''
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${style.dot} ${
          style.pulse && showPulse ? 'animate-ping' : ''
        }`}
      />
      <span>{status}</span>
    </span>
  );
};
