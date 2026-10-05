// Future Message Repository (Section 30: "Message to Future Self")
// Allows users to write messages to their future self scheduled to unlock on an exact date.

import { db, generateId, logAudit } from '../db/db';
import type { FutureMessageItem } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class FutureMessageRepository {
  public static async create(input: {
    title: string;
    message: string;
    openDate: string; // YYYY-MM-DD
  }): Promise<FutureMessageItem> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Title cannot be empty.');
    }
    if (!input.message || input.message.trim().length === 0) {
      throw new Error('Message cannot be empty.');
    }
    if (!input.openDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.openDate)) {
      throw new Error('Open date must be in YYYY-MM-DD format.');
    }

    const now = new Date().toISOString();
    const id = generateId();

    const futureMessage: FutureMessageItem = sanitizeObject({
      id,
      title: input.title.trim().slice(0, LIMITS.MAX_TITLE_LENGTH),
      message: input.message.trim().slice(0, LIMITS.MAX_NOTE_CONTENT_LENGTH),
      openDate: input.openDate,
      isOpened: false,
      createdAt: now,
      updatedAt: now
    });

    await db.futureMessages.add(futureMessage);
    await logAudit('create', 'future_message', id, `Scheduled message to future self for ${futureMessage.openDate}`);
    multiTabSync.broadcastMutation('future_message', id, 'create', now);

    return futureMessage;
  }

  public static async openMessage(id: string): Promise<FutureMessageItem> {
    const existing = await db.futureMessages.get(id);
    if (!existing) throw new Error(`Future message ${id} not found.`);

    const now = new Date().toISOString();
    await db.futureMessages.update(id, {
      isOpened: true,
      openedAt: now,
      updatedAt: now
    });

    await logAudit('update', 'future_message', id, `Opened message from past self: ${existing.title}`);
    multiTabSync.broadcastMutation('future_message', id, 'update', now);

    return (await db.futureMessages.get(id))!;
  }

  public static async queryReadyToOpen(todayDate: string): Promise<FutureMessageItem[]> {
    return db.futureMessages
      .filter(m => !m.deletedAt && !m.isOpened && m.openDate <= todayDate)
      .toArray();
  }

  public static async queryAll(): Promise<FutureMessageItem[]> {
    return db.futureMessages.filter(m => !m.deletedAt).toArray();
  }
}
