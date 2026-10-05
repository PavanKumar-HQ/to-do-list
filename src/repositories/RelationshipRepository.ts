// Relationship Repository (Section 9, 10, Invariants 1 & 2)
// Enforces referential integrity at the database layer.

import { db, generateId, logAudit } from '../db/db';
import type { RelationshipItem, EntityType } from '../types';
import { multiTabSync } from '../services/multiTabService';

export class RelationshipRepository {
  /**
   * Check if a referenced entity exists in the database
   */
  public static async recordExists(type: EntityType, id: string): Promise<boolean> {
    try {
      switch (type) {
        case 'inbox': return !!(await db.inbox.get(id));
        case 'task': return !!(await db.tasks.get(id));
        case 'reminder': return !!(await db.reminders.get(id));
        case 'note': return !!(await db.notes.get(id));
        case 'idea': return !!(await db.ideas.get(id));
        case 'dont_forget': return !!(await db.dontForget.get(id));
        case 'person': return !!(await db.people.get(id));
        case 'followup': return !!(await db.followups.get(id));
        case 'event': return !!(await db.events.get(id));
        case 'list': return !!(await db.lists.get(id));
        case 'goal': return !!(await db.goals.get(id));
        case 'routine': return !!(await db.routines.get(id));
        case 'journal': return !!(await db.journalEntries.get(id));
        case 'expense': return !!(await db.expenses.get(id));
        case 'income': return !!(await db.income.get(id));
        case 'budget': return !!(await db.budgets.get(id));
        case 'credit_card': return !!(await db.creditCards.get(id));
        case 'recurring_expense': return !!(await db.recurringExpenses.get(id));
        case 'savings_goal': return !!(await db.savingsGoals.get(id));
        case 'attachment': return !!(await db.attachments.get(id));
        case 'voice_note': return !!(await db.voiceNotes.get(id));
        default: return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Create a relationship between two entities (Invariants 1 & 2)
   */
  public static async createRelationship(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationshipLabel?: string
  ): Promise<RelationshipItem> {
    // 0. Prevent self-reference
    if (sourceId === targetId) {
      throw new Error(`Cannot create self-referencing relationship: entity ${sourceId} cannot link to itself.`);
    }

    // 1. Verify source exists
    const sourceExists = await this.recordExists(sourceType, sourceId);
    if (!sourceExists) {
      throw new Error(`Cannot create relationship: source ${sourceType} with ID ${sourceId} does not exist.`);
    }

    // 2. Verify target exists
    const targetExists = await this.recordExists(targetType, targetId);
    if (!targetExists) {
      throw new Error(`Cannot create relationship: target ${targetType} with ID ${targetId} does not exist.`);
    }

    // 3. Avoid duplicate link
    const existing = await db.relationships
      .filter(
        r =>
          (r.sourceId === sourceId && r.targetId === targetId) ||
          (r.sourceId === targetId && r.targetId === sourceId)
      )
      .first();

    if (existing) {
      return existing;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const rel: RelationshipItem = {
      id,
      sourceId,
      sourceType,
      targetId,
      targetType,
      relationshipLabel: relationshipLabel?.trim(),
      createdAt: now
    };

    await db.relationships.add(rel);
    await logAudit('create', 'relationship', id, `Linked ${sourceType} to ${targetType}`);
    multiTabSync.broadcastMutation('relationship', id, 'create', now);

    return rel;
  }

  /**
   * Safely remove a relationship
   */
  public static async removeRelationship(id: string): Promise<void> {
    await db.relationships.delete(id);
    await logAudit('delete', 'relationship', id, `Removed relationship ${id}`);
    multiTabSync.broadcastMutation('relationship', id, 'delete');
  }

  /**
   * Find all relationships involving a record
   */
  public static async findForRecord(recordId: string): Promise<RelationshipItem[]> {
    return db.relationships
      .filter(r => r.sourceId === recordId || r.targetId === recordId)
      .toArray();
  }

  /**
   * Remove all relationships involving a record (Section 10)
   */
  public static async cleanupForRecord(recordId: string): Promise<number> {
    const list = await this.findForRecord(recordId);
    if (list.length > 0) {
      await db.relationships.bulkDelete(list.map(r => r.id));
    }
    return list.length;
  }
}
