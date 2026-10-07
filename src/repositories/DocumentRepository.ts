// Document Repository (Section 31)
// Local documents associated with Person, Family Member, Warranty, Task, Event, Goal.

import { db, generateId, logAudit, addRelationship } from '../db/db';
import type { DocumentItem, DocumentCategory, EntityType } from '../types';
import { sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class DocumentRepository {
  public static async create(input: {
    title: string;
    category: DocumentCategory;
    documentNumber?: string;
    holderName?: string;
    expiryDate?: string;
    issueDate?: string;
    relatedEntityType: EntityType;
    relatedEntityId: string;
    fileData?: string; // base64 data uri
    fileName: string;
    fileSize: number;
    mimeType: string;
    notes?: string;
  }): Promise<DocumentItem> {
    if (!input.title?.trim()) throw new Error('Document title is required.');
    if (!input.fileName?.trim()) throw new Error('Document file name is required.');

    const now = new Date().toISOString();
    const id = generateId();

    const doc: DocumentItem = sanitizeObject({
      id,
      title: input.title.trim(),
      category: input.category || 'other',
      documentNumber: input.documentNumber?.trim(),
      holderName: input.holderName?.trim(),
      expiryDate: input.expiryDate,
      issueDate: input.issueDate,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      fileData: input.fileData,
      fileName: input.fileName.trim(),
      fileSize: input.fileSize || 0,
      mimeType: input.mimeType || 'application/octet-stream',
      notes: input.notes?.trim(),
      createdAt: now,
      updatedAt: now
    });

    await db.documents.add(doc);
    await logAudit('create', 'document', id, `Added document: ${doc.title} (${doc.category})`);
    multiTabSync.broadcastMutation('document', id, 'create', now);

    if (input.relatedEntityId && input.relatedEntityType) {
      await addRelationship(id, 'document', input.relatedEntityId, input.relatedEntityType, 'attached_document');
    }

    return doc;
  }

  public static async getById(id: string): Promise<DocumentItem | undefined> {
    return db.documents.get(id);
  }

  public static async update(id: string, updates: Partial<DocumentItem>): Promise<DocumentItem> {
    const existing = await db.documents.get(id);
    if (!existing) throw new Error(`Document ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.documents.update(id, cleanUpdates);
    await logAudit('update', 'document', id, `Updated document: ${cleanUpdates.title || existing.title}`);
    multiTabSync.broadcastMutation('document', id, 'update', now);

    return (await db.documents.get(id))!;
  }

  public static async softDelete(id: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.documents.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'document', id, `Moved document to trash: ${existing.title}`);
    multiTabSync.broadcastMutation('document', id, 'delete', now);
  }

  public static async restore(id: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.documents.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'document', id, `Restored document: ${existing.title}`);
    multiTabSync.broadcastMutation('document', id, 'restore', now);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.documents, db.relationships, db.auditHistory, db.settings], async () => {
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'document') || (r.targetId === id && r.targetType === 'document'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }
      await db.documents.delete(id);
    });

    await logAudit('delete', 'document', id, `Permanently deleted document: ${existing.title}`);
    multiTabSync.broadcastMutation('document', id, 'delete');
  }

  public static async queryByEntity(entityType: EntityType, entityId: string): Promise<DocumentItem[]> {
    return db.documents
      .filter(d => !d.deletedAt && d.relatedEntityType === entityType && d.relatedEntityId === entityId)
      .reverse()
      .sortBy('createdAt');
  }

  public static async queryAllActive(): Promise<DocumentItem[]> {
    return db.documents.filter(d => !d.deletedAt).reverse().sortBy('createdAt');
  }
}
