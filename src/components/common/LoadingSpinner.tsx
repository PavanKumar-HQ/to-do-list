// Calm Activity Indicators & Single-Color Compact Spinners (Section 10, 11)

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'sm', message }) => {
  const dimension = size === 'sm' ? 16 : 20;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}
    >
      <div
        className="spinner-compact"
        style={{
          width: dimension,
          height: dimension,
          borderWidth: '2px'
        }}
        role="status"
        aria-label={message || 'Loading'}
      />
      {message && (
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontWeight: 500
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
};

// ActivityBars: Three short vertical bars (| | |) with sequential rise
export const ActivityBars: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
      }}
      role="status"
      aria-label={message || 'Working'}
    >
      <div className="activity-bars">
        <span className="activity-bar" />
        <span className="activity-bar" />
        <span className="activity-bar" />
      </div>
      {message && (
        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          {message}
        </span>
      )}
    </div>
  );
};
