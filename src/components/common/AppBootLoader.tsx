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
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          border: '1.5px solid var(--border-strong)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <span style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em' }}>S</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          Saral
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontWeight: 500 }}>
          सरल • Simple, Calm & Focused
        </p>
      </div>

      <div style={{ marginTop: '6px' }}>
        <ActivityBars />
      </div>
    </div>
  );
};
