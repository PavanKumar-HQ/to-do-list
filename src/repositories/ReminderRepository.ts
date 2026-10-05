// Reminder Repository (Section 18, 19, 70, Invariant 9)
// Enforces reminder scheduling consistency and notification invalidation.

import { db, generateId, logAudit } from '../db/db';
import type { ReminderItem, ReminderStatus, RecurrenceType, EntityType } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';
import { scheduleReminder, cancelReminder, rescheduleReminder } from '../services/notificationService';

export class ReminderRepository {
  private static validate(data: Partial<ReminderItem>): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Reminder title cannot be empty.');
    }
    if (data.title.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Reminder title exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error('Reminder date must be in YYYY-MM-DD format.');
    }
  }

  public static async create(input: Partial<ReminderItem>): Promise<ReminderItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const reminder: ReminderItem = sanitizeObject({
      id,
      title: input.title!.trim(),
      date: input.date!,
      time: input.time,
      recurrence: input.recurrence || 'none',
      snoozedUntil: input.snoozedUntil,
      status: input.status || 'active',
      notificationState: input.notificationState || 'scheduled',
      linkedType: input.linkedType,
      linkedId: input.linkedId,
      snoozeCount: input.snoozeCount || 0,
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.reminders.add(reminder);
    await logAudit('create', 'reminder', id, `Created reminder: ${reminder.title}`);
    multiTabSync.broadcastMutation('reminder', id, 'create', now);
    scheduleReminder(reminder);

    return reminder;
  }

  public static async update(
    id: string,
    updates: Partial<ReminderItem>,
    expectedUpdatedAt?: string
  ): Promise<ReminderItem> {
    const existing = await db.reminders.get(id);
    if (!existing) throw new Error(`Reminder ${id} not found.`);

    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error('Reminder was modified in another session. Please reload.');
    }

    const merged = { ...existing, ...updates };
    this.validate(merged);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.reminders.update(id, cleanUpdates);
    await logAudit('update', 'reminder', id, `Updated reminder: ${merged.title}`);
    multiTabSync.broadcastMutation('reminder', id, 'update', now);

    const updated = (await db.reminders.get(id))!;
    if (updated.status === 'active' && !updated.deletedAt) {
      rescheduleReminder(updated);
    } else {
      cancelReminder(id);
    }

    return updated;
  }

  /**
   * Reschedule reminder - invalidates existing schedule (Section 19)
   */
  public static async reschedule(id: string, newDate: string, newTime?: string): Promise<ReminderItem> {
    const updated = await this.update(id, {
      date: newDate,
      time: newTime,
      status: 'active',
      snoozedUntil: undefined
    });
    rescheduleReminder(updated);
    return updated;
  }

  /**
   * Complete reminder - handles recurrence advancement idempotently (Section 19)
   */
  public static async complete(id: string): Promise<{ reminder: ReminderItem; nextOccurrence?: string }> {
    const existing = await db.reminders.get(id);
    if (!existing) throw new Error(`Reminder ${id} not found.`);

    const now = new Date().toISOString();
    if (existing.recurrence && existing.recurrence !== 'none') {
      const { calculateNextOccurrence } = await import('../utils/dates');
      const nextDate = calculateNextOccurrence(existing.date, existing.recurrence);
      await db.reminders.update(id, {
        date: nextDate,
        status: 'active',
        snoozedUntil: undefined,
        snoozeCount: 0,
        updatedAt: now
      });
      await logAudit('complete', 'reminder', id, `Completed occurrence of recurring reminder: ${existing.title}. Advanced to ${nextDate}`);
      multiTabSync.broadcastMutation('reminder', id, 'update', now);
      const updated = (await db.reminders.get(id))!;
      rescheduleReminder(updated);
      return { reminder: updated, nextOccurrence: nextDate };
    } else {
      await db.reminders.update(id, {
        status: 'completed',
        snoozedUntil: undefined,
        updatedAt: now
      });
      await logAudit('complete', 'reminder', id, `Completed reminder: ${existing.title}`);
      multiTabSync.broadcastMutation('reminder', id, 'update', now);
      cancelReminder(id);
      const updated = (await db.reminders.get(id))!;
      return { reminder: updated };
    }
  }

  /**
   * Dismiss or complete reminder (Section 19: cancels notification)
   */
  public static async dismiss(id: string): Promise<void> {
    const existing = await db.reminders.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.reminders.update(id, {
      status: 'dismissed',
      notificationState: 'cancelled',
      updatedAt: now
    });

    await logAudit('complete', 'reminder', id, `Dismissed reminder: ${existing.title}`);
    multiTabSync.broadcastMutation('reminder', id, 'update', now);
    cancelReminder(id);
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.reminders.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.reminders.update(id, {
      status: 'dismissed',
      notificationState: 'cancelled',
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'reminder', id, `Moved reminder to trash: ${existing.title}`);
    multiTabSync.broadcastMutation('reminder', id, 'delete', now);
    cancelReminder(id);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.reminders.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.reminders, db.auditHistory, db.settings], async () => {
      await db.reminders.delete(id);
    });

    await logAudit('delete', 'reminder', id, `Permanently deleted reminder: ${existing.title}`);
    multiTabSync.broadcastMutation('reminder', id, 'delete');
    cancelReminder(id);
  }

  public static async queryActive(): Promise<ReminderItem[]> {
    return db.reminders.filter(r => !r.deletedAt && r.status === 'active').toArray();
  }
}
