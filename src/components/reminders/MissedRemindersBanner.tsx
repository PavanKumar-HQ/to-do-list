// MissedRemindersBanner — Calm, actionable recovery for missed reminders (Section 41)
// Prevents notification backlog spam and gives the user one-tap recovery actions.

import React from 'react';
import { Bell, Clock, Check, X } from 'lucide-react';
import { db } from '../../db/db';
import { cancelReminder, rescheduleReminder } from '../../services/notificationService';
import { useToast } from '../common/ToastContext';
import type { ReminderItem } from '../../types';

interface MissedRemindersBannerProps {
  missedItems: ReminderItem[];
  onReview: () => void;
  onClear: () => void;
}

export const MissedRemindersBanner: React.FC<MissedRemindersBannerProps> = ({
  missedItems,
  onReview,
  onClear
}) => {
  const { showToast } = useToast();

  if (!missedItems || missedItems.length === 0) return null;

  const handleSnoozeAllOneHour = async () => {
    const oneHourLater = new Date(Date.now() + 60 * 60000);
    const newDate = oneHourLater.toISOString().split('T')[0];
    const newTime = oneHourLater.toTimeString().slice(0, 5);

    for (const item of missedItems) {
      await db.reminders.update(item.id, {
        date: newDate,
        time: newTime,
        snoozedUntil: oneHourLater.toISOString(),
        updatedAt: new Date().toISOString()
      });
      rescheduleReminder({
        ...item,
        date: newDate,
        time: newTime
      });
    }

    showToast(`Snoozed ${missedItems.length} missed reminder${missedItems.length > 1 ? 's' : ''} by 1 hour`, { type: 'info' });
    onClear();
  };

  const handleDismissAll = async () => {
    const now = new Date().toISOString();
    for (const item of missedItems) {
      await db.reminders.update(item.id, {
        status: 'dismissed',
        updatedAt: now
      });
      cancelReminder(item.id);
    }

    showToast(`Dismissed ${missedItems.length} missed reminder${missedItems.length > 1 ? 's' : ''}`, { type: 'info' });
    onClear();
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--warning)',
        borderRadius: '8px',
        padding: '0.875rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '6px',
            background: 'var(--warning-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Bell size={16} color="var(--warning)" />
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            You missed {missedItems.length} reminder{missedItems.length > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Scheduled while the app was inactive. Choose how to handle them.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={onReview} className="btn btn-sm btn-primary" style={{ gap: '0.25rem' }}>
          <span>Review</span>
        </button>
        <button onClick={handleSnoozeAllOneHour} className="btn btn-sm btn-secondary" style={{ gap: '0.25rem' }}>
          <Clock size={13} />
          <span>Snooze 1h</span>
        </button>
        <button onClick={handleDismissAll} className="btn btn-sm btn-secondary" style={{ gap: '0.25rem' }}>
          <Check size={13} />
          <span>Dismiss</span>
        </button>
      </div>
    </div>
  );
};
