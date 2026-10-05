// Life Context Repository
// Manages distinct life spheres/contexts (e.g. "Work", "Brandex", "Personal Health", "Family")

import { db, generateId, logAudit } from '../db/db';
import type { LifeContextItem } from '../types';
import { multiTabSync } from '../services/multiTabService';

export class LifeContextRepository {
  public static async create(name: string, description?: string, color?: string): Promise<LifeContextItem> {
    if (!name || name.trim().length === 0) {
      throw new Error('Life context name cannot be empty.');
    }

    const id = generateId();
    const now = new Date().toISOString();

    const context: LifeContextItem = {
      id,
      name: name.trim(),
      description: description?.trim(),
      color: color || '#64748b',
      isArchived: false,
      createdAt: now,
      updatedAt: now
    };

    await db.lifeContexts.add(context);
    await logAudit('create', 'life_context', id, `Created life context: ${context.name}`);
    multiTabSync.broadcastMutation('life_context', id, 'create', now);

    return context;
  }

  public static async queryActive(): Promise<LifeContextItem[]> {
    return db.lifeContexts.filter(c => !c.isArchived).toArray();
  }
}
