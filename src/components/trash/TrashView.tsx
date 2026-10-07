import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, RotateCcw, AlertTriangle, Filter, Search } from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useToast } from '../common/ToastContext';

type TrashedItem = {
  id: string;
  table: string;
  type: string;
  title: string;
  deletedAt?: string;
};

export const TrashView: React.FC = () => {
  const { showToast } = useToast();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Comprehensive query across all entities with soft-delete support
  const trashedItems = useLiveQuery(async (): Promise<TrashedItem[]> => {
    const items: TrashedItem[] = [];

    const [
      tasks,
      notes,
      reminders,
      ideas,
      expenses,
      lists,
      people,
      events,
      commitments,
      decisions,
      openLoops,
      goals,
      routines,
      journal,
      canvases,
      warranties,
      familyMembers,
      careReminders,
      documents
    ] = await Promise.all([
      db.tasks.filter(t => !!t.deletedAt).toArray(),
      db.notes.filter(n => !!n.deletedAt).toArray(),
      db.reminders.filter(r => !!r.deletedAt).toArray(),
      db.ideas.filter(i => !!i.deletedAt).toArray(),
      db.expenses.filter(e => !!e.deletedAt).toArray(),
      db.lists.filter(l => !!l.deletedAt).toArray(),
      db.people.filter(p => !!p.deletedAt).toArray(),
      db.events.filter(e => !!e.deletedAt).toArray(),
      db.commitments.filter(c => !!c.deletedAt).toArray(),
      db.decisions.filter(d => !!d.deletedAt).toArray(),
      db.openLoops.filter(o => !!o.deletedAt).toArray(),
      db.goals.filter(g => !!g.deletedAt).toArray(),
      db.routines.filter(r => !!r.deletedAt).toArray(),
      db.journalEntries.filter(j => !!j.deletedAt).toArray(),
      db.canvases.filter(c => !!c.deletedAt).toArray(),
      db.warranties.filter(w => !!w.deletedAt).toArray(),
      db.familyMembers.filter(f => !!f.deletedAt).toArray(),
      db.careReminders.filter(cr => !!cr.deletedAt).toArray(),
      db.documents.filter(d => !!d.deletedAt).toArray()
    ]);

    tasks.forEach(t => items.push({ id: t.id, table: 'tasks', type: 'Task', title: t.title, deletedAt: t.deletedAt }));
    notes.forEach(n => items.push({ id: n.id, table: 'notes', type: 'Note', title: n.title, deletedAt: n.deletedAt }));
    reminders.forEach(r => items.push({ id: r.id, table: 'reminders', type: 'Reminder', title: r.title, deletedAt: r.deletedAt }));
    ideas.forEach(i => items.push({ id: i.id, table: 'ideas', type: 'Idea', title: i.title, deletedAt: i.deletedAt }));
    expenses.forEach(e => items.push({ id: e.id, table: 'expenses', type: 'Expense', title: `${formatMoney(e.amountMinor)} - ${e.category}`, deletedAt: e.deletedAt }));
    lists.forEach(l => items.push({ id: l.id, table: 'lists', type: 'List', title: l.title, deletedAt: l.deletedAt }));
    people.forEach(p => items.push({ id: p.id, table: 'people', type: 'Person', title: p.name, deletedAt: p.deletedAt }));
    events.forEach(e => items.push({ id: e.id, table: 'events', type: 'Event', title: e.title, deletedAt: e.deletedAt }));
    commitments.forEach(c => items.push({ id: c.id, table: 'commitments', type: 'Commitment', title: c.what, deletedAt: c.deletedAt }));
    decisions.forEach(d => items.push({ id: d.id, table: 'decisions', type: 'Decision', title: d.title, deletedAt: d.deletedAt }));
    openLoops.forEach(o => items.push({ id: o.id, table: 'openLoops', type: 'Open Loop', title: o.title, deletedAt: o.deletedAt }));
    goals.forEach(g => items.push({ id: g.id, table: 'goals', type: 'Goal', title: g.title, deletedAt: g.deletedAt }));
    routines.forEach(r => items.push({ id: r.id, table: 'routines', type: 'Routine', title: r.title, deletedAt: r.deletedAt }));
    journal.forEach(j => items.push({ id: j.id, table: 'journalEntries', type: 'Journal', title: j.title || `Entry for ${j.date}`, deletedAt: j.deletedAt }));
    canvases.forEach(c => items.push({ id: c.id, table: 'canvases', type: 'Canvas', title: c.name, deletedAt: c.deletedAt }));
    warranties.forEach(w => items.push({ id: w.id, table: 'warranties', type: 'Warranty', title: `${w.itemName} (${w.brand || ''})`, deletedAt: w.deletedAt }));
    familyMembers.forEach(f => items.push({ id: f.id, table: 'familyMembers', type: 'Family Member', title: `${f.name} (${f.relationship})`, deletedAt: f.deletedAt }));
    careReminders.forEach(cr => items.push({ id: cr.id, table: 'careReminders', type: 'Care Reminder', title: cr.title, deletedAt: cr.deletedAt }));
    documents.forEach(d => items.push({ id: d.id, table: 'documents', type: 'Document', title: d.title, deletedAt: d.deletedAt }));

    // Sort by deletedAt desc
    return items.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, []) || [];

  const handleRestore = async (item: TrashedItem) => {
    try {
      // @ts-ignore
      await db[item.table].update(item.id, { deletedAt: undefined, updatedAt: new Date().toISOString() });
      await logAudit('restore', item.table as any, item.id, `Restored ${item.title} from trash`);
      showToast(`Restored: ${item.title}`, { type: 'success' });
    } catch (err: any) {
      showToast(`Failed to restore: ${err.message}`, { type: 'error' });
    }
  };

  const handlePermanentDelete = async (item: TrashedItem) => {
    if (!window.confirm(`Permanently delete "${item.title}"? This action cannot be undone.`)) return;
    try {
      // Clean up linked relationships if any
      await db.relationships
        .filter(r => r.sourceId === item.id || r.targetId === item.id)
        .delete();

      // @ts-ignore
      await db[item.table].delete(item.id);
      await logAudit('delete', item.table as any, item.id, `Permanently deleted ${item.title}`);
      showToast('Record permanently deleted', { type: 'info' });
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, { type: 'error' });
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm(`Permanently remove all ${trashedItems.length} items in the trash? This cannot be undone.`)) return;

    try {
      await Promise.all(
        trashedItems.map(async item => {
          await db.relationships
            .filter(r => r.sourceId === item.id || r.targetId === item.id)
            .delete();
          // @ts-ignore
          await db[item.table].delete(item.id);
        })
      );
      showToast('Trash emptied completely', { type: 'success' });
    } catch (err: any) {
      showToast(`Failed to empty trash: ${err.message}`, { type: 'error' });
    }
  };

  const filteredItems = trashedItems.filter(item => {
    const matchesFilter = filterType === 'all' || item.table === filterType;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const availableTables = Array.from(new Set(trashedItems.map(i => i.table)));

  return (
    <div className="page-wrapper max-w-4xl mx-auto space-y-4 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Trash & Recovery</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trashedItems.length} items in trash across all modules
          </p>
        </div>
        {trashedItems.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm transition self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash ({trashedItems.length})</span>
          </button>
        )}
      </div>

      {trashedItems.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search trashed items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground"
            />
          </div>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground capitalize"
          >
            <option value="all">All Types ({trashedItems.length})</option>
            {availableTables.map(t => {
              const count = trashedItems.filter(i => i.table === t).length;
              return (
                <option key={t} value={t}>
                  {t} ({count})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {trashedItems.length === 0 ? (
        <div className="card p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <Trash2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <div className="font-semibold text-foreground text-sm">Trash is completely empty</div>
          <div className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Deleted tasks, expenses, notes, canvases, warranties, family records, and documents enter here before permanent removal.
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-xl">
          No trashed items match the filter or search query.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div
              key={`${item.table}-${item.id}`}
              className="card bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 transition hover:border-border/80"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground truncate">
                  {item.title}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded bg-muted font-medium text-[10px]">
                    {item.type}
                  </span>
                  <span>
                    Deleted {item.deletedAt ? formatDisplayDate(item.deletedAt.slice(0, 10)) : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded-lg bg-card hover:bg-muted text-foreground transition"
                  title="Restore record"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Restore</span>
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                  title="Permanent Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
