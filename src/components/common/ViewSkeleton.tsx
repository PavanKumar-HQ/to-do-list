import React from 'react';

export const ViewSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Title & subtitle skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        <div className="skeleton-row" style={{ height: '22px', width: '140px' }} />
        <div className="skeleton-row" style={{ height: '14px', width: '220px' }} />
      </div>

      {/* Row list skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div className="skeleton-row" style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="skeleton-row" style={{ height: '14px', width: i % 2 === 0 ? '60%' : '75%' }} />
              <div className="skeleton-row" style={{ height: '11px', width: '35%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
