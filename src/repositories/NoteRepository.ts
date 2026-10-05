// Note Repository (Section 15, 21, 51, 70)
// Manages notes, atomic conversions to tasks, checklist items, and archiving.

import { db, generateId, logAudit, addRelationship } from '../db/db';
import type { NoteItem, TaskItem, ChecklistItem } from '../types';
import { LIMITS, sanitizeObject, escapeHtml } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class NoteRepository {
  private static validate(data: Partial<NoteItem>): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Note title cannot be empty.');
    }
    if (data.title.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Note title exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
    if (data.content && data.content.length > LIMITS.MAX_NOTE_CONTENT_LENGTH) {
      throw new Error(`Note content exceeds limit of ${LIMITS.MAX_NOTE_CONTENT_LENGTH} characters.`);
    }
  }

  public static async create(input: Partial<NoteItem>): Promise<NoteItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const note: NoteItem = sanitizeObject({
      id,
      title: input.title!.trim(),
      content: input.content || '',
      category: input.category?.trim(),
      tags: (input.tags || []).map(t => t.trim()),
      isPinned: !!input.isPinned,
      checklistItems: (input.checklistItems || []).map((c: ChecklistItem) => ({
        id: c.id || generateId(),
        text: c.text.trim(),
        done: !!c.done
      })),
      attachmentIds: input.attachmentIds || [],
      voiceNoteIds: input.voiceNoteIds || [],
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.notes.add(note);
    await logAudit('create', 'note', id, `Created note: ${note.title}`);
    multiTabSync.broadcastMutation('note', id, 'create', now);

    return note;
  }

  public static async update(
    id: string,
    updates: Partial<NoteItem>,
    expectedUpdatedAt?: string
  ): Promise<NoteItem> {
    const existing = await db.notes.get(id);
    if (!existing) throw new Error(`Note ${id} not found.`);

    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error('Note was modified in another session. Please reload.');
    }

    const merged = { ...existing, ...updates };
    this.validate(merged);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.notes.update(id, cleanUpdates);
    await logAudit('update', 'note', id, `Updated note: ${merged.title}`);
    multiTabSync.broadcastMutation('note', id, 'update', now);

    return (await db.notes.get(id))!;
  }

  /**
   * Atomic conversion Note -> Task (Section 15)
   * Does not destroy the original note; creates task and links them transactionally.
   */
  public static async convertToTask(noteId: string, taskTitle?: string): Promise<TaskItem> {
    const note = await db.notes.get(noteId);
    if (!note) throw new Error(`Source note ${noteId} does not exist.`);

    const now = new Date().toISOString();
    const taskId = generateId();

    let createdTask: TaskItem;

    await db.transaction('rw', [db.notes, db.tasks, db.relationships, db.auditHistory, db.settings], async () => {
      createdTask = {
        id: taskId,
        title: (taskTitle || note.title).trim(),
        description: note.content,
        status: 'todo',
        priority: 'medium',
        category: note.category,
        recurrence: 'none',
        subtasks: note.checklistItems.map(c => ({
          id: generateId(),
          title: c.text,
          completed: c.done
        })),
        tags: [...note.tags],
        linkedNoteId: noteId,
        attachmentIds: [...note.attachmentIds],
        createdAt: now,
        updatedAt: now
      };

      await db.tasks.add(createdTask);

      // Create relationship record
      await db.relationships.add({
        id: generateId(),
        sourceId: noteId,
        sourceType: 'note',
        targetId: taskId,
        targetType: 'task',
        relationshipLabel: 'Converted To Task',
        createdAt: now
      });

      // Update source note's timestamp
      await db.notes.update(noteId, { updatedAt: now });
    });

    await logAudit('create', 'task', taskId, `Converted Note "${note.title}" to Task`);
    multiTabSync.broadcastMutation('task', taskId, 'create', now);
    multiTabSync.broadcastMutation('note', noteId, 'update', now);

    return (await db.tasks.get(taskId))!;
  }

  public static async archive(id: string): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.notes.update(id, {
      archivedAt: now,
      updatedAt: now
    });

    await logAudit('archive', 'note', id, `Archived note: ${existing.title}`);
    multiTabSync.broadcastMutation('note', id, 'archive', now);
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.notes.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'note', id, `Moved note to trash: ${existing.title}`);
    multiTabSync.broadcastMutation('note', id, 'delete', now);
  }

  public static async restore(id: string): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.notes.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'note', id, `Restored note from trash: ${existing.title}`);
    multiTabSync.broadcastMutation('note', id, 'restore', now);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.notes, db.relationships, db.auditHistory, db.settings], async () => {
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'note') || (r.targetId === id && r.targetType === 'note'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }
      await db.notes.delete(id);
    });

    await logAudit('delete', 'note', id, `Permanently deleted note: ${existing.title}`);
    multiTabSync.broadcastMutation('note', id, 'delete');
  }

  public static async queryActive(): Promise<NoteItem[]> {
    return db.notes.filter(n => !n.deletedAt && !n.archivedAt).toArray();
  }
}
