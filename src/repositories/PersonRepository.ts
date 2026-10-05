// Person Repository (Section 10, 12, 70, 132, 161)
// Preserves linked tasks, expenses, notes, and events on person deletion, removing only the relationship edges.

import { db, generateId, logAudit } from '../db/db';
import type { PersonItem } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class PersonRepository {
  private static validate(data: Partial<PersonItem>): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Person name cannot be empty.');
    }
    if (data.name.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Person name exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
  }

  public static async create(input: Partial<PersonItem>): Promise<PersonItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const person: PersonItem = sanitizeObject({
      id,
      name: input.name!.trim(),
      relationship: input.relationship?.trim(),
      notes: input.notes?.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.people.add(person);
    await logAudit('create', 'person', id, `Added contact: ${person.name}`);
    multiTabSync.broadcastMutation('person', id, 'create', now);

    return person;
  }

  public static async update(
    id: string,
    updates: Partial<PersonItem>,
    expectedUpdatedAt?: string
  ): Promise<PersonItem> {
    const existing = await db.people.get(id);
    if (!existing) throw new Error(`Person ${id} not found.`);

    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error('Contact was modified in another session. Please reload.');
    }

    const merged = { ...existing, ...updates };
    this.validate(merged);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.people.update(id, cleanUpdates);
    await logAudit('update', 'person', id, `Updated contact: ${merged.name}`);
    multiTabSync.broadcastMutation('person', id, 'update', now);

    return (await db.people.get(id))!;
  }

  /**
   * Safe delete (Section 132 & 161)
   * Deleting a person preserves linked tasks, expenses, notes, and events!
   * Unlinks relationships safely without destroying related data.
   */
  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.people.get(id);
    if (!existing) return;

    await db.transaction('rw', [
      db.people,
      db.relationships,
      db.tasks,
      db.events,
      db.followups,
      db.auditHistory,
      db.settings
    ], async () => {
      // 1. Unlink any tasks referencing this person as linkedPersonId (preserve task!)
      const linkedTasks = await db.tasks.filter(t => t.linkedPersonId === id).toArray();
      for (const t of linkedTasks) {
        await db.tasks.update(t.id, { linkedPersonId: undefined });
      }

      // 2. Unlink any events referencing this person (preserve event!)
      const linkedEvents = await db.events.filter(e => e.personId === id).toArray();
      for (const e of linkedEvents) {
        await db.events.update(e.id, { personId: undefined });
      }

      // 3. Mark follow-ups as resolved or archive them safely
      const followups = await db.followups.filter(f => f.personId === id).toArray();
      for (const f of followups) {
        await db.followups.update(f.id, { status: 'resolved' });
      }

      // 4. Remove all relationship edges involving this person
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'person') || (r.targetId === id && r.targetType === 'person'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }

      // 5. Delete the person record
      await db.people.delete(id);
    });

    await logAudit('delete', 'person', id, `Safely deleted person: ${existing.name} (preserved related records)`);
    multiTabSync.broadcastMutation('person', id, 'delete');
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.people.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.people.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'person', id, `Moved contact to trash: ${existing.name}`);
    multiTabSync.broadcastMutation('person', id, 'delete', now);
  }

  public static async restore(id: string): Promise<void> {
    const existing = await db.people.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    await db.people.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'person', id, `Restored contact from trash: ${existing.name}`);
    multiTabSync.broadcastMutation('person', id, 'restore', now);
  }

  public static async queryActive(): Promise<PersonItem[]> {
    return db.people.filter(p => !p.deletedAt).toArray();
  }
}
