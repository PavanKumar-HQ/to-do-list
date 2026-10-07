import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame,
  Sunrise,
  Sun,
  Moon,
  PiggyBank,
  GraduationCap,
  Calendar,
  Activity,
  Check
} from 'lucide-react';
import { db } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';

export const GrowthDashboardAnalytics: React.FC = () => {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; habits: string[] } | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '28d'>('28d');

  const habits = useLiveQuery(async () => {
    return db.habits.filter((h) => !h.deletedAt).toArray();
  }, []) || [];

  const tasks = useLiveQuery(async () => {
    return db.tasks.filter((t) => !t.deletedAt).toArray();
  }, []) || [];

  const savingsGoals = useLiveQuery(async () => {
    return db.savingsGoals.filter((g) => !g.deletedAt).toArray();
  }, []) || [];

  const studySubjects = useLiveQuery(async () => {
    return db.studySubjects.filter((s) => !s.deletedAt).toArray();
  }, []) || [];

  const todayStr = getTodayDateString();

  // 1. Compute 28-day Habit Consistency Heatmap
  const daysCount = selectedTimeRange === '7d' ? 7 : 28;
  const heatmapDays = Array.from({ length: daysCount }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysCount - 1 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNum = d.getDate();

    // Habits completed on this date
    const completedHabits = habits.filter((h) => h.completedDates.includes(dateStr));
    const count = completedHabits.length;
    const ratio = habits.length > 0 ? count / habits.length : 0;

    return {
      dateStr,
      dayName,
      dayNum,
      count,
      ratio,
      habitNames: completedHabits.map((h) => h.name),
      isToday: dateStr === todayStr
    };
  });

  // 2. Daily Planner Time-Block Metrics (strictly tasks assigned to time blocks)
  const morningTasks = tasks.filter((t) => t.timeBlock === 'morning');
  const afternoonTasks = tasks.filter((t) => t.timeBlock === 'afternoon');
  const eveningTasks = tasks.filter((t) => t.timeBlock === 'evening');

  const morningDone = morningTasks.filter((t) => t.status === 'completed').length;
  const afternoonDone = afternoonTasks.filter((t) => t.status === 'completed').length;
  const eveningDone = eveningTasks.filter((t) => t.status === 'completed').length;

  const p1Tasks = tasks.filter((t) => t.priorityCode === 'P1');
  const p2Tasks = tasks.filter((t) => t.priorityCode === 'P2');
  const p3Tasks = tasks.filter((t) => t.priorityCode === 'P3');

  const p1Done = p1Tasks.filter((t) => t.status === 'completed').length;
  const p2Done = p2Tasks.filter((t) => t.status === 'completed').length;
  const p3Done = p3Tasks.filter((t) => t.status === 'completed').length;

  // 3. Savings Goal Aggregates
  const totalTargetMinor = savingsGoals.reduce((sum, g) => sum + g.targetAmountMinor, 0);
  const totalSavedMinor = savingsGoals.reduce((sum, g) => sum + g.currentAmountMinor, 0);
  const overallSavingsPercent = totalTargetMinor > 0 ? Math.min(100, Math.round((totalSavedMinor / totalTargetMinor) * 100)) : 0;

  // 4. Study Syllabus Aggregates
  const totalChapters = studySubjects.reduce((sum, s) => sum + s.chapters.length, 0);
  const completedChapters = studySubjects.reduce(
    (sum, s) => sum + s.chapters.filter((c) => c.completed).length,
    0
  );
  const overallStudyPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  const activeStreaksCount = habits.filter((h) => h.streak > 0).length;
  const totalStreaksDays = habits.reduce((sum, h) => sum + h.streak, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* KPI Highlight Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {/* Habit Streak Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Habit Streaks</span>
            <Flame size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalStreaksDays} <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>days</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activeStreaksCount} of {habits.length} habits with active streaks
          </div>
        </div>

        {/* Daily Planner Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tasks Execution</span>
            <Activity size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {p1Done + p2Done + p3Done}{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {tasks.length}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {p1Done} of {p1Tasks.length} P1 priorities done
          </div>
        </div>

        {/* Savings Goal Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Savings Progress</span>
            <PiggyBank size={18} style={{ color: '#10b981', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{(totalSavedMinor / 100).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {overallSavingsPercent}% of ₹{(totalTargetMinor / 100).toLocaleString('en-IN')} target
          </div>
        </div>

        {/* Study Planner Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Syllabus Mastery</span>
            <GraduationCap size={18} style={{ color: '#8b5cf6', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {overallStudyPercent}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {completedChapters} of {totalChapters} chapters across {studySubjects.length} subjects
          </div>
        </div>
      </div>

      {/* 1. Habit Consistency & Streak Heatmap Matrix */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Habit Consistency Punchcard Heatmap
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Activity density & streaks across recent weeks
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSelectedTimeRange('7d')}
              className={`btn btn-sm ${selectedTimeRange === '7d' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedTimeRange('28d')}
              className={`btn btn-sm ${selectedTimeRange === '28d' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}
            >
              28 Days (4 Weeks)
            </button>
          </div>
        </div>

        {/* 7-Column Responsive Grid with zero horizontal overflow */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '8px',
            padding: '12px 0',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {heatmapDays.map((day) => {
            let bg = 'var(--bg-surface-elevated)';
            let border = 'var(--border-subtle)';

            if (day.count > 0) {
              if (day.ratio >= 0.75) {
                bg = 'rgba(16, 185, 129, 0.9)';
                border = '#10b981';
              } else if (day.ratio >= 0.4) {
                bg = 'rgba(16, 185, 129, 0.55)';
                border = '#10b981';
              } else {
                bg = 'rgba(16, 185, 129, 0.25)';
                border = 'rgba(16, 185, 129, 0.4)';
              }
            }

            return (
              <div
                key={day.dateStr}
                onMouseEnter={() => setHoveredDay({ date: day.dateStr, count: day.count, habits: day.habitNames })}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  height: '46px',
                  borderRadius: '8px',
                  background: bg,
                  border: day.isToday ? '2px solid var(--accent)' : `1px solid ${border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: day.count > 0 ? (day.ratio >= 0.4 ? '#ffffff' : 'var(--text-primary)') : 'var(--text-muted)'
                  }}
                >
                  {day.dayNum}
                </span>
                {day.count > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: day.ratio >= 0.4 ? '#ffffff' : 'var(--text-primary)'
                    }}
                  >
                    <span>{day.count}</span>
                    <Check size={9} strokeWidth={3} style={{ flexShrink: 0 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hovered Day Details or Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
          {hoveredDay ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
              <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span>
                {formatDisplayDate(hoveredDay.date)}:{' '}
                <strong style={{ color: 'var(--accent)' }}>{hoveredDay.count} habits completed</strong>{' '}
                {hoveredDay.habits.length > 0 && `(${hoveredDay.habits.join(', ')})`}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Hover over any square to inspect completed habits
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Less</span>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--bg-surface-elevated)' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.25)' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.55)' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.9)' }} />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* 2 & 3: Daily Planner Workload & Savings Gauges Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Daily Time Block Allocation */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Daily Planner Time-Block Distribution
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Energy allocation across Morning, Afternoon & Evening
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Morning Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sunrise size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  Morning Focus (06:00-12:00)
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {morningDone}/{morningTasks.length} Done ({morningTasks.length > 0 ? Math.round((morningDone / morningTasks.length) * 100) : 0}%)
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${morningTasks.length > 0 ? (morningDone / morningTasks.length) * 100 : 0}%`,
                    background: '#f59e0b',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            {/* Afternoon Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sun size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  Afternoon Flow (12:00-17:00)
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {afternoonDone}/{afternoonTasks.length} Done ({afternoonTasks.length > 0 ? Math.round((afternoonDone / afternoonTasks.length) * 100) : 0}%)
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${afternoonTasks.length > 0 ? (afternoonDone / afternoonTasks.length) * 100 : 0}%`,
                    background: '#3b82f6',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            {/* Evening Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Moon size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  Evening Wind-down (17:00-22:00)
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {eveningDone}/{eveningTasks.length} Done ({eveningTasks.length > 0 ? Math.round((eveningDone / eveningTasks.length) * 100) : 0}%)
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${eveningTasks.length > 0 ? (eveningDone / eveningTasks.length) * 100 : 0}%`,
                    background: '#8b5cf6',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Savings Goal Radial Gauges */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PiggyBank size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Savings Goal Radial Gauges
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Target completion & monthly trajectory
              </p>
            </div>
          </div>

          {savingsGoals.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
              No savings goals created yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {savingsGoals.slice(0, 3).map((goal) => {
                const current = goal.currentAmountMinor / 100;
                const target = goal.targetAmountMinor / 100;
                const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

                return (
                  <div
                    key={goal.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {/* SVG Mini Radial Gauge */}
                    <div style={{ position: 'relative', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="42" height="42" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="var(--bg-surface)"
                          strokeWidth="3.8"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3.8"
                          strokeDasharray={`${percent}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span style={{ position: 'absolute', fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {percent}%
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {goal.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        ₹{current.toLocaleString('en-IN')} of ₹{target.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Study Syllabus Mastery Matrix */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <GraduationCap size={18} style={{ color: '#8b5cf6', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Study Syllabus Mastery Matrix
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Subject-wise chapter completion & deadlines
            </p>
          </div>
        </div>

        {studySubjects.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
            No study subjects added yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {studySubjects.map((sub) => {
              const comp = sub.chapters.filter((c) => c.completed).length;
              const tot = sub.chapters.length;
              const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;

              return (
                <div
                  key={sub.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {sub.title}
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: sub.color || '#3b82f6',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {comp} of {tot} chapters completed • {sub.category || 'General'}
                  </div>

                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: sub.color || '#3b82f6',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
