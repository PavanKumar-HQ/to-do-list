// Application API Layer (Local-First Architecture)
// Acts as the local backend for all UI components.
// Enforces transactions, validation, event broadcasting, and audit logging.

import { db, generateId, logAudit } from '../db/db';
import {
  TaskRepository,
  ReminderRepository,
  ExpenseRepository,
  NoteRepository,
  PersonRepository,
  CommitmentRepository,
  DecisionRepository,
  OpenLoopRepository,
  SettingsRepository
} from '../repositories';
import { eventBus } from '../services/eventBus';
import { triggerHaptic } from '../utils/haptics';
import { scheduleReminder, cancelReminder } from '../services/notificationService';
import type { TaskItem, ReminderItem, ExpenseItem, NoteItem, PersonItem, OpenLoopItem, CommitmentItem, EventItem } from '../types';

export const api = {
  tasks: {
    create: async (input: Partial<TaskItem>) => {
      const task = await TaskRepository.create(input);
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id, action: 'create' });
      triggerHaptic('light');
      return task;
    },
    update: async (id: string, updates: Partial<TaskItem>) => {
      const task = await TaskRepository.update(id, updates);
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return task;
    },
    complete: async (id: string) => {
      const res = await TaskRepository.complete(id);
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'complete' });
      triggerHaptic('success');
      return res;
    },
    undoComplete: async (id: string) => {
      const now = new Date().toISOString();
      await db.tasks.update(id, { status: 'todo', completedAt: undefined, updatedAt: now });
      await logAudit('update', 'task', id, 'Reopened task');
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
    },
    snooze: async (id: string, days = 1) => {
      const task = await db.tasks.get(id);
      if (!task) throw new Error('Task not found');
      const targetDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
      const res = await TaskRepository.update(id, {
        dueDate: targetDate,
        postponeCount: (task.postponeCount || 0) + 1,
        lastPostponedAt: new Date().toISOString()
      });
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'snooze' });
      triggerHaptic('light');
      return res;
    },
    reschedule: async (id: string, newDate: string, newTime?: string) => {
      const res = await TaskRepository.update(id, { dueDate: newDate, dueTime: newTime });
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return res;
    },
    archive: async (id: string) => {
      await db.tasks.update(id, { status: 'archived', updatedAt: new Date().toISOString() });
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('medium');
    },
    delete: async (id: string) => {
      await TaskRepository.softDelete(id);
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  reminders: {
    create: async (input: Partial<ReminderItem>) => {
      const reminder = await ReminderRepository.create(input);
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: reminder.id, action: 'create' });
      triggerHaptic('light');
      return reminder;
    },
    update: async (id: string, updates: Partial<ReminderItem>) => {
      const reminder = await ReminderRepository.update(id, updates);
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return reminder;
    },
    complete: async (id: string) => {
      await db.reminders.update(id, { status: 'completed', updatedAt: new Date().toISOString() });
      await cancelReminder(id);
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: id, action: 'complete' });
      triggerHaptic('success');
    },
    snooze: async (id: string, minutes = 10) => {
      const targetTime = new Date(Date.now() + minutes * 60000);
      const newDate = targetTime.toISOString().split('T')[0];
      const newTime = targetTime.toTimeString().slice(0, 5);
      await db.reminders.update(id, {
        date: newDate,
        time: newTime,
        snoozedUntil: targetTime.toISOString(),
        updatedAt: new Date().toISOString()
      });
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: id, action: 'snooze' });
      triggerHaptic('light');
    },
    delete: async (id: string) => {
      await ReminderRepository.softDelete(id);
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  expenses: {
    create: async (input: Partial<ExpenseItem>) => {
      const exp = await ExpenseRepository.create({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        currency: 'INR',
        ...input
      });
      eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: exp.id, action: 'create' });
      triggerHaptic('light');
      return exp;
    },
    update: async (id: string, updates: Partial<ExpenseItem>) => {
      const exp = await ExpenseRepository.update(id, updates);
      eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return exp;
    },
    delete: async (id: string) => {
      await ExpenseRepository.softDelete(id);
      eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  notes: {
    create: async (input: Partial<NoteItem>) => {
      const note = await NoteRepository.create(input);
      eventBus.emit('NOTE_MUTATED', { type: 'NOTE_MUTATED', entityId: note.id, action: 'create' });
      triggerHaptic('light');
      return note;
    },
    update: async (id: string, updates: Partial<NoteItem>) => {
      const note = await NoteRepository.update(id, updates);
      eventBus.emit('NOTE_MUTATED', { type: 'NOTE_MUTATED', entityId: id, action: 'update' });
      return note;
    },
    delete: async (id: string) => {
      await NoteRepository.softDelete(id);
      eventBus.emit('NOTE_MUTATED', { type: 'NOTE_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  loops: {
    create: async (input: Partial<OpenLoopItem>) => {
      const loop = await OpenLoopRepository.create(input);
      eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: loop.id, action: 'create' });
      triggerHaptic('light');
      return loop;
    },
    close: async (id: string) => {
      const loop = await OpenLoopRepository.close(id);
      eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: id, action: 'complete' });
      triggerHaptic('success');
      return loop;
    },
    delete: async (id: string) => {
      await OpenLoopRepository.softDelete(id);
      eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  commitments: {
    create: async (input: Partial<CommitmentItem> & { personName?: string; commitmentText?: string }) => {
      const today = new Date().toISOString().split('T')[0];
      const com = await CommitmentRepository.create({
        who: input.who || input.personName || 'Self',
        what: input.what || input.commitmentText || 'Promise',
        promisedDate: input.promisedDate || today,
        ...input
      });
      eventBus.emit('COMMITMENT_MUTATED', { type: 'COMMITMENT_MUTATED', entityId: com.id, action: 'create' });
      triggerHaptic('light');
      return com;
    },
    fulfill: async (id: string) => {
      const res = await CommitmentRepository.fulfill(id);
      eventBus.emit('COMMITMENT_MUTATED', { type: 'COMMITMENT_MUTATED', entityId: id, action: 'complete' });
      triggerHaptic('success');
      return res;
    },
    delete: async (id: string) => {
      await CommitmentRepository.softDelete(id);
      eventBus.emit('COMMITMENT_MUTATED', { type: 'COMMITMENT_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  events: {
    create: async (input: Partial<EventItem>) => {
      const now = new Date().toISOString();
      const id = input.id || generateId();
      const newEvent: EventItem = {
        id,
        title: (input.title || 'Event').trim(),
        date: input.date || now.split('T')[0],
        startTime: input.startTime || '10:00',
        endTime: input.endTime,
        location: input.location?.trim(),
        notes: input.notes?.trim(),
        category: input.category || 'meeting',
        color: input.color || '#3b82f6',
        recurrence: input.recurrence || 'none',
        reminderSchedule: input.reminderSchedule || { enabled: true, oneDayBefore: true },
        createdAt: input.createdAt || now,
        updatedAt: now
      };
      await db.events.add(newEvent);
      await logAudit('create', 'event', id, `Created event: ${newEvent.title}`);
      eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: id, action: 'create' });
      triggerHaptic('light');
      return newEvent;
    },
    update: async (id: string, updates: Partial<EventItem>) => {
      const now = new Date().toISOString();
      await db.events.update(id, { ...updates, updatedAt: now });
      await logAudit('update', 'event', id, `Updated event: ${id}`);
      eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
    },
    delete: async (id: string) => {
      const now = new Date().toISOString();
      await db.events.update(id, { deletedAt: now, updatedAt: now });
      await logAudit('delete', 'event', id, `Moved event ${id} to trash`);
      eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  }
};
