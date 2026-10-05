// FutureMessageModal — Compose or View Messages to/from Future Self (Section 30)

import React, { useState } from 'react';
import { X, Send, Mail, Calendar } from 'lucide-react';
import { FutureMessageRepository } from '../../repositories';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { FutureMessageItem } from '../../types';

interface FutureMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToRead?: FutureMessageItem | null;
  onSaved?: () => void;
}

export const FutureMessageModal: React.FC<FutureMessageModalProps> = ({
  isOpen,
  onClose,
  messageToRead,
  onSaved
}) => {
  const { showToast } = useToast();
  const today = getTodayDateString();

  // Form states for creating new message
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [openDate, setOpenDate] = useState(() => {
    // Default 30 days into future
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showToast('Title and message are required', { type: 'warning' });
      return;
    }
    if (openDate <= today) {
      showToast('Unlock date must be in the future', { type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await FutureMessageRepository.create({
        title: title.trim(),
        message: message.trim(),
        openDate
      });
      showToast(`Message scheduled to unlock on ${formatDisplayDate(openDate)}`, { type: 'success' });
      setTitle('');
      setMessage('');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule message', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkOpened = async () => {
    if (!messageToRead) return;
    try {
      await FutureMessageRepository.openMessage(messageToRead.id);
      showToast('Message marked as read', { type: 'info' });
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error updating message', { type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '540px', margin: '0 auto', maxHeight: '85vh' }}
      >
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {messageToRead ? 'Message From Your Past Self' : 'Write to Your Future Self'}
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {messageToRead ? (
          // Read Mode
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Written on {formatDisplayDate(messageToRead.createdAt.slice(0, 10))} · Scheduled for {formatDisplayDate(messageToRead.openDate)}
              </div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {messageToRead.title}
              </h2>
            </div>

            <div style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', padding: '0.5rem 0' }}>
              {messageToRead.message}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              {!messageToRead.isOpened && (
                <button className="btn btn-primary" onClick={handleMarkOpened}>
                  Mark as Read
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          // Compose Mode
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Send an intention, perspective, or reflection into the future. It will remain locked until the designated unlock date.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Subject / Title
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Check in on your career shift / How are you feeling about health?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Unlock Date
              </label>
              <input
                type="date"
                className="input"
                min={today}
                value={openDate}
                onChange={e => setOpenDate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Message
              </label>
              <textarea
                rows={5}
                className="input"
                placeholder="Write your reflection, mindset, or reminders to yourself..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Send size={14} style={{ marginRight: '4px' }} />
                Schedule Message
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
