// Expense Repository (Section 8, 12, 70, 78)
// Guarantees integer minor unit calculations, validation, and safe relationship handling.

import { db, generateId, logAudit } from '../db/db';
import type { ExpenseItem, PaymentMethod } from '../types';
import { LIMITS, sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class ExpenseRepository {
  /**
   * Validate expense fields before persistence (Section 8, 68)
   */
  private static validate(data: Partial<ExpenseItem>): void {
    if (typeof data.amountMinor !== 'number' || !Number.isInteger(data.amountMinor) || !Number.isFinite(data.amountMinor)) {
      throw new Error('Expense amount must be an integer represented in minor units (paise/cents).');
    }
    if (data.amountMinor < 0) {
      throw new Error('Expense amount cannot be negative.');
    }
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error('Expense date must be in YYYY-MM-DD format.');
    }
    if (!data.category || data.category.trim().length === 0) {
      throw new Error('Expense category cannot be empty.');
    }
    if (data.notes && data.notes.length > LIMITS.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Expense notes exceed limit of ${LIMITS.MAX_DESCRIPTION_LENGTH} characters.`);
    }
  }

  /**
   * Create an expense
   */
  public static async create(input: Partial<ExpenseItem>): Promise<ExpenseItem> {
    this.validate(input);

    const now = new Date().toISOString();
    const id = input.id || generateId();

    const expense: ExpenseItem = sanitizeObject({
      id,
      amountMinor: input.amountMinor!,
      currency: input.currency || 'INR',
      date: input.date!,
      time: input.time,
      category: input.category!.trim(),
      paymentMethod: input.paymentMethod || 'upi',
      isBusiness: !!input.isBusiness,
      notes: input.notes?.trim(),
      receiptAttachmentId: input.receiptAttachmentId,
      recurringExpenseId: input.recurringExpenseId,
      goalId: input.goalId,
      createdAt: input.createdAt || now,
      updatedAt: now
    });

    await db.expenses.add(expense);
    await logAudit('create', 'expense', id, `Added expense: ${expense.category} (${expense.amountMinor})`);
    multiTabSync.broadcastMutation('expense', id, 'create', now);

    return expense;
  }

  /**
   * Update an expense
   */
  public static async update(
    id: string,
    updates: Partial<ExpenseItem>,
    expectedUpdatedAt?: string
  ): Promise<ExpenseItem> {
    const existing = await db.expenses.get(id);
    if (!existing) throw new Error(`Expense ${id} not found.`);

    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error('Expense was modified in another session. Please reload before saving.');
    }

    const merged = { ...existing, ...updates };
    this.validate(merged);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.expenses.update(id, cleanUpdates);
    await logAudit('update', 'expense', id, `Updated expense: ${merged.category} (${merged.amountMinor})`);
    multiTabSync.broadcastMutation('expense', id, 'update', now);

    return (await db.expenses.get(id))!;
  }

  /**
   * Soft delete expense
   */
  public static async softDelete(id: string): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.expenses.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'expense', id, `Moved expense to trash: ${existing.category}`);
    multiTabSync.broadcastMutation('expense', id, 'delete', now);
  }

  /**
   * Restore expense
   */
  public static async restore(id: string): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.expenses.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'expense', id, `Restored expense: ${existing.category}`);
    multiTabSync.broadcastMutation('expense', id, 'restore', now);
  }

  /**
   * Permanent delete - cleans up relationships transactionally
   */
  public static async permanentDelete(id: string): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.expenses, db.relationships, db.auditHistory, db.settings], async () => {
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'expense') || (r.targetId === id && r.targetType === 'expense'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }
      await db.expenses.delete(id);
    });

    await logAudit('delete', 'expense', id, `Permanently deleted expense: ${existing.category}`);
    multiTabSync.broadcastMutation('expense', id, 'delete');
  }

  /**
   * Query expenses for a month
   */
  public static async queryByMonth(yearMonth: string): Promise<ExpenseItem[]> {
    return db.expenses
      .filter(e => !e.deletedAt && e.date.startsWith(yearMonth))
      .toArray();
  }

  /**
   * Calculate exact monthly total in minor units without floating point math
   */
  public static async calculateMonthlyTotal(yearMonth: string): Promise<number> {
    const list = await this.queryByMonth(yearMonth);
    return list.reduce((sum, item) => sum + item.amountMinor, 0);
  }
}
