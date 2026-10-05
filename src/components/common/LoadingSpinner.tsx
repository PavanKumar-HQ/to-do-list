// LoadingSpinner — Premium multi-color animated loader

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const dimension = size === 'sm' ? 24 : size === 'lg' ? 48 : 36;
  const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 4 : 3.5;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '12px' : '32px 16px',
        gap: '12px',
        width: '100%'
      }}
    >
      <div
        style={{
          width: dimension,
          height: dimension,
          position: 'relative'
        }}
      >
        <svg
          viewBox="0 0 50 50"
          style={{
            animation: 'spinLoader 1s linear infinite',
            width: '100%',
            height: '100%'
          }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="url(#spinnerGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray="80, 200"
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="50%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {message && (
        <span
          style={{
            fontSize: size === 'sm' ? '12px' : '13px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            letterSpacing: '0.01em'
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
};
