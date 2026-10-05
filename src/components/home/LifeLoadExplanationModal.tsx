import React from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, Wallet, Users, Info } from 'lucide-react';
import { formatMoney } from '../../utils/currency';
import type { LifeLoadAssessment } from '../../types';

interface LifeLoadExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lifeLoad: LifeLoadAssessment | null;
}

export const LifeLoadExplanationModal: React.FC<LifeLoadExplanationModalProps> = ({
  isOpen,
  onClose,
  lifeLoad
}) => {
  if (!isOpen || !lifeLoad) return null;

  const { level, score, summary, breakdown } = lifeLoad;

  const getLevelLabel = () => {
    switch (level) {
      case 'overloaded': return 'Overloaded';
      case 'heavy': return 'Heavy Load';
      case 'moderate': return 'Moderate Load';
      default: return 'Light Day';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        style={{ maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Life Load Assessment
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
              {getLevelLabel()} · Score {score}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          {summary}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Overdue items</span>
            </div>
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: breakdown.overdueCount > 0 ? 'var(--danger)' : 'var(--text-muted)'
              }}
            >
              {breakdown.overdueCount}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Waiting on others</span>
            </div>
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: breakdown.waitingCount > 0 ? 'var(--warning)' : 'var(--text-muted)'
              }}
            >
              {breakdown.waitingCount}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Stale backlog items</span>
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
              {breakdown.staleCount}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wallet size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Upcoming payments</span>
            </div>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatMoney(breakdown.upcomingPaymentMinor, '₹')}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            background: 'var(--bg-app)',
            borderRadius: '6px',
            lineHeight: 1.4
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Scored deterministically on device from your active commitments, due dates, and open loops.
          </span>
        </div>
      </div>
    </div>
  );
};
