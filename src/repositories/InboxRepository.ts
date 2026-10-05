// Inbox Repository (Section 15, 70)
// Universal input capture and atomic conversion to Tasks, Expenses, Notes, or Ideas.

import { db, generateId, logAudit } from '../db/db';
import type { InboxItem, TaskItem, ExpenseItem, NoteItem, IdeaItem, EntityType } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class InboxRepository {
  public static async capture(rawText: string, notes?: string, tags?: string[]): Promise<InboxItem> {
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Inbox item text cannot be empty.');
    }

    const now = new Date().toISOString();
    const id = generateId();

    const item: InboxItem = sanitizeObject({
      id,
      rawText: rawText.trim().slice(0, LIMITS.MAX_TITLE_LENGTH),
      notes: notes?.trim().slice(0, LIMITS.MAX_DESCRIPTION_LENGTH),
      tags: (tags || []).map(t => t.trim()),
      isProcessed: false,
      createdAt: now,
      updatedAt: now
    });

    await db.inbox.add(item);
    await logAudit('create', 'inbox', id, `Captured inbox item: ${item.rawText.slice(0, 50)}`);
    multiTabSync.broadcastMutation('inbox', id, 'create', now);

    return item;
  }

  /**
   * Convert Inbox -> Task atomically (Section 15)
   */
  public static async convertToTask(inboxId: string, taskData: Partial<TaskItem>): Promise<TaskItem> {
    const inboxItem = await db.inbox.get(inboxId);
    if (!inboxItem) throw new Error(`Inbox item ${inboxId} not found.`);

    const now = new Date().toISOString();
    const taskId = generateId();

    let createdTask: TaskItem;

    await db.transaction('rw', [db.inbox, db.tasks, db.relationships, db.auditHistory, db.settings], async () => {
      createdTask = {
        id: taskId,
        title: (taskData.title || inboxItem.rawText).trim(),
        description: taskData.description || inboxItem.notes,
        status: taskData.status || 'todo',
        priority: taskData.priority || 'medium',
        category: taskData.category,
        dueDate: taskData.dueDate,
        dueTime: taskData.dueTime,
        recurrence: taskData.recurrence || 'none',
        subtasks: taskData.subtasks || [],
        tags: [...inboxItem.tags, ...(taskData.tags || [])],
        createdAt: now,
        updatedAt: now
      };

      await db.tasks.add(createdTask);

      // Mark inbox item processed
      await db.inbox.update(inboxId, {
        isProcessed: true,
        processedToType: 'task',
        processedToId: taskId,
        updatedAt: now
      });

      // Link relationship
      await db.relationships.add({
        id: generateId(),
        sourceId: inboxId,
        sourceType: 'inbox',
        targetId: taskId,
        targetType: 'task',
        relationshipLabel: 'Processed To Task',
        createdAt: now
      });
    });

    await logAudit('create', 'task', taskId, `Processed Inbox to Task: ${createdTask!.title}`);
    multiTabSync.broadcastMutation('task', taskId, 'create', now);
    multiTabSync.broadcastMutation('inbox', inboxId, 'update', now);

    return (await db.tasks.get(taskId))!;
  }

  /**
   * Convert Inbox -> Expense atomically (Section 15)
   */
  public static async convertToExpense(inboxId: string, expenseData: Partial<ExpenseItem>): Promise<ExpenseItem> {
    const inboxItem = await db.inbox.get(inboxId);
    if (!inboxItem) throw new Error(`Inbox item ${inboxId} not found.`);

    const now = new Date().toISOString();
    const expenseId = generateId();

    let createdExpense: ExpenseItem;

    await db.transaction('rw', [db.inbox, db.expenses, db.relationships, db.auditHistory, db.settings], async () => {
      createdExpense = {
        id: expenseId,
        amountMinor: expenseData.amountMinor || 0,
        currency: expenseData.currency || 'INR',
        date: expenseData.date || now.split('T')[0],
        time: expenseData.time,
        category: (expenseData.category || 'General').trim(),
        paymentMethod: expenseData.paymentMethod || 'upi',
        isBusiness: !!expenseData.isBusiness,
        notes: expenseData.notes || inboxItem.rawText,
        createdAt: now,
        updatedAt: now
      };

      await db.expenses.add(createdExpense);

      await db.inbox.update(inboxId, {
        isProcessed: true,
        processedToType: 'expense',
        processedToId: expenseId,
        updatedAt: now
      });

      await db.relationships.add({
        id: generateId(),
        sourceId: inboxId,
        sourceType: 'inbox',
        targetId: expenseId,
        targetType: 'expense',
        relationshipLabel: 'Processed To Expense',
        createdAt: now
      });
    });

    await logAudit('create', 'expense', expenseId, `Processed Inbox to Expense`);
    multiTabSync.broadcastMutation('expense', expenseId, 'create', now);
    multiTabSync.broadcastMutation('inbox', inboxId, 'update', now);

    return (await db.expenses.get(expenseId))!;
  }

  public static async queryUnprocessed(): Promise<InboxItem[]> {
    return db.inbox.filter(i => !i.isProcessed && !i.deletedAt).toArray();
  }
}
