import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bell,
  Plus,
  Clock,
  Repeat,
  CheckCircle,
  Trash2,
  Calendar,
  AlertCircle,
  Volume2,
  Upload
} from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { getTodayDateString, formatDisplayDate, calculateNextOccurrence } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { requestNotificationPermission, getNotificationPermissionStatus, playGentleChime } from '../../services/notificationService';
import { getConfiguredAlarmTone, saveCustomDeviceTone, testAlarmSound, type AlarmToneType } from '../../services/soundService';
import type { ReminderItem, RecurrenceType } from '../../types';

export const RemindersView: React.FC<{ onOpenQuickAdd: (type: any) => void }> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();
  const [snoozeModalReminder, setSnoozeModalReminder] = useState<ReminderItem | null>(null);
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermissionStatus());
  const [activeTone, setActiveTone] = useState<AlarmToneType>('digital');
  const [customToneName, setCustomToneName] = useState<string | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    getConfiguredAlarmTone().then((cfg) => {
      setActiveTone(cfg.tone);
      if (cfg.customName) setCustomToneName(cfg.customName);
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await saveCustomDeviceTone(file);
      setActiveTone('custom');
      setCustomToneName(saved.name);
      showToast(`Device audio saved: ${file.name}`, { type: 'success' });
      testAlarmSound('custom');
    } catch {
      showToast('Could not load audio file', { type: 'warning' });
    }
  };

  const handleTestSound = async (toneToTest?: AlarmToneType) => {
    setIsPlayingTest(true);
    await testAlarmSound(toneToTest || activeTone);
    setTimeout(() => setIsPlayingTest(false), 1200);
  };

  const reminders = useLiveQuery(async () => {
    return db.reminders.filter((r) => !r.deletedAt).toArray();
  }, []) || [];

  const activeReminders = reminders.filter((r) => r.status === 'active' || r.status === 'snoozed');
  const pastReminders = reminders.filter((r) => r.status === 'completed' || r.status === 'dismissed');

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      showToast('Notification permission granted', { type: 'success' });
      playGentleChime();
    } else {
      showToast('Notifications denied or unsupported. In-app alerts will be used.', { type: 'warning' });
    }
  };

  const handleComplete = async (reminder: ReminderItem) => {
    const nowIso = new Date().toISOString();

    if (reminder.recurrence && reminder.recurrence !== 'none') {
      const nextDate = calculateNextOccurrence(reminder.date, reminder.recurrence);
      await db.reminders.update(reminder.id, {
        date: nextDate,
        status: 'active',
        snoozeCount: 0,
        updatedAt: nowIso
      });
      await logAudit('complete', 'reminder', reminder.id, `Completed recurring reminder and rescheduled for ${nextDate}`);
      showToast(`Completed! Next reminder on ${nextDate}`);
      return;
    }

    await db.reminders.update(reminder.id, {
      status: 'completed',
      updatedAt: nowIso
    });
    await logAudit('complete', 'reminder', reminder.id, `Completed reminder: ${reminder.title}`);
    showToast('Reminder completed');
  };

  const handleDismiss = async (id: string) => {
    await db.reminders.update(id, {
      status: 'dismissed',
      updatedAt: new Date().toISOString()
    });
    showToast('Reminder dismissed');
  };

  const handleDelete = async (id: string, title: string) => {
    await db.reminders.update(id, { deletedAt: new Date().toISOString() });
    await logAudit('delete', 'reminder', id, `Deleted reminder: ${title}`);
    showToast('Reminder moved to trash');
  };

  // Snooze Presets
  const applySnooze = async (reminder: ReminderItem, minutes: number | 'tomorrow' | 'weekend' | 'next_week') => {
    const now = new Date();
    let targetDateStr = reminder.date;
    let targetTimeStr = reminder.time || '10:00';

    if (typeof minutes === 'number') {
      now.setMinutes(now.getMinutes() + minutes);
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      targetTimeStr = `${h}:${m}`;
      targetDateStr = todayStr;
    } else if (minutes === 'tomorrow') {
      now.setDate(now.getDate() + 1);
      targetDateStr = now.toISOString().slice(0, 10);
      targetTimeStr = '09:00';
    } else if (minutes === 'weekend') {
      const day = now.getDay();
      const daysToSaturday = (6 - day + 7) % 7 || 7;
      now.setDate(now.getDate() + daysToSaturday);
      targetDateStr = now.toISOString().slice(0, 10);
      targetTimeStr = '10:00';
    } else if (minutes === 'next_week') {
      now.setDate(now.getDate() + 7);
      targetDateStr = now.toISOString().slice(0, 10);
      targetTimeStr = '09:00';
    }

    const currentSnoozes = (reminder.snoozeCount || 0) + 1;

    await db.reminders.update(reminder.id, {
      date: targetDateStr,
      time: targetTimeStr,
      status: 'snoozed',
      snoozeCount: currentSnoozes,
      updatedAt: new Date().toISOString()
    });

    await logAudit('update', 'reminder', reminder.id, `Snoozed reminder "${reminder.title}" to ${targetDateStr} ${targetTimeStr}`);
    showToast(`Snoozed until ${formatDisplayDate(targetDateStr)} ${targetTimeStr}`);
    setSnoozeModalReminder(null);
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {activeReminders.length} scheduled {activeReminders.length === 1 ? 'reminder' : 'reminders'}
        </div>
        <button
          onClick={() => onOpenQuickAdd('reminder')}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Permission banner if default or denied */}
      {permissionStatus !== 'granted' && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            background: 'var(--warning-light)',
            borderColor: 'var(--warning-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: '14px' }}>
              Device Notifications
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Enable system alerts for upcoming reminders on this device
            </div>
          </div>
          <button
            onClick={handleRequestPermission}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '12px' }}
          >
            Enable Alerts
          </button>
        </div>
      )}

      {/* Alarm Ringtone & Custom Audio from Device */}
      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={16} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Alarm Ringtone & Custom Tone
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleTestSound()}
            disabled={isPlayingTest}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
          >
            <Volume2 size={13} color="var(--accent)" />
            <span>{isPlayingTest ? 'Playing...' : 'Test Tone'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'digital', label: 'Digital Alarm' },
            { id: 'chime', label: 'Gentle Chime' },
            { id: 'radar', label: 'Radar Pulse' },
            { id: 'marimba', label: 'Marimba' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={async () => {
                setActiveTone(t.id as AlarmToneType);
                await db.settings.update('current_settings', { reminderTone: t.id as any });
                handleTestSound(t.id as AlarmToneType);
              }}
              className={`btn btn-sm ${activeTone === t.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px' }}
            >
              {t.label}
            </button>
          ))}

          {/* Custom audio from device */}
          <label
            className={`btn btn-sm ${activeTone === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Upload size={13} />
            <span>{customToneName ? `Custom: ${customToneName.slice(0, 16)}...` : 'Upload Device Tone'}</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Active Reminders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeReminders.length === 0 ? (
          <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <Bell size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              No active reminders.
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Set a reminder when you want to be nudged at a specific time.
            </div>
          </div>
        ) : (
          activeReminders.map((reminder) => {
            const isToday = reminder.date === todayStr;
            const isOverdue = reminder.date < todayStr;
            const hasMultipleSnoozes = (reminder.snoozeCount || 0) >= 3;

            return (
              <div
                key={reminder.id}
                className="card"
                style={{
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: isOverdue ? '4px solid var(--danger)' : isToday ? '4px solid var(--warning)' : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {reminder.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <span className={`badge ${isOverdue ? 'badge-danger' : isToday ? 'badge-warning' : 'badge-neutral'}`}>
                        <Calendar size={11} />
                        {isToday ? 'Today' : formatDisplayDate(reminder.date)}
                        {reminder.time ? ` at ${reminder.time}` : ''}
                      </span>

                      {reminder.recurrence && reminder.recurrence !== 'none' && (
                        <span className="badge badge-neutral">
                          <Repeat size={11} />
                          {reminder.recurrence}
                        </span>
                      )}

                      {reminder.status === 'snoozed' && (
                        <span className="badge badge-warning">
                          <Clock size={11} />
                          Snoozed
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(reminder.id, reminder.title)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)', padding: '6px 8px', borderRadius: '6px' }}
                    title="Delete reminder"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Multiple postponement warning */}
                {hasMultipleSnoozes && (
                  <div
                    style={{
                      background: 'var(--warning-light)',
                      border: '1px solid var(--warning-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      fontSize: '12px',
                      color: 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>This reminder has been postponed {reminder.snoozeCount} times. Still relevant?</span>
                  </div>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => handleComplete(reminder)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, gap: '4px', color: 'var(--success)' }}
                  >
                    <CheckCircle size={14} />
                    <span>Done</span>
                  </button>

                  <button
                    onClick={() => setSnoozeModalReminder(reminder)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, gap: '4px' }}
                  >
                    <Clock size={14} />
                    <span>Snooze</span>
                  </button>

                  <button
                    onClick={() => handleDismiss(reminder.id)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Snooze Presets Modal */}
      {snoozeModalReminder && (
        <div className="modal-overlay" onClick={() => setSnoozeModalReminder(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '14px' }}>
              Snooze: {snoozeModalReminder.title}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => applySnooze(snoozeModalReminder, 15)}
                className="btn btn-secondary"
                style={{ padding: '12px' }}
              >
                15 Minutes
              </button>

              <button
                onClick={() => applySnooze(snoozeModalReminder, 60)}
                className="btn btn-secondary"
                style={{ padding: '12px' }}
              >
                1 Hour
              </button>

              <button
                onClick={() => applySnooze(snoozeModalReminder, 'tomorrow')}
                className="btn btn-secondary"
                style={{ padding: '12px' }}
              >
                Tomorrow Morning
              </button>

              <button
                onClick={() => applySnooze(snoozeModalReminder, 'weekend')}
                className="btn btn-secondary"
                style={{ padding: '12px' }}
              >
                This Weekend
              </button>

              <button
                onClick={() => applySnooze(snoozeModalReminder, 'next_week')}
                className="btn btn-secondary"
                style={{ padding: '12px', gridColumn: 'span 2' }}
              >
                Next Week
              </button>
            </div>

            <button
              onClick={() => setSnoozeModalReminder(null)}
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
