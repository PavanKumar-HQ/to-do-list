// Review Session Repository (Sections 33, 34)
// Tracks weekly and monthly review sessions: open loops closed, commitments reviewed, tasks cleaned.

import { db, generateId, logAudit } from '../db/db';
import type { ReviewSessionItem } from '../types';
import { multiTabSync } from '../services/multiTabService';

export class ReviewSessionRepository {
  public static async recordSession(input: {
    reviewType: 'weekly' | 'monthly' | 'clean_life';
    loopsClosedCount: number;
    commitmentsReviewedCount: number;
    tasksCleanedCount: number;
    notesArchivedCount: number;
    notes?: string;
  }): Promise<ReviewSessionItem> {
    const id = generateId();
    const now = new Date().toISOString();

    const session: ReviewSessionItem = {
      id,
      reviewType: input.reviewType,
      completedAt: now,
      loopsClosedCount: input.loopsClosedCount,
      commitmentsReviewedCount: input.commitmentsReviewedCount,
      tasksCleanedCount: input.tasksCleanedCount,
      notesArchivedCount: input.notesArchivedCount,
      notes: input.notes?.trim()
    };

    await db.reviewSessions.add(session as any);
    await logAudit('create', 'review_session', id, `Completed ${input.reviewType} life review session`);
    multiTabSync.broadcastMutation('review_session', id, 'create', now);

    return session;
  }

  public static async getLastReviewDate(): Promise<string | null> {
    const last = await db.reviewSessions.orderBy('completedAt').reverse().first();
    return last ? last.completedAt : null;
  }

  public static async queryRecentSessions(): Promise<ReviewSessionItem[]> {
    return (await db.reviewSessions.toArray()).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
}
