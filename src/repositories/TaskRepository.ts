// Task Repository (Sections 11-17, 70, 73)
// Handles validation, transactions, lifecycle state, recurrence idempotency, and referential integrity.

import { db, generateId, logAudit } from '../db/db';
import type { TaskItem, Subtask } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';
import { calculateNextOccurrence } from '../utils/dates';

export class TaskRepository {
  /**
   * Validate task fields before persistence (Section 67-68)
   */
  private static validate(data: Partial<TaskItem>): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Task title cannot be empty.');
    }
    if (data.title.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Task title exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
    if (data.description && data.description.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Task description exceeds limit of ${LIMITS.MAX_DESCRIPTION_LENGTH} characters.`);
    }
    if (data.status && !['inbox', 'todo', 'in_progress', 'waiting', 'completed', 'archived'].includes(data.status)) {
      throw new Error(`Invalid task status: ${data.status}`);
    }
    if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
      throw new Error(`Invalid task priority: ${data.priority}`);
    }
  }

  /**
   * Create a new task
   */
  public static async create(input: Partial<TaskItem>): Promise<TaskItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const task: TaskItem = sanitizeObject({
      id,
      title: input.title!.trim(),
      description: input.description?.trim(),
      status: input.status || 'todo',
      priority: input.priority || 'medium',
      category: input.category?.trim(),
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      reminderAt: input.reminderAt,
      recurrence: input.recurrence || 'none',
      subtasks: (input.subtasks || []).map((s: Subtask) => ({
        id: s.id || generateId(),
        title: s.title.trim(),
        completed: !!s.completed
      })),
      tags: (input.tags || []).map(t => t.trim()),
      linkedPersonId: input.linkedPersonId,
      linkedEventId: input.linkedEventId,
      linkedNoteId: input.linkedNoteId,
      goalId: input.goalId,
      attachmentIds: input.attachmentIds || [],
      isPinned: !!input.isPinned,
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.tasks.add(task);
    await logAudit('create', 'task', id, `Created task: ${task.title}`);
    multiTabSync.broadcastMutation('task', id, 'create', now);

    return task;
  }

  /**
   * Update an existing task with lost-update protection
   */
  public static async update(
    id: string,
    updates: Partial<TaskItem>,
    expectedUpdatedAt?: string
  ): Promise<TaskItem> {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task ${id} not found.`);
    }

    // Lost update check (Section 46)
    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error('Task was modified in another session. Please reload before saving.');
    }

    const merged = { ...existing, ...updates };
    this.validate(merged);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.tasks.update(id, cleanUpdates);
    await logAudit('update', 'task', id, `Updated task: ${merged.title}`);
    multiTabSync.broadcastMutation('task', id, 'update', now);

    return (await db.tasks.get(id))!;
  }

  /**
   * Complete task - handles recurrence idempotency (Section 16-17)
   */
  public static async complete(id: string): Promise<{ task: TaskItem; nextTask?: TaskItem }> {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task ${id} not found.`);
    }

    // Idempotency: completing an already-completed task is a no-op
    if (existing.status === 'completed') {
      return { task: existing };
    }

    const now = new Date().toISOString();
    let nextTask: TaskItem | undefined;

    await db.transaction('rw', [db.tasks, db.auditHistory, db.settings], async () => {
      // Mark current task complete
      await db.tasks.update(id, {
        status: 'completed',
        completedAt: now,
        updatedAt: now
      });

      // Recurrence generation (idempotent, series check)
      if (existing.recurrence && existing.recurrence !== 'none' && existing.dueDate) {
        const nextDueDate = calculateNextOccurrence(existing.dueDate, existing.recurrence);
        if (nextDueDate) {
          // Check if occurrence already exists for this date to maintain idempotency
          const duplicate = await db.tasks
            .filter(t => t.title === existing.title && t.dueDate === nextDueDate && !t.deletedAt)
            .first();

          if (!duplicate) {
            const nextId = generateId();
            nextTask = {
              ...existing,
              id: nextId,
              dueDate: nextDueDate,
              status: 'todo',
              completedAt: undefined,
              subtasks: existing.subtasks.map(s => ({ ...s, id: generateId(), completed: false })),
              createdAt: now,
              updatedAt: now
            };
            await db.tasks.add(nextTask);
          }
        }
      }
    });

    await logAudit('complete', 'task', id, `Completed task: ${existing.title}`);
    multiTabSync.broadcastMutation('task', id, 'update', now);

    return {
      task: (await db.tasks.get(id))!,
      nextTask
    };
  }

  /**
   * Uncomplete task
   */
  public static async uncomplete(id: string): Promise<TaskItem> {
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found.`);

    const now = new Date().toISOString();
    await db.tasks.update(id, {
      status: 'todo',
      completedAt: undefined,
      updatedAt: now
    });

    await logAudit('update', 'task', id, `Uncompleted task: ${existing.title}`);
    multiTabSync.broadcastMutation('task', id, 'update', now);
    return (await db.tasks.get(id))!;
  }

  /**
   * Soft delete (moves to Trash) - Section 11, 20
   */
  public static async softDelete(id: string): Promise<void> {
    const existing = await db.tasks.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.tasks.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'task', id, `Moved task to trash: ${existing.title}`);
    multiTabSync.broadcastMutation('task', id, 'delete', now);
  }

  /**
   * Restore from Trash (Section 13)
   */
  public static async restore(id: string): Promise<void> {
    const existing = await db.tasks.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.tasks.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'task', id, `Restored task from trash: ${existing.title}`);
    multiTabSync.broadcastMutation('task', id, 'restore', now);
  }

  /**
   * Permanent Delete - cleans up relationships transactionally (Section 12)
   */
  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.tasks.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.tasks, db.relationships, db.auditHistory, db.settings], async () => {
      // 1. Remove relationships pointing to this task
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'task') || (r.targetId === id && r.targetType === 'task'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }

      // 2. Delete task record permanently
      await db.tasks.delete(id);
    });

    await logAudit('delete', 'task', id, `Permanently deleted task: ${existing.title}`);
    multiTabSync.broadcastMutation('task', id, 'delete');
  }

  /**
   * Query active (non-deleted) tasks
   */
  public static async queryActive(): Promise<TaskItem[]> {
    return db.tasks.filter(t => !t.deletedAt).toArray();
  }

  /**
   * Query tasks in trash
   */
  public static async queryTrash(): Promise<TaskItem[]> {
    return db.tasks.filter(t => !!t.deletedAt).toArray();
  }
}
