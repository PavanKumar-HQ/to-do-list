// Canvas Repository (Section 17-23)
// Visual drawing & explanation space with structured object model, debounced autosave, and relationships.

import { db, generateId, logAudit, addRelationship } from '../db/db';
import type { CanvasItem, CanvasObject, EntityType } from '../types';
import { sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class CanvasRepository {
  public static async create(input: {
    name: string;
    background?: string;
    thumbnail?: string;
    objects?: CanvasObject[];
    relatedEntities?: { entityType: EntityType; entityId: string }[];
  }): Promise<CanvasItem> {
    const now = new Date().toISOString();
    const id = generateId();

    const canvas: CanvasItem = sanitizeObject({
      id,
      name: input.name.trim() || 'Untitled Canvas',
      background: input.background || '#ffffff',
      thumbnail: input.thumbnail,
      objects: input.objects || [],
      relatedEntities: input.relatedEntities || [],
      createdAt: now,
      updatedAt: now
    });

    await db.canvases.add(canvas);
    await logAudit('create', 'canvas', id, `Created canvas: ${canvas.name}`);
    multiTabSync.broadcastMutation('canvas', id, 'create', now);

    // Link relationships if provided
    if (input.relatedEntities) {
      for (const rel of input.relatedEntities) {
        await addRelationship(id, 'canvas', rel.entityId, rel.entityType, 'visual_note');
      }
    }

    return canvas;
  }

  public static async getById(id: string): Promise<CanvasItem | undefined> {
    return db.canvases.get(id);
  }

  public static async update(id: string, updates: Partial<CanvasItem>): Promise<CanvasItem> {
    const existing = await db.canvases.get(id);
    if (!existing) throw new Error(`Canvas ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.canvases.update(id, cleanUpdates);
    multiTabSync.broadcastMutation('canvas', id, 'update', now);

    return (await db.canvases.get(id))!;
  }

  public static async duplicate(id: string): Promise<CanvasItem> {
    const existing = await db.canvases.get(id);
    if (!existing) throw new Error(`Canvas ${id} not found.`);

    const now = new Date().toISOString();
    const duplicated: CanvasItem = {
      ...existing,
      id: generateId(),
      name: `${existing.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined
    };

    await db.canvases.add(duplicated);
    await logAudit('create', 'canvas', duplicated.id, `Duplicated canvas: ${duplicated.name}`);
    multiTabSync.broadcastMutation('canvas', duplicated.id, 'create', now);
    return duplicated;
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.canvases.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.canvases.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'canvas', id, `Moved canvas to trash: ${existing.name}`);
    multiTabSync.broadcastMutation('canvas', id, 'delete', now);
  }

  public static async restore(id: string): Promise<void> {
    const existing = await db.canvases.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.canvases.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'canvas', id, `Restored canvas: ${existing.name}`);
    multiTabSync.broadcastMutation('canvas', id, 'restore', now);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.canvases.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.canvases, db.relationships, db.auditHistory, db.settings], async () => {
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'canvas') || (r.targetId === id && r.targetType === 'canvas'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }
      await db.canvases.delete(id);
    });

    await logAudit('delete', 'canvas', id, `Permanently deleted canvas: ${existing.name}`);
    multiTabSync.broadcastMutation('canvas', id, 'delete');
  }

  public static async queryActive(): Promise<CanvasItem[]> {
    return db.canvases.filter(c => !c.deletedAt).reverse().sortBy('updatedAt');
  }
}
