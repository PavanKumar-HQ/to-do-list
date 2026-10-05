import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckSquare,
  Bell,
  BellOff,
  Clock,
  Wallet,
  UserCheck,
  Network,
  GripVertical,
  Radio,
  Sliders,
  Check,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  FileText
} from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { ContextModal } from '../common/ContextModal';
import { EventReminderService } from '../../services/eventReminderService';
import { useToast } from '../common/ToastContext';
import { eventBus } from '../../services/eventBus';
import type { EntityType, EventItem } from '../../types';

const EVENT_PALETTES: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  meeting: { bg: 'rgba(59, 130, 246, 0.14)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.35)', dot: '#3b82f6', label: 'Meetings & Calls' },
  work: { bg: 'rgba(59, 130, 246, 0.14)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.35)', dot: '#3b82f6', label: 'Work' },
  personal: { bg: 'rgba(16, 185, 129, 0.14)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981', label: 'Personal & Family' },
  deadline: { bg: 'rgba(245, 158, 11, 0.14)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b', label: 'Deadlines & Tasks' },
  health: { bg: 'rgba(244, 63, 94, 0.14)', text: '#f43f5e', border: 'rgba(244, 63, 94, 0.35)', dot: '#f43f5e', label: 'Health & Wellbeing' },
  travel: { bg: 'rgba(139, 92, 246, 0.14)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.35)', dot: '#8b5cf6', label: 'Travel & Focus' },
  default: { bg: 'rgba(59, 130, 246, 0.14)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.35)', dot: '#3b82f6', label: 'Event' }
};

const getEventTheme = (ev: { category?: string; color?: string; title: string }) => {
  if (ev.color) {
    return {
      bg: `${ev.color}1f`,
      text: ev.color,
      border: `${ev.color}4d`,
      dot: ev.color,
      label: ev.category || 'Custom'
    };
  }
  const cat = (ev.category || '').toLowerCase();
  if (EVENT_PALETTES[cat]) return EVENT_PALETTES[cat];
  const keys = ['meeting', 'personal', 'deadline', 'travel', 'health'];
  let hash = 0;
  for (let i = 0; i < ev.title.length; i++) hash = ev.title.charCodeAt(i) + ((hash << 5) - hash);
  return EVENT_PALETTES[keys[Math.abs(hash) % keys.length]];
};

interface CalendarViewProps {
  onOpenQuickAdd?: (type?: any, date?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Active layer filter (All, Meetings, Deadlines, Personal)
  const [activeLayer, setActiveLayer] = useState<'all' | 'meetings' | 'deadlines' | 'personal'>('all');

  // Dragging state (transient local state - ZERO DB writes during drag)
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: 'task' | 'event'; title: string } | null>(null);
  const [dropHoverDate, setDropHoverDate] = useState<string | null>(null);

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Reminder schedule modal state
  const [scheduleModalEvent, setScheduleModalEvent] = useState<EventItem | null>(null);
  const [scheduleOneDayBefore, setScheduleOneDayBefore] = useState(true);
  const [scheduleRecurringHours, setScheduleRecurringHours] = useState<number>(2);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  // Event detail & edit modal state
  const [detailModalEvent, setDetailModalEvent] = useState<EventItem | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<'meeting' | 'work' | 'personal' | 'deadline' | 'health' | 'travel'>('meeting');

  // Current calendar year/month
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-11

  // Purge any historical synthetic interval reminders from past event schedule bugs
  useEffect(() => {
    EventReminderService.purgeFloodedReminders();
  }, []);

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

  // All upcoming events (from today onwards, next 14 days)
  const upcomingEvents = useLiveQuery(async () => {
    const list = await db.events
      .filter((e) => !e.deletedAt && e.date >= todayStr)
      .toArray();
    return list.sort((a, b) => `${a.date} ${a.startTime || '00:00'}`.localeCompare(`${b.date} ${b.startTime || '00:00'}`));
  }, [todayStr]) || [];

  const reminders = useLiveQuery(async () => {
    return db.reminders
      .filter((r) => !r.deletedAt && r.status === 'active' && r.linkedType !== 'event' && r.date.startsWith(monthPrefix))
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

  // Drag & drop commit
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
        const ev = await db.events.get(draggingItem.id);
        if (ev) {
          const updated = { ...ev, date: targetDate, updatedAt: new Date().toISOString() };
          await db.events.update(draggingItem.id, { date: targetDate, updatedAt: updated.updatedAt });
          await EventReminderService.syncEventReminders(updated);
          eventBus.emit('EVENT_MUTATED', { entityId: draggingItem.id, action: 'update' });
        }
      }
    } catch (err) {
      console.error('Failed to reschedule on drop:', err);
    } finally {
      setDraggingItem(null);
      setDropHoverDate(null);
    }
  };

  // Open schedule configuration for an event
  const openScheduleModal = (event: EventItem) => {
    setScheduleModalEvent(event);
    setScheduleOneDayBefore(event.reminderSchedule?.oneDayBefore ?? true);
    setScheduleRecurringHours(event.reminderSchedule?.recurringHours ?? 2);
    setScheduleEnabled(event.reminderSchedule?.enabled ?? true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleModalEvent) return;
    try {
      await EventReminderService.updateSchedule(scheduleModalEvent.id, {
        oneDayBefore: scheduleOneDayBefore,
        recurringHours: scheduleRecurringHours,
        enabled: scheduleEnabled,
        isDismissed: !scheduleEnabled
      });
      showToast(scheduleEnabled ? `Reminders updated for ${scheduleModalEvent.title}` : 'Reminders turned off', { type: 'success' });
      setScheduleModalEvent(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to update reminder schedule', { type: 'error' });
    }
  };

  // Quick toggle reminders
  const handleToggleReminder = async (event: EventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentlyEnabled = event.reminderSchedule?.enabled ?? false;
    await EventReminderService.toggleEventReminder(event.id, !currentlyEnabled);
    showToast(!currentlyEnabled ? 'Reminders active (1-day & recurring 2h)' : 'Reminders turned off', { type: 'info' });
  };

  // Delete event with audit log and reminder cancellation
  const handleDeleteEvent = async (event: EventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const now = new Date().toISOString();
      await db.events.update(event.id, { deletedAt: now, updatedAt: now });
      await EventReminderService.toggleEventReminder(event.id, false);
      eventBus.emit('EVENT_MUTATED', { entityId: event.id, action: 'delete' });
      await logAudit('delete', 'event', event.id, `Deleted event "${event.title}"`);
      showToast('Event moved to trash');
      if (detailModalEvent?.id === event.id) {
        setDetailModalEvent(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete event', { type: 'error' });
    }
  };

  // Open detail modal to view and edit all filled fields
  const openDetailModal = (event: EventItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDetailModalEvent(event);
    setIsEditingDetail(false);
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditStartTime(event.startTime || '10:00');
    setEditLocation(event.location || '');
    setEditNotes(event.notes || '');
    setEditCategory((event.category as any) || 'meeting');
  };

  // Save changes from detail modal
  const handleSaveEditEvent = async () => {
    if (!detailModalEvent) return;
    if (!editTitle.trim()) {
      showToast('Event title is required', { type: 'warning' });
      return;
    }
    try {
      const now = new Date().toISOString();
      const updated: EventItem = {
        ...detailModalEvent,
        title: editTitle.trim(),
        date: editDate || detailModalEvent.date,
        startTime: editStartTime || detailModalEvent.startTime,
        location: editLocation.trim() || undefined,
        notes: editNotes.trim() || undefined,
        category: editCategory,
        updatedAt: now
      };
      await db.events.update(detailModalEvent.id, {
        title: updated.title,
        date: updated.date,
        startTime: updated.startTime,
        location: updated.location,
        notes: updated.notes,
        category: updated.category,
        updatedAt: now
      });
      await EventReminderService.syncEventReminders(updated);
      eventBus.emit('EVENT_MUTATED', { entityId: detailModalEvent.id, action: 'update' });
      await logAudit('update', 'event', detailModalEvent.id, `Updated event: ${updated.title}`);
      showToast('Event updated successfully', { type: 'success' });
      setDetailModalEvent(updated);
      setIsEditingDetail(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to update event', { type: 'error' });
    }
  };

  // Filter events based on active layer
  const filterByLayer = (evList: EventItem[]) => {
    if (activeLayer === 'all') return evList;
    if (activeLayer === 'meetings') return evList.filter((e) => e.category === 'meeting' || e.category === 'work');
    if (activeLayer === 'deadlines') return evList.filter((e) => e.category === 'deadline');
    if (activeLayer === 'personal') return evList.filter((e) => e.category === 'personal' || e.category === 'health');
    return evList;
  };

  // Load settings for start of week preference
  const settings = useLiveQuery(() => db.settings.get('current_settings'), []);
  const weekStartsMonday = settings?.weekStartsMonday ?? true;

  // Week calculation (respecting weekStartsMonday preference)
  const getWeekDays = (baseDateStr: string) => {
    const parts = baseDateStr.split('-');
    const base = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = base.getDay();
    const diff = weekStartsMonday ? ((day === 0 ? -6 : 1) - day) : -day;
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() + diff);

    const week: { dateStr: string; dayName: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
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

  // Month grid calculation (Monday vs Sunday offset)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  const firstDayOffset = weekStartsMonday ? (rawFirstDay === 0 ? 6 : rawFirstDay - 1) : rawFirstDay;

  // Filtered items for selected date
  const selectedTasks = tasks.filter((t) => t.dueDate === selectedDate);
  const selectedEvents = filterByLayer(events.filter((e) => e.date === selectedDate));
  const selectedReminders = reminders.filter((r) => r.date === selectedDate);
  const selectedPayments = recurringPayments.filter((r) => r.nextDueDate === selectedDate);
  const selectedFollowups = followups.filter((f) => f.dueDate === selectedDate);

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Imminent next event for Live Radar
  const nextImminentEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  return (
    <div className="content-max-width" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. UPCOMING THINGS (LIVE RADAR) */}
      {nextImminentEvent ? (
        <div
          className="animate-row-enter"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981'
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', letterSpacing: '0.04em' }}>
                Upcoming Radar
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
                padding: '0.125rem 0.5rem',
                borderRadius: '10px',
                fontWeight: 500
              }}
            >
              {upcomingEvents.length} upcoming
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Clock size={13} color="var(--text-tertiary)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {nextImminentEvent.date === todayStr ? 'Today' : formatDisplayDate(nextImminentEvent.date)} • {nextImminentEvent.startTime || 'All day'}
                </span>
                {nextImminentEvent.location && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    • {nextImminentEvent.location}
                  </span>
                )}
              </div>
              <h3
                onClick={() => openDetailModal(nextImminentEvent)}
                style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, cursor: 'pointer' }}
                title="Click to view event details"
              >
                {nextImminentEvent.title}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={(e) => handleToggleReminder(nextImminentEvent, e)}
                className={`btn btn-sm ${nextImminentEvent.reminderSchedule?.enabled ? 'btn-primary' : 'btn-secondary'}`}
                style={{ gap: '0.375rem', fontSize: '0.75rem' }}
                title="Toggle 1-day & recurring 2hr reminders"
              >
                {nextImminentEvent.reminderSchedule?.enabled ? <Bell size={13} /> : <BellOff size={13} />}
                <span>{nextImminentEvent.reminderSchedule?.enabled ? 'Reminders On' : 'Set Reminder'}</span>
              </button>
              <button
                onClick={() => openScheduleModal(nextImminentEvent)}
                className="btn btn-sm btn-secondary"
                style={{ padding: '6px 8px' }}
                title="Customize Schedule"
              >
                <Sliders size={13} />
              </button>
              <button
                onClick={() => openDetailModal(nextImminentEvent)}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem' }}
              >
                View Details
              </button>
              <button
                onClick={(e) => handleDeleteEvent(nextImminentEvent, e)}
                className="btn btn-sm btn-secondary"
                style={{ padding: '6px 8px', color: 'var(--danger)' }}
                title="Delete Event"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Top Header & View Modes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {viewMode === 'day' ? formatDisplayDate(selectedDate) : monthLabel}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onOpenQuickAdd && (
            <button
              onClick={() => onOpenQuickAdd('event', selectedDate)}
              className="btn btn-primary btn-sm"
              style={{ gap: '5px', fontSize: '0.75rem', padding: '5px 12px' }}
            >
              <Plus size={14} />
              <span>New Event</span>
            </button>
          )}

          {/* View Switcher: Day | Week | Month */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 12px',
                fontSize: '0.8125rem',
                fontWeight: viewMode === mode ? 600 : 400,
                background: viewMode === mode ? 'var(--accent)' : 'transparent',
                color: viewMode === mode ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Month/Day Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => (viewMode === 'day' ? shiftDay(-1) : prevMonth())}
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px', padding: 0 }}
            aria-label="Previous period"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              setSelectedDate(todayStr);
              setCurrentYear(new Date().getFullYear());
              setCurrentMonth(new Date().getMonth());
            }}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
          >
            Today
          </button>
          <button
            onClick={() => (viewMode === 'day' ? shiftDay(1) : nextMonth())}
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px', padding: 0 }}
            aria-label="Next period"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        </div>
      </div>

      {/* 3. EVENT LAYERS FILTER */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { id: 'all', label: 'All Activities', count: events.length },
          { id: 'meetings', label: 'Meetings & Calls', count: events.filter((e) => e.category === 'meeting' || e.category === 'work').length },
          { id: 'deadlines', label: 'Deadlines & Tasks', count: events.filter((e) => e.category === 'deadline').length },
          { id: 'personal', label: 'Personal & Health', count: events.filter((e) => e.category === 'personal' || e.category === 'health').length }
        ].map((layer) => {
          const isSelected = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{layer.label}</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-surface-elevated)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                {layer.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. MONTH VIEW WITH COLOR-CODED DOTS */}
      {viewMode === 'month' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
            {(weekStartsMonday ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty_${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isHoveredTarget = dropHoverDate === dateStr;

              const dayEvents = filterByLayer(events.filter((e) => e.date === dateStr));
              const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
              const dayReminders = reminders.filter((r) => r.date === dateStr);
              const dayPayments = recurringPayments.filter((p) => p.nextDueDate === dateStr);
              const hasAny = dayEvents.length > 0 || dayTasks.length > 0 || dayReminders.length > 0 || dayPayments.length > 0;

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
                    position: 'relative',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      background: isSelected
                        ? 'var(--accent)'
                        : isHoveredTarget
                        ? 'var(--bg-surface-elevated)'
                        : isToday
                        ? 'var(--bg-surface-elevated)'
                        : 'transparent',
                      border: isHoveredTarget ? '1px dashed var(--accent)' : isToday && !isSelected ? '1px solid var(--accent)' : 'none',
                      color: isSelected ? '#ffffff' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: isSelected || isToday ? 600 : 400,
                      fontSize: '0.8125rem'
                    }}
                  >
                    <span>{dayNum}</span>
                    {hasAny && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginTop: '1px' }}>
                        {dayEvents.slice(0, 3).map((ev) => {
                          const theme = getEventTheme(ev);
                          return (
                            <span
                              key={ev.id}
                              style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: isSelected ? '#ffffff' : theme.dot
                              }}
                            />
                          );
                        })}
                        {dayEvents.length === 0 && (
                          <span
                            style={{
                              width: '3px',
                              height: '3px',
                              borderRadius: '50%',
                              background: isSelected ? '#ffffff' : 'var(--text-muted)'
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. WEEK VIEW WITH COLOR CODING */}
      {viewMode === 'week' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '6px',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: '4px'
          }}
          className="no-scrollbar"
        >
          {currentWeekDays.map((col) => {
            const isToday = col.dateStr === todayStr;
            const isSelected = col.dateStr === selectedDate;
            const isHoveredTarget = dropHoverDate === col.dateStr;
            const colEvents = filterByLayer(events.filter((e) => e.date === col.dateStr));
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
                style={{
                  minHeight: '88px',
                  minWidth: 0,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: isHoveredTarget
                    ? '1.5px dashed var(--accent)'
                    : isSelected
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{col.dayName}</div>
                  <div
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                      marginTop: '2px'
                    }}
                  >
                    {col.dayNum}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  {colEvents.slice(0, 3).map((ev) => {
                    const theme = getEventTheme(ev);
                    return (
                      <div
                        key={ev.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', ev.id);
                          setDraggingItem({ id: ev.id, type: 'event', title: ev.title });
                        }}
                        onDragEnd={() => setDraggingItem(null)}
                        style={{
                          fontSize: '0.6875rem',
                          padding: '3px 5px',
                          background: theme.bg,
                          color: theme.text,
                          borderLeft: `2.5px solid ${theme.dot}`,
                          borderRadius: '3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                          cursor: 'grab'
                        }}
                      >
                        {ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                      </div>
                    );
                  })}
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
                        fontSize: '0.6875rem',
                        padding: '3px 5px',
                        background: 'var(--bg-surface-elevated)',
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

      {/* 6. DAY VIEW (Vertical Timeline) */}
      {viewMode === 'day' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Timeline for {formatDisplayDate(selectedDate)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    borderBottom: '1px solid var(--border-subtle)',
                    minHeight: '38px'
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', width: '42px', flexShrink: 0, paddingTop: '2px' }}>
                    {hourStr}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {hourEvents.map((ev) => {
                      const theme = getEventTheme(ev);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: theme.bg,
                            borderLeft: `3px solid ${theme.dot}`,
                            borderRadius: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CalendarIcon size={13} color={theme.text} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: theme.text }}>{ev.title}</span>
                            {ev.location && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>({ev.location})</span>}
                          </div>
                          <button
                            onClick={() => openScheduleModal(ev)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text, padding: '2px' }}
                            title="Reminders"
                          >
                            {ev.reminderSchedule?.enabled ? <Bell size={13} /> : <BellOff size={13} />}
                          </button>
                        </div>
                      );
                    })}
                    {hourTasks.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--bg-surface-elevated)',
                          borderRadius: '4px'
                        }}
                      >
                        <CheckSquare size={13} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{t.title}</span>
                      </div>
                    ))}
                    {hourEvents.length === 0 && hourTasks.length === 0 && onOpenQuickAdd && (
                      <div
                        onClick={() => onOpenQuickAdd('event', selectedDate)}
                        style={{
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          padding: '0 8px',
                          border: '1px dashed transparent',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <Plus size={12} />
                        <span>Empty slot • tap to add</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. SELECTED DAY AGENDA */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Agenda for {formatDisplayDate(selectedDate)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenQuickAdd && (
              <button
                onClick={() => onOpenQuickAdd('event', selectedDate)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', gap: '0.375rem', padding: '4px 10px' }}
                title="Schedule an event for this date"
              >
                <Plus size={13} />
                <span>Add Event</span>
              </button>
            )}
            {draggingItem && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                Drop onto any day to reschedule
              </span>
            )}
          </div>
        </div>

        {selectedTasks.length === 0 && selectedEvents.length === 0 && selectedReminders.length === 0 && selectedPayments.length === 0 && selectedFollowups.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Nothing scheduled for {formatDisplayDate(selectedDate)}
            </div>
            {onOpenQuickAdd && (
              <button
                onClick={() => onOpenQuickAdd('event', selectedDate)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', gap: '0.375rem' }}
              >
                <Plus size={13} />
                <span>Schedule Event or Task</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {selectedEvents.map((ev) => {
              const theme = getEventTheme(ev);
              const hasReminders = ev.reminderSchedule?.enabled;

              return (
                <div
                  key={ev.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', ev.id);
                    setDraggingItem({ id: ev.id, type: 'event', title: ev.title });
                  }}
                  onDragEnd={() => setDraggingItem(null)}
                  onClick={() => openDetailModal(ev)}
                  className="animate-row-enter"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${theme.dot}`,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <GripVertical size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  <CalendarIcon size={16} color={theme.text} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ev.startTime || 'All day'} {ev.location ? `• ${ev.location}` : ''}
                      {hasReminders && (
                        <span style={{ color: theme.text, marginLeft: '6px' }}>
                          • Alerts active (1d & 2h)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleToggleReminder(ev, e)}
                    className="btn-ghost"
                    style={{ color: hasReminders ? theme.text : 'var(--text-muted)', padding: '4px' }}
                    title={hasReminders ? 'Reminders On' : 'Turn On Reminders'}
                  >
                    {hasReminders ? <Bell size={15} /> : <BellOff size={15} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openScheduleModal(ev);
                    }}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                    title="Customize Reminders"
                  >
                    <Sliders size={14} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextModal({ isOpen: true, type: 'event', id: ev.id });
                    }}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                    title="Context"
                  >
                    <Network size={14} />
                  </button>

                  <button
                    onClick={(e) => handleDeleteEvent(ev, e)}
                    className="btn-ghost"
                    style={{ color: 'var(--danger)', padding: '4px' }}
                    title="Delete event"
                  >
                    <Trash2 size={15} />
                  </button>

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      background: theme.bg,
                      color: theme.text,
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {theme.label}
                  </span>
                </div>
              );
            })}

            {selectedTasks.map((t) => (
              <div
                key={t.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', t.id);
                  setDraggingItem({ id: t.id, type: 'task', title: t.title });
                }}
                onDragEnd={() => setDraggingItem(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  cursor: 'grab'
                }}
              >
                <GripVertical size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                <CheckSquare size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Task • {t.status}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'task', id: t.id })}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '4px' }}
                  title="Context"
                >
                  <Network size={14} />
                </button>
                <span className="badge badge-neutral">Task</span>
              </div>
            ))}

            {selectedReminders.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    await db.reminders.update(r.id, { status: 'completed', notificationState: 'cancelled', updatedAt: new Date().toISOString() });
                    showToast('Reminder completed', { type: 'success' });
                  }}
                  className="btn-ghost"
                  style={{ width: '28px', height: '28px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                  title="Complete / Dismiss reminder"
                >
                  <Check size={16} />
                </button>
                <Bell size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{r.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {r.time ? `At ${r.time}` : 'Reminder'}
                  </div>
                </div>
                <span className="badge badge-warning">Reminder</span>
              </div>
            ))}

            {selectedPayments.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <Wallet size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Payment Due: {formatMoney(p.amountMinor)}
                  </div>
                </div>
                <span className="badge badge-danger">Payment</span>
              </div>
            ))}

            {selectedFollowups.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <UserCheck size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{f.subject}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Follow up with: {f.personName}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'followup', id: f.id })}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '4px' }}
                  title="Context"
                >
                  <Network size={14} />
                </button>
                <span className="badge badge-accent">Follow-up</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. REMINDER SCHEDULE CUSTOMIZATION MODAL */}
      {scheduleModalEvent && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="bottom-sheet" style={{ maxWidth: '420px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Event Reminders
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {scheduleModalEvent.title} • {scheduleModalEvent.date}
                </div>
              </div>
              <button
                onClick={() => setScheduleModalEvent(null)}
                className="btn-ghost"
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Enable / Disable switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Enable Reminders
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Receive gentle chimes & notifications
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {scheduleEnabled && (
                <>
                  {/* 1 Day Before */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        1 Day Before
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Alerts at 09:00 AM the day before
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={scheduleOneDayBefore}
                      onChange={(e) => setScheduleOneDayBefore(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Recurring Interval */}
                  <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      Recurring Alert Interval
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>
                      Alerts repeatedly until event starts or turned off
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[1, 2, 4].map((hrs) => (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => setScheduleRecurringHours(hrs)}
                          className={`btn btn-sm ${scheduleRecurringHours === hrs ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, fontSize: '0.75rem' }}
                        >
                          Every {hrs} hrs
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setScheduleModalEvent(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. EVENT DETAIL & EDIT MODAL (Shows all filled data with full editing & deletion) */}
      {detailModalEvent && (
        <div className="modal-overlay" onClick={() => setDetailModalEvent(null)} role="dialog" aria-modal="true">
          <div
            className="bottom-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={18} color="var(--accent)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {isEditingDetail ? 'Edit Event' : 'Event Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalEvent(null)}
                className="btn-ghost"
                style={{ padding: '4px' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {isEditingDetail ? (
              /* EDIT MODE */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Event title"
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Location / Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g. Conference Room A, Google Meet link"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Notes / Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add agenda, discussion points, or notes..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'meeting', label: 'Meeting', color: '#3b82f6' },
                      { id: 'work', label: 'Work', color: '#3b82f6' },
                      { id: 'personal', label: 'Personal', color: '#10b981' },
                      { id: 'deadline', label: 'Deadline', color: '#f59e0b' },
                      { id: 'health', label: 'Health', color: '#f43f5e' },
                      { id: 'travel', label: 'Travel', color: '#8b5cf6' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEditCategory(cat.id as any)}
                        className={`btn btn-sm ${editCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '16px' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditEvent}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW MODE — Shows all data filled */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {detailModalEvent.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: getEventTheme(detailModalEvent).bg,
                        color: getEventTheme(detailModalEvent).text,
                        border: `1px solid ${getEventTheme(detailModalEvent).border}`
                      }}
                    >
                      {getEventTheme(detailModalEvent).label}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} />
                      <span>{formatDisplayDate(detailModalEvent.date)} at {detailModalEvent.startTime || 'All day'}</span>
                    </span>
                  </div>
                </div>

                {detailModalEvent.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word' }}>{detailModalEvent.location}</span>
                  </div>
                )}

                {detailModalEvent.notes && (
                  <div style={{ background: 'var(--bg-surface)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Notes & Agenda
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {detailModalEvent.notes}
                    </div>
                  </div>
                )}

                {/* Reminder status summary */}
                <div style={{ background: 'var(--bg-surface)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {detailModalEvent.reminderSchedule?.enabled ? <Bell size={16} color="var(--accent)" /> : <BellOff size={16} color="var(--text-muted)" />}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {detailModalEvent.reminderSchedule?.enabled ? 'Alerts Active' : 'Alerts Disabled'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {detailModalEvent.reminderSchedule?.enabled
                          ? `1 day before & recurring every ${detailModalEvent.reminderSchedule?.recurringHours || 2}h`
                          : 'No reminders set for this event'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleToggleReminder(detailModalEvent, e)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    {detailModalEvent.reminderSchedule?.enabled ? 'Turn Off' : 'Turn On'}
                  </button>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, gap: '5px' }}
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(detailModalEvent)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)', gap: '5px' }}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailModalEvent(null)}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '6px 16px' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />
    </div>
  );
};
