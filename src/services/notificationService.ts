// Dedicated Notification Engine (Sections 32-43, 70-76)
// Handles permission, gentle Web Audio chime, Service Worker native notifications,
// duplicate protection via stable tags ('reminder:<uuid>'), missed reminder detection,
// and event-driven timer scheduling (NO continuous 1-second polling loop).

import { db } from '../db/db';
import type { ReminderItem } from '../types';
import { eventBus } from './eventBus';
import { getTodayDateString } from '../utils/dates';
import { testAlarmSound } from './soundService';

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let nextTimerTimestamp: number | null = null;
const recentlyFiredIds = new Set<string>();

export interface NotificationSupportInfo {
  supported: boolean;
  backgroundSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  explanation: string;
}

export function getNotificationSupportInfo(): NotificationSupportInfo {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      supported: false,
      backgroundSupported: false,
      permission: 'unsupported',
      explanation: 'Notifications are not supported by this browser.'
    };
  }

  const backgroundSupported = 'serviceWorker' in navigator;
  return {
    supported: true,
    backgroundSupported,
    permission: Notification.permission,
    explanation: backgroundSupported
      ? 'Notifications enabled. Background reminders are supported via Service Worker.'
      : 'Notifications will work while Life OS is active.'
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      refreshNextReminderTimer();
    }
    return permission;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return 'denied';
  }
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Gentle audio chime using Web Audio API (zero external assets needed)
export function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (e) {
    // Audio context may require user interaction
  }
}

// Check quiet hours
export async function isWithinQuietHours(): Promise<boolean> {
  try {
    const settings = await db.settings.get('current_settings');
    if (!settings || !settings.quietHoursEnabled) return false;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = (settings.quietHoursStart || '22:00').split(':').map(Number);
    const [endH, endM] = (settings.quietHoursEnd || '07:00').split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins < endMins) {
      return currentMins >= startMins && currentMins <= endMins;
    } else {
      return currentMins >= startMins || currentMins <= endMins;
    }
  } catch {
    return false;
  }
}

/**
 * Dispatch a native notification safely using Service Worker when possible
 * Tagged with stable identifier to prevent duplicates (Section 40)
 */
export async function dispatchNativeNotification(
  tag: string,
  title: string,
  body?: string,
  data?: Record<string, any>
) {
  const quiet = await isWithinQuietHours();
  if (quiet) {
    console.log('Notification suppressed due to quiet hours:', title);
    return;
  }

  playGentleChime();

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Prefer Service Worker registration for native PWA notifications (Section 34, 37)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon: typeof window !== 'undefined' ? new URL('icon-512.svg', window.location.href).href : './icon-512.svg',
            badge: typeof window !== 'undefined' ? new URL('icon-512.svg', window.location.href).href : './icon-512.svg',
            tag, // Stable tag ensures replacement rather than duplicate spam
            renotify: true,
            data: data || {},
            actions: [
              { action: 'complete', title: 'Complete' },
              { action: 'snooze_10m', title: 'Snooze 10m' }
            ]
          } as any);
          return;
        }
      }

      // Standard Web Notification fallback
      new Notification(title, {
        body,
        icon: typeof window !== 'undefined' ? new URL('icon-512.svg', window.location.href).href : './icon-512.svg',
        tag
      });
    } catch (e) {
      console.warn('Native notification dispatch failed:', e);
    }
  }
}

/**
 * Event-Driven Reminder Scheduler (NO continuous 1-second polling loop!)
 * Finds the single earliest upcoming active reminder and sets one timeout.
 */
export async function refreshNextReminderTimer() {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
    nextTimerTimestamp = null;
  }

  const now = new Date();
  const todayStr = getTodayDateString();

  // Indexed query for today and future active reminders
  const activeReminders = await db.reminders
    .where('date')
    .aboveOrEqual(todayStr)
    .filter(r => !r.deletedAt && (r.status === 'active' || r.status === 'snoozed'))
    .toArray();

  let earliestTime: number | null = null;
  let earliestReminder: ReminderItem | null = null;

  for (const r of activeReminders) {
    let targetTimestamp: number;
    const isSnoozedFuture = r.snoozedUntil && new Date(r.snoozedUntil).getTime() > now.getTime();

    if (isSnoozedFuture) {
      targetTimestamp = new Date(r.snoozedUntil!).getTime();
    } else {
      const parts = r.date.split('-').map(Number);
      const timeParts = (r.time || '09:00').split(':').map(Number);
      const targetDate = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0] || 0, timeParts[1] || 0, 0);
      targetTimestamp = targetDate.getTime();
    }

    // Check if due right now (or within the last 2 minutes) and hasn't fired in this session
    // Only fire if not actively snoozed in the future
    if (!isSnoozedFuture && r.date === todayStr && targetTimestamp <= now.getTime() && (now.getTime() - targetTimestamp) <= 120000) {
      if (!recentlyFiredIds.has(r.id)) {
        recentlyFiredIds.add(r.id);
        fireReminder(r);
      }
    } else if (targetTimestamp > now.getTime()) {
      if (earliestTime === null || targetTimestamp < earliestTime) {
        earliestTime = targetTimestamp;
        earliestReminder = r;
      }
    }
  }

  if (earliestTime !== null && earliestReminder !== null) {
    const delay = Math.max(0, earliestTime - now.getTime());
    // Max safe setTimeout is ~24.8 days (2^31 - 1 ms). If further, cap to 24 hours
    const cappedDelay = Math.min(delay, 86400000);

    nextTimerTimestamp = earliestTime;
    activeTimer = setTimeout(async () => {
      if (earliestReminder) {
        await fireReminder(earliestReminder);
      }
      refreshNextReminderTimer();
    }, cappedDelay);
  }
}

// 15-second heartbeat to ensure near and due alarms never stall
if (typeof window !== 'undefined') {
  setInterval(() => {
    refreshNextReminderTimer();
  }, 15000);
}

/**
 * Dispatch a manual test notification to verify audio and native notification delivery
 */
export async function dispatchTestNotification(): Promise<{ success: boolean; message: string }> {
  testAlarmSound().catch(() => playGentleChime());

  if (!('Notification' in window)) {
    return { success: false, message: 'Native notifications not supported on this browser. Audio chime tested.' };
  }

  if (Notification.permission === 'denied') {
    return { success: false, message: 'Notifications are blocked in browser settings. Audio chime tested.' };
  }

  if (Notification.permission === 'default') {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return { success: false, message: 'Notification permission not granted. Audio chime tested.' };
    }
  }

  await dispatchNativeNotification(
    'test_notification_' + Date.now(),
    'Life OS Alert Active',
    'Local notifications and reminders are working properly.',
    { type: 'test' }
  );

  return { success: true, message: 'Test notification sent and alarm sound played.' };
}

async function fireReminder(reminder: ReminderItem) {
  recentlyFiredIds.add(reminder.id);

  // If in background, play chime or test alarm sound so user is alerted even if screen is away
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    testAlarmSound().catch(() => playGentleChime());
  }

  // Emit in-app alert for immediate on-screen presentation (which handles foreground alarm ringing)
  eventBus.emit('IN_APP_ALERT', {
    type: 'IN_APP_ALERT',
    entityId: reminder.id,
    data: {
      id: reminder.id,
      title: reminder.title,
      time: reminder.time,
      date: reminder.date
    }
  });

  await dispatchNativeNotification(
    `reminder:${reminder.id}`,
    `Alarm: ${reminder.title}`,
    `Due at ${reminder.time || 'now'}`,
    { reminderId: reminder.id }
  );

  eventBus.emit('REMINDER_DUE', {
    type: 'REMINDER_DUE',
    entityId: reminder.id,
    data: reminder
  });
}

/**
 * Schedule a specific reminder immediately
 */
export async function scheduleReminder(reminder: ReminderItem) {
  refreshNextReminderTimer();
}

/**
 * Cancel a reminder and close native notification tag
 */
export async function cancelReminder(reminderId: string) {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const notifications = await reg.getNotifications({ tag: `reminder:${reminderId}` });
        notifications.forEach(n => n.close());
      }
    } catch {}
  }
  refreshNextReminderTimer();
}

/**
 * Reschedule reminder
 */
export async function rescheduleReminder(reminder: ReminderItem) {
  await cancelReminder(reminder.id);
  await scheduleReminder(reminder);
}

/**
 * Detect reminders that were missed while application was closed/suspended (Section 41)
 */
export async function checkMissedReminders(): Promise<ReminderItem[]> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHM = now.toTimeString().slice(0, 5);

  const missed = await db.reminders
    .filter(r => {
      if (r.deletedAt || r.status !== 'active') return false;
      if (r.date < todayStr) return true;
      if (r.date === todayStr && r.time && r.time < currentHM) return true;
      return false;
    })
    .toArray();

  if (missed.length > 0) {
    eventBus.emit('MISSED_REMINDERS', {
      type: 'MISSED_REMINDERS',
      data: { count: missed.length, items: missed }
    });
  }

  return missed;
}

// Handle notification actions received from Service Worker
export async function handleNotificationAction(action: string, reminderId: string) {
  if (!reminderId) return;

  if (action === 'complete') {
    await db.reminders.update(reminderId, { status: 'dismissed', updatedAt: new Date().toISOString() });
    cancelReminder(reminderId);
  } else if (action === 'snooze_10m') {
    recentlyFiredIds.delete(reminderId);
    const tenMinsLater = new Date(Date.now() + 10 * 60000);
    const newDate = tenMinsLater.toISOString().split('T')[0];
    const newTime = tenMinsLater.toTimeString().slice(0, 5);
    await db.reminders.update(reminderId, {
      status: 'snoozed',
      date: newDate,
      time: newTime,
      snoozedUntil: tenMinsLater.toISOString(),
      updatedAt: new Date().toISOString()
    });
    refreshNextReminderTimer();
  }
}

// Listen to internal eventBus to invalidate reminder timer automatically
eventBus.subscribe('REMINDER_MUTATED', () => {
  refreshNextReminderTimer();
});

eventBus.subscribe('APP_RESUMED', () => {
  checkMissedReminders();
  refreshNextReminderTimer();
});

export const notificationService = {
  getSupportInfo: getNotificationSupportInfo,
  requestPermission: requestNotificationPermission,
  getPermissionStatus: getNotificationPermissionStatus,
  scheduleReminder,
  cancelReminder,
  rescheduleReminder,
  refreshNextReminderTimer,
  checkMissedReminders,
  handleNotificationAction,
  dispatchTestNotification,
  playGentleChime
};

