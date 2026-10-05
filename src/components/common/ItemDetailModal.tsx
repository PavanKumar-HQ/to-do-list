import React from 'react';
import {
  X,
  CheckSquare,
  Square,
  Calendar,
  Clock,
  Bell,
  MapPin,
  Tag,
  User,
  RotateCcw,
  Trash2,
  Edit2,
  Network,
  CheckCircle2,
  CalendarDays,
  Folder
} from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { TaskRepository, ReminderRepository, OpenLoopRepository, ExpenseRepository } from '../../repositories';
import { formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useToast } from './ToastContext';
import { eventBus } from '../../services/eventBus';
import type { TaskItem, EventItem, ReminderItem, OpenLoopItem, ExpenseItem, EntityType } from '../../types';

export interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'task' | 'event' | 'reminder' | 'loop' | 'expense' | null;
  itemData: any | null;
  onOpenContext?: (type: EntityType, id: string) => void;
  onEditItem?: (type: string, item: any) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemData,
  onOpenContext,
  onEditItem
}) => {
  const { showToast } = useToast();

  if (!isOpen || !itemType || !itemData) return null;

  // Actions
  const handleToggleCompleteTask = async (task: TaskItem) => {
    try {
      const isCompleted = task.status === 'completed';
      if (isCompleted) {
        await TaskRepository.uncomplete(task.id);
        showToast('Task reopened', { type: 'info' });
      } else {
        await TaskRepository.complete(task.id);
        showToast('Task completed', { type: 'success' });
      }
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  const handlePostponeTaskTomorrow = async (task: TaskItem) => {
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await TaskRepository.update(task.id, {
        dueDate: tomorrow,
        postponeCount: (task.postponeCount || 0) + 1,
        lastPostponedAt: new Date().toISOString()
      });
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id });
      showToast('Rescheduled to tomorrow', { type: 'info' });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  const handleDeleteItem = async () => {
    try {
      if (itemType === 'task') {
        await TaskRepository.softDelete(itemData.id);
        eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: itemData.id });
        showToast('Task moved to trash', { type: 'info' });
      } else if (itemType === 'event') {
        await db.events.update(itemData.id, { deletedAt: new Date().toISOString() });
        eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: itemData.id });
        showToast('Event moved to trash', { type: 'info' });
      } else if (itemType === 'reminder') {
        await ReminderRepository.softDelete(itemData.id);
        eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: itemData.id });
        showToast('Reminder deleted', { type: 'info' });
      } else if (itemType === 'loop') {
        await OpenLoopRepository.softDelete(itemData.id);
        eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: itemData.id });
        showToast('Loop deleted', { type: 'info' });
      } else if (itemType === 'expense') {
        await ExpenseRepository.softDelete(itemData.id);
        eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: itemData.id });
        showToast('Expense moved to trash', { type: 'info' });
      }
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Delete failed', { type: 'error' });
    }
  };

  const handleResolveLoop = async (loop: OpenLoopItem) => {
    try {
      await OpenLoopRepository.close(loop.id);
      eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: loop.id });
      showToast('Open loop marked resolved', { type: 'success' });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', margin: '0 auto' }}
      >
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--accent-light)',
                color: 'var(--accent)'
              }}
            >
              {itemType.toUpperCase()}
            </span>
            {itemData.status && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: itemData.status === 'completed' ? 'var(--success-light)' : 'var(--bg-surface-elevated)',
                  color: itemData.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)'
                }}
              >
                {itemData.status}
              </span>
            )}
          </div>

          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close detail modal">
            <X size={20} />
          </button>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: '0 0 16px 0',
            lineHeight: 1.3
          }}
        >
          {itemData.title || itemData.subject || (itemType === 'expense' ? formatMoney(itemData.amountMinor, '₹') : 'Item Details')}
        </h2>

        {/* Structured Data Rows (Section 4: Detail view must show real data) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '18px'
          }}
        >
          {/* Due date / Timing */}
          {(itemData.dueDate || itemData.date) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <Calendar size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Schedule: </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatDisplayDate(itemData.dueDate || itemData.date)}
                  {itemData.dueTime ? ` · ${itemData.dueTime}` : itemData.startTime ? ` · ${itemData.startTime}` : ''}
                </strong>
              </div>
            </div>
          )}

          {/* Priority */}
          {itemData.priority && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <Tag size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Priority: </span>
                <strong style={{ textTransform: 'capitalize', color: itemData.priority === 'high' ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {itemData.priority}
                </strong>
              </div>
            </div>
          )}

          {/* Context / Project */}
          {(itemData.category || itemData.projectContext) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <Folder size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Context: </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {itemData.category || itemData.projectContext}
                </strong>
              </div>
            </div>
          )}

          {/* Linked Person */}
          {(itemData.waitingOnPersonName || itemData.linkedPersonName || itemData.personName) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <User size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Person: </span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {itemData.waitingOnPersonName || itemData.linkedPersonName || itemData.personName}
                </strong>
              </div>
            </div>
          )}

          {/* Location (Events) */}
          {itemData.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Location: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{itemData.location}</strong>
              </div>
            </div>
          )}

          {/* Recurrence */}
          {itemData.recurrence && itemData.recurrence !== 'none' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <RotateCcw size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recurrence: </span>
                <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {itemData.recurrence}
                </strong>
              </div>
            </div>
          )}

          {/* Reminders / Snooze state */}
          {itemData.snoozedUntil && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
              <Bell size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Snoozed until: </span>
                <strong style={{ color: 'var(--warning)' }}>{new Date(itemData.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            </div>
          )}

          {/* Notes / Description */}
          {(itemData.description || itemData.notes) && (
            <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {itemData.description || itemData.notes}
              </div>
            </div>
          )}

          {/* Created / Updated Timestamps */}
          <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            <span>Created: {new Date(itemData.createdAt || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            {itemData.updatedAt && (
              <span>Updated: {new Date(itemData.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {itemType === 'task' && (
            <>
              <button
                type="button"
                onClick={() => handleToggleCompleteTask(itemData)}
                className="btn btn-primary"
                style={{ flex: 1, gap: '6px' }}
              >
                <CheckCircle2 size={16} />
                <span>{itemData.status === 'completed' ? 'Reopen task' : 'Complete'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePostponeTaskTomorrow(itemData)}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
                title="Postpone to tomorrow"
              >
                <CalendarDays size={15} />
                <span>Tomorrow</span>
              </button>
            </>
          )}

          {itemType === 'loop' && (
            <button
              type="button"
              onClick={() => handleResolveLoop(itemData)}
              className="btn btn-primary"
              style={{ flex: 1, gap: '6px' }}
            >
              <CheckCircle2 size={16} />
              <span>Mark resolved</span>
            </button>
          )}

          {onOpenContext && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenContext(itemType as EntityType, itemData.id);
              }}
              className="btn btn-secondary"
              style={{ gap: '6px' }}
              title="View 360° Life Graph Context"
            >
              <Network size={15} />
              <span>Context</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDeleteItem}
            className="btn btn-secondary"
            style={{ color: 'var(--danger)', padding: '10px' }}
            title="Delete item"
            aria-label="Delete item"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
