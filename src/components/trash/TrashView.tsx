import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useToast } from '../common/ToastContext';

export const TrashView: React.FC = () => {
  const { showToast } = useToast();

  const trashedTasks = useLiveQuery(async () => db.tasks.filter((t) => !!t.deletedAt).toArray(), []) || [];
  const trashedNotes = useLiveQuery(async () => db.notes.filter((n) => !!n.deletedAt).toArray(), []) || [];
  const trashedReminders = useLiveQuery(async () => db.reminders.filter((r) => !!r.deletedAt).toArray(), []) || [];
  const trashedIdeas = useLiveQuery(async () => db.ideas.filter((i) => !!i.deletedAt).toArray(), []) || [];
  const trashedExpenses = useLiveQuery(async () => db.expenses.filter((e) => !!e.deletedAt).toArray(), []) || [];
  const trashedLists = useLiveQuery(async () => db.lists.filter((l) => !!l.deletedAt).toArray(), []) || [];

  const totalTrashCount =
    trashedTasks.length +
    trashedNotes.length +
    trashedReminders.length +
    trashedIdeas.length +
    trashedExpenses.length +
    trashedLists.length;

  const handleRestore = async (table: 'tasks' | 'notes' | 'reminders' | 'ideas' | 'expenses' | 'lists', id: string, title: string) => {
    // @ts-ignore
    await db[table].update(id, { deletedAt: undefined });
    await logAudit('restore', table as any, id, `Restored ${title} from trash`);
    showToast(`Restored: ${title}`, { type: 'success' });
  };

  const handlePermanentDelete = async (table: 'tasks' | 'notes' | 'reminders' | 'ideas' | 'expenses' | 'lists', id: string) => {
    if (!window.confirm('Permanently delete this record? This action cannot be undone.')) return;
    // @ts-ignore
    await db[table].delete(id);
    showToast('Record permanently deleted');
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm(`Permanently remove all ${totalTrashCount} items in the trash? This cannot be undone.`)) return;

    await Promise.all([
      ...trashedTasks.map((t) => db.tasks.delete(t.id)),
      ...trashedNotes.map((n) => db.notes.delete(n.id)),
      ...trashedReminders.map((r) => db.reminders.delete(r.id)),
      ...trashedIdeas.map((i) => db.ideas.delete(i.id)),
      ...trashedExpenses.map((e) => db.expenses.delete(e.id)),
      ...trashedLists.map((l) => db.lists.delete(l.id))
    ]);

    showToast('Trash emptied completely', { type: 'success' });
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Trash & Recovery</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {totalTrashCount} items in trash
          </p>
        </div>
        {totalTrashCount > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="btn btn-danger btn-sm"
            style={{ gap: '6px' }}
          >
            <Trash2 size={16} />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {totalTrashCount === 0 ? (
        <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
          <Trash2 size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: 600 }}>Trash is empty.</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Deleted tasks, notes, and records appear here before permanent deletion.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trashedTasks.map((t) => (
            <TrashRow
              key={t.id}
              type="Task"
              title={t.title}
              deletedAt={t.deletedAt}
              onRestore={() => handleRestore('tasks', t.id, t.title)}
              onDelete={() => handlePermanentDelete('tasks', t.id)}
            />
          ))}

          {trashedNotes.map((n) => (
            <TrashRow
              key={n.id}
              type="Note"
              title={n.title}
              deletedAt={n.deletedAt}
              onRestore={() => handleRestore('notes', n.id, n.title)}
              onDelete={() => handlePermanentDelete('notes', n.id)}
            />
          ))}

          {trashedReminders.map((r) => (
            <TrashRow
              key={r.id}
              type="Reminder"
              title={r.title}
              deletedAt={r.deletedAt}
              onRestore={() => handleRestore('reminders', r.id, r.title)}
              onDelete={() => handlePermanentDelete('reminders', r.id)}
            />
          ))}

          {trashedIdeas.map((i) => (
            <TrashRow
              key={i.id}
              type="Idea"
              title={i.title}
              deletedAt={i.deletedAt}
              onRestore={() => handleRestore('ideas', i.id, i.title)}
              onDelete={() => handlePermanentDelete('ideas', i.id)}
            />
          ))}

          {trashedExpenses.map((e) => (
            <TrashRow
              key={e.id}
              type="Expense"
              title={`${formatMoney(e.amountMinor)} - ${e.category}`}
              deletedAt={e.deletedAt}
              onRestore={() => handleRestore('expenses', e.id, `Expense of ${formatMoney(e.amountMinor)}`)}
              onDelete={() => handlePermanentDelete('expenses', e.id)}
            />
          ))}

          {trashedLists.map((l) => (
            <TrashRow
              key={l.id}
              type="List"
              title={l.title}
              deletedAt={l.deletedAt}
              onRestore={() => handleRestore('lists', l.id, l.title)}
              onDelete={() => handlePermanentDelete('lists', l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TrashRow: React.FC<{
  type: string;
  title: string;
  deletedAt?: string;
  onRestore: () => void;
  onDelete: () => void;
}> = ({ type, title, deletedAt, onRestore, onDelete }) => (
  <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {type} {deletedAt ? `• Deleted ${formatDisplayDate(deletedAt.slice(0, 10))}` : ''}
      </div>
    </div>
    <div style={{ display: 'flex', gap: '6px' }}>
      <button onClick={onRestore} className="btn btn-sm btn-secondary" style={{ gap: '4px', fontSize: '12px' }}>
        <RotateCcw size={13} />
        <span>Restore</span>
      </button>
      <button onClick={onDelete} className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '6px' }}>
        <Trash2 size={15} />
      </button>
    </div>
  </div>
);
