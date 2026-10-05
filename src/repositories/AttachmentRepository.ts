// Attachment Repository (Section 47-50, 135-137, 162)
// Enforces MIME safety, size limits, and reference counting before physical deletion.

import { db, generateId, logAudit } from '../db/db';
import type { AttachmentItem, EntityType } from '../types';
import { LIMITS, isValidAttachmentMime } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class AttachmentRepository {
  /**
   * Save an attachment with size and MIME validation
   */
  public static async save(
    name: string,
    mimeType: string,
    sizeBytes: number,
    dataBase64: string
  ): Promise<AttachmentItem> {
    if (!name || name.trim().length === 0) {
      throw new Error('Attachment name cannot be empty.');
    }
    if (sizeBytes > LIMITS.MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(`Attachment exceeds maximum allowable size of 25MB.`);
    }
    if (!isValidAttachmentMime(mimeType)) {
      throw new Error(`File type ${mimeType} is not permitted for security reasons.`);
    }

    const id = generateId();
    const now = new Date().toISOString();

    const attachment: AttachmentItem = {
      id,
      name: name.trim().slice(0, 255),
      mimeType: mimeType.trim().toLowerCase(),
      sizeBytes,
      dataBase64,
      createdAt: now
    };

    await db.attachments.add(attachment);
    await logAudit('create', 'attachment', id, `Saved attachment: ${attachment.name}`);
    multiTabSync.broadcastMutation('attachment', id, 'create', now);

    return attachment;
  }

  /**
   * Count references across all domain entities (Section 136)
   */
  public static async countReferences(attachmentId: string): Promise<number> {
    const [tasks, notes, journal, expenses] = await Promise.all([
      db.tasks.filter(t => !!t.attachmentIds?.includes(attachmentId)).toArray(),
      db.notes.filter(n => !!n.attachmentIds?.includes(attachmentId)).toArray(),
      db.journalEntries.filter(j => !!j.attachmentIds?.includes(attachmentId)).toArray(),
      db.expenses.filter(e => e.receiptAttachmentId === attachmentId).toArray()
    ]);

    return tasks.length + notes.length + journal.length + expenses.length;
  }

  /**
   * Unlink an attachment from a specific record without necessarily deleting the file
   */
  public static async unlinkFromRecord(
    attachmentId: string,
    recordType: 'task' | 'note' | 'journal' | 'expense',
    recordId: string
  ): Promise<{ remainingReferences: number; wasDeleted: boolean }> {
    await db.transaction('rw', [db.tasks, db.notes, db.journalEntries, db.expenses], async () => {
      if (recordType === 'task') {
        const task = await db.tasks.get(recordId);
        if (task && task.attachmentIds) {
          await db.tasks.update(recordId, {
            attachmentIds: task.attachmentIds.filter(id => id !== attachmentId)
          });
        }
      } else if (recordType === 'note') {
        const note = await db.notes.get(recordId);
        if (note && note.attachmentIds) {
          await db.notes.update(recordId, {
            attachmentIds: note.attachmentIds.filter(id => id !== attachmentId)
          });
        }
      } else if (recordType === 'journal') {
        const journal = await db.journalEntries.get(recordId);
        if (journal && journal.attachmentIds) {
          await db.journalEntries.update(recordId, {
            attachmentIds: journal.attachmentIds.filter(id => id !== attachmentId)
          });
        }
      } else if (recordType === 'expense') {
        const expense = await db.expenses.get(recordId);
        if (expense && expense.receiptAttachmentId === attachmentId) {
          await db.expenses.update(recordId, { receiptAttachmentId: undefined });
        }
      }
    });

    const remaining = await this.countReferences(attachmentId);
    let wasDeleted = false;

    // Only delete physical file if no references remain (Section 135)
    if (remaining === 0) {
      await db.attachments.delete(attachmentId);
      wasDeleted = true;
      await logAudit('delete', 'attachment', attachmentId, `Purged orphaned attachment: ${attachmentId}`);
      multiTabSync.broadcastMutation('attachment', attachmentId, 'delete');
    }

    return { remainingReferences: remaining, wasDeleted };
  }

  /**
   * Safe manual delete: will refuse if active references remain unless force is set
   */
  public static async deleteIfOrphaned(attachmentId: string): Promise<boolean> {
    const refs = await this.countReferences(attachmentId);
    if (refs > 0) {
      return false; // Still referenced! Do not delete!
    }
    await db.attachments.delete(attachmentId);
    await logAudit('delete', 'attachment', attachmentId, `Cleaned up orphaned attachment ${attachmentId}`);
    return true;
  }
}
