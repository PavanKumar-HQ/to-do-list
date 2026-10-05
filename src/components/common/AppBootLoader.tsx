import React from 'react';
import { ActivityBars } from './LoadingSpinner';

export const AppBootLoader: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        gap: '20px',
        padding: '24px'
      }}
    >
      {/* Clean, geometric monochrome mark */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          border: '1.5px solid var(--border-strong)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)'
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.03em' }}>K</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          Kanso
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Workspace
        </p>
      </div>

      <div style={{ marginTop: '8px' }}>
        <ActivityBars />
      </div>
    </div>
  );
};
