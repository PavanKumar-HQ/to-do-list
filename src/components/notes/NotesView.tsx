import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Lightbulb,
  Plus,
  Pin,
  Trash2,
  Edit3,
  CheckSquare,
  ArrowRight,
  Bookmark,
  X,
  Volume2,
  Network
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import type { NoteItem, IdeaItem, ChecklistItem, EntityType } from '../../types';

export const NotesView: React.FC<{ onOpenQuickAdd: (type: any) => void }> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'notes' | 'ideas'>('notes');
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<IdeaItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Queries
  const allNotes = useLiveQuery(async () => {
    return db.notes.filter((n) => !n.deletedAt).reverse().sortBy('updatedAt');
  }, []) || [];

  const allIdeas = useLiveQuery(async () => {
    return db.ideas.filter((i) => !i.deletedAt).reverse().sortBy('updatedAt');
  }, []) || [];

  // Pinned vs Normal Notes
  const pinnedNotes = allNotes.filter((n) => n.isPinned);
  const regularNotes = allNotes.filter((n) => !n.isPinned);

  const togglePinNote = async (note: NoteItem) => {
    const isPinned = !note.isPinned;
    await db.notes.update(note.id, { isPinned, updatedAt: new Date().toISOString() });
    showToast(isPinned ? 'Note pinned to top' : 'Note unpinned');
  };

  const handleDeleteNote = async (id: string, title: string) => {
    await db.notes.update(id, { deletedAt: new Date().toISOString() });
    await logAudit('delete', 'note', id, `Moved note to trash: ${title}`);
    showToast('Note moved to trash');
    setSelectedNote(null);
  };

  const handleDeleteIdea = async (id: string, title: string) => {
    await db.ideas.update(id, { deletedAt: new Date().toISOString() });
    await logAudit('delete', 'idea', id, `Moved idea to trash: ${title}`);
    showToast('Idea moved to trash');
    setSelectedIdea(null);
  };

  // Convert Note to Task
  const convertNoteToTask = async (note: NoteItem) => {
    const taskId = generateId();
    const nowIso = new Date().toISOString();
    await db.tasks.add({
      id: taskId,
      title: note.title,
      description: note.content,
      status: 'todo',
      priority: 'medium',
      recurrence: 'none',
      subtasks: note.checklistItems?.map((ci) => ({ id: ci.id, title: ci.text, completed: ci.done })) || [],
      tags: note.tags,
      dueDate: getTodayDateString(),
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await logAudit('create', 'task', taskId, `Converted note "${note.title}" into task`);
    showToast('Converted to task scheduled for today', { type: 'success' });
    setSelectedNote(null);
  };

  // Convert Idea to Task
  const convertIdeaToTask = async (idea: IdeaItem) => {
    const taskId = generateId();
    const nowIso = new Date().toISOString();
    await db.tasks.add({
      id: taskId,
      title: idea.title,
      description: idea.description,
      status: 'todo',
      priority: 'medium',
      recurrence: 'none',
      subtasks: [],
      tags: idea.tags,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await db.ideas.update(idea.id, { status: 'converted', convertedToId: taskId, updatedAt: nowIso });
    await logAudit('update', 'idea', idea.id, `Converted idea "${idea.title}" into task`);
    showToast('Idea converted to task', { type: 'success' });
    setSelectedIdea(null);
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Notes & Ideas
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {allNotes.length} notes • {allIdeas.length} ideas
          </p>
        </div>
        <button
          onClick={() => onOpenQuickAdd(activeTab === 'notes' ? 'note' : 'idea')}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>New {activeTab === 'notes' ? 'Note' : 'Idea'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('notes')}
          className={`btn btn-sm ${activeTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px', gap: '6px' }}
        >
          <FileText size={15} />
          <span>Notes ({allNotes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ideas')}
          className={`btn btn-sm ${activeTab === 'ideas' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px', gap: '6px' }}
        >
          <Lightbulb size={15} />
          <span>Ideas ({allIdeas.length})</span>
        </button>
      </div>

      {activeTab === 'notes' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {allNotes.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                Your notes will appear here.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Capture checklists, references, or reflections whenever they strike.
              </div>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Pin size={12} />
                    <span>PINNED</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onClick={() => setSelectedNote(note)}
                        onPin={() => togglePinNote(note)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {regularNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      ALL NOTES
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {regularNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onClick={() => setSelectedNote(note)}
                        onPin={() => togglePinNote(note)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Ideas Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allIdeas.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Lightbulb size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                No ideas recorded yet.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Record sparks of creativity before they fade.
              </div>
            </div>
          ) : (
            allIdeas.map((idea) => (
              <div
                key={idea.id}
                className="card"
                onClick={() => setSelectedIdea(idea)}
                style={{ padding: '14px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {idea.title}
                  </div>
                  {idea.status === 'converted' && (
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                      Converted to Task
                    </span>
                  )}
                </div>
                {idea.description && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {idea.description}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Recorded {formatDisplayDate(idea.createdAt.slice(0, 10))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Note Detail / Edit Modal */}
      {selectedNote && (
        <div className="modal-overlay" onClick={() => setSelectedNote(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => togglePinNote(selectedNote)}
                  className="btn-ghost"
                  style={{ padding: '6px', color: selectedNote.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
                  title="Toggle pin"
                >
                  <Pin size={18} />
                </button>
                <span className="badge badge-neutral">{selectedNote.category || 'Note'}</span>
              </div>
              <button onClick={() => setSelectedNote(null)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {selectedNote.title}
            </h3>

            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', flex: 1, overflowY: 'auto' }}>
              {selectedNote.content || 'No text content'}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={() => setContextModal({ isOpen: true, type: 'note', id: selectedNote.id })}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, gap: '6px' }}
                title="View Life Context"
              >
                <Network size={14} />
                <span>Context</span>
              </button>
              <button
                onClick={() => convertNoteToTask(selectedNote)}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, gap: '6px' }}
              >
                <CheckSquare size={14} />
                <span>Make Task</span>
              </button>
              <button
                onClick={() => handleDeleteNote(selectedNote.id, selectedNote.title)}
                className="btn btn-danger btn-sm"
                style={{ flex: 1, gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idea Detail Modal */}
      {selectedIdea && (
        <div className="modal-overlay" onClick={() => setSelectedIdea(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span className="badge badge-accent">Idea</span>
              <button onClick={() => setSelectedIdea(null)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {selectedIdea.title}
            </h3>

            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {selectedIdea.description || 'No additional description provided.'}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={() => convertIdeaToTask(selectedIdea)}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, gap: '6px' }}
              >
                <CheckSquare size={14} />
                <span>Convert to Task</span>
              </button>
              <button
                onClick={() => handleDeleteIdea(selectedIdea.id, selectedIdea.title)}
                className="btn btn-danger btn-sm"
                style={{ flex: 1, gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />
    </div>
  );
};

const NoteCard: React.FC<{ note: NoteItem; onClick: () => void; onPin: () => void }> = ({ note, onClick, onPin }) => {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
          {note.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="btn-ghost"
          style={{ padding: '4px', color: note.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <Pin size={14} />
        </button>
      </div>

      {note.content && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {note.content}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>{formatDisplayDate(note.updatedAt.slice(0, 10))}</span>
        {note.category && <span>• {note.category}</span>}
      </div>
    </div>
  );
};
