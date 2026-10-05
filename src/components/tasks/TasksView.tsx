import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckSquare,
  Plus,
  Calendar,
  AlertCircle,
  Inbox,
  Clock,
  Trash2,
  Edit2,
  Repeat,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Network,
  Target
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getTodayDateString, getRelativeDateLabel, calculateNextOccurrence } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import type { TaskItem, TaskStatus, Priority, RecurrenceType, Subtask, EntityType } from '../../types';

export const TasksView: React.FC<{ onOpenQuickAdd: (type: any) => void }> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'overdue' | 'inbox' | 'all' | 'completed'>('today');
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const goals = useLiveQuery(() => db.goals.filter(g => !g.deletedAt).toArray()) || [];
  const goalMap = useMemo(() => new Map(goals.map(g => [g.id, g])), [goals]);

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Tasks live query
  const allTasks = useLiveQuery(async () => {
    return db.tasks.filter((t) => !t.deletedAt).toArray();
  }, []) || [];

  // Filter tasks based on activeTab
  const filteredTasks = allTasks.filter((t) => {
    if (activeTab === 'completed') return t.status === 'completed';
    if (t.status === 'completed' || t.status === 'archived') return false;

    if (activeTab === 'inbox') return t.status === 'inbox' || !t.dueDate;
    if (activeTab === 'today') return t.dueDate === todayStr;
    if (activeTab === 'upcoming') return !!t.dueDate && t.dueDate > todayStr;
    if (activeTab === 'overdue') return !!t.dueDate && t.dueDate < todayStr;
    if (activeTab === 'all') return true;

    return true;
  });

  // Toggle completion
  const handleToggleComplete = async (task: TaskItem) => {
    const isNowCompleted = task.status !== 'completed';
    const nowIso = new Date().toISOString();

    if (isNowCompleted && task.recurrence && task.recurrence !== 'none') {
      // Recurring task: complete current, generate next occurrence
      const nextDate = calculateNextOccurrence(task.dueDate || todayStr, task.recurrence);
      await db.tasks.update(task.id, {
        status: 'completed',
        completedAt: nowIso,
        updatedAt: nowIso
      });

      const nextTask: TaskItem = {
        ...task,
        id: generateId(),
        status: 'todo',
        dueDate: nextDate,
        subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
        createdAt: nowIso,
        updatedAt: nowIso,
        completedAt: undefined
      };
      await db.tasks.add(nextTask);
      await logAudit('complete', 'task', task.id, `Completed recurring task and scheduled next for ${nextDate}`);

      showToast(`Recurring task completed. Next scheduled for ${nextDate}`);
      return;
    }

    // Normal non-recurring task
    await db.tasks.update(task.id, {
      status: isNowCompleted ? 'completed' : 'todo',
      completedAt: isNowCompleted ? nowIso : undefined,
      updatedAt: nowIso
    });

    await logAudit(
      isNowCompleted ? 'complete' : 'update',
      'task',
      task.id,
      `${isNowCompleted ? 'Completed' : 'Reopened'} task: ${task.title}`
    );

    if (isNowCompleted) {
      showToast('Task marked as completed', {
        actionLabel: 'Undo',
        onAction: async () => {
          await db.tasks.update(task.id, {
            status: 'todo',
            completedAt: undefined,
            updatedAt: new Date().toISOString()
          });
          await logAudit('update', 'task', task.id, `Undid task completion: ${task.title}`);
        }
      });
    }
  };

  // Safe delete (moves to trash)
  const handleDeleteTask = async (id: string, title: string) => {
    await db.tasks.update(id, { deletedAt: new Date().toISOString() });
    await logAudit('delete', 'task', id, `Moved task to trash: ${title}`);
    showToast('Task moved to trash', {
      actionLabel: 'Undo',
      onAction: async () => {
        await db.tasks.update(id, { deletedAt: undefined });
        await logAudit('restore', 'task', id, `Restored task from trash: ${title}`);
      }
    });
  };

  // Toggle subtask
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    await db.tasks.update(taskId, {
      subtasks: updatedSubtasks,
      updatedAt: new Date().toISOString()
    });
  };

  // Save edit modal
  const handleSaveEdit = async () => {
    if (!editingTask) return;
    await db.tasks.update(editingTask.id, {
      ...editingTask,
      updatedAt: new Date().toISOString()
    });
    await logAudit('update', 'task', editingTask.id, `Updated task: ${editingTask.title}`);
    showToast('Task updated', { type: 'success' });
    setEditingTask(null);
  };

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Done' }
  ];

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
          {allTasks.filter(t => t.status !== 'completed').length} active tasks
        </div>
        <button
          onClick={() => onOpenQuickAdd('task')}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '16px',
          scrollbarWidth: 'none'
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px', flexShrink: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTasks.length === 0 ? (
          <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
            <CheckSquare size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
              Nothing waiting for you.
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {activeTab === 'today'
                ? 'You have completed everything scheduled for today.'
                : activeTab === 'overdue'
                ? 'No overdue tasks. You are right on schedule!'
                : 'No tasks found in this view.'}
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const dateMeta = getRelativeDateLabel(task.dueDate, task.dueTime);
            const isCompleted = task.status === 'completed';
            const hasSubtasks = task.subtasks && task.subtasks.length > 0;
            const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
            const isExpanded = !!expandedSubtasks[task.id];

            return (
              <div
                key={task.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px 14px',
                  borderLeft: task.priority === 'high' ? '4px solid var(--danger)' : undefined,
                  opacity: isCompleted ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div
                    className={`checkbox-custom ${isCompleted ? 'checked' : ''}`}
                    onClick={() => handleToggleComplete(task)}
                    role="checkbox"
                    aria-checked={isCompleted}
                    style={{ marginTop: '2px' }}
                    title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
                  >
                    {isCompleted && <CheckCircle size={14} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        textDecoration: isCompleted ? 'line-through' : 'none'
                      }}
                    >
                      {task.title}
                    </div>

                    {task.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {task.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {task.dueDate && (
                        <span
                          className={`badge ${dateMeta.isOverdue ? 'badge-danger' : dateMeta.isToday ? 'badge-accent' : 'badge-neutral'}`}
                          style={{ fontSize: '11px' }}
                        >
                          <Clock size={11} />
                          {dateMeta.label}
                        </span>
                      )}

                      {task.recurrence && task.recurrence !== 'none' && (
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                          <Repeat size={11} />
                          {task.recurrence}
                        </span>
                      )}

                      {task.category && task.category !== 'General' && (
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                          {task.category}
                        </span>
                      )}

                      {task.goalId && goalMap.get(task.goalId) && (
                        <span className="badge badge-accent" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Target size={11} />
                          <span>{goalMap.get(task.goalId)!.title}</span>
                        </span>
                      )}

                      {hasSubtasks && (
                        <button
                          onClick={() => setExpandedSubtasks((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                          style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <span>{completedSubtasks}/{task.subtasks.length} subtasks</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'task', id: task.id })}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                      title="View Life Context"
                    >
                      <Network size={14} />
                    </button>
                    <button
                      onClick={() => setEditingTask(task)}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Edit task"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}
                      title="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Subtask list view */}
                {hasSubtasks && isExpanded && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '34px' }}>
                    {task.subtasks.map((st) => (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          className={`checkbox-custom ${st.completed ? 'checked' : ''}`}
                          style={{ width: '18px', height: '18px' }}
                          onClick={() => handleToggleSubtask(task.id, st.id)}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', textDecoration: st.completed ? 'line-through' : 'none' }}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Title
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingTask.dueDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={editingTask.dueTime || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueTime: e.target.value || undefined })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditingTask({ ...editingTask, priority: p })}
                      className={`btn btn-sm ${editingTask.priority === p ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, textTransform: 'capitalize' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Recurrence
                </label>
                <select
                  value={editingTask.recurrence || 'none'}
                  onChange={(e) => setEditingTask({ ...editingTask, recurrence: e.target.value as any })}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Linked Goal
                </label>
                <select
                  value={editingTask.goalId || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, goalId: e.target.value || undefined })}
                >
                  <option value="">No goal linked (Standalone)</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      🎯 {g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subtasks Editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Subtasks ({editingTask.subtasks?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newSubtask: Subtask = { id: generateId(), title: 'New subtask', completed: false };
                      setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), newSubtask] });
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', padding: '4px 10px', gap: '4px' }}
                  >
                    + Add Step
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {editingTask.subtasks?.map((st, idx) => (
                    <div key={st.id} style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => {
                          const updated = [...editingTask.subtasks];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setEditingTask({ ...editingTask, subtasks: updated });
                        }}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingTask.subtasks.filter((_, i) => i !== idx);
                          setEditingTask({ ...editingTask, subtasks: updated });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)', padding: '6px 8px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                Save Changes
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
