import { db, generateId, logAudit } from '../db/db';
import type { EventItem, ReminderItem } from '../types';
import { refreshNextReminderTimer } from './notificationService';
import { eventBus } from './eventBus';

export class EventReminderService {
  /**
   * Synchronize reminders for a given event based on its reminderSchedule
   * Only creates durable, non-polluting single reminders (at event time, and optionally 1 day before).
   */
  static async syncEventReminders(event: EventItem): Promise<void> {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);

    // Remove existing active reminders for this event to avoid duplicate backlog
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

    // 2. Day-of-Event Single Reminder (At Event Start Time)
    const eventTimeStr = event.startTime || '10:00';
    const currentHM = new Date().toTimeString().slice(0, 5);

    // Only schedule if the event is today in future, or upcoming date
    const isFutureTime = event.date > todayStr || (event.date === todayStr && eventTimeStr >= currentHM);

    if (isFutureTime) {
      const existingAtTime = existingReminders.find((r) => r.date === event.date && r.time === eventTimeStr);
      if (!existingAtTime) {
        const newReminder: ReminderItem = {
          id: generateId(),
          title: `Event: ${event.title}`,
          date: event.date,
          time: eventTimeStr,
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

    // Clean up any old duplicate synthetic interval reminders for this event
    for (const r of existingReminders) {
      if (r.title.startsWith('Upcoming:') && r.time !== eventTimeStr) {
        await db.reminders.delete(r.id);
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

    const updatedEvent = await db.events.get(eventId);
    if (updatedEvent) {
      await this.syncEventReminders(updatedEvent);
    }
  }

  /**
   * Update full reminder schedule for an event
   */
  static async updateSchedule(
    eventId: string,
    scheduleUpdates: {
      oneDayBefore?: boolean;
      recurringHours?: number;
      enabled?: boolean;
      isDismissed?: boolean;
    }
  ): Promise<void> {
    const event = await db.events.get(eventId);
    if (!event) throw new Error('Event not found');

    const current = event.reminderSchedule || {
      oneDayBefore: true,
      recurringHours: 2,
      enabled: true
    };

    const newSchedule = {
      ...current,
      ...scheduleUpdates
    };

    await db.events.update(eventId, {
      reminderSchedule: newSchedule,
      updatedAt: new Date().toISOString()
    });

    const updatedEvent = await db.events.get(eventId);
    if (updatedEvent) {
      await this.syncEventReminders(updatedEvent);
    }
  }

  /**
   * Purge any historical synthetic interval flood reminders from the database
   */
  static async purgeFloodedReminders(): Promise<number> {
    const flooded = await db.reminders
      .filter((r) => r.linkedType === 'event' && r.title.startsWith('Upcoming:'))
      .toArray();

    for (const r of flooded) {
      await db.reminders.delete(r.id);
    }
    return flooded.length;
  }
}
