import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckSquare,
  Bell,
  Clock,
  Wallet,
  UserCheck,
  Network,
  GripVertical
} from 'lucide-react';
import { db } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { ContextModal } from '../common/ContextModal';
import { eventBus } from '../../services/eventBus';
import type { EntityType } from '../../types';

export const CalendarView: React.FC = () => {
  const todayStr = getTodayDateString();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Dragging state (transient local state - ZERO DB writes during drag)
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: 'task' | 'event'; title: string } | null>(null);
  const [dropHoverDate, setDropHoverDate] = useState<string | null>(null);

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Current calendar year/month
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-11

  // Targeted query: only query items for current visible month prefix
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const tasks = useLiveQuery(async () => {
    return db.tasks
      .filter((t) => !t.deletedAt && !!t.dueDate && t.dueDate.startsWith(monthPrefix))
      .toArray();
  }, [monthPrefix]) || [];

  const events = useLiveQuery(async () => {
    return db.events
      .filter((e) => !e.deletedAt && e.date.startsWith(monthPrefix))
      .toArray();
  }, [monthPrefix]) || [];

  const reminders = useLiveQuery(async () => {
    return db.reminders
      .filter((r) => !r.deletedAt && r.date.startsWith(monthPrefix))
      .toArray();
  }, [monthPrefix]) || [];

  const recurringPayments = useLiveQuery(async () => {
    return db.recurringExpenses
      .filter((r) => !r.deletedAt && r.isActive && r.nextDueDate.startsWith(monthPrefix))
      .toArray();
  }, [monthPrefix]) || [];

  const followups = useLiveQuery(async () => {
    return db.followups
      .filter((f) => !f.deletedAt && !!f.dueDate && f.dueDate.startsWith(monthPrefix))
      .toArray();
  }, [monthPrefix]) || [];

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Day navigation for Day view
  const shiftDay = (deltaDays: number) => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + deltaDays);
      const nextDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setSelectedDate(nextDateStr);
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
        setCurrentMonth(d.getMonth());
        setCurrentYear(d.getFullYear());
      }
    }
  };

  // Drag & drop commit (committed ONCE on drop in a single transaction)
  const handleItemDropOnDate = async (targetDate: string) => {
    if (!draggingItem) return;
    try {
      if (draggingItem.type === 'task') {
        await db.tasks.update(draggingItem.id, {
          dueDate: targetDate,
          updatedAt: new Date().toISOString()
        });
        eventBus.emit('TASK_MUTATED', { entityId: draggingItem.id, action: 'update' });
      } else if (draggingItem.type === 'event') {
        await db.events.update(draggingItem.id, {
          date: targetDate,
          updatedAt: new Date().toISOString()
        });
        eventBus.emit('EVENT_MUTATED', { entityId: draggingItem.id, action: 'update' });
      }
    } catch (err) {
      console.error('Failed to reschedule on drop:', err);
    } finally {
      setDraggingItem(null);
      setDropHoverDate(null);
    }
  };

  // Week calculation (Monday through Sunday around selectedDate)
  const getWeekDays = (baseDateStr: string) => {
    const parts = baseDateStr.split('-');
    const base = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = base.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon);

    const week: { dateStr: string; dayName: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      week.push({
        dateStr,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    return week;
  };

  const currentWeekDays = getWeekDays(selectedDate);

  // Month grid calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  // Items for selected date
  const selectedTasks = tasks.filter((t) => t.dueDate === selectedDate);
  const selectedEvents = events.filter((e) => e.date === selectedDate);
  const selectedReminders = reminders.filter((r) => r.date === selectedDate);
  const selectedPayments = recurringPayments.filter((r) => r.nextDueDate === selectedDate);
  const selectedFollowups = followups.filter((f) => f.dueDate === selectedDate);

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="page-wrapper">
      {/* Top Header & View Modes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Calendar</h2>
        </div>

        {/* View Switcher: Day | Week | Month */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: viewMode === mode ? 600 : 500,
                background: viewMode === mode ? 'var(--accent)' : 'transparent',
                color: viewMode === mode ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Month/Day Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => (viewMode === 'day' ? shiftDay(-1) : prevMonth())}
            className="btn btn-secondary btn-icon"
            style={{ width: '34px', height: '34px' }}
            aria-label="Previous period"
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontWeight: 600, fontSize: '14px', minWidth: '120px', textAlign: 'center' }}>
            {viewMode === 'day' ? formatDisplayDate(selectedDate) : monthLabel}
          </span>
          <button
            onClick={() => (viewMode === 'day' ? shiftDay(1) : nextMonth())}
            className="btn btn-secondary btn-icon"
            style={{ width: '34px', height: '34px' }}
            aria-label="Next period"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="card" style={{ padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty_${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isHoveredTarget = dropHoverDate === dateStr;

              const hasTasks = tasks.some((t) => t.dueDate === dateStr);
              const hasEvents = events.some((e) => e.date === dateStr);
              const hasReminders = reminders.some((r) => r.date === dateStr);
              const hasPayments = recurringPayments.some((p) => p.nextDueDate === dateStr);
              const hasAny = hasTasks || hasEvents || hasReminders || hasPayments;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropHoverDate !== dateStr) setDropHoverDate(dateStr);
                  }}
                  onDragLeave={() => {
                    if (dropHoverDate === dateStr) setDropHoverDate(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleItemDropOnDate(dateStr);
                  }}
                  style={{
                    height: '42px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    background: isHoveredTarget
                      ? 'var(--accent-light)'
                      : isSelected
                      ? 'var(--accent)'
                      : isToday
                      ? 'var(--accent-light)'
                      : 'transparent',
                    border: isHoveredTarget ? '1px dashed var(--accent)' : 'none',
                    color: isSelected && !isHoveredTarget ? '#ffffff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    fontSize: '13px',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                >
                  <span>{dayNum}</span>
                  {hasAny && (
                    <span
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: isSelected && !isHoveredTarget ? '#ffffff' : 'var(--accent)',
                        marginTop: '2px'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {currentWeekDays.map((col) => {
            const isToday = col.dateStr === todayStr;
            const isSelected = col.dateStr === selectedDate;
            const isHoveredTarget = dropHoverDate === col.dateStr;
            const colEvents = events.filter((e) => e.date === col.dateStr);
            const colTasks = tasks.filter((t) => t.dueDate === col.dateStr);

            return (
              <div
                key={col.dateStr}
                onClick={() => setSelectedDate(col.dateStr)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dropHoverDate !== col.dateStr) setDropHoverDate(col.dateStr);
                }}
                onDragLeave={() => {
                  if (dropHoverDate === col.dateStr) setDropHoverDate(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleItemDropOnDate(col.dateStr);
                }}
                className="card"
                style={{
                  minHeight: '140px',
                  padding: '8px 6px',
                  border: isHoveredTarget
                    ? '1.5px dashed var(--accent)'
                    : isSelected
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--border-color)',
                  background: isHoveredTarget ? 'var(--accent-light)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{col.dayName}</div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                      marginTop: '2px'
                    }}
                  >
                    {col.dayNum}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  {colEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', ev.id);
                        setDraggingItem({ id: ev.id, type: 'event', title: ev.title });
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      style={{
                        fontSize: '10px',
                        padding: '3px 4px',
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        cursor: 'grab'
                      }}
                    >
                      {ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                    </div>
                  ))}
                  {colTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', t.id);
                        setDraggingItem({ id: t.id, type: 'task', title: t.title });
                      }}
                      onDragEnd={() => setDraggingItem(null)}
                      style={{
                        fontSize: '10px',
                        padding: '3px 4px',
                        background: 'var(--bg-hover)',
                        color: 'var(--text-secondary)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'grab'
                      }}
                    >
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAY VIEW (Vertical Timeline) */}
      {viewMode === 'day' && (
        <div className="card" style={{ padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
            Timeline for {formatDisplayDate(selectedDate)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 14 }).map((_, idx) => {
              const hour = idx + 8; // 08:00 to 21:00
              const hourStr = `${String(hour).padStart(2, '0')}:00`;
              const hourEvents = selectedEvents.filter((e) => (e.startTime || '').startsWith(String(hour).padStart(2, '0')));
              const hourTasks = selectedTasks.filter((t) => (t.dueTime || '').startsWith(String(hour).padStart(2, '0')));

              return (
                <div
                  key={hourStr}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-color)',
                    minHeight: '38px'
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '42px', flexShrink: 0, paddingTop: '2px' }}>
                    {hourStr}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {hourEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="card"
                        style={{
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'var(--accent-light)',
                          border: '1px solid var(--accent)'
                        }}
                      >
                        <CalendarIcon size={14} color="var(--accent)" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{ev.title}</span>
                        {ev.location && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({ev.location})</span>}
                      </div>
                    ))}
                    {hourTasks.map((t) => (
                      <div
                        key={t.id}
                        className="card"
                        style={{
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <CheckSquare size={14} color="var(--text-muted)" />
                        <span style={{ fontSize: '13px' }}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Agenda (Available in all views) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Agenda for {formatDisplayDate(selectedDate)}
          </div>
          {draggingItem && (
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
              Drop onto any day to reschedule
            </span>
          )}
        </div>

        {selectedTasks.length === 0 && selectedEvents.length === 0 && selectedReminders.length === 0 && selectedPayments.length === 0 && selectedFollowups.length === 0 ? (
          <div className="card" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nothing scheduled for this date.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedEvents.map((ev) => (
              <div
                key={ev.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', ev.id);
                  setDraggingItem({ id: ev.id, type: 'event', title: ev.title });
                }}
                onDragEnd={() => setDraggingItem(null)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  cursor: 'grab'
                }}
              >
                <GripVertical size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <CalendarIcon size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{ev.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {ev.startTime || 'All day'} {ev.location ? `• ${ev.location}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'event', id: ev.id })}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '4px' }}
                  title="Context"
                  aria-label="Context"
                >
                  <Network size={15} />
                </button>
                <span className="badge badge-accent">Event</span>
              </div>
            ))}

            {selectedTasks.map((t) => (
              <div
                key={t.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', t.id);
                  setDraggingItem({ id: t.id, type: 'task', title: t.title });
                }}
                onDragEnd={() => setDraggingItem(null)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  cursor: 'grab'
                }}
              >
                <GripVertical size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <CheckSquare size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Task • {t.status}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'task', id: t.id })}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '4px' }}
                  title="Context"
                  aria-label="Context"
                >
                  <Network size={15} />
                </button>
                <span className="badge badge-neutral">Task</span>
              </div>
            ))}

            {selectedReminders.map((r) => (
              <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                <Bell size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{r.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {r.time ? `At ${r.time}` : 'Reminder'}
                  </div>
                </div>
                <span className="badge badge-warning">Reminder</span>
              </div>
            ))}

            {selectedPayments.map((p) => (
              <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                <Wallet size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Payment Due: {formatMoney(p.amountMinor)}
                  </div>
                </div>
                <span className="badge badge-danger">Payment</span>
              </div>
            ))}

            {selectedFollowups.map((f) => (
              <div key={f.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                <UserCheck size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{f.subject}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Follow up with: {f.personName}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'followup', id: f.id })}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '4px' }}
                  title="Context"
                  aria-label="Context"
                >
                  <Network size={15} />
                </button>
                <span className="badge badge-accent">Follow-up</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
