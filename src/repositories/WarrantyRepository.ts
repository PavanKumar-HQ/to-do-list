// Warranty Repository (Section 24-26)
// Products, purchase tracking, warranty deadlines, receipts & documents.

import { db, generateId, logAudit, addRelationship } from '../db/db';
import type { WarrantyItem } from '../types';
import { sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class WarrantyRepository {
  public static calculateStatus(warrantyEnd: string, daysThreshold = 30): 'active' | 'expiring_soon' | 'expired' {
    const today = new Date().toISOString().split('T')[0];
    if (warrantyEnd < today) return 'expired';

    const todayMs = new Date(today).getTime();
    const endMs = new Date(warrantyEnd).getTime();
    const daysRemaining = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= daysThreshold) return 'expiring_soon';
    return 'active';
  }

  public static async create(input: Partial<WarrantyItem>): Promise<WarrantyItem> {
    if (!input.itemName?.trim()) {
      throw new Error('Warranty item name is required.');
    }
    if (!input.purchaseDate || !input.warrantyEnd) {
      throw new Error('Purchase date and warranty expiration date are required.');
    }

    const now = new Date().toISOString();
    const id = input.id || generateId();
    const status = input.status || this.calculateStatus(input.warrantyEnd);

    const item: WarrantyItem = sanitizeObject({
      id,
      itemName: input.itemName.trim(),
      brand: input.brand?.trim(),
      model: input.model?.trim(),
      serialNumber: input.serialNumber?.trim(),
      purchaseDate: input.purchaseDate,
      purchasePriceMinor: input.purchasePriceMinor,
      currency: input.currency || 'INR',
      seller: input.seller?.trim(),
      warrantyProvider: input.warrantyProvider?.trim(),
      warrantyStart: input.warrantyStart || input.purchaseDate,
      warrantyEnd: input.warrantyEnd,
      receiptAttachmentId: input.receiptAttachmentId,
      documentIds: input.documentIds || [],
      notes: input.notes?.trim(),
      relatedExpenseId: input.relatedExpenseId,
      reminderDaysBefore: input.reminderDaysBefore ?? 30,
      status,
      createdAt: now,
      updatedAt: now
    });

    await db.warranties.add(item);
    await logAudit('create', 'warranty', id, `Added warranty for: ${item.itemName} (expires ${item.warrantyEnd})`);
    multiTabSync.broadcastMutation('warranty', id, 'create', now);

    if (item.relatedExpenseId) {
      await addRelationship(id, 'warranty', item.relatedExpenseId, 'expense', 'purchased_with');
    }

    return item;
  }

  public static async getById(id: string): Promise<WarrantyItem | undefined> {
    return db.warranties.get(id);
  }

  public static async update(id: string, updates: Partial<WarrantyItem>): Promise<WarrantyItem> {
    const existing = await db.warranties.get(id);
    if (!existing) throw new Error(`Warranty ${id} not found.`);

    const now = new Date().toISOString();
    const targetEnd = updates.warrantyEnd || existing.warrantyEnd;
    const computedStatus = updates.status || this.calculateStatus(targetEnd, updates.reminderDaysBefore ?? existing.reminderDaysBefore ?? 30);

    const cleanUpdates = sanitizeObject({
      ...updates,
      status: computedStatus,
      updatedAt: now
    });

    await db.warranties.update(id, cleanUpdates);
    await logAudit('update', 'warranty', id, `Updated warranty for: ${cleanUpdates.itemName || existing.itemName}`);
    multiTabSync.broadcastMutation('warranty', id, 'update', now);

    return (await db.warranties.get(id))!;
  }

  public static async duplicate(id: string): Promise<WarrantyItem> {
    const existing = await db.warranties.get(id);
    if (!existing) throw new Error(`Warranty ${id} not found.`);

    const now = new Date().toISOString();
    const duplicated: WarrantyItem = {
      ...existing,
      id: generateId(),
      itemName: `${existing.itemName} (Copy)`,
      serialNumber: undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined
    };

    await db.warranties.add(duplicated);
    await logAudit('create', 'warranty', duplicated.id, `Duplicated warranty: ${duplicated.itemName}`);
    multiTabSync.broadcastMutation('warranty', duplicated.id, 'create', now);
    return duplicated;
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.warranties.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.warranties.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'warranty', id, `Moved warranty to trash: ${existing.itemName}`);
    multiTabSync.broadcastMutation('warranty', id, 'delete', now);
  }

  public static async restore(id: string): Promise<void> {
    const existing = await db.warranties.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.warranties.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'warranty', id, `Restored warranty: ${existing.itemName}`);
    multiTabSync.broadcastMutation('warranty', id, 'restore', now);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.warranties.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.warranties, db.relationships, db.auditHistory, db.settings], async () => {
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'warranty') || (r.targetId === id && r.targetType === 'warranty'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }
      await db.warranties.delete(id);
    });

    await logAudit('delete', 'warranty', id, `Permanently deleted warranty: ${existing.itemName}`);
    multiTabSync.broadcastMutation('warranty', id, 'delete');
  }

  public static async queryActive(): Promise<WarrantyItem[]> {
    const items = await db.warranties.filter(w => !w.deletedAt && w.status !== 'archived').toArray();
    // Dynamically update status if expired
    return items.map(item => ({
      ...item,
      status: this.calculateStatus(item.warrantyEnd, item.reminderDaysBefore ?? 30)
    }));
  }
}
