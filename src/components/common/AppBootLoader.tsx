// AppBootLoader — Modern First-Load Application Loading Screen

import React from 'react';
import { Shield } from 'lucide-react';

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
      <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Animated outer spinning gradient ring */}
        <svg
          viewBox="0 0 80 80"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            animation: 'spinLoader 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
          }}
        >
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="3.5"
            opacity="0.25"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="url(#bootLoaderGradient)"
            strokeWidth="4"
            strokeDasharray="90, 200"
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="bootLoaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>

        {/* Central Geometric Icon */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Shield size={22} color="var(--accent)" />
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          Personal Life OS
        </h1>
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Loading...
        </p>
      </div>
    </div>
  );
};
