// Decision Repository
// Tracks personal reasoning, decisions made, alternatives considered, and scheduled reviews.

import { db, generateId, logAudit } from '../db/db';
import type { DecisionItem } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class DecisionRepository {
  private static validate(data: Partial<DecisionItem>): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Decision title cannot be empty.');
    }
    if (!data.reason || data.reason.trim().length === 0) {
      throw new Error('Decision reason must be documented.');
    }
    if (data.title.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Decision title exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
  }

  public static async create(input: Partial<DecisionItem>): Promise<DecisionItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const decision: DecisionItem = sanitizeObject({
      id,
      title: input.title!.trim(),
      reason: input.reason!.trim(),
      alternativesConsidered: (input.alternativesConsidered || []).map(a => a.trim()),
      decisionDate: input.decisionDate || now.split('T')[0],
      reviewDate: input.reviewDate,
      status: input.status || 'active',
      linkedEntityIds: input.linkedEntityIds || [],
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.decisions.add(decision);
    await logAudit('create', 'decision', id, `Recorded decision: ${decision.title}`);
    multiTabSync.broadcastMutation('decision', id, 'create', now);

    return decision;
  }

  public static async update(
    id: string,
    updates: Partial<DecisionItem>
  ): Promise<DecisionItem> {
    const existing = await db.decisions.get(id);
    if (!existing) throw new Error(`Decision ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.decisions.update(id, cleanUpdates);
    await logAudit('update', 'decision', id, `Updated decision: ${existing.title}`);
    multiTabSync.broadcastMutation('decision', id, 'update', now);

    return (await db.decisions.get(id))!;
  }

  public static async markReviewed(id: string, newStatus: DecisionItem['status'] = 'reviewed'): Promise<DecisionItem> {
    return this.update(id, { status: newStatus });
  }

  public static async queryDueForReview(): Promise<DecisionItem[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.decisions
      .filter(d => d.status === 'active' && !d.deletedAt && !!d.reviewDate && d.reviewDate <= today)
      .toArray();
  }

  public static async queryAll(): Promise<DecisionItem[]> {
    return db.decisions.filter(d => !d.deletedAt).toArray();
  }
}
