import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sun,
  Sunrise,
  Moon,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowRight,
  Tag,
  AlertCircle,
  Timer
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { TaskItem } from '../../types';

type TimeBlock = 'morning' | 'afternoon' | 'evening';

const TIME_BLOCK_META: Record<TimeBlock, { title: string; subtitle: string; icon: any; color: string; bg: string; border: string }> = {
  morning: {
    title: 'Morning Focus',
    subtitle: '06:00 - 12:00 • Deep work & critical priorities',
    icon: Sunrise,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.06)',
    border: 'rgba(245, 158, 11, 0.2)'
  },
  afternoon: {
    title: 'Afternoon Flow',
    subtitle: '12:00 - 17:00 • Execution, meetings & collaborative tasks',
    icon: Sun,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.06)',
    border: 'rgba(59, 130, 246, 0.2)'
  },
  evening: {
    title: 'Evening Wind-down',
    subtitle: '17:00 - 22:00 • Reviews, planning, reading & recharge',
    icon: Moon,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.06)',
    border: 'rgba(139, 92, 246, 0.2)'
  }
};

const PRIORITY_BADGES: Record<'P1' | 'P2' | 'P3', { label: string; color: string; bg: string; border: string }> = {
  P1: { label: 'P1 • Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
  P2: { label: 'P2 • High', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  P3: { label: 'P3 • Normal', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' }
};

export const DailyPlannerTab: React.FC = () => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [activeTimerMode, setActiveTimerMode] = useState<'focus' | 'break'>('focus');
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Quick Add State inside block
  const [activeAddBlock, setActiveAddBlock] = useState<TimeBlock | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'P1' | 'P2' | 'P3'>('P1');
  const [newTaskTime, setNewTaskTime] = useState('');

  // Pomodoro timer effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSecondsLeft > 0) {
      interval = setInterval(() => {
        setTimerSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerSecondsLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (activeTimerMode === 'focus') {
        showToast('🎉 Focus session completed! Time for a 5-minute break.', { type: 'success' });
        setActiveTimerMode('break');
        setTimerSecondsLeft(5 * 60);
      } else {
        showToast('⚡ Break over! Ready for the next focus sprint?', { type: 'info' });
        setActiveTimerMode('focus');
        setTimerSecondsLeft(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsLeft, activeTimerMode]);

  // Query tasks for the selected date
  const tasks = useLiveQuery(async () => {
    return db.tasks
      .filter((t) => !t.deletedAt && (!t.dueDate || t.dueDate === selectedDate))
      .toArray();
  }, [selectedDate]) || [];

  const handleToggleTask = async (task: TaskItem) => {
    const isCompleted = task.status === 'completed';
    const nextStatus = isCompleted ? 'todo' : 'completed';
    const nowIso = new Date().toISOString();

    await db.tasks.update(task.id, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? nowIso : undefined,
      updatedAt: nowIso
    });

    if (nextStatus === 'completed') {
      showToast(`Completed: ${task.title} ✨`, { type: 'success' });
    }
  };

  const handleMoveBlock = async (task: TaskItem, nextBlock: TimeBlock) => {
    await db.tasks.update(task.id, {
      timeBlock: nextBlock,
      updatedAt: new Date().toISOString()
    });
    showToast(`Moved to ${TIME_BLOCK_META[nextBlock].title}`, { type: 'info' });
  };

  const handleAddTaskToBlock = async (block: TimeBlock) => {
    if (!newTaskTitle.trim()) return;

    const nowIso = new Date().toISOString();
    const newTask: TaskItem = {
      id: generateId(),
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: newTaskPriority === 'P1' ? 'high' : newTaskPriority === 'P2' ? 'medium' : 'low',
      priorityCode: newTaskPriority,
      timeBlock: block,
      dueDate: selectedDate,
      dueTime: newTaskTime || undefined,
      recurrence: 'none',
      subtasks: [],
      tags: ['daily-plan'],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.tasks.add(newTask);
    await logAudit('create', 'task', newTask.id, `Created planner task: ${newTask.title}`);
    showToast(`Added to ${TIME_BLOCK_META[block].title}`, { type: 'success' });

    setNewTaskTitle('');
    setNewTaskTime('');
    setActiveAddBlock(null);
  };

  const handleDateChangeBy = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-${newD}`);
  };

  const isToday = selectedDate === getTodayDateString();

  // Distribute tasks into time blocks (or default morning/unassigned)
  const morningTasks = tasks.filter((t) => t.timeBlock === 'morning' || (!t.timeBlock && t.priority === 'high'));
  const afternoonTasks = tasks.filter((t) => t.timeBlock === 'afternoon' || (!t.timeBlock && t.priority === 'medium'));
  const eveningTasks = tasks.filter((t) => t.timeBlock === 'evening' || (!t.timeBlock && t.priority === 'low'));

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Date Navigator Bar & Focus Timer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '16px',
          alignItems: 'center',
          background: 'var(--bg-surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => handleDateChangeBy(-1)} className="btn-ghost btn-icon" title="Previous Day">
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 6px' }}>
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatDisplayDate(selectedDate)}
              </span>
              {isToday && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)'
                  }}
                >
                  Today
                </span>
              )}
            </div>
            <button onClick={() => handleDateChangeBy(1)} className="btn-ghost btn-icon" title="Next Day">
              <ChevronRight size={18} />
            </button>
          </div>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', borderRadius: 'var(--radius-full)' }}
            >
              Jump to Today
            </button>
          )}

          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {completedTasks}/{totalTasks} Completed ({completionPercentage}%)
          </div>
        </div>

        {/* Integrated Pomodoro Focus Timer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTimerMode === 'focus' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: activeTimerMode === 'focus' ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)'
          }}
        >
          <Timer size={16} style={{ color: activeTimerMode === 'focus' ? '#3b82f6' : '#10b981' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeTimerMode === 'focus' ? 'Focus' : 'Break'}:
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            {formatTimer(timerSecondsLeft)}
          </div>
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="btn-ghost btn-icon"
            style={{ width: '26px', height: '26px', color: isTimerRunning ? '#ef4444' : 'var(--accent)' }}
            title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
          >
            {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={() => {
              setIsTimerRunning(false);
              setTimerSecondsLeft(activeTimerMode === 'focus' ? 25 * 60 : 5 * 60);
            }}
            className="btn-ghost btn-icon"
            style={{ width: '26px', height: '26px' }}
            title="Reset Timer"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* 3 Interactive Time Blocks (Morning Focus, Afternoon Flow, Evening Wind-down) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {(['morning', 'afternoon', 'evening'] as TimeBlock[]).map((blockKey) => {
          const meta = TIME_BLOCK_META[blockKey];
          const Icon = meta.icon;
          const blockTasks =
            blockKey === 'morning' ? morningTasks : blockKey === 'afternoon' ? afternoonTasks : eveningTasks;
          const isAdding = activeAddBlock === blockKey;

          return (
            <div
              key={blockKey}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${meta.border}`,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden'
              }}
            >
              {/* Block Header */}
              <div
                style={{
                  background: meta.bg,
                  padding: '14px 16px',
                  borderBottom: `1px solid ${meta.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: meta.color,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {meta.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {meta.subtitle}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveAddBlock(isAdding ? null : blockKey);
                    setNewTaskPriority(blockKey === 'morning' ? 'P1' : blockKey === 'afternoon' ? 'P2' : 'P3');
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ gap: '4px', borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: '12px' }}
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>

              {/* Inline Quick Add Task Form */}
              {isAdding && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--bg-surface-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <input
                    type="text"
                    className="input-text"
                    placeholder={`Add task to ${meta.title}...`}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTaskToBlock(blockKey);
                    }}
                    autoFocus
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['P1', 'P2', 'P3'] as Array<'P1' | 'P2' | 'P3'>).map((p) => {
                        const isSelected = newTaskPriority === p;
                        const pCfg = PRIORITY_BADGES[p];
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewTaskPriority(p)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              border: isSelected ? `1.5px solid ${pCfg.color}` : '1px solid var(--border-subtle)',
                              background: isSelected ? pCfg.bg : 'transparent',
                              color: isSelected ? pCfg.color : 'var(--text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="time"
                        className="input-text"
                        style={{ padding: '2px 6px', fontSize: '12px', width: '100px' }}
                        value={newTaskTime}
                        onChange={(e) => setNewTaskTime(e.target.value)}
                      />
                      <button
                        onClick={() => handleAddTaskToBlock(blockKey)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '3px 10px', fontSize: '12px' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {blockTasks.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 12px',
                      color: 'var(--text-muted)',
                      fontSize: '12.5px',
                      fontStyle: 'italic'
                    }}
                  >
                    No tasks planned for this block.
                  </div>
                ) : (
                  blockTasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const priorityCode = (task.priorityCode || (task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3')) as 'P1' | 'P2' | 'P3';
                    const pCfg = PRIORITY_BADGES[priorityCode] || PRIORITY_BADGES.P3;

                    return (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: isCompleted ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          opacity: isCompleted ? 0.65 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                          <button
                            onClick={() => handleToggleTask(task)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: isCompleted ? '#10b981' : 'var(--text-muted)',
                              marginTop: '2px'
                            }}
                          >
                            {isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </button>

                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                textDecoration: isCompleted ? 'line-through' : 'none'
                              }}
                            >
                              {task.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: pCfg.bg,
                                  color: pCfg.color,
                                  border: `1px solid ${pCfg.border}`
                                }}
                              >
                                {pCfg.label}
                              </span>
                              {task.dueTime && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={11} />
                                  {task.dueTime}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Move Time Block Action */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {blockKey !== 'morning' && (
                            <button
                              onClick={() => handleMoveBlock(task, 'morning')}
                              className="btn-ghost btn-icon"
                              style={{ width: '24px', height: '24px', fontSize: '10px' }}
                              title="Move to Morning Focus"
                            >
                              🌅
                            </button>
                          )}
                          {blockKey !== 'afternoon' && (
                            <button
                              onClick={() => handleMoveBlock(task, 'afternoon')}
                              className="btn-ghost btn-icon"
                              style={{ width: '24px', height: '24px', fontSize: '10px' }}
                              title="Move to Afternoon Flow"
                            >
                              ☀️
                            </button>
                          )}
                          {blockKey !== 'evening' && (
                            <button
                              onClick={() => handleMoveBlock(task, 'evening')}
                              className="btn-ghost btn-icon"
                              style={{ width: '24px', height: '24px', fontSize: '10px' }}
                              title="Move to Evening Wind-down"
                            >
                              🌙
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
