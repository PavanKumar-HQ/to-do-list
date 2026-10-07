// Open Loop Repository (Core Life OS Concept)
// Tracks unresolved life loops: waiting on someone, promised items, stale intentions, coming up commitments.

import { db, generateId, logAudit } from '../db/db';
import type { OpenLoopItem, OpenLoopType, ConsequenceLevel } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class OpenLoopRepository {
  private static validate(data: Partial<OpenLoopItem>): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Open loop description cannot be empty.');
    }
    if (data.title.length > LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`Open loop exceeds limit of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
  }

  public static async create(input: Partial<OpenLoopItem>): Promise<OpenLoopItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const loop: OpenLoopItem = sanitizeObject({
      id,
      title: input.title!.trim(),
      loopType: input.loopType || 'unresolved_thought',
      sourceEntityId: input.sourceEntityId,
      sourceEntityType: input.sourceEntityType,
      waitingOnPersonId: input.waitingOnPersonId,
      waitingOnPersonName: input.waitingOnPersonName?.trim(),
      consequence: input.consequence || 'none',
      nextAction: input.nextAction?.trim(),
      notes: input.notes?.trim(),
      status: input.status || 'open',
      snoozedUntil: input.snoozedUntil,
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.openLoops.add(loop);
    await logAudit('create', 'open_loop', id, `Opened loop: ${loop.title}`);
    multiTabSync.broadcastMutation('open_loop', id, 'create', now);

    return loop;
  }

  public static async close(id: string): Promise<OpenLoopItem> {
    const existing = await db.openLoops.get(id);
    if (!existing) throw new Error(`Open loop ${id} not found.`);

    const now = new Date().toISOString();
    await db.openLoops.update(id, {
      status: 'closed',
      closedAt: now,
      updatedAt: now
    });

    await logAudit('update', 'open_loop', id, `Closed loop: ${existing.title}`);
    multiTabSync.broadcastMutation('open_loop', id, 'update', now);

    return (await db.openLoops.get(id))!;
  }

  public static async update(id: string, updates: Partial<OpenLoopItem>): Promise<OpenLoopItem> {
    const existing = await db.openLoops.get(id);
    if (!existing) throw new Error(`Open loop ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.openLoops.update(id, cleanUpdates);
    await logAudit('update', 'open_loop', id, `Updated loop: ${cleanUpdates.title || existing.title}`);
    multiTabSync.broadcastMutation('open_loop', id, 'update', now);

    return (await db.openLoops.get(id))!;
  }

  public static async snooze(id: string, untilDate: string): Promise<OpenLoopItem> {
    const existing = await db.openLoops.get(id);
    if (!existing) throw new Error(`Open loop ${id} not found.`);

    const now = new Date().toISOString();
    await db.openLoops.update(id, {
      status: 'snoozed',
      snoozedUntil: untilDate,
      updatedAt: now
    });

    await logAudit('update', 'open_loop', id, `Snoozed loop until ${untilDate}: ${existing.title}`);
    multiTabSync.broadcastMutation('open_loop', id, 'update', now);

    return (await db.openLoops.get(id))!;
  }

  public static async queryOpen(): Promise<OpenLoopItem[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.openLoops
      .filter(l => !l.deletedAt && (l.status === 'open' || (l.status === 'snoozed' && !!l.snoozedUntil && l.snoozedUntil <= today)))
      .toArray();
  }

  public static async queryWaitingOn(): Promise<OpenLoopItem[]> {
    const list = await this.queryOpen();
    return list.filter(l => l.loopType === 'waiting_on');
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.openLoops.get(id);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.openLoops.update(id, { deletedAt: now, updatedAt: now });
    await logAudit('delete', 'open_loop', id, `Moved open loop to trash: ${existing.title}`);
    multiTabSync.broadcastMutation('open_loop', id, 'delete', now);
  }
}
