// GlobalSearchModal — "Search Your Life" Across All First-Class Records (Sections 1, 38)

import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  CheckSquare,
  Bell,
  FileText,
  Lightbulb,
  Wallet,
  BookOpen,
  Users,
  ArrowRight,
  Layers,
  HelpCircle,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { db } from '../../db/db';
import { formatMoney } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import type { EntityType } from '../../types';

interface SearchResultItem {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  date?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTo: (screen: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateTo
}) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'loop' | 'commitment' | 'decision' | 'note' | 'expense' | 'person' | 'event'>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const searchTimer = setTimeout(async () => {
      try {
        const found: SearchResultItem[] = [];

        // Tasks
        if (typeFilter === 'all' || typeFilter === 'task') {
          const tasks = await db.tasks
            .filter((t) => !t.deletedAt && (t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term) || (t.why || '').toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          tasks.forEach((t) => {
            found.push({
              id: t.id,
              type: 'task',
              title: t.title,
              subtitle: `Task · ${t.status} ${t.why ? `· Why: ${t.why}` : ''}`,
              date: t.dueDate
            });
          });
        }

        // Open Loops
        if (typeFilter === 'all' || typeFilter === 'loop') {
          const loops = await db.openLoops
            .filter((l) => !l.deletedAt && (l.title.toLowerCase().includes(term) || (l.waitingOnPersonName || '').toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          loops.forEach((l) => {
            found.push({
              id: l.id,
              type: 'open_loop',
              title: l.title,
              subtitle: `Open Loop · ${l.loopType.replace('_', ' ')} ${l.waitingOnPersonName ? `· Waiting on: ${l.waitingOnPersonName}` : ''}`,
              date: l.createdAt.slice(0, 10)
            });
          });
        }

        // Commitments
        if (typeFilter === 'all' || typeFilter === 'commitment') {
          const comms = await db.commitments
            .filter((c) => !c.deletedAt && (c.what.toLowerCase().includes(term) || c.who.toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          comms.forEach((c) => {
            found.push({
              id: c.id,
              type: 'commitment',
              title: c.what,
              subtitle: `Commitment · Promised to: ${c.who} (${c.status})`,
              date: c.promisedDate
            });
          });
        }

        // Decisions
        if (typeFilter === 'all' || typeFilter === 'decision') {
          const decs = await db.decisions
            .filter((d) => !d.deletedAt && (d.title.toLowerCase().includes(term) || d.reason.toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          decs.forEach((d) => {
            found.push({
              id: d.id,
              type: 'decision',
              title: d.title,
              subtitle: `Decision · Reason: ${d.reason.slice(0, 50)}...`,
              date: d.decisionDate
            });
          });
        }

        // Notes
        if (typeFilter === 'all' || typeFilter === 'note') {
          const notes = await db.notes
            .filter((n) => !n.deletedAt && (n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          notes.forEach((n) => {
            found.push({
              id: n.id,
              type: 'note',
              title: n.title,
              subtitle: n.content ? (n.content.length > 50 ? n.content.slice(0, 50) + '...' : n.content) : 'Empty note',
              date: n.updatedAt ? n.updatedAt.slice(0, 10) : undefined
            });
          });
        }

        // Expenses
        if (typeFilter === 'all' || typeFilter === 'expense') {
          const expenses = await db.expenses
            .filter((e) => !e.deletedAt && ((e.notes || '').toLowerCase().includes(term) || e.category.toLowerCase().includes(term) || (e.why || '').toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          expenses.forEach((e) => {
            found.push({
              id: e.id,
              type: 'expense',
              title: `${formatMoney(e.amountMinor)} · ${e.category}`,
              subtitle: e.notes || e.why || `${e.paymentMethod.toUpperCase()} expense`,
              date: e.date
            });
          });
        }

        // People
        if (typeFilter === 'all' || typeFilter === 'person') {
          const people = await db.people
            .filter((p) => !p.deletedAt && (p.name.toLowerCase().includes(term) || (p.relationship || '').toLowerCase().includes(term) || (p.notes || '').toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          people.forEach((p) => {
            found.push({
              id: p.id,
              type: 'person',
              title: p.name,
              subtitle: `Person · ${p.relationship || 'Contact'} ${p.notes ? `· ${p.notes}` : ''}`,
              date: p.createdAt.slice(0, 10)
            });
          });
        }

        // Events
        if (typeFilter === 'all' || typeFilter === 'event') {
          const events = await db.events
            .filter((e) => !e.deletedAt && (e.title.toLowerCase().includes(term) || (e.notes || '').toLowerCase().includes(term) || (e.location || '').toLowerCase().includes(term)))
            .limit(15)
            .toArray();
          events.forEach((e) => {
            found.push({
              id: e.id,
              type: 'event',
              title: e.title,
              subtitle: `Event · ${e.startTime || 'All day'} ${e.location ? `· ${e.location}` : ''}`,
              date: e.date
            });
          });
        }

        setResults(found);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(searchTimer);
  }, [query, typeFilter]);

  if (!isOpen) return null;

  const getIcon = (type: EntityType) => {
    switch (type) {
      case 'task': return <CheckSquare size={16} color="var(--accent)" />;
      case 'open_loop': return <Layers size={16} color="#d97706" />;
      case 'commitment': return <CheckCircle2 size={16} color="#059669" />;
      case 'decision': return <HelpCircle size={16} color="#7c3aed" />;
      case 'note': return <FileText size={16} color="#2563eb" />;
      case 'expense': return <Wallet size={16} color="#dc2626" />;
      case 'person': return <Users size={16} color="#0891b2" />;
      case 'event': return <Calendar size={16} color="#4f46e5" />;
      default: return <Search size={16} />;
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    let screen = 'home';
    if (item.type === 'task') screen = 'tasks';
    else if (item.type === 'open_loop' || item.type === 'commitment' || item.type === 'decision') screen = 'loops';
    else if (item.type === 'note') screen = 'notes';
    else if (item.type === 'expense') screen = 'money';
    else if (item.type === 'person') screen = 'people';
    else if (item.type === 'event') screen = 'calendar';

    onNavigateTo(screen);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ minHeight: '65vh', maxHeight: '85vh', maxWidth: '640px', margin: '0 auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search tasks, loops, commitments, decisions, people, notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{ paddingLeft: '38px', fontSize: '15px' }}
            />
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close search">
            <X size={20} />
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', scrollbarWidth: 'none' }}>
          {(['all', 'task', 'loop', 'commitment', 'decision', 'note', 'expense', 'person', 'event'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTypeFilter(filter)}
              className={`btn btn-sm ${typeFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: '12px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isSearching && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Searching your local life records...
            </div>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-title">No matching records</div>
              <div className="empty-state-desc">
                Nothing found for "{query}". Check spelling or try a different term.
              </div>
            </div>
          )}

          {!query.trim() && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Type anything to search across all your local tasks, open loops, commitments, decisions, people, notes, events, and finances.
            </div>
          )}

          {results.map((res) => (
            <button
              key={`${res.type}_${res.id}`}
              onClick={() => handleSelectResult(res)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
                width: '100%',
                border: '1px solid var(--border-light)',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {getIcon(res.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {res.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {res.subtitle}
                </div>
              </div>
              {res.date && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatDisplayDate(res.date)}
                </div>
              )}
              <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
