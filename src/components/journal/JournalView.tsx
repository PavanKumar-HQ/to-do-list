import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Calendar,
  Laugh,
  Smile,
  Meh,
  Frown,
  ZapOff,
  Save,
  Trash2,
  CheckCircle,
  TrendingDown,
  FileText
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useToast } from '../common/ToastContext';
import type { JournalEntry } from '../../types';

export const JournalView: React.FC = () => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Load entry for selectedDate
  const currentEntry = useLiveQuery(async () => {
    return db.journalEntries.filter((j) => !j.deletedAt && j.date === selectedDate).first();
  }, [selectedDate]);

  // Contextual activity summaries for this day
  const tasksCompletedToday = useLiveQuery(async () => {
    return db.tasks
      .filter((t) => !t.deletedAt && t.status === 'completed' && (t.completedAt?.startsWith(selectedDate) || t.dueDate === selectedDate))
      .toArray();
  }, [selectedDate]) || [];

  const expensesToday = useLiveQuery(async () => {
    return db.expenses
      .filter((e) => !e.deletedAt && e.date === selectedDate)
      .toArray();
  }, [selectedDate]) || [];

  const totalSpentToday = expensesToday.reduce((sum, e) => sum + e.amountMinor, 0);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood'] | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);

  // Sync state when currentEntry changes or check unsaved draft
  React.useEffect(() => {
    if (currentEntry) {
      setTitle(currentEntry.title || '');
      setContent(currentEntry.content || '');
      setMood(currentEntry.mood);
    } else {
      const draft = localStorage.getItem(`journal_draft_${selectedDate}`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setTitle(parsed.title || '');
          setContent(parsed.content || '');
          setMood(parsed.mood);
        } catch {
          setTitle('');
          setContent('');
          setMood(undefined);
        }
      } else {
        setTitle('');
        setContent('');
        setMood(undefined);
      }
    }
  }, [currentEntry, selectedDate]);

  // Persist unsaved draft locally while typing
  React.useEffect(() => {
    if (!currentEntry && (title.trim() || content.trim())) {
      localStorage.setItem(`journal_draft_${selectedDate}`, JSON.stringify({ title, content, mood }));
    }
  }, [title, content, mood, currentEntry, selectedDate]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!content.trim() && !title.trim()) {
      showToast('Write a note or title before saving', { type: 'warning' });
      return;
    }

    setIsSaving(true);
    const nowIso = new Date().toISOString();

    try {
      if (currentEntry) {
        await db.journalEntries.update(currentEntry.id, {
          title: title.trim(),
          content: content.trim(),
          mood,
          updatedAt: nowIso
        });
        await logAudit('update', 'journal', currentEntry.id, `Updated journal entry for ${selectedDate}`);
      } else {
        const newEntry: JournalEntry = {
          id: generateId(),
          date: selectedDate,
          title: title.trim(),
          content: content.trim(),
          mood,
          tags: [],
          attachmentIds: [],
          voiceNoteIds: [],
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.journalEntries.add(newEntry);
        await logAudit('create', 'journal', newEntry.id, `Created journal entry for ${selectedDate}`);
      }

      localStorage.removeItem(`journal_draft_${selectedDate}`);
      showToast('Journal entry saved', { type: 'success' });
    } catch (err: any) {
      showToast(`Couldn't save journal entry: ${err.message}`, { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const moods: { id: JournalEntry['mood']; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'great', label: 'Great', icon: Laugh },
    { id: 'good', label: 'Good', icon: Smile },
    { id: 'neutral', label: 'Neutral', icon: Meh },
    { id: 'tough', label: 'Tough', icon: Frown },
    { id: 'exhausted', label: 'Exhausted', icon: ZapOff }
  ];

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Daily Journal</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Private reflections and daily log
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Editor Surface */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Entry headline (optional)..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            fontSize: '18px',
            fontWeight: 600,
            border: 'none',
            borderBottom: '1px solid var(--border-light)',
            borderRadius: 0,
            padding: '4px 0 10px 0',
            marginBottom: '14px'
          }}
        />

        <textarea
          rows={10}
          placeholder="What happened today? How are you feeling?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            border: 'none',
            padding: 0,
            fontSize: '15px',
            lineHeight: '1.6',
            resize: 'vertical'
          }}
        />

        {/* Optional Mood Selector */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Mood (Optional)
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {moods.map((m) => {
              const Icon = m.icon;
              const isSelected = mood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(isSelected ? undefined : m.id)}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    borderRadius: 'var(--radius-full)',
                    padding: '6px 14px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Icon size={15} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ gap: '8px', minWidth: '130px' }}
            disabled={isSaving}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      {/* Day Activity Context (Non-invasive summary of actual activities) */}
      {(tasksCompletedToday.length > 0 || expensesToday.length > 0) && (
        <div className="card" style={{ padding: '16px', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Day Activity Summary ({formatDisplayDate(selectedDate)})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            {tasksCompletedToday.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} color="var(--success)" />
                <span>Completed {tasksCompletedToday.length} task{tasksCompletedToday.length === 1 ? '' : 's'}: {tasksCompletedToday.map(t => t.title).join(', ')}</span>
              </div>
            )}

            {expensesToday.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={16} color="var(--danger)" />
                <span>Recorded {expensesToday.length} expense{expensesToday.length === 1 ? '' : 's'} totaling {formatMoney(totalSpentToday)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
