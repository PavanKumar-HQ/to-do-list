// ItemDetailModal — Universal Detail View, Edit Form, and Lifecycle Actions
// Supports complete lifecycle for: Tasks, Reminders, Events, Expenses, Income, Loops, Notes, People, Warranties, Family, Documents

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Bell,
  MapPin,
  Tag,
  User,
  RotateCcw,
  Trash2,
  Edit2,
  Copy,
  Network,
  CheckCircle2,
  CalendarDays,
  Folder,
  Wallet,
  ShieldCheck,
  Users,
  FileText,
  Download,
  AlertCircle,
  Save,
  CheckSquare
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import {
  TaskRepository,
  ReminderRepository,
  OpenLoopRepository,
  ExpenseRepository,
  WarrantyRepository,
  FamilyRepository,
  DocumentRepository,
  NoteRepository
} from '../../repositories';
import { formatDisplayDate } from '../../utils/dates';
import { formatMoney, toMinorUnits, fromMinorUnits } from '../../utils/currency';
import { useToast } from './ToastContext';
import { eventBus } from '../../services/eventBus';
import type {
  TaskItem,
  EventItem,
  ReminderItem,
  OpenLoopItem,
  ExpenseItem,
  IncomeItem,
  NoteItem,
  PersonItem,
  WarrantyItem,
  FamilyMemberItem,
  CareReminderItem,
  DocumentItem,
  EntityType,
  Priority,
  PaymentMethod
} from '../../types';

export interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: EntityType | 'loop' | null;
  itemData: any | null;
  onOpenContext?: (type: EntityType, id: string) => void;
  onItemUpdated?: (updatedItem: any) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemData,
  onOpenContext,
  onItemUpdated
}) => {
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [currentData, setCurrentData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form states
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('upi');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editRecurrence, setEditRecurrence] = useState<string>('none');
  const [editLocation, setEditLocation] = useState('');
  const [editIsBusiness, setEditIsBusiness] = useState(false);
  const [editPersonName, setEditPersonName] = useState('');
  const [editRelationship, setEditRelationship] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editWarrantyEnd, setEditWarrantyEnd] = useState('');

  useEffect(() => {
    if (isOpen && itemData) {
      setCurrentData(itemData);
      setIsEditing(false);
      populateEditForm(itemData);
    }
  }, [isOpen, itemData]);

  const populateEditForm = (data: any) => {
    setEditTitle(data.title || data.subject || data.itemName || data.name || '');
    setEditNotes(data.notes || data.description || data.content || '');
    if (data.amountMinor !== undefined) {
      setEditAmount((data.amountMinor / 100).toString());
    } else if (data.purchasePriceMinor !== undefined) {
      setEditAmount((data.purchasePriceMinor / 100).toString());
    } else {
      setEditAmount('');
    }
    setEditCategory(data.category || 'General');
    setEditPaymentMethod(data.paymentMethod || 'upi');
    setEditDate(data.date || data.dueDate || data.purchaseDate || data.promisedDate || '');
    setEditTime(data.dueTime || data.startTime || data.time || '');
    setEditEndTime(data.endTime || '');
    setEditPriority(data.priority || 'medium');
    setEditRecurrence(data.recurrence || 'none');
    setEditLocation(data.location || '');
    setEditIsBusiness(!!data.isBusiness);
    setEditPersonName(data.waitingOnPersonName || data.who || data.personName || '');
    setEditRelationship(data.relationship || '');
    setEditBrand(data.brand || '');
    setEditWarrantyEnd(data.warrantyEnd || '');
  };

  if (!isOpen || !itemType || !currentData) return null;

  const normalizedType = itemType === 'loop' ? 'open_loop' : itemType;

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (isSaving) return; // Prevent double save
    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();

      if (normalizedType === 'expense') {
        const numAmount = parseFloat(editAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
          showToast('Please enter a valid expense amount', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const minorUnits = toMinorUnits(numAmount);
        const updated = await ExpenseRepository.update(currentData.id, {
          amountMinor: minorUnits,
          category: editCategory.trim() || 'General',
          paymentMethod: editPaymentMethod,
          date: editDate || currentData.date,
          time: editTime || undefined,
          notes: editNotes.trim() || undefined,
          isBusiness: editIsBusiness
        });

        setCurrentData(updated);
        eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: updated.id });
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Expense updated successfully', { type: 'success' });
      } else if (normalizedType === 'task') {
        if (!editTitle.trim()) {
          showToast('Task title cannot be empty', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const updated = await TaskRepository.update(currentData.id, {
          title: editTitle.trim(),
          description: editNotes.trim() || undefined,
          dueDate: editDate || undefined,
          dueTime: editTime || undefined,
          priority: editPriority,
          recurrence: editRecurrence as any
        });

        setCurrentData(updated);
        eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: updated.id });
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Task updated successfully', { type: 'success' });
      } else if (normalizedType === 'reminder') {
        if (!editTitle.trim()) {
          showToast('Reminder title cannot be empty', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const updated = await ReminderRepository.update(currentData.id, {
          title: editTitle.trim(),
          date: editDate || currentData.date,
          time: editTime || undefined,
          recurrence: editRecurrence as any
        });

        setCurrentData(updated);
        eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: updated.id });
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Reminder updated', { type: 'success' });
      } else if (normalizedType === 'event') {
        if (!editTitle.trim()) {
          showToast('Event title cannot be empty', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const updates = {
          title: editTitle.trim(),
          date: editDate || currentData.date,
          startTime: editTime || undefined,
          endTime: editEndTime || undefined,
          location: editLocation.trim() || undefined,
          notes: editNotes.trim() || undefined,
          category: editCategory || currentData.category,
          updatedAt: nowIso
        };
        await db.events.update(currentData.id, updates);
        const updated = { ...currentData, ...updates };

        setCurrentData(updated);
        eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: currentData.id });
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Event updated', { type: 'success' });
      } else if (normalizedType === 'warranty') {
        if (!editTitle.trim()) {
          showToast('Item name cannot be empty', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const updated = await WarrantyRepository.update(currentData.id, {
          itemName: editTitle.trim(),
          brand: editBrand.trim() || undefined,
          warrantyEnd: editWarrantyEnd || currentData.warrantyEnd,
          purchaseDate: editDate || currentData.purchaseDate,
          purchasePriceMinor: editAmount ? toMinorUnits(parseFloat(editAmount) || 0) : undefined,
          notes: editNotes.trim() || undefined
        });

        setCurrentData(updated);
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Warranty updated', { type: 'success' });
      } else if (normalizedType === 'family_member') {
        if (!editTitle.trim()) {
          showToast('Name cannot be empty', { type: 'warning' });
          setIsSaving(false);
          return;
        }

        const updated = await FamilyRepository.updateMember(currentData.id, {
          name: editTitle.trim(),
          relationship: editRelationship.trim() || currentData.relationship,
          notes: editNotes.trim() || undefined
        });

        setCurrentData(updated);
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Family member updated', { type: 'success' });
      } else if (normalizedType === 'note') {
        const updated = await NoteRepository.update(currentData.id, {
          title: editTitle.trim() || 'Untitled Note',
          content: editNotes.trim()
        });

        setCurrentData(updated);
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Note updated', { type: 'success' });
      } else if (normalizedType === 'open_loop') {
        const updated = await OpenLoopRepository.update(currentData.id, {
          title: editTitle.trim(),
          notes: editNotes.trim() || undefined
        });

        setCurrentData(updated);
        eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: updated.id });
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Open loop updated', { type: 'success' });
      } else if (normalizedType === 'document') {
        const updated = await DocumentRepository.update(currentData.id, {
          title: editTitle.trim(),
          notes: editNotes.trim() || undefined
        });

        setCurrentData(updated);
        if (onItemUpdated) onItemUpdated(updated);
        showToast('Document updated', { type: 'success' });
      }

      setIsEditing(false);
    } catch (err: any) {
      showToast(`Failed to save: ${err.message}`, { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Duplicate
  const handleDuplicate = async () => {
    try {
      let duplicated: any;
      if (normalizedType === 'expense') {
        duplicated = await ExpenseRepository.duplicate(currentData.id);
        eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: duplicated.id });
      } else if (normalizedType === 'task') {
        duplicated = await TaskRepository.duplicate(currentData.id);
        eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: duplicated.id });
      } else if (normalizedType === 'warranty') {
        duplicated = await WarrantyRepository.duplicate(currentData.id);
      } else {
        showToast('Duplication not supported for this entity type', { type: 'info' });
        return;
      }

      showToast(`Duplicated: ${duplicated.title || duplicated.category || duplicated.itemName}`, { type: 'success' });
      onClose();
    } catch (err: any) {
      showToast(`Duplication failed: ${err.message}`, { type: 'error' });
    }
  };

  // Handle Delete
  const handleDeleteItem = async () => {
    try {
      if (normalizedType === 'task') {
        await TaskRepository.softDelete(currentData.id);
        eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: currentData.id });
      } else if (normalizedType === 'expense') {
        await ExpenseRepository.softDelete(currentData.id);
        eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: currentData.id });
      } else if (normalizedType === 'event') {
        await db.events.update(currentData.id, { deletedAt: new Date().toISOString() });
        eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: currentData.id });
      } else if (normalizedType === 'reminder') {
        await ReminderRepository.softDelete(currentData.id);
        eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: currentData.id });
      } else if (normalizedType === 'open_loop') {
        await OpenLoopRepository.softDelete(currentData.id);
        eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: currentData.id });
      } else if (normalizedType === 'warranty') {
        await WarrantyRepository.softDelete(currentData.id);
      } else if (normalizedType === 'family_member') {
        await FamilyRepository.softDeleteMember(currentData.id);
      } else if (normalizedType === 'note') {
        await NoteRepository.softDelete(currentData.id);
      } else if (normalizedType === 'document') {
        await DocumentRepository.softDelete(currentData.id);
      } else {
        // Generic soft delete
        // @ts-ignore
        if (db[normalizedType]) {
          // @ts-ignore
          await db[normalizedType].update(currentData.id, { deletedAt: new Date().toISOString() });
        }
      }

      showToast('Item moved to trash', { type: 'info' });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Delete failed', { type: 'error' });
    }
  };

  // Toggle complete task
  const handleToggleCompleteTask = async (task: TaskItem) => {
    try {
      const isCompleted = task.status === 'completed';
      if (isCompleted) {
        await TaskRepository.uncomplete(task.id);
        showToast('Task reopened', { type: 'info' });
      } else {
        await TaskRepository.complete(task.id);
        showToast('Task completed', { type: 'success' });
      }
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  const handlePostponeTomorrow = async (task: TaskItem) => {
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await TaskRepository.update(task.id, {
        dueDate: tomorrow,
        postponeCount: (task.postponeCount || 0) + 1,
        lastPostponedAt: new Date().toISOString()
      });
      eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id });
      showToast('Postponed to tomorrow', { type: 'info' });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  const handleResolveLoop = async (loop: OpenLoopItem) => {
    try {
      await OpenLoopRepository.close(loop.id);
      eventBus.emit('OPEN_LOOP_MUTATED', { type: 'OPEN_LOOP_MUTATED', entityId: loop.id });
      showToast('Open loop marked resolved', { type: 'success' });
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="sheet-handle" />

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--accent-light)',
                color: 'var(--accent)'
              }}
            >
              {normalizedType.replace('_', ' ').toUpperCase()}
            </span>

            {currentData.status && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: currentData.status === 'completed' || currentData.status === 'active' ? 'var(--success-light)' : 'var(--bg-surface-elevated)',
                  color: currentData.status === 'completed' || currentData.status === 'active' ? 'var(--success)' : 'var(--text-secondary)'
                }}
              >
                {currentData.status}
              </span>
            )}

            {currentData.isBusiness && (
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-surface-elevated)', color: 'var(--text-tertiary)' }}>
                Business
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-secondary btn-sm"
                style={{ gap: '4px' }}
                title="Edit item"
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  populateEditForm(currentData);
                  setIsEditing(false);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            )}

            <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close modal">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* -------------------- EDIT MODE -------------------- */}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Edit {normalizedType.replace('_', ' ')}
            </div>

            {/* Title / Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {normalizedType === 'expense' ? 'Expense Note / Title' : 'Title'}
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter title"
                autoFocus
              />
            </div>

            {/* Amount (for Expenses, Income, Warranties) */}
            {(normalizedType === 'expense' || normalizedType === 'income' || normalizedType === 'warranty') && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {normalizedType === 'warranty' ? 'Purchase Price (₹)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Expense / Income specific categories and payment method */}
            {normalizedType === 'expense' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Bills">Bills & Utilities</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Health">Health</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            )}

            {/* Date and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Time
                </label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>
            </div>

            {/* Warranty specifics */}
            {normalizedType === 'warranty' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    placeholder="e.g. Apple, Samsung"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Warranty Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editWarrantyEnd}
                    onChange={(e) => setEditWarrantyEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Family Member specifics */}
            {normalizedType === 'family_member' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Relationship
                </label>
                <input
                  type="text"
                  value={editRelationship}
                  onChange={(e) => setEditRelationship(e.target.value)}
                  placeholder="e.g. Mother, Father, Spouse"
                />
              </div>
            )}

            {/* Priority (for Tasks) */}
            {normalizedType === 'task' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`btn btn-sm ${editPriority === p ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, textTransform: 'capitalize' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recurrence */}
            {(normalizedType === 'task' || normalizedType === 'reminder' || normalizedType === 'event') && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Recurrence
                </label>
                <select value={editRecurrence} onChange={(e) => setEditRecurrence(e.target.value)}>
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}

            {/* Description / Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Description / Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {/* Business Toggle for expenses */}
            {normalizedType === 'expense' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={editIsBusiness}
                  onChange={(e) => setEditIsBusiness(e.target.checked)}
                />
                <span>This is a business expense</span>
              </label>
            )}

            {/* Save Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ flex: 1, gap: '6px' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* -------------------- VIEW MODE (REAL PERSISTED DATA) -------------------- */
          <>
            {/* Title / Main Metric */}
            <h2
              style={{
                fontSize: normalizedType === 'expense' ? '1.5rem' : '1.25rem',
                fontWeight: 700,
                color: normalizedType === 'expense' ? 'var(--danger)' : 'var(--text-primary)',
                letterSpacing: '-0.02em',
                margin: '0 0 16px 0',
                lineHeight: 1.3
              }}
            >
              {normalizedType === 'expense'
                ? formatMoney(currentData.amountMinor, '₹')
                : currentData.title || currentData.subject || currentData.itemName || currentData.name || 'Item Details'}
            </h2>

            {/* Structured Real Data Fields */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '18px'
              }}
            >
              {/* Expense Category & Payment Method */}
              {normalizedType === 'expense' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                    <Tag size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Category: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{currentData.category}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                    <Wallet size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Method: </span>
                      <strong style={{ textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        {currentData.paymentMethod}
                      </strong>
                    </div>
                  </div>
                </>
              )}

              {/* Schedule / Date */}
              {(currentData.dueDate || currentData.date || currentData.purchaseDate || currentData.promisedDate) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <Calendar size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Date: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatDisplayDate(currentData.dueDate || currentData.date || currentData.purchaseDate || currentData.promisedDate)}
                      {currentData.dueTime ? ` · ${currentData.dueTime}` : currentData.startTime ? ` · ${currentData.startTime}` : currentData.time ? ` · ${currentData.time}` : ''}
                    </strong>
                  </div>
                </div>
              )}

              {/* Warranty Expiry */}
              {currentData.warrantyEnd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <ShieldCheck size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Warranty End: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatDisplayDate(currentData.warrantyEnd)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Priority */}
              {currentData.priority && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <Tag size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Priority: </span>
                    <strong style={{ textTransform: 'capitalize', color: currentData.priority === 'high' ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {currentData.priority}
                    </strong>
                  </div>
                </div>
              )}

              {/* Linked Person */}
              {(currentData.waitingOnPersonName || currentData.linkedPersonName || currentData.personName || currentData.who) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <User size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Person: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {currentData.waitingOnPersonName || currentData.linkedPersonName || currentData.personName || currentData.who}
                    </strong>
                  </div>
                </div>
              )}

              {/* Location */}
              {currentData.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Location: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{currentData.location}</strong>
                  </div>
                </div>
              )}

              {/* Recurrence */}
              {currentData.recurrence && currentData.recurrence !== 'none' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
                  <RotateCcw size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Recurrence: </span>
                    <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {currentData.recurrence}
                    </strong>
                  </div>
                </div>
              )}

              {/* Notes / Description */}
              {(currentData.description || currentData.notes || currentData.content) && (
                <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Notes</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {currentData.description || currentData.notes || currentData.content}
                  </div>
                </div>
              )}

              {/* Document Download Link */}
              {normalizedType === 'document' && currentData.fileData && (
                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <a
                    href={currentData.fileData}
                    download={currentData.fileName || 'document'}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '6px', display: 'inline-flex' }}
                  >
                    <Download size={14} />
                    <span>Download {currentData.fileName}</span>
                  </a>
                </div>
              )}

              {/* Timestamps */}
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                <span>Created: {new Date(currentData.createdAt || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {currentData.updatedAt && (
                  <span>Updated: {new Date(currentData.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {normalizedType === 'task' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleToggleCompleteTask(currentData)}
                    className="btn btn-primary"
                    style={{ flex: 1, gap: '6px' }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{currentData.status === 'completed' ? 'Reopen task' : 'Complete'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePostponeTomorrow(currentData)}
                    className="btn btn-secondary"
                    style={{ gap: '6px' }}
                    title="Postpone to tomorrow"
                  >
                    <CalendarDays size={15} />
                    <span>Tomorrow</span>
                  </button>
                </>
              )}

              {normalizedType === 'open_loop' && (
                <button
                  type="button"
                  onClick={() => handleResolveLoop(currentData)}
                  className="btn btn-primary"
                  style={{ flex: 1, gap: '6px' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Mark resolved</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
              >
                <Edit2 size={15} />
                <span>Edit</span>
              </button>

              {(normalizedType === 'expense' || normalizedType === 'task' || normalizedType === 'warranty') && (
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="btn btn-secondary"
                  style={{ gap: '6px' }}
                  title="Duplicate record"
                >
                  <Copy size={15} />
                  <span>Duplicate</span>
                </button>
              )}

              {onOpenContext && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContext(normalizedType as EntityType, currentData.id);
                  }}
                  className="btn btn-secondary"
                  style={{ gap: '6px' }}
                  title="View 360° Life Graph Context"
                >
                  <Network size={15} />
                  <span>Context</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteItem}
                className="btn btn-secondary"
                style={{ color: 'var(--danger)', padding: '10px' }}
                title="Delete item"
                aria-label="Delete item"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
