// ViewSkeleton — Calm, subtle content placeholder for route loading (Section 9)
// Avoids jarring blank screens and heavy spinners; respects prefers-reduced-motion.

import React from 'react';

export const ViewSkeleton: React.FC = () => {
  return (
    <div
      className="content-max-width"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0.5rem 0',
        animation: 'fadeIn 0.2s ease forwards'
      }}
      aria-busy="true"
      aria-label="Loading content"
    >
      {/* Title skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div
          style={{
            width: '180px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--bg-subtle)'
          }}
        />
        <div
          style={{
            width: '80px',
            height: '32px',
            borderRadius: '6px',
            background: 'var(--bg-subtle)'
          }}
        />
      </div>

      {/* Row skeletons */}
      {[1, 2, 3, 4, 5].map((idx) => (
        <div
          key={idx}
          style={{
            height: '60px',
            borderRadius: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1rem',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'var(--bg-subtle)'
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                width: `${40 + (idx * 11) % 45}%`,
                height: '14px',
                borderRadius: '4px',
                background: 'var(--bg-subtle)'
              }}
            />
            <div
              style={{
                width: '30%',
                height: '10px',
                borderRadius: '3px',
                background: 'var(--bg-subtle)',
                opacity: 0.7
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
