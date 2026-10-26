import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, X, Volume2, VolumeX, ChevronUp } from 'lucide-react';
import { db } from '../../db/db';
import { getTodayDateString } from '../../utils/dates';
import { eventBus } from '../../services/eventBus';
import { handleNotificationAction } from '../../services/notificationService';
import { startAlarmRinging, stopAlarmRinging } from '../../services/soundService';
import { useToast } from './ToastContext';

interface ActiveAlert {
  id: string;
  title: string;
  time?: string;
  date?: string;
  type?: 'reminder' | 'task';
  attempt?: number;
  maxAttempts?: number;
}

export const InAppReminderAlert: React.FC = () => {
  const [currentAlert, setCurrentAlert] = useState<ActiveAlert | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const { showToast } = useToast();

  const handleNewAlert = (data: any) => {
    if (data?.id && data?.title) {
      const isTask = data.type === 'task';
      setCurrentAlert({
        id: data.id,
        title: data.title,
        time: data.time,
        date: data.date,
        type: isTask ? 'task' : 'reminder',
        attempt: data.attempt,
        maxAttempts: data.maxAttempts
      });

      // Sound is strictly for reminders/alarms. Tasks use quiet floating notification!
      if (!isTask) {
        setIsRinging(true);
        startAlarmRinging().catch((e) => console.warn('Alarm audio start notice:', e));
      } else {
        setIsRinging(false);
      }
    }
  };

  useEffect(() => {
    // Check on mount if any reminder or task is currently due/overdue today so it stays visible
    const checkDueOnMount = async () => {
      try {
        const now = new Date();
        const todayStr = getTodayDateString();
        const currentHM = now.toTimeString().slice(0, 5);

        const dueReminder = await db.reminders
          .where('date')
          .equals(todayStr)
          .filter(r => !r.deletedAt && (r.status === 'active' || r.status === 'snoozed') && !!r.time && r.time <= currentHM)
          .first();

        if (dueReminder) {
          handleNewAlert({
            id: dueReminder.id,
            title: dueReminder.title,
            time: dueReminder.time,
            date: dueReminder.date,
            type: 'reminder'
          });
          return;
        }

        const dueTask = await db.tasks
          .filter(t => !t.deletedAt && t.status !== 'completed' && t.status !== 'archived' && t.dueDate === todayStr && (!t.dueTime || t.dueTime <= currentHM))
          .first();

        if (dueTask) {
          handleNewAlert({
            id: dueTask.id,
            title: dueTask.title,
            time: dueTask.dueTime || 'Due today',
            date: dueTask.dueDate,
            type: 'task'
          });
        }
      } catch (err) {
        console.warn('Initial due check error:', err);
      }
    };

    checkDueOnMount();

    const unsubAlert = eventBus.subscribe('IN_APP_ALERT', (event) => {
      handleNewAlert(event.data);
    });

    return () => {
      unsubAlert();
      stopAlarmRinging();
    };
  }, []);

  if (!currentAlert) return null;

  const handleSilence = () => {
    stopAlarmRinging();
    setIsRinging(false);
    showToast('Alarm silenced', { type: 'info' });
  };

  const handleTurnOff = async () => {
    stopAlarmRinging();
    setIsRinging(false);
    if (currentAlert?.id) {
      try {
        await db.reminders.update(currentAlert.id, {
          status: 'dismissed',
          updatedAt: new Date().toISOString()
        });
        eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: currentAlert.id });
      } catch {}
    }
    showToast('Alarm turned off', { type: 'info' });
    setCurrentAlert(null);
  };

  const handleComplete = async () => {
    stopAlarmRinging();
    setIsRinging(false);
    try {
      await handleNotificationAction('complete', currentAlert.id);
      showToast(currentAlert.type === 'task' ? 'Task completed' : 'Reminder completed', { type: 'success' });
      setCurrentAlert(null);
    } catch {
      setCurrentAlert(null);
    }
  };

  const handleSnooze = async () => {
    stopAlarmRinging();
    setIsRinging(false);
    try {
      await handleNotificationAction('snooze_10m', currentAlert.id);
      showToast('Snoozed for 10 minutes', { type: 'info' });
      setCurrentAlert(null);
    } catch {
      setCurrentAlert(null);
    }
  };

  // Push / swipe off gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const delta = e.touches[0].clientY - touchStartY;
    if (delta < 0) {
      setTouchDeltaY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (touchDeltaY < -60) {
      handleTurnOff();
    }
    setTouchStartY(null);
    setTouchDeltaY(0);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        top: 'calc(var(--header-height, 56px) + 12px)',
        left: '50%',
        transform: touchDeltaY !== 0 ? `translate(-50%, ${touchDeltaY}px)` : 'translateX(-50%)',
        transition: touchDeltaY === 0 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        zIndex: 10000,
        width: 'calc(100% - 32px)',
        maxWidth: '540px',
        background: 'var(--bg-surface-elevated, #1c1c1e)',
        border: '2px solid var(--accent, #6366f1)',
        borderRadius: '16px',
        padding: '14px 18px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        animation: 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        touchAction: 'pan-y'
      }}
    >
      {/* Swipe handle / Push off indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          fontSize: '10.5px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        <ChevronUp size={13} />
        <span>Push / swipe up to turn off</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isRinging ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
              border: isRinging ? '1px solid var(--danger, #ef4444)' : '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isRinging ? 'var(--danger, #ef4444)' : 'var(--accent)',
              flexShrink: 0
            }}
          >
            <Bell size={22} className={isRinging ? 'animate-bounce' : ''} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isRinging ? 'var(--danger, #ef4444)' : 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Bell size={12} />
                <span>{isRinging ? 'Alarm Ringing' : 'Reminder Due'}</span>
              </span>
              {currentAlert.time && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {currentAlert.time}
                </span>
              )}
              {currentAlert.attempt && currentAlert.attempt > 1 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: currentAlert.attempt >= (currentAlert.maxAttempts || 3) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: currentAlert.attempt >= (currentAlert.maxAttempts || 3) ? 'var(--danger, #ef4444)' : 'var(--warning, #f59e0b)'
                  }}
                >
                  {currentAlert.attempt >= (currentAlert.maxAttempts || 3) ? 'Final Alert (3/3)' : `Repeat (${currentAlert.attempt}/3)`}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '4px',
                lineHeight: 1.3
              }}
            >
              {currentAlert.title}
            </div>
          </div>
        </div>

        <button
          onClick={handleTurnOff}
          className="btn btn-secondary btn-sm"
          style={{ padding: '6px 10px', color: 'var(--danger)', borderRadius: '8px', fontSize: '11px', gap: '4px' }}
          aria-label="Turn off alarm"
          title="Turn off alarm"
        >
          <X size={14} />
          <span>Turn Off</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          flexWrap: 'wrap'
        }}
      >
        {isRinging && (
          <button
            type="button"
            onClick={handleSilence}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px', padding: '6px 12px', gap: '5px' }}
          >
            <VolumeX size={14} />
            <span>Silence Audio</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleSnooze}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px', padding: '6px 12px', gap: '5px' }}
          >
            <Clock size={14} />
            <span>Snooze 10m</span>
          </button>

          <button
            type="button"
            onClick={handleComplete}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '12px', padding: '6px 16px', gap: '5px', fontWeight: 600 }}
          >
            <Check size={14} />
            <span>Stop & Complete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
