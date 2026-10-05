// Commitment & Promise Repository
// Manages promises made to other people ("I'll send you the document tomorrow") and tracks due dates.

import { db, generateId, logAudit } from '../db/db';
import type { CommitmentItem } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class CommitmentRepository {
  private static validate(data: Partial<CommitmentItem>): void {
    if (!data.what || data.what.trim().length === 0) {
      throw new Error('Commitment description cannot be empty.');
    }
    if (data.what.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Commitment exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
    if (!data.promisedDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.promisedDate)) {
      throw new Error('Promised date must be in YYYY-MM-DD format.');
    }
  }

  public static async create(input: Partial<CommitmentItem>): Promise<CommitmentItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const commitment: CommitmentItem = sanitizeObject({
      id,
      who: (input.who || 'Self').trim(),
      personId: input.personId,
      what: input.what!.trim(),
      promisedDate: input.promisedDate!,
      context: input.context?.trim(),
      status: input.status || 'pending',
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.commitments.add(commitment);
    await logAudit('create', 'commitment', id, `Promised ${commitment.who}: ${commitment.what}`);
    multiTabSync.broadcastMutation('commitment', id, 'create', now);

    return commitment;
  }

  public static async update(
    id: string,
    updates: Partial<CommitmentItem>
  ): Promise<CommitmentItem> {
    const existing = await db.commitments.get(id);
    if (!existing) throw new Error(`Commitment ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.commitments.update(id, cleanUpdates);
    await logAudit('update', 'commitment', id, `Updated commitment: ${existing.what}`);
    multiTabSync.broadcastMutation('commitment', id, 'update', now);

    return (await db.commitments.get(id))!;
  }

  public static async fulfill(id: string): Promise<CommitmentItem> {
    return this.update(id, { status: 'fulfilled' });
  }

  public static async queryPending(): Promise<CommitmentItem[]> {
    return db.commitments.filter(c => c.status === 'pending' && !c.deletedAt).toArray();
  }

  public static async queryDueThisWeek(): Promise<CommitmentItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    return db.commitments
      .filter(c => c.status === 'pending' && !c.deletedAt && c.promisedDate >= today && c.promisedDate <= sevenDaysLater)
      .toArray();
  }
}
