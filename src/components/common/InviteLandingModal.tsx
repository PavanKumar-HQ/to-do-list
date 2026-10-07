import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FolderLock,
  ArrowRight,
  Heart,
  Share2
} from 'lucide-react';

interface InviteLandingModalProps {
  isOpen: boolean;
  token: string;
  onAccept: () => void;
  onDismiss?: () => void;
}

export const InviteLandingModal: React.FC<InviteLandingModalProps> = ({
  isOpen,
  token,
  onAccept,
  onDismiss
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} role="dialog" aria-modal="true">
      <div
        className="card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '92%',
          margin: '0 auto',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-surface)'
        }}
      >
        {/* Banner Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%)',
            padding: '28px 24px 24px 24px',
            color: '#ffffff',
            position: 'relative'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '12px'
            }}
          >
            <Sparkles size={13} />
            <span>VIP Invitation</span>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
            Welcome to Saral (सरल)
          </h2>
          <p style={{ fontSize: '13px', margin: 0, opacity: 0.9, lineHeight: 1.4, color: 'rgba(255,255,255,0.95)' }}>
            You've been invited to use Saral — a calm, private, local-first workspace designed to organize your mind, habits, study, planning, and life.
          </p>
        </div>

        {/* Body content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Token verification badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontSize: '11.5px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Share2 size={13} color="var(--accent)" />
              <span>Invite Token:</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
              {token ? `${token.slice(0, 12)}...` : 'Personal Pass'}
            </span>
          </div>

          {/* Features Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--success-light)', color: 'var(--success)', flexShrink: 0 }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  100% Private & On-Device
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Your notes, finances, tasks, and journal are stored locally in your browser. No servers track you.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-light)', color: 'var(--accent)', flexShrink: 0 }}>
                <Zap size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Instant & Offline Ready
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Install as an app on Desktop or Mobile (PWA) and use it anywhere without an internet connection.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', flexShrink: 0 }}>
                <Heart size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Complete Productivity Suite
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Tasks, Universal Inbox, Daily Journal, Visual Canvas Studio, Money Tracker & Family Care.
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onAccept}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '10px',
                gap: '8px',
                justifyContent: 'center'
              }}
            >
              <span>Accept Invite & Get Started</span>
              <ArrowRight size={16} />
            </button>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="btn-ghost"
                style={{ width: '100%', fontSize: '12px', padding: '6px' }}
              >
                Skip & Continue as Guest
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
