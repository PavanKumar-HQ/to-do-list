import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame,
  Trophy,
  Plus,
  Check,
  CheckCircle2,
  Calendar,
  Sparkles,
  Trash2,
  Edit2,
  Clock,
  Tag,
  Filter,
  TrendingUp,
  X
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { HabitItem, HabitCategory } from '../../types';

const CATEGORY_CONFIG: Record<HabitCategory, { label: string; color: string; bg: string }> = {
  health: { label: 'Health', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  fitness: { label: 'Fitness', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  learning: { label: 'Learning', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  mind: { label: 'Mind & Calm', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  routine: { label: 'Routine', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  career: { label: 'Career', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' }
};

export const HabitTrackerTab: React.FC = () => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(7);
  const [reminderTime, setReminderTime] = useState('');
  const [color, setColor] = useState('#10b981');

  const habits = useLiveQuery(async () => {
    return db.habits.filter((h) => !h.deletedAt).toArray();
  }, []) || [];

  const todayStr = getTodayDateString();

  // Generate last 7 days list (YYYY-MM-DD)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNumber = d.getDate();
    return { dateStr, dayName, dayNumber, isToday: dateStr === todayStr };
  });

  const handleOpenAdd = () => {
    setEditingHabit(null);
    setName('');
    setCategory('health');
    setTargetDaysPerWeek(7);
    setReminderTime('');
    setColor('#10b981');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (habit: HabitItem) => {
    setEditingHabit(habit);
    setName(habit.name);
    setCategory(habit.category);
    setTargetDaysPerWeek(habit.targetDaysPerWeek || 7);
    setReminderTime(habit.reminderTime || '');
    setColor(habit.color || '#10b981');
    setIsModalOpen(true);
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a habit name', { type: 'warning' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (editingHabit) {
      await db.habits.update(editingHabit.id, {
        name: name.trim(),
        category,
        targetDaysPerWeek,
        reminderTime: reminderTime || undefined,
        color,
        updatedAt: nowIso
      });
      await logAudit('update', 'habit' as any, editingHabit.id, `Updated habit: ${name.trim()}`);
      showToast(`Habit updated: ${name.trim()}`, { type: 'success' });
    } else {
      const newHabit: HabitItem = {
        id: generateId(),
        name: name.trim(),
        category,
        color,
        streak: 0,
        bestStreak: 0,
        completedDates: [],
        targetDaysPerWeek,
        reminderTime: reminderTime || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await db.habits.add(newHabit);
      await logAudit('create', 'habit' as any, newHabit.id, `Created habit: ${name.trim()}`);
      showToast(`Habit created: ${name.trim()}`, { type: 'success' });
    }

    setIsModalOpen(false);
  };

  // Toggle completion for a specific date and recalculate streaks accurately
  const handleToggleDay = async (habit: HabitItem, dateStr: string) => {
    const isCompleted = habit.completedDates.includes(dateStr);
    let updatedDates: string[];

    if (isCompleted) {
      updatedDates = habit.completedDates.filter((d) => d !== dateStr);
    } else {
      updatedDates = [...habit.completedDates, dateStr].sort();
    }

    // Calculate active streak
    const dateSet = new Set(updatedDates);
    let currentStreak = 0;
    const checkDate = new Date();

    // Check today or yesterday as start of active streak
    const today = getTodayDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    let cursor = dateSet.has(today) ? new Date() : (dateSet.has(yesterday) ? yesterdayDate : null);

    if (cursor) {
      while (true) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const str = `${y}-${m}-${d}`;
        if (dateSet.has(str)) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const newBestStreak = Math.max(habit.bestStreak || 0, currentStreak);

    await db.habits.update(habit.id, {
      completedDates: updatedDates,
      streak: currentStreak,
      bestStreak: newBestStreak,
      updatedAt: new Date().toISOString()
    });

    if (!isCompleted && dateStr === todayStr) {
      showToast(`Completed "${habit.name}" today! Streak: ${currentStreak} days`, { type: 'success' });
    }
  };

  const handleDeleteHabit = async (habit: HabitItem) => {
    if (confirm(`Delete habit "${habit.name}"?`)) {
      await db.habits.update(habit.id, { deletedAt: new Date().toISOString() });
      await logAudit('delete', 'habit' as any, habit.id, `Deleted habit: ${habit.name}`);
      showToast(`Habit deleted`, { type: 'info' });
    }
  };

  const filteredHabits = habits.filter((h) => {
    if (filterCategory === 'all') return true;
    return h.category === filterCategory;
  });

  const totalCompletedToday = habits.filter((h) => h.completedDates.includes(todayStr)).length;
  const habitCompletionRate = habits.length > 0 ? Math.round((totalCompletedToday / habits.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner with Today's Streak Summary */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
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
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Flame size={24} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Habit Tracker & Streaks
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {totalCompletedToday} of {habits.length} habits done today ({habitCompletionRate}%)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            <Plus size={16} />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setFilterCategory('all')}
          className={`btn btn-sm ${filterCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '5px 14px', fontSize: '12px' }}
        >
          All ({habits.length})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as HabitCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = habits.filter((h) => h.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`btn btn-sm ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '5px 14px', fontSize: '12px', gap: '6px' }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color }} />
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Habits List */}
      {filteredHabits.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          <Flame size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No habits found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '360px', margin: '4px auto 16px' }}>
            Build momentum one day at a time with simple daily streaks.
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            <Plus size={15} />
            <span>Create First Habit</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
          {filteredHabits.map((habit) => {
            const isDoneToday = habit.completedDates.includes(todayStr);
            const catCfg = CATEGORY_CONFIG[habit.category] || CATEGORY_CONFIG.routine;

            return (
              <div
                key={habit.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: isDoneToday ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  transition: 'border-color 0.2s ease'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: catCfg.bg,
                          color: catCfg.color
                        }}
                      >
                        {catCfg.label}
                      </span>
                      {habit.reminderTime && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} />
                          {habit.reminderTime}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {habit.name}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleOpenEdit(habit)}
                      className="btn-ghost btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      title="Edit Habit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteHabit(habit)}
                      className="btn-ghost btn-icon"
                      style={{ width: '28px', height: '28px', color: 'var(--danger)' }}
                      title="Delete Habit"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Streak Indicators */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: habit.streak > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface-elevated)',
                      color: habit.streak > 0 ? '#ef4444' : 'var(--text-muted)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    <Flame size={15} />
                    <span>{habit.streak} day streak</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    <Trophy size={13} style={{ color: '#f59e0b' }} />
                    <span>Best: {habit.bestStreak || 0}d</span>
                  </div>
                </div>

                {/* 7-Day Interactive Punchcard */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    Past 7 Days
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                    {last7Days.map((day) => {
                      const completed = habit.completedDates.includes(day.dateStr);
                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => handleToggleDay(habit, day.dateStr)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 2px',
                            borderRadius: '8px',
                            border: day.isToday ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: completed
                              ? (habit.color || '#10b981')
                              : day.isToday
                              ? 'var(--accent-light)'
                              : 'var(--bg-surface-elevated)',
                            color: completed ? '#ffffff' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={`${day.dateStr} - ${completed ? 'Completed' : 'Click to toggle'}`}
                        >
                          <span style={{ fontSize: '10px', fontWeight: 600, opacity: completed ? 0.9 : 0.7 }}>
                            {day.dayName}
                          </span>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: completed ? 'rgba(255,255,255,0.25)' : 'transparent'
                            }}
                          >
                            {completed ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 500 }}>{day.dayNumber}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Toggle Button for Today */}
                <button
                  onClick={() => handleToggleDay(habit, todayStr)}
                  className={`btn btn-sm ${isDoneToday ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%', gap: '6px', marginTop: '4px' }}
                >
                  {isDoneToday ? (
                    <>
                      <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                      <span>Completed Today • Keep it up!</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Mark Done for Today</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Habit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {editingHabit ? 'Edit Habit' : 'New Streak Habit'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHabit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Habit Name *</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g., Morning Meditation, Drink 3L Water, Read 20 mins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setCategory(e.target.value as HabitCategory)}
                  >
                    <option value="health">Health & Nutrition</option>
                    <option value="fitness">Fitness & Movement</option>
                    <option value="learning">Learning & Skill</option>
                    <option value="mind">Mindfulness & Calm</option>
                    <option value="routine">Daily Routine</option>
                    <option value="career">Work & Career</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Target Days/Week</label>
                  <select
                    className="input-select"
                    value={targetDaysPerWeek}
                    onChange={(e) => setTargetDaysPerWeek(parseInt(e.target.value, 10))}
                  >
                    <option value={7}>Every day (7 days)</option>
                    <option value={5}>Weekdays (5 days)</option>
                    <option value={4}>4 days / week</option>
                    <option value={3}>3 days / week</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Daily Reminder Time (Optional)</label>
                <input
                  type="time"
                  className="input-text"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Color Accent</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'].map((c) => (
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingHabit ? 'Save Changes' : 'Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
