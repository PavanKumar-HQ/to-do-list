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
  SettingsRepository,
  RelationshipRepository
} from '../repositories';
import { eventBus } from '../services/eventBus';
import { triggerHaptic } from '../utils/haptics';
import { scheduleReminder, cancelReminder } from '../services/notificationService';
import type {
  TaskItem,
  ReminderItem,
  ExpenseItem,
  NoteItem,
  PersonItem,
  OpenLoopItem,
  CommitmentItem,
  EventItem,
  GoalItem,
  CustomListItem,
  IncomeItem,
  BudgetItem,
  EntityType
} from '../types';

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
      const res = await ReminderRepository.complete(id);
      eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: id, action: 'complete' });
      triggerHaptic('success');
      return res;
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
  },

  people: {
    create: async (input: Partial<PersonItem>) => {
      const person = await PersonRepository.create(input);
      eventBus.emit('PERSON_MUTATED', { type: 'PERSON_MUTATED', entityId: person.id, action: 'create' });
      triggerHaptic('light');
      return person;
    },
    update: async (id: string, updates: Partial<PersonItem>) => {
      const person = await PersonRepository.update(id, updates);
      eventBus.emit('PERSON_MUTATED', { type: 'PERSON_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return person;
    },
    delete: async (id: string) => {
      await PersonRepository.softDelete(id);
      eventBus.emit('PERSON_MUTATED', { type: 'PERSON_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  goals: {
    create: async (input: Partial<GoalItem>) => {
      const now = new Date().toISOString();
      const id = input.id || generateId();
      const goal: GoalItem = {
        id,
        title: (input.title || 'Goal').trim(),
        description: input.description?.trim(),
        why: input.why?.trim(),
        nextAction: input.nextAction?.trim(),
        targetAmount: input.targetAmount || 100,
        currentAmount: input.currentAmount || 0,
        unit: input.unit || '%',
        deadline: input.deadline,
        status: input.status || 'active',
        milestones: input.milestones || [],
        createdAt: input.createdAt || now,
        updatedAt: now
      };
      await db.goals.add(goal);
      await logAudit('create', 'goal', id, `Created goal: ${goal.title}`);
      eventBus.emit('GOAL_MUTATED', { type: 'GOAL_MUTATED', entityId: id, action: 'create' });
      triggerHaptic('light');
      return goal;
    },
    update: async (id: string, updates: Partial<GoalItem>) => {
      const now = new Date().toISOString();
      await db.goals.update(id, { ...updates, updatedAt: now });
      await logAudit('update', 'goal', id, `Updated goal: ${id}`);
      eventBus.emit('GOAL_MUTATED', { type: 'GOAL_MUTATED', entityId: id, action: 'update' });
      triggerHaptic('light');
      return (await db.goals.get(id))!;
    },
    recordProgress: async (id: string, newAmount: number) => {
      const existing = await db.goals.get(id);
      if (!existing) throw new Error(`Goal ${id} not found.`);
      const now = new Date().toISOString();
      const status = newAmount >= existing.targetAmount ? 'completed' : existing.status;
      await db.goals.update(id, { currentAmount: newAmount, status, lastActivityAt: now, updatedAt: now });
      await logAudit('update', 'goal', id, `Updated progress for ${existing.title}: ${newAmount}/${existing.targetAmount}`);
      eventBus.emit('GOAL_MUTATED', { type: 'GOAL_MUTATED', entityId: id, action: 'update' });
      triggerHaptic(status === 'completed' ? 'success' : 'light');
    },
    delete: async (id: string) => {
      const now = new Date().toISOString();
      await db.goals.update(id, { deletedAt: now, updatedAt: now });
      await logAudit('delete', 'goal', id, `Moved goal ${id} to trash`);
      eventBus.emit('GOAL_MUTATED', { type: 'GOAL_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  lists: {
    create: async (input: { title: string; category?: string }) => {
      const now = new Date().toISOString();
      const id = generateId();
      const list: CustomListItem = {
        id,
        title: input.title.trim(),
        category: input.category || 'General',
        isPinned: false,
        items: [],
        createdAt: now,
        updatedAt: now
      };
      await db.lists.add(list);
      await logAudit('create', 'list', id, `Created list: ${list.title}`);
      eventBus.emit('LIST_MUTATED', { type: 'LIST_MUTATED', entityId: id, action: 'create' });
      triggerHaptic('light');
      return list;
    },
    addItem: async (listId: string, text: string) => {
      const list = await db.lists.get(listId);
      if (!list) throw new Error(`List ${listId} not found.`);
      const now = new Date().toISOString();
      const currentItems = list.items || [];
      const newItem = {
        id: generateId(),
        text: text.trim(),
        completed: false,
        order: currentItems.length
      };
      await db.lists.update(listId, {
        items: [...currentItems, newItem],
        updatedAt: now
      });
      eventBus.emit('LIST_MUTATED', { type: 'LIST_MUTATED', entityId: listId, action: 'update' });
      triggerHaptic('light');
      return newItem;
    },
    toggleItem: async (listId: string, itemId: string) => {
      const list = await db.lists.get(listId);
      if (!list) return;
      const now = new Date().toISOString();
      const currentItems = list.items || [];
      const updated = currentItems.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i));
      await db.lists.update(listId, { items: updated, updatedAt: now });
      eventBus.emit('LIST_MUTATED', { type: 'LIST_MUTATED', entityId: listId, action: 'update' });
      triggerHaptic('light');
    },
    deleteItem: async (listId: string, itemId: string) => {
      const list = await db.lists.get(listId);
      if (!list) return;
      const now = new Date().toISOString();
      const currentItems = list.items || [];
      const updated = currentItems.filter((i) => i.id !== itemId);
      await db.lists.update(listId, { items: updated, updatedAt: now });
      eventBus.emit('LIST_MUTATED', { type: 'LIST_MUTATED', entityId: listId, action: 'update' });
      triggerHaptic('light');
    },
    delete: async (listId: string) => {
      const now = new Date().toISOString();
      await db.lists.update(listId, { deletedAt: now, updatedAt: now });
      await logAudit('delete', 'list', listId, `Moved list ${listId} to trash`);
      eventBus.emit('LIST_MUTATED', { type: 'LIST_MUTATED', entityId: listId, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  income: {
    create: async (input: Partial<IncomeItem>) => {
      const now = new Date().toISOString();
      const id = input.id || generateId();
      const item: IncomeItem = {
        id,
        amountMinor: input.amountMinor || 0,
        currency: input.currency || 'INR',
        source: input.source || 'General',
        date: input.date || now.split('T')[0],
        category: input.category || 'Salary',
        isRecurring: !!input.isRecurring,
        notes: input.notes?.trim(),
        createdAt: input.createdAt || now,
        updatedAt: now
      };
      await db.income.add(item);
      await logAudit('create', 'income', id, `Recorded income: ${item.source} (${item.amountMinor})`);
      eventBus.emit('INCOME_MUTATED', { type: 'INCOME_MUTATED', entityId: id, action: 'create' });
      triggerHaptic('light');
      return item;
    },
    delete: async (id: string) => {
      const now = new Date().toISOString();
      await db.income.update(id, { deletedAt: now, updatedAt: now });
      await logAudit('delete', 'income', id, `Moved income ${id} to trash`);
      eventBus.emit('INCOME_MUTATED', { type: 'INCOME_MUTATED', entityId: id, action: 'delete' });
      triggerHaptic('heavy');
    }
  },

  budgets: {
    setBudget: async (month: string, category: string, budgetAmountMinor: number) => {
      const existing = await db.budgets.filter((b) => b.month === month && b.category === category).first();
      const now = new Date().toISOString();
      if (existing) {
        await db.budgets.update(existing.id, { budgetAmountMinor, updatedAt: now });
        await logAudit('update', 'budget', existing.id, `Updated budget for ${category} (${month})`);
      } else {
        const id = generateId();
        await db.budgets.add({ id, month, category, budgetAmountMinor, createdAt: now, updatedAt: now });
        await logAudit('create', 'budget', id, `Set budget for ${category} (${month})`);
      }
      eventBus.emit('BUDGET_MUTATED', { type: 'BUDGET_MUTATED', entityId: month, action: 'update' });
      triggerHaptic('light');
    }
  },

  relationships: {
    link: async (sourceType: EntityType, sourceId: string, targetType: EntityType, targetId: string, label?: string) => {
      const rel = await RelationshipRepository.createRelationship(sourceType, sourceId, targetType, targetId, label);
      eventBus.emit('RELATIONSHIP_MUTATED', { type: 'RELATIONSHIP_MUTATED', entityId: rel.id, action: 'create' });
      return rel;
    },
    unlink: async (id: string) => {
      await RelationshipRepository.removeRelationship(id);
      eventBus.emit('RELATIONSHIP_MUTATED', { type: 'RELATIONSHIP_MUTATED', entityId: id, action: 'delete' });
    }
  },

  trash: {
    restore: async (type: EntityType, id: string) => {
      const now = new Date().toISOString();
      switch (type) {
        case 'task': await db.tasks.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'reminder': await db.reminders.update(id, { deletedAt: undefined, status: 'active', updatedAt: now }); break;
        case 'event': await db.events.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'note': await db.notes.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'expense': await db.expenses.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'income': await db.income.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'person': await db.people.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'goal': await db.goals.update(id, { deletedAt: undefined, updatedAt: now }); break;
        case 'list': await db.lists.update(id, { deletedAt: undefined, updatedAt: now }); break;
      }
      await logAudit('restore', type, id, `Restored ${type} from trash`);
      triggerHaptic('success');
    }
  }
};
