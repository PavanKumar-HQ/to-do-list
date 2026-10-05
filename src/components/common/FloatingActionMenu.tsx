import React from 'react';
import {
  CheckSquare,
  Wallet,
  FileText,
  Bell,
  TrendingUp,
  Lightbulb,
  Calendar,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import type { EntityType } from '../../types';

interface FloatingActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: EntityType) => void;
}

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  isOpen,
  onClose,
  onSelectType
}) => {
  if (!isOpen) return null;

  const captureActions = [
    { id: 'task' as EntityType, label: 'Task', icon: CheckSquare, color: 'var(--accent)' },
    { id: 'expense' as EntityType, label: 'Expense', icon: Wallet, color: '#10b981' },
    { id: 'note' as EntityType, label: 'Note', icon: FileText, color: '#06b6d4' },
    { id: 'reminder' as EntityType, label: 'Reminder', icon: Bell, color: '#f59e0b' },
    { id: 'income' as EntityType, label: 'Income', icon: TrendingUp, color: '#10b981' },
    { id: 'idea' as EntityType, label: 'Idea', icon: Lightbulb, color: '#eab308' },
    { id: 'event' as EntityType, label: 'Event', icon: Calendar, color: '#8b5cf6' },
    { id: 'followup' as EntityType, label: 'Follow-up', icon: UserCheck, color: '#ec4899' },
    { id: 'person' as EntityType, label: 'Person', icon: Users, color: '#3b82f6' }
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: '0 20px calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 80px) 0'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '290px',
          background: 'var(--glass-surface)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: 'var(--shadow-sheet)',
          animation: 'rowEnter 0.16s ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            Quick Capture
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close capture menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* 3x3 Grid of 9 Universal Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px'
          }}
        >
          {captureActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onSelectType(action.id);
                  onClose();
                }}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 6px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon size={18} color={action.color} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
