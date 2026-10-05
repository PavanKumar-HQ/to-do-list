import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Inbox,
  Plus,
  Trash2,
  Archive,
  ArrowRight,
  CheckSquare,
  Clock,
  Check,
  X,
  FileText,
  Lightbulb,
  Wallet,
  Calendar,
  UserCheck,
  Bookmark
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString, getCurrentTimeString } from '../../utils/dates';
import { toMinorUnits } from '../../utils/currency';
import { parseNaturalQuickInput } from '../../utils/naturalParser';
import { useToast } from '../common/ToastContext';
import type { InboxItem, EntityType } from '../../types';

export const InboxView: React.FC = () => {
  const { showToast } = useToast();
  const [quickDumpText, setQuickDumpText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [convertingItem, setConvertingItem] = useState<InboxItem | null>(null);

  // Queries
  const inboxItems = useLiveQuery(async () => {
    return db.inbox
      .filter((i) => !i.deletedAt && !i.isProcessed)
      .reverse()
      .sortBy('createdAt');
  }, []) || [];

  // Direct quick dump
  const handleQuickDump = async () => {
    const text = quickDumpText.trim();
    if (!text) return;

    const nowIso = new Date().toISOString();
    const newItem: InboxItem = {
      id: generateId(),
      rawText: text,
      tags: [],
      isProcessed: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.inbox.add(newItem);
    await logAudit('create', 'inbox', newItem.id, `Dumped to inbox: ${text}`);
    setQuickDumpText('');
    showToast('Saved to Inbox', { type: 'success' });
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    const nowIso = new Date().toISOString();
    await Promise.all(
      selectedIds.map((id) =>
        db.inbox.update(id, { isProcessed: true, updatedAt: nowIso })
      )
    );
    showToast(`Archived ${selectedIds.length} items`);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const nowIso = new Date().toISOString();
    await Promise.all(
      selectedIds.map((id) =>
        db.inbox.update(id, { deletedAt: nowIso, updatedAt: nowIso })
      )
    );
    showToast(`Moved ${selectedIds.length} items to trash`);
    setSelectedIds([]);
  };

  // Convert Inbox Item to Target Domain Entity
  const executeConversion = async (targetType: EntityType) => {
    if (!convertingItem) return;
    const text = convertingItem.rawText;
    const nowIso = new Date().toISOString();
    const todayStr = getTodayDateString();

    try {
      let createdId = generateId();

      switch (targetType) {
        case 'task':
          await db.tasks.add({
            id: createdId,
            title: text,
            status: 'todo',
            priority: 'medium',
            recurrence: 'none',
            subtasks: [],
            tags: [],
            dueDate: todayStr,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'task', createdId, `Converted inbox item to task: ${text}`);
          break;

        case 'reminder':
          await db.reminders.add({
            id: createdId,
            title: text,
            date: todayStr,
            recurrence: 'none',
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'reminder', createdId, `Converted inbox item to reminder: ${text}`);
          break;

        case 'note':
          await db.notes.add({
            id: createdId,
            title: text,
            content: '',
            category: 'Inbox',
            tags: [],
            isPinned: false,
            checklistItems: [],
            attachmentIds: [],
            voiceNoteIds: [],
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'note', createdId, `Converted inbox item to note: ${text}`);
          break;

        case 'idea':
          await db.ideas.add({
            id: createdId,
            title: text,
            description: '',
            category: 'General',
            tags: [],
            isPinned: false,
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'idea', createdId, `Converted inbox item to idea: ${text}`);
          break;

        case 'expense': {
          const parsed = parseNaturalQuickInput(text);
          await db.expenses.add({
            id: createdId,
            amountMinor: parsed.amountMinor || toMinorUnits(100),
            currency: 'INR',
            date: todayStr,
            time: getCurrentTimeString(),
            category: parsed.category || 'Other',
            paymentMethod: 'upi',
            isBusiness: false,
            notes: parsed.title,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'expense', createdId, `Converted inbox item to expense: ${text}`);
          break;
        }

        case 'dont_forget':
          await db.dontForget.add({
            id: createdId,
            text,
            priority: 'medium',
            isPinned: true,
            isDismissed: false,
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'dont_forget', createdId, `Converted inbox item to remember: ${text}`);
          break;

        case 'event':
          await db.events.add({
            id: createdId,
            title: text,
            date: todayStr,
            startTime: '10:00',
            recurrence: 'none',
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'event', createdId, `Converted inbox item to event: ${text}`);
          break;

        case 'followup':
          await db.followups.add({
            id: createdId,
            personId: 'custom',
            personName: 'Contact',
            subject: text,
            dueDate: todayStr,
            status: 'waiting',
            createdAt: nowIso,
            updatedAt: nowIso
          });
          await logAudit('create', 'followup', createdId, `Converted inbox item to follow-up: ${text}`);
          break;
      }

      // Mark processed in inbox
      await db.inbox.update(convertingItem.id, {
        isProcessed: true,
        processedToType: targetType,
        processedToId: createdId,
        updatedAt: nowIso
      });

      showToast(`Converted to ${targetType}`, { type: 'success' });
      setConvertingItem(null);
    } catch (err: any) {
      showToast(`Conversion failed: ${err.message}`, { type: 'error' });
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Universal Inbox</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {inboxItems.length} unprocessed thought{inboxItems.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Instant Rapid Dump Bar */}
      <div className="card" style={{ padding: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Dump anything here... (press Enter to capture)"
            value={quickDumpText}
            onChange={(e) => setQuickDumpText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickDump();
            }}
            style={{ fontSize: '14px', padding: '10px 12px' }}
            autoFocus
          />
          <button
            onClick={handleQuickDump}
            className="btn btn-primary"
            style={{ flexShrink: 0, gap: '6px' }}
          >
            <Plus size={16} />
            <span>Dump</span>
          </button>
        </div>
      </div>

      {/* Bulk action toolbar if items selected */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--accent-light)',
            border: '1px solid #bfdbfe',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '14px'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
            {selectedIds.length} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleBulkArchive} className="btn btn-sm btn-secondary" style={{ gap: '4px' }}>
              <Archive size={14} />
              <span>Archive</span>
            </button>
            <button onClick={handleBulkDelete} className="btn btn-sm btn-danger" style={{ gap: '4px' }}>
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Inbox Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {inboxItems.length === 0 ? (
          <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <Inbox size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Inbox is clean.</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Type in the box above to dump thoughts without worrying about categorizing them yet.
            </div>
          </div>
        ) : (
          inboxItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: isSelected ? 'var(--accent-light)' : 'var(--bg-surface)'
                }}
              >
                <div
                  className={`checkbox-custom ${isSelected ? 'checked' : ''}`}
                  onClick={() => toggleSelect(item.id)}
                  style={{ width: '18px', height: '18px' }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {item.rawText}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Captured {formatDisplayDate(item.createdAt.slice(0, 10))} at {item.createdAt.slice(11, 16)}
                  </div>
                </div>

                <button
                  onClick={() => setConvertingItem(item)}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px', fontSize: '12px', flexShrink: 0 }}
                >
                  <span>Process</span>
                  <ArrowRight size={13} />
                </button>

                <button
                  onClick={async () => {
                    await db.inbox.update(item.id, { deletedAt: new Date().toISOString() });
                    showToast('Moved to trash');
                  }}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '6px' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Convert Bottom Sheet Modal */}
      {convertingItem && (
        <div className="modal-overlay" onClick={() => setConvertingItem(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Convert Inbox Item</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  "{convertingItem.rawText}"
                </div>
              </div>
              <button onClick={() => setConvertingItem(null)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => executeConversion('task')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <CheckSquare size={18} color="var(--accent)" />
                <span>Task</span>
              </button>

              <button
                onClick={() => executeConversion('reminder')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <Clock size={18} color="var(--warning)" />
                <span>Reminder</span>
              </button>

              <button
                onClick={() => executeConversion('note')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <FileText size={18} color="#059669" />
                <span>Note</span>
              </button>

              <button
                onClick={() => executeConversion('idea')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <Lightbulb size={18} color="#d97706" />
                <span>Idea</span>
              </button>

              <button
                onClick={() => executeConversion('expense')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <Wallet size={18} color="var(--danger)" />
                <span>Expense</span>
              </button>

              <button
                onClick={() => executeConversion('dont_forget')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <Bookmark size={18} color="var(--accent)" />
                <span>Remember</span>
              </button>

              <button
                onClick={() => executeConversion('event')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <Calendar size={18} color="var(--accent)" />
                <span>Event</span>
              </button>

              <button
                onClick={() => executeConversion('followup')}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', gap: '10px', padding: '12px' }}
              >
                <UserCheck size={18} color="var(--accent)" />
                <span>Follow-up</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
