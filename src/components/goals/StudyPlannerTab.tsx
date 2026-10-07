import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  GraduationCap,
  BookOpen,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Sparkles,
  CheckSquare
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { StudySubjectItem, StudyChapter } from '../../types';

export const StudyPlannerTab: React.FC = () => {
  const { showToast } = useToast();
  const [isNewSubjectOpen, setIsNewSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<StudySubjectItem | null>(null);
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Record<string, boolean>>({});

  // New Subject Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tech');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [notes, setNotes] = useState('');
  const [initialChaptersText, setInitialChaptersText] = useState('');

  // Inline New Chapter Form
  const [activeAddChapterSubjectId, setActiveAddChapterSubjectId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterDeadline, setNewChapterDeadline] = useState('');

  const subjects = useLiveQuery(async () => {
    return db.studySubjects.filter((s) => !s.deletedAt).toArray();
  }, []) || [];

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setTitle('');
    setCategory('Tech');
    setDeadline('');
    setColor('#3b82f6');
    setNotes('');
    setInitialChaptersText('');
    setIsNewSubjectOpen(true);
  };

  const handleOpenEdit = (subject: StudySubjectItem) => {
    setEditingSubject(subject);
    setTitle(subject.title);
    setCategory(subject.category || 'General');
    setDeadline(subject.deadline || '');
    setColor(subject.color || '#3b82f6');
    setNotes(subject.notes || '');
    setInitialChaptersText('');
    setIsNewSubjectOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a subject title', { type: 'warning' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (editingSubject) {
      await db.studySubjects.update(editingSubject.id, {
        title: title.trim(),
        category,
        deadline: deadline || undefined,
        color,
        notes: notes.trim() || undefined,
        updatedAt: nowIso
      });
      await logAudit('update', 'study_subject' as any, editingSubject.id, `Updated study subject: ${title.trim()}`);
      showToast(`Subject updated: ${title.trim()}`, { type: 'success' });
    } else {
      const parsedChapters: StudyChapter[] = initialChaptersText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((chTitle) => ({
          id: generateId(),
          title: chTitle,
          completed: false
        }));

      const newSubject: StudySubjectItem = {
        id: generateId(),
        title: title.trim(),
        category,
        deadline: deadline || undefined,
        color,
        notes: notes.trim() || undefined,
        chapters: parsedChapters,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await db.studySubjects.add(newSubject);
      await logAudit('create', 'study_subject' as any, newSubject.id, `Created study subject: ${title.trim()}`);
      showToast(`Created study subject: ${title.trim()}`, { type: 'success' });

      // Automatically expand new subject
      setExpandedSubjectIds((prev) => ({ ...prev, [newSubject.id]: true }));
    }

    setIsNewSubjectOpen(false);
  };

  const handleToggleChapter = async (subject: StudySubjectItem, chapterId: string) => {
    const updatedChapters = subject.chapters.map((ch) => {
      if (ch.id === chapterId) {
        const next = !ch.completed;
        return {
          ...ch,
          completed: next,
          completedAt: next ? new Date().toISOString() : undefined
        };
      }
      return ch;
    });

    const nowIso = new Date().toISOString();
    await db.studySubjects.update(subject.id, {
      chapters: updatedChapters,
      updatedAt: nowIso
    });

    const completedCount = updatedChapters.filter((c) => c.completed).length;
    showToast(`Chapter progress: ${completedCount}/${updatedChapters.length} in ${subject.title}`, { type: 'info' });
  };

  const handleAddChapterToSubject = async (subjectId: string) => {
    if (!newChapterTitle.trim()) return;

    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;

    const newChapter: StudyChapter = {
      id: generateId(),
      title: newChapterTitle.trim(),
      completed: false,
      deadline: newChapterDeadline || undefined
    };

    const updatedChapters = [...subject.chapters, newChapter];
    await db.studySubjects.update(subjectId, {
      chapters: updatedChapters,
      updatedAt: new Date().toISOString()
    });

    showToast(`Added chapter "${newChapter.title}"`, { type: 'success' });
    setNewChapterTitle('');
    setNewChapterDeadline('');
    setActiveAddChapterSubjectId(null);
  };

  const handleDeleteChapter = async (subject: StudySubjectItem, chapterId: string) => {
    const updatedChapters = subject.chapters.filter((ch) => ch.id !== chapterId);
    await db.studySubjects.update(subject.id, {
      chapters: updatedChapters,
      updatedAt: new Date().toISOString()
    });
    showToast('Chapter removed', { type: 'info' });
  };

  const handleDeleteSubject = async (subject: StudySubjectItem) => {
    if (confirm(`Delete subject "${subject.title}" and all its chapters?`)) {
      await db.studySubjects.update(subject.id, { deletedAt: new Date().toISOString() });
      await logAudit('delete', 'study_subject' as any, subject.id, `Deleted study subject: ${subject.title}`);
      showToast('Subject deleted', { type: 'info' });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSubjectIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalChapters = subjects.reduce((sum, s) => sum + s.chapters.length, 0);
  const totalCompletedChapters = subjects.reduce(
    (sum, s) => sum + s.chapters.filter((c) => c.completed).length,
    0
  );
  const overallProgress = totalChapters > 0 ? Math.round((totalCompletedChapters / totalChapters) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner with Study Overview */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: '#8b5cf6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GraduationCap size={24} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Study Planner & Syllabus Tracker
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {totalCompletedChapters} of {totalChapters} chapters completed across {subjects.length} subjects ({overallProgress}%)
            </div>
          </div>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
          <Plus size={16} />
          <span>New Subject</span>
        </button>
      </div>

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          <BookOpen size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No study subjects yet</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '360px', margin: '4px auto 16px' }}>
            Break subjects down into chapters, set deadlines, and track your syllabus completion.
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            <Plus size={15} />
            <span>Create First Subject</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {subjects.map((subject) => {
            const isExpanded = expandedSubjectIds[subject.id] !== false; // default expanded
            const completedCount = subject.chapters.filter((c) => c.completed).length;
            const chTotal = subject.chapters.length;
            const percent = chTotal > 0 ? Math.round((completedCount / chTotal) * 100) : 0;
            const isAddingChapter = activeAddChapterSubjectId === subject.id;

            return (
              <div
                key={subject.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden'
                }}
              >
                {/* Subject Header Card */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'var(--bg-surface-elevated)'
                  }}
                  onClick={() => toggleExpand(subject.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    <div
                      style={{
                        width: '12px',
                        height: '42px',
                        borderRadius: '6px',
                        background: subject.color || '#3b82f6'
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: subject.color || 'var(--accent)'
                          }}
                        >
                          {subject.category || 'General'}
                        </span>
                        {subject.deadline && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={12} />
                            Target: {formatDisplayDate(subject.deadline)}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {subject.title}
                      </h4>
                    </div>
                  </div>

                  {/* Progress Meter & Expand/Action Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '140px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {completedCount}/{chTotal} Chapters ({percent}%)
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '3px',
                          background: 'var(--bg-surface)',
                          overflow: 'hidden',
                          marginTop: '4px'
                        }}
                      >
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: subject.color || '#3b82f6',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEdit(subject)}
                        className="btn-ghost btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Edit Subject"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject)}
                        className="btn-ghost btn-icon"
                        style={{ width: '28px', height: '28px', color: 'var(--danger)' }}
                        title="Delete Subject"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Chapters View */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                    {subject.notes && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', fontStyle: 'italic' }}>
                        {subject.notes}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {subject.chapters.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                          No chapters added yet. Add your first chapter below.
                        </div>
                      ) : (
                        subject.chapters.map((ch, idx) => (
                          <div
                            key={ch.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-md)',
                              background: ch.completed ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              opacity: ch.completed ? 0.75 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                              <button
                                onClick={() => handleToggleChapter(subject, ch.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: ch.completed ? '#10b981' : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {ch.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>

                              <span
                                style={{
                                  fontSize: '13.5px',
                                  fontWeight: 500,
                                  color: 'var(--text-primary)',
                                  textDecoration: ch.completed ? 'line-through' : 'none'
                                }}
                              >
                                <span style={{ color: 'var(--text-muted)', marginRight: '6px', fontSize: '12px' }}>
                                  #{idx + 1}
                                </span>
                                {ch.title}
                              </span>

                              {ch.deadline && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    marginLeft: '8px'
                                  }}
                                >
                                  <Clock size={11} />
                                  Due: {formatDisplayDate(ch.deadline)}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteChapter(subject, ch.id)}
                              className="btn-ghost btn-icon"
                              style={{ width: '24px', height: '24px', color: 'var(--text-muted)' }}
                              title="Remove Chapter"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Inline Add Chapter Form */}
                    {isAddingChapter ? (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          alignItems: 'center'
                        }}
                      >
                        <input
                          type="text"
                          className="input-text"
                          placeholder="Chapter/Topic title..."
                          style={{ flex: 2, minWidth: '180px' }}
                          value={newChapterTitle}
                          onChange={(e) => setNewChapterTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddChapterToSubject(subject.id);
                          }}
                          autoFocus
                        />
                        <input
                          type="date"
                          className="input-text"
                          style={{ flex: 1, minWidth: '130px' }}
                          value={newChapterDeadline}
                          onChange={(e) => setNewChapterDeadline(e.target.value)}
                        />
                        <button
                          onClick={() => handleAddChapterToSubject(subject.id)}
                          className="btn btn-primary btn-sm"
                        >
                          Add Chapter
                        </button>
                        <button
                          onClick={() => setActiveAddChapterSubjectId(null)}
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveAddChapterSubjectId(subject.id);
                          setNewChapterTitle('');
                          setNewChapterDeadline('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '12px', gap: '4px', fontSize: '12px' }}
                      >
                        <Plus size={14} />
                        <span>Add Chapter / Module</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Subject Modal */}
      {isNewSubjectOpen && (
        <div className="modal-overlay" onClick={() => setIsNewSubjectOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {editingSubject ? 'Edit Subject' : 'New Study Subject'}
              </h3>
              <button onClick={() => setIsNewSubjectOpen(false)} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Subject / Course Title *</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. System Design, Calculus III, UPSC General Studies"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Category</label>
                  <select
                    className="input-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Tech">Tech & Coding</option>
                    <option value="Exam Prep">Exam Preparation</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science & Engineering</option>
                    <option value="Languages">Languages</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Self Study">Self Study</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Target Completion Date</label>
                  <input
                    type="date"
                    className="input-text"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              {!editingSubject && (
                <div>
                  <label className="form-label">
                    Initial Chapters / Modules (One per line)
                  </label>
                  <textarea
                    className="input-textarea"
                    rows={4}
                    placeholder="Chapter 1: Foundations&#10;Chapter 2: Core Principles&#10;Chapter 3: Advanced Applications&#10;Chapter 4: Practice Problems"
                    value={initialChaptersText}
                    onChange={(e) => setInitialChaptersText(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="form-label">Notes & Syllabus Objective</label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  placeholder="e.g. Target score: 95%, covers chapters 1-12 of textbook"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Color Accent</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsNewSubjectOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSubject ? 'Save Changes' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
