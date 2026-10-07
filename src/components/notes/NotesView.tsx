import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Lightbulb,
  Plus,
  Pin,
  Trash2,
  Edit2,
  CheckSquare,
  Copy,
  X,
  Network,
  Check,
  Tag,
  ListPlus,
  Layers,
  ArrowRight
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import { NoteRepository } from '../../repositories/NoteRepository';
import type { NoteItem, IdeaItem, ChecklistItem, EntityType } from '../../types';

export const NotesView: React.FC<{ onOpenQuickAdd: (type: any) => void }> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'notes' | 'ideas'>('notes');
  
  // Inline quick capture
  const [quickInput, setQuickInput] = useState('');

  // Modals state
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);

  const [selectedIdea, setSelectedIdea] = useState<IdeaItem | null>(null);
  const [editingIdea, setEditingIdea] = useState<IdeaItem | null>(null);
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);

  // Note Edit Form State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [noteIsPinned, setNoteIsPinned] = useState(false);
  const [noteChecklist, setNoteChecklist] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Idea Edit Form State
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('');
  const [ideaTags, setIdeaTags] = useState('');
  const [ideaStatus, setIdeaStatus] = useState<'active' | 'converted' | 'archived'>('active');

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

  // --------------------------------------------------------------------------
  // NOTE CRUD HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenCreateNote = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteCategory('');
    setNoteTags('');
    setNoteIsPinned(false);
    setNoteChecklist([]);
    setNewChecklistText('');
    setIsNewNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: NoteItem) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setNoteCategory(note.category || '');
    setNoteTags(note.tags ? note.tags.join(', ') : '');
    setNoteIsPinned(!!note.isPinned);
    setNoteChecklist(note.checklistItems ? [...note.checklistItems] : []);
    setNewChecklistText('');
    if (selectedNote?.id === note.id) {
      setSelectedNote(null);
    }
  };

  const handleSaveNote = async () => {
    const trimmedTitle = noteTitle.trim();
    if (!trimmedTitle) {
      showToast('Note title cannot be empty', { type: 'warning' });
      return;
    }

    const tagsArray = noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingNote) {
        // UPDATE
        const updated = await NoteRepository.update(editingNote.id, {
          title: trimmedTitle,
          content: noteContent.trim(),
          category: noteCategory.trim() || undefined,
          tags: tagsArray,
          isPinned: noteIsPinned,
          checklistItems: noteChecklist
        });
        showToast('Note updated successfully', { type: 'success' });
        setEditingNote(null);
      } else {
        // CREATE
        const created = await NoteRepository.create({
          title: trimmedTitle,
          content: noteContent.trim(),
          category: noteCategory.trim() || undefined,
          tags: tagsArray,
          isPinned: noteIsPinned,
          checklistItems: noteChecklist
        });
        showToast('Note created', { type: 'success' });
        setIsNewNoteModalOpen(false);
      }
    } catch (err: any) {
      showToast(`Error saving note: ${err.message}`, { type: 'error' });
    }
  };

  const handleDeleteNote = async (id: string, title: string) => {
    try {
      await NoteRepository.softDelete(id);
      showToast(`Note "${title}" moved to trash`, {
        type: 'info',
        actionLabel: 'Undo',
        onAction: async () => {
          await NoteRepository.restore(id);
          showToast('Note restored', { type: 'success' });
        }
      });
      setSelectedNote(null);
      setEditingNote(null);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, { type: 'error' });
    }
  };

  const handleDuplicateNote = async (id: string) => {
    try {
      const copy = await NoteRepository.duplicate(id);
      showToast(`Duplicated: ${copy.title}`, { type: 'success' });
    } catch (err: any) {
      showToast(`Duplicate failed: ${err.message}`, { type: 'error' });
    }
  };

  const togglePinNote = async (note: NoteItem) => {
    const isPinned = !note.isPinned;
    await db.notes.update(note.id, { isPinned, updatedAt: new Date().toISOString() });
    showToast(isPinned ? 'Note pinned to top' : 'Note unpinned');
  };

  const handleToggleChecklistItem = async (note: NoteItem, itemIndex: number) => {
    const items = [...(note.checklistItems || [])];
    if (items[itemIndex]) {
      items[itemIndex].done = !items[itemIndex].done;
      await db.notes.update(note.id, { checklistItems: items, updatedAt: new Date().toISOString() });
    }
  };

  const handleAddChecklistEntry = () => {
    if (!newChecklistText.trim()) return;
    setNoteChecklist([
      ...noteChecklist,
      { id: generateId(), text: newChecklistText.trim(), done: false }
    ]);
    setNewChecklistText('');
  };

  const handleRemoveChecklistEntry = (index: number) => {
    setNoteChecklist(noteChecklist.filter((_, i) => i !== index));
  };

  // Convert Note to Task
  const convertNoteToTask = async (note: NoteItem) => {
    try {
      const task = await NoteRepository.convertToTask(note.id);
      showToast(`Converted "${task.title}" to Task`, { type: 'success' });
      setSelectedNote(null);
    } catch (err: any) {
      showToast(`Convert failed: ${err.message}`, { type: 'error' });
    }
  };

  // --------------------------------------------------------------------------
  // IDEA CRUD HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenCreateIdea = () => {
    setIdeaTitle('');
    setIdeaDescription('');
    setIdeaCategory('');
    setIdeaTags('');
    setIdeaStatus('active');
    setIsNewIdeaModalOpen(true);
  };

  const handleOpenEditIdea = (idea: IdeaItem) => {
    setEditingIdea(idea);
    setIdeaTitle(idea.title);
    setIdeaDescription(idea.description || '');
    setIdeaCategory(idea.category || '');
    setIdeaTags(idea.tags ? idea.tags.join(', ') : '');
    setIdeaStatus(idea.status || 'active');
    if (selectedIdea?.id === idea.id) {
      setSelectedIdea(null);
    }
  };

  const handleSaveIdea = async () => {
    const trimmedTitle = ideaTitle.trim();
    if (!trimmedTitle) {
      showToast('Idea title cannot be empty', { type: 'warning' });
      return;
    }

    const tagsArray = ideaTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const nowIso = new Date().toISOString();

    try {
      if (editingIdea) {
        // UPDATE
        await db.ideas.update(editingIdea.id, {
          title: trimmedTitle,
          description: ideaDescription.trim(),
          category: ideaCategory.trim() || undefined,
          tags: tagsArray,
          status: ideaStatus,
          updatedAt: nowIso
        });
        await logAudit('update', 'idea', editingIdea.id, `Updated idea: ${trimmedTitle}`);
        showToast('Idea updated successfully', { type: 'success' });
        setEditingIdea(null);
      } else {
        // CREATE
        const id = generateId();
        await db.ideas.add({
          id,
          title: trimmedTitle,
          description: ideaDescription.trim(),
          category: ideaCategory.trim() || undefined,
          tags: tagsArray,
          isPinned: false,
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        await logAudit('create', 'idea', id, `Created idea: ${trimmedTitle}`);
        showToast('Idea recorded', { type: 'success' });
        setIsNewIdeaModalOpen(false);
      }
    } catch (err: any) {
      showToast(`Error saving idea: ${err.message}`, { type: 'error' });
    }
  };

  const handleDeleteIdea = async (id: string, title: string) => {
    try {
      await db.ideas.update(id, { deletedAt: new Date().toISOString() });
      await logAudit('delete', 'idea', id, `Moved idea to trash: ${title}`);
      showToast(`Idea "${title}" moved to trash`, {
        type: 'info',
        actionLabel: 'Undo',
        onAction: async () => {
          await db.ideas.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() });
          showToast('Idea restored', { type: 'success' });
        }
      });
      setSelectedIdea(null);
      setEditingIdea(null);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, { type: 'error' });
    }
  };

  const handleDuplicateIdea = async (idea: IdeaItem) => {
    try {
      const nowIso = new Date().toISOString();
      const newId = generateId();
      await db.ideas.add({
        ...idea,
        id: newId,
        title: `${idea.title} (Copy)`,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await logAudit('create', 'idea', newId, `Duplicated idea: ${idea.title}`);
      showToast(`Duplicated: ${idea.title} (Copy)`, { type: 'success' });
    } catch (err: any) {
      showToast(`Duplicate failed: ${err.message}`, { type: 'error' });
    }
  };

  const convertIdeaToTask = async (idea: IdeaItem) => {
    const taskId = generateId();
    const nowIso = new Date().toISOString();
    try {
      await db.tasks.add({
        id: taskId,
        title: idea.title,
        description: idea.description,
        status: 'todo',
        priority: 'medium',
        recurrence: 'none',
        subtasks: [],
        tags: idea.tags,
        dueDate: getTodayDateString(),
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await db.ideas.update(idea.id, { status: 'converted', convertedToId: taskId, updatedAt: nowIso });
      await logAudit('create', 'task', taskId, `Converted idea "${idea.title}" into task`);
      showToast('Idea converted to task scheduled for today', { type: 'success' });
      setSelectedIdea(null);
    } catch (err: any) {
      showToast(`Convert failed: ${err.message}`, { type: 'error' });
    }
  };

  // Quick 1-tap capture handler
  const handleQuickCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text) return;

    if (activeTab === 'notes') {
      await NoteRepository.create({ title: text });
      showToast(`Note "${text}" created`, { type: 'success' });
    } else {
      const nowIso = new Date().toISOString();
      const id = generateId();
      await db.ideas.add({
        id,
        title: text,
        description: '',
        tags: [],
        isPinned: false,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      });
      showToast(`Idea "${text}" recorded`, { type: 'success' });
    }
    setQuickInput('');
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
          onClick={activeTab === 'notes' ? handleOpenCreateNote : handleOpenCreateIdea}
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

      {/* Quick 1-Tap Capture Input */}
      <form onSubmit={handleQuickCaptureSubmit} style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder={activeTab === 'notes' ? 'Quick capture note title... (Press Enter)' : 'Quick spark an idea... (Press Enter)'}
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', borderRadius: '10px' }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', borderRadius: '10px' }}>
          <Plus size={16} />
          <span>Add</span>
        </button>
      </form>

      {/* ----------------- NOTES TAB ----------------- */}
      {activeTab === 'notes' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {allNotes.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                Your notes will appear here.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Capture checklists, references, or reflections.
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
                        onEdit={() => handleOpenEditNote(note)}
                        onPin={() => togglePinNote(note)}
                        onDuplicate={() => handleDuplicateNote(note.id)}
                        onDelete={() => handleDeleteNote(note.id, note.title)}
                        onToggleChecklist={(idx) => handleToggleChecklistItem(note, idx)}
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
                        onEdit={() => handleOpenEditNote(note)}
                        onPin={() => togglePinNote(note)}
                        onDuplicate={() => handleDuplicateNote(note.id)}
                        onDelete={() => handleDeleteNote(note.id, note.title)}
                        onToggleChecklist={(idx) => handleToggleChecklistItem(note, idx)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ----------------- IDEAS TAB ----------------- */
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
                style={{ padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {idea.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {idea.status === 'converted' && (
                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                        Converted
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditIdea(idea);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '12px', height: '26px', gap: '4px' }}
                      title="Edit idea"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateIdea(idea);
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '4px' }}
                      title="Duplicate idea"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete idea "${idea.title}"?`)) {
                          handleDeleteIdea(idea.id, idea.title);
                        }
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: '4px' }}
                      title="Delete idea"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {idea.description && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {idea.description}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Recorded {formatDisplayDate(idea.createdAt.slice(0, 10))}</span>
                  {idea.category && <span>• {idea.category}</span>}
                  {idea.tags && idea.tags.length > 0 && (
                    <span>• {idea.tags.map(t => `#${t}`).join(' ')}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ----------------- NOTE DETAIL MODAL (READ MODE) ----------------- */}
      {selectedNote && !editingNote && (
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
                {selectedNote.tags?.map((t) => (
                  <span key={t} className="badge badge-neutral" style={{ fontSize: '11px' }}>
                    #{t}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => handleOpenEditNote(selectedNote)}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px' }}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button onClick={() => setSelectedNote(null)} className="btn-ghost btn-icon">
                  <X size={20} />
                </button>
              </div>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {selectedNote.title}
            </h3>

            {selectedNote.content && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '16px' }}>
                {selectedNote.content}
              </div>
            )}

            {/* Interactive Checklist in Note Detail */}
            {selectedNote.checklistItems && selectedNote.checklistItems.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Checklist:</div>
                {selectedNote.checklistItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => handleToggleChecklistItem(selectedNote, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      background: 'var(--bg-subtle)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <input type="checkbox" checked={item.done} readOnly style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={() => setContextModal({ isOpen: true, type: 'note', id: selectedNote.id })}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, gap: '6px' }}
                title="View 360 Life Context"
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
                onClick={() => handleDuplicateNote(selectedNote.id)}
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
                title="Duplicate note"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => handleDeleteNote(selectedNote.id, selectedNote.title)}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--danger)', padding: '6px 10px' }}
                title="Delete note"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- NOTE CREATE / EDIT MODAL ----------------- */}
      {(isNewNoteModalOpen || editingNote) && (
        <div className="modal-overlay" onClick={() => { setIsNewNoteModalOpen(false); setEditingNote(null); }} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </h3>
              <button onClick={() => { setIsNewNoteModalOpen(false); setEditingNote(null); }} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Content
                </label>
                <textarea
                  rows={4}
                  placeholder="Write your note, thoughts, or references..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Work, Personal, Book"
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="design, meeting, draft"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                  />
                </div>
              </div>

              {/* Checklist builder */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Checklist Items
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add checklist task..."
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistEntry();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddChecklistEntry} className="btn btn-secondary btn-sm" style={{ padding: '0 12px' }}>
                    <Plus size={14} />
                  </button>
                </div>

                {noteChecklist.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {noteChecklist.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '13px' }}>{item.text}</span>
                        <button type="button" onClick={() => handleRemoveChecklistEntry(idx)} className="btn-ghost" style={{ color: 'var(--danger)', padding: '2px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pin Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  id="notePinCheckbox"
                  checked={noteIsPinned}
                  onChange={(e) => setNoteIsPinned(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="notePinCheckbox" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Pin this note to top
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setIsNewNoteModalOpen(false); setEditingNote(null); }} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveNote} className="btn btn-primary" style={{ flex: 2 }}>
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- IDEA DETAIL MODAL (READ MODE) ----------------- */}
      {selectedIdea && !editingIdea && (
        <div className="modal-overlay" onClick={() => setSelectedIdea(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="badge badge-accent">Idea</span>
                {selectedIdea.category && (
                  <span className="badge badge-neutral">{selectedIdea.category}</span>
                )}
                {selectedIdea.status === 'converted' && (
                  <span className="badge badge-success">Converted</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => handleOpenEditIdea(selectedIdea)}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px' }}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button onClick={() => setSelectedIdea(null)} className="btn-ghost btn-icon">
                  <X size={20} />
                </button>
              </div>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {selectedIdea.title}
            </h3>

            {selectedIdea.description && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '16px' }}>
                {selectedIdea.description}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
              <button
                onClick={() => convertIdeaToTask(selectedIdea)}
                className="btn btn-primary btn-sm"
                style={{ flex: 2, gap: '6px' }}
              >
                <CheckSquare size={14} />
                <span>Convert to Task</span>
              </button>
              <button
                onClick={() => handleDuplicateIdea(selectedIdea)}
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
                title="Duplicate idea"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => handleDeleteIdea(selectedIdea.id, selectedIdea.title)}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--danger)', padding: '6px 10px' }}
                title="Delete idea"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- IDEA CREATE / EDIT MODAL ----------------- */}
      {(isNewIdeaModalOpen || editingIdea) && (
        <div className="modal-overlay" onClick={() => { setIsNewIdeaModalOpen(false); setEditingIdea(null); }} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingIdea ? 'Edit Idea' : 'Record New Idea'}
              </h3>
              <button onClick={() => { setIsNewIdeaModalOpen(false); setEditingIdea(null); }} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Idea Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. AI workshop for schools"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe the spark or brainstorm details..."
                  value={ideaDescription}
                  onChange={(e) => setIdeaDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="Product, Business, Creative"
                    value={ideaCategory}
                    onChange={(e) => setIdeaCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={ideaStatus}
                    onChange={(e) => setIdeaStatus(e.target.value as any)}
                  >
                    <option value="active">Active</option>
                    <option value="converted">Converted</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="startup, ai, feature"
                  value={ideaTags}
                  onChange={(e) => setIdeaTags(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => { setIsNewIdeaModalOpen(false); setEditingIdea(null); }} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveIdea} className="btn btn-primary" style={{ flex: 2 }}>
                  {editingIdea ? 'Save Changes' : 'Record Idea'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 360° Life Graph Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />
    </div>
  );
};

// Subcomponent: NoteCard with Quick CRUD Buttons
const NoteCard: React.FC<{
  note: NoteItem;
  onClick: () => void;
  onEdit: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleChecklist: (index: number) => void;
}> = ({ note, onClick, onEdit, onPin, onDuplicate, onDelete, onToggleChecklist }) => {
  const completedChecklistCount = note.checklistItems?.filter((c) => c.done).length || 0;
  const totalChecklistCount = note.checklistItems?.length || 0;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
          {note.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="btn-ghost"
            style={{ padding: '4px', color: note.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
            title={note.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '2px 8px', fontSize: '12px', height: '26px', gap: '4px' }}
            title="Edit note"
          >
            <Edit2 size={12} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="btn-ghost"
            style={{ color: 'var(--text-muted)', padding: '4px' }}
            title="Duplicate note"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete note "${note.title}"?`)) {
                onDelete();
              }
            }}
            className="btn-ghost"
            style={{ color: 'var(--danger)', padding: '4px' }}
            title="Delete note"
          >
            <Trash2 size={13} />
          </button>
        </div>
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

      {/* Checklist preview */}
      {totalChecklistCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <CheckSquare size={13} />
          <span>
            {completedChecklistCount}/{totalChecklistCount} tasks completed
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>{formatDisplayDate(note.updatedAt.slice(0, 10))}</span>
        {note.category && <span>• {note.category}</span>}
        {note.tags && note.tags.length > 0 && (
          <span>• {note.tags.map(t => `#${t}`).join(' ')}</span>
        )}
      </div>
    </div>
  );
};
