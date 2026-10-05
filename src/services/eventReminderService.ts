import { db, generateId, logAudit } from '../db/db';
import type { EventItem, ReminderItem } from '../types';
import { refreshNextReminderTimer } from './notificationService';
import { eventBus } from './eventBus';

export class EventReminderService {
  /**
   * Synchronize reminders for a given event based on its reminderSchedule
   */
  static async syncEventReminders(event: EventItem): Promise<void> {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);

    // First remove existing active reminders for this event
    const existingReminders = await db.reminders
      .filter((r) => !r.deletedAt && r.linkedType === 'event' && r.linkedId === event.id)
      .toArray();

    const schedule = event.reminderSchedule;

    if (!schedule || !schedule.enabled || schedule.isDismissed) {
      // Deactivate all existing reminders for this event
      for (const r of existingReminders) {
        await db.reminders.update(r.id, {
          status: 'dismissed',
          notificationState: 'cancelled',
          updatedAt: nowIso
        });
      }
      refreshNextReminderTimer();
      return;
    }

    // 1. One Day Before Reminder (at 09:00)
    if (schedule.oneDayBefore) {
      const eventDateObj = new Date(`${event.date}T00:00:00`);
      eventDateObj.setDate(eventDateObj.getDate() - 1);
      const dayBeforeStr = `${eventDateObj.getFullYear()}-${String(eventDateObj.getMonth() + 1).padStart(2, '0')}-${String(eventDateObj.getDate()).padStart(2, '0')}`;

      if (dayBeforeStr >= todayStr) {
        const existingDayBefore = existingReminders.find((r) => r.date === dayBeforeStr);
        if (!existingDayBefore) {
          const newReminder: ReminderItem = {
            id: generateId(),
            title: `Tomorrow: ${event.title}${event.startTime ? ` at ${event.startTime}` : ''}`,
            date: dayBeforeStr,
            time: '09:00',
            recurrence: 'none',
            status: 'active',
            notificationState: 'scheduled',
            linkedType: 'event',
            linkedId: event.id,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.reminders.add(newReminder);
        }
      }
    }

    // 2. Day-of-Event & Recurring interval reminders (default every 2 hours until event/acknowledged)
    const recurringInterval = schedule.recurringHours || 2;
    const eventTimeStr = event.startTime || '10:00';
    const [eventHour, eventMin] = eventTimeStr.split(':').map(Number);

    // Generate intervals leading up to the event starting from morning (e.g. 08:00) or 2hr steps
    const timesToRemind: string[] = [];
    let startH = Math.max(8, eventHour - (recurringInterval * 3));
    while (startH < eventHour) {
      timesToRemind.push(`${String(startH).padStart(2, '0')}:${String(eventMin || 0).padStart(2, '0')}`);
      startH += recurringInterval;
    }
    // Also add the event start time
    timesToRemind.push(eventTimeStr);

    for (const time of timesToRemind) {
      const existing = existingReminders.find((r) => r.date === event.date && r.time === time);
      if (!existing && event.date >= todayStr) {
        const newReminder: ReminderItem = {
          id: generateId(),
          title: `Upcoming: ${event.title} (${time})`,
          date: event.date,
          time,
          recurrence: 'none',
          status: 'active',
          notificationState: 'scheduled',
          linkedType: 'event',
          linkedId: event.id,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.reminders.add(newReminder);
      }
    }

    refreshNextReminderTimer();
    eventBus.emit('REMINDER_MUTATED', { entityId: event.id, action: 'update' });
  }

  /**
   * Turn off or acknowledge reminders for an event
   */
  static async toggleEventReminder(eventId: string, enabled: boolean): Promise<void> {
    const event = await db.events.get(eventId);
    if (!event) return;

    const currentSchedule = event.reminderSchedule || {
      oneDayBefore: true,
      recurringHours: 2,
      enabled: true
    };

    const updatedSchedule = {
      ...currentSchedule,
      enabled,
      isDismissed: !enabled
    };

    await db.events.update(eventId, {
      reminderSchedule: updatedSchedule,
      updatedAt: new Date().toISOString()
    });

    const updatedEvent = { ...event, reminderSchedule: updatedSchedule };
    await this.syncEventReminders(updatedEvent);
    await logAudit('update', 'event', eventId, `Toggled reminders ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Update the custom schedule (e.g. interval hours, one-day before)
   */
  static async updateSchedule(
    eventId: string,
    updates: { oneDayBefore?: boolean; recurringHours?: number; enabled?: boolean; isDismissed?: boolean }
  ): Promise<void> {
    const event = await db.events.get(eventId);
    if (!event) return;

    const schedule = {
      oneDayBefore: updates.oneDayBefore ?? event.reminderSchedule?.oneDayBefore ?? true,
      recurringHours: updates.recurringHours ?? event.reminderSchedule?.recurringHours ?? 2,
      enabled: updates.enabled ?? event.reminderSchedule?.enabled ?? true,
      isDismissed: updates.isDismissed ?? event.reminderSchedule?.isDismissed ?? false
    };

    await db.events.update(eventId, {
      reminderSchedule: schedule,
      updatedAt: new Date().toISOString()
    });

    await this.syncEventReminders({ ...event, reminderSchedule: schedule });
  }
}
