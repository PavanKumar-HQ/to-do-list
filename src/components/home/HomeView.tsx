import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckSquare,
  Square,
  Calendar,
  Wallet,
  Clock,
  ChevronRight,
  Plus,
  RotateCcw,
  Mail,
  CheckCircle2,
  ArrowRight,
  Send,
  Sparkles,
  Bell,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Sun,
  PiggyBank,
  GraduationCap,
  FolderSearch,
  Key,
  Headphones,
  Glasses,
  BarChart3,
  Target
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getTodayDateString, getCurrentMonthString, formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useTimeAwareGreeting } from '../../utils/greeting';
import { useToast } from '../common/ToastContext';
import { AttentionService } from '../../services/attentionService';
import { TaskRepository, CommitmentRepository, OpenLoopRepository, ExpenseRepository, ReminderRepository } from '../../repositories';
import { parseNaturalQuickInput } from '../../utils/naturalParser';
import { ContextModal } from '../common/ContextModal';
import { ItemDetailModal } from '../common/ItemDetailModal';
import { LifeReviewModal } from '../loops/LifeReviewModal';
import { FutureMessageModal } from '../loops/FutureMessageModal';
import { LifeLoadExplanationModal } from './LifeLoadExplanationModal';
import { MissedRemindersBanner } from '../reminders/MissedRemindersBanner';
import { ActivityBars } from '../common/LoadingSpinner';
import { checkMissedReminders, checkUpcomingTasksAndNotify } from '../../services/notificationService';
import { eventBus } from '../../services/eventBus';
import type { AttentionItem, LifeLoadAssessment, TaskItem, EntityType, FutureMessageItem, ReminderItem } from '../../types';

interface HomeViewProps {
  onNavigateTo: (screen: string) => void;
  onOpenQuickAdd: (type?: any) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigateTo, onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const todayStr = getTodayDateString();
  const currentMonth = getCurrentMonthString();

  // Settings & Personalized Greeting
  const settings = useLiveQuery(() => db.settings.get('current_settings'), []);
  const { greeting, subtleDate } = useTimeAwareGreeting(settings?.displayName);

  // Detail Modal state (for real persistent data view)
  const [selectedDetail, setSelectedDetail] = useState<{
    type: 'task' | 'event' | 'reminder' | 'loop' | 'expense' | null;
    data: any | null;
  }>({
    type: null,
    data: null
  });

  // Life Load explanation modal state
  const [isLifeLoadModalOpen, setIsLifeLoadModalOpen] = useState(false);

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Attention Engine state
  const [attentionData, setAttentionData] = useState<{
    attentionItems: AttentionItem[];
    lifeLoad: LifeLoadAssessment | null;
    minimumDayTasks: TaskItem[];
  }>({
    attentionItems: [],
    lifeLoad: null,
    minimumDayTasks: []
  });

  const [loadingAttention, setLoadingAttention] = useState(true);

  // Refresh Attention Engine
  const refreshAttention = async () => {
    try {
      const res = await AttentionService.evaluateAttention();
      setAttentionData(res);
    } catch (err) {
      console.error('Failed to evaluate attention:', err);
    } finally {
      setLoadingAttention(false);
    }
  };

  // Guided Life Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Future Message read/open modal state
  const [futureModalConfig, setFutureModalConfig] = useState<{ isOpen: boolean; messageToRead: FutureMessageItem | null }>({
    isOpen: false,
    messageToRead: null
  });

  // Missed Reminders recovery state
  const [missedReminders, setMissedReminders] = useState<ReminderItem[]>([]);

  // Quick Capture inline input state
  const [captureText, setCaptureText] = useState('');
  const [isSubmittingCapture, setIsSubmittingCapture] = useState(false);

  const parsedCapture = useMemo(() => {
    if (!captureText.trim()) return null;
    return parseNaturalQuickInput(captureText);
  }, [captureText]);

  useEffect(() => {
    refreshAttention();
    checkMissedReminders().then(setMissedReminders);

    const unsubMissed = eventBus.subscribe('MISSED_REMINDERS', (e) => {
      if (e.data?.items) {
        setMissedReminders(e.data.items);
      }
    });

    const unsubMutated = eventBus.subscribe('REMINDER_MUTATED', () => {
      checkMissedReminders().then(setMissedReminders);
      refreshAttention();
    });

    const unsubTask = eventBus.subscribe('TASK_MUTATED', () => refreshAttention());
    const unsubEvent = eventBus.subscribe('EVENT_MUTATED', () => refreshAttention());
    const unsubLoop = eventBus.subscribe('OPEN_LOOP_MUTATED', () => refreshAttention());
    const unsubExpense = eventBus.subscribe('EXPENSE_MUTATED', () => refreshAttention());

    return () => {
      unsubMissed();
      unsubMutated();
      unsubTask();
      unsubEvent();
      unsubLoop();
      unsubExpense();
    };
  }, []);

  // Future messages arriving today
  const readyFutureMessages = useLiveQuery(() => {
    return db.futureMessages.filter(m => !m.deletedAt && !m.isOpened && m.openDate <= todayStr).toArray();
  }, [todayStr]) || [];

  const lastReviewSession = useLiveQuery(() => {
    return db.reviewSessions.orderBy('completedAt').reverse().first();
  }, []);

  // Today's tasks (due today OR unscheduled tasks created today, not completed)
  const todayTasks = useLiveQuery(() => {
    return db.tasks
      .filter((t) => !t.deletedAt && t.status !== 'completed' && (!t.dueDate || t.dueDate === todayStr))
      .toArray();
  }, [todayStr]) || [];

  // Today's events (IndexedDB date index)
  const todayEvents = useLiveQuery(() => {
    return db.events.where('date').equals(todayStr).filter((e) => !e.deletedAt).toArray();
  }, [todayStr]) || [];

  // Today's reminders (IndexedDB date index)
  const todayReminders = useLiveQuery(() => {
    return db.reminders
      .where('date')
      .equals(todayStr)
      .filter((r) => !r.deletedAt && (r.status === 'active' || r.status === 'snoozed'))
      .toArray();
  }, [todayStr]) || [];

  // Open loops (waiting on others / active loops)
  const openLoopsList = useLiveQuery(() => {
    return db.openLoops.filter((l) => !l.deletedAt && l.status === 'open').limit(5).toArray();
  }, []) || [];

  // Tomorrow's items for Up Next section
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const upNextItems = useLiveQuery(async () => {
    const [tasks, events, reminders] = await Promise.all([
      db.tasks.where('dueDate').equals(tomorrowStr).filter(t => !t.deletedAt && t.status !== 'completed').toArray(),
      db.events.where('date').equals(tomorrowStr).filter(e => !e.deletedAt).toArray(),
      db.reminders.where('date').equals(tomorrowStr).filter(r => !r.deletedAt && (r.status === 'active' || r.status === 'snoozed')).toArray()
    ]);
    return [
      ...tasks.map(t => ({ id: t.id, title: t.title, type: 'Task' })),
      ...events.map(e => ({ id: e.id, title: e.title, type: 'Event' })),
      ...reminders.map(r => ({ id: r.id, title: r.title, type: 'Reminder' }))
    ];
  }, [tomorrowStr]) || [];

  // Financial metrics (IndexedDB date index)
  const todayExpenses = useLiveQuery(() => {
    return db.expenses.where('date').equals(todayStr).filter((e) => !e.deletedAt).toArray();
  }, [todayStr]) || [];

  const monthlyExpenses = useLiveQuery(() => {
    return db.expenses.filter((e) => !e.deletedAt && e.date.startsWith(currentMonth)).toArray();
  }, [currentMonth]) || [];

  const todayTotalSpentMinor = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const monthlyTotalSpentMinor = monthlyExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

  // Grouped monthly expenses by category (only categories with real data)
  const activeExpenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    monthlyExpenses.forEach((e) => {
      const current = map.get(e.category) || 0;
      map.set(e.category, current + e.amountMinor);
    });
    return Array.from(map.entries())
      .map(([category, amountMinor]) => ({ category, amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor);
  }, [monthlyExpenses]);

  // Real status indicators for "Worth your attention"
  const counts = useLiveQuery(async () => {
    const commitments = await db.commitments.filter(c => !c.deletedAt && c.status === 'pending').count();
    const waitingLoops = await db.openLoops.filter(l => !l.deletedAt && l.status === 'open').count();
    const waitingFollowups = await db.followups.filter(f => !f.deletedAt && f.status === 'waiting').count();
    const deadlines = await db.events.filter(e => !e.deletedAt && e.category === 'deadline' && e.date >= todayStr).count();
    return {
      commitments,
      waiting: waitingLoops + waitingFollowups,
      deadlines
    };
  }, [todayStr]) || { commitments: 0, waiting: 0, deadlines: 0 };

  // Growth & Vault queries for quick launch hub
  const habitsList = useLiveQuery(() => db.habits.filter(h => !h.deletedAt).toArray(), []) || [];
  const savingsList = useLiveQuery(() => db.savingsGoals.filter(s => !s.deletedAt).toArray(), []) || [];
  const studyList = useLiveQuery(() => db.studySubjects.filter(s => !s.deletedAt).toArray(), []) || [];
  const vaultList = useLiveQuery(() => db.vaultResources.filter(v => !v.deletedAt).toArray(), []) || [];

  // Recent activity stream (only items that actually exist in the database)
  const recentActivities = useLiveQuery(async () => {
    const [tasks, expenses, notes, reminders] = await Promise.all([
      db.tasks.filter(t => !t.deletedAt).reverse().limit(3).toArray(),
      db.expenses.filter(e => !e.deletedAt).reverse().limit(3).toArray(),
      db.notes.filter(n => !n.deletedAt && !n.archivedAt).reverse().limit(3).toArray(),
      db.reminders.filter(r => !r.deletedAt).reverse().limit(3).toArray()
    ]);

    const combined: Array<{
      id: string;
      type: string;
      title: string;
      detail: string;
      timestamp: string;
    }> = [
        ...tasks.map(t => ({
          id: t.id,
          type: 'Task',
          title: t.title,
          detail: t.dueDate ? `Due ${t.dueDate}` : 'Open task',
          timestamp: t.createdAt
        })),
        ...expenses.map(e => ({
          id: e.id,
          type: 'Expense',
          title: `₹${(e.amountMinor / 100).toFixed(0)}`,
          detail: e.category,
          timestamp: e.createdAt
        })),
        ...notes.map(n => ({
          id: n.id,
          type: 'Note',
          title: n.title,
          detail: (n.content || '').slice(0, 40),
          timestamp: n.createdAt
        })),
        ...reminders.map(r => ({
          id: r.id,
          type: 'Reminder',
          title: r.title,
          detail: r.time ? `${r.date} · ${r.time}` : r.date,
          timestamp: r.createdAt
        }))
      ];

    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return combined.slice(0, 3);
  }, []) || [];

  // Helper for human-readable relative time
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Submit Quick Capture directly from Home
  const handleQuickCaptureSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = captureText.trim();
    if (!trimmed) {
      onOpenQuickAdd('task');
      return;
    }

    setIsSubmittingCapture(true);
    try {
      const parsed = parseNaturalQuickInput(trimmed);

      if (parsed.detectedType === 'expense') {
        const exp = await ExpenseRepository.create({
          amountMinor: parsed.amountMinor || 0,
          currency: 'INR',
          date: parsed.dueDate || getTodayDateString(),
          category: parsed.category || 'Other',
          notes: parsed.title
        });
        eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: exp.id });
        showToast(`Expense logged: ₹${((parsed.amountMinor || 0) / 100).toFixed(0)}`, { type: 'success' });
      } else if (parsed.detectedType === 'reminder') {
        const rem = await ReminderRepository.create({
          title: parsed.title,
          date: parsed.dueDate || getTodayDateString(),
          time: parsed.dueTime || undefined,
          status: 'active'
        });
        eventBus.emit('REMINDER_MUTATED', { type: 'REMINDER_MUTATED', entityId: rem.id });
        showToast(`Reminder set for ${rem.date}`, { type: 'success' });
      } else if (parsed.detectedType === 'idea') {
        const ideaId = generateId();
        const nowIso = new Date().toISOString();
        await db.ideas.add({
          id: ideaId,
          title: parsed.title,
          description: '',
          category: 'General',
          tags: [],
          isPinned: false,
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        showToast(`Idea captured: ${parsed.title}`, { type: 'success' });
      } else if (parsed.detectedType === 'event') {
        const eventId = generateId();
        const nowIso = new Date().toISOString();
        await db.events.add({
          id: eventId,
          title: parsed.title,
          date: parsed.dueDate || getTodayDateString(),
          startTime: parsed.dueTime || '10:00',
          category: 'meeting',
          color: '#3b82f6',
          recurrence: 'none',
          reminderSchedule: { enabled: true, oneDayBefore: true },
          createdAt: nowIso,
          updatedAt: nowIso
        });
        eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: eventId });
        showToast(`Event added: ${parsed.title}`, { type: 'success' });
      } else {
        // Default to Task
        const task = await TaskRepository.create({
          title: parsed.title,
          dueDate: parsed.dueDate || undefined,
          dueTime: parsed.dueTime || undefined,
          status: 'todo'
        });
        eventBus.emit('TASK_MUTATED', { type: 'TASK_MUTATED', entityId: task.id });
        showToast(`Task added: ${parsed.title}`, { type: 'success' });
      }

      setCaptureText('');
      refreshAttention();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', { type: 'error' });
    } finally {
      setIsSubmittingCapture(false);
    }
  };

  // Attention actions
  const handleAttentionAction = async (item: AttentionItem, action: string) => {
    try {
      if (action === 'open_context' && item.entityType && item.entityId) {
        setContextModal({ isOpen: true, type: item.entityType, id: item.entityId });
        return;
      }

      if (action === 'complete') {
        if (item.entityType === 'task' && item.entityId) {
          await TaskRepository.complete(item.entityId);
          showToast('Task marked complete', { type: 'success' });
        } else if (item.entityType === 'commitment' && item.entityId) {
          await CommitmentRepository.fulfill(item.entityId);
          showToast('Commitment fulfilled', { type: 'success' });
        } else if (item.entityType === 'followup' && item.entityId) {
          await db.followups.update(item.entityId, { status: 'resolved' });
          showToast('Follow-up marked resolved', { type: 'success' });
        } else if (item.entityType === 'decision' && item.entityId) {
          await db.decisions.update(item.entityId, { status: 'reviewed' });
          showToast('Decision reviewed', { type: 'success' });
        }
      } else if (action === 'archive') {
        if (item.entityType === 'task' && item.entityId) {
          await TaskRepository.softDelete(item.entityId);
          showToast('Task moved to trash', { type: 'info' });
        } else if (item.entityType === 'goal' && item.entityId) {
          await db.goals.update(item.entityId, { status: 'archived' });
          showToast('Goal archived', { type: 'info' });
        } else if (item.entityType === 'note' && item.entityId) {
          await db.notes.update(item.entityId, { archivedAt: new Date().toISOString() });
          showToast('Note archived', { type: 'info' });
        }
      } else if (action === 'snooze' || action === 'reschedule') {
        if (item.entityType === 'task' && item.entityId) {
          const task = await db.tasks.get(item.entityId);
          if (task) {
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            await TaskRepository.update(item.entityId, {
              dueDate: tomorrow,
              postponeCount: (task.postponeCount || 0) + 1,
              lastPostponedAt: new Date().toISOString()
            });
            showToast('Postponed to tomorrow', { type: 'info' });
          }
        }
      }
      refreshAttention();
    } catch (err: any) {
      showToast(err.message || 'Action failed', { type: 'error' });
    }
  };

  // Intelligent schedule-aware contextual status commentary
  const getScheduleInsight = () => {
    const activeTasksCount = todayTasks.filter((t) => t.status !== 'completed').length;
    const completedTasksCount = todayTasks.filter((t) => t.status === 'completed').length;
    const eventsCount = todayEvents.length;
    const remindersCount = todayReminders.length;
    const attentionCount = attentionData.attentionItems.length;

    // Check next upcoming event time today
    const currentHM = new Date().toTimeString().slice(0, 5);
    const nextEvent = todayEvents
      .filter((e) => !e.startTime || e.startTime >= currentHM)
      .sort((a, b) => (a.startTime || '23:59').localeCompare(b.startTime || '23:59'))[0];

    if (attentionCount > 0) {
      return {
        label: attentionCount === 1 ? '1 urgent item today' : `${attentionCount} items need attention`,
        color: 'var(--danger)',
        dotColor: 'var(--danger)'
      };
    }

    if (nextEvent && nextEvent.startTime) {
      return {
        label: `Next: ${nextEvent.title} (${nextEvent.startTime})`,
        color: 'var(--accent)',
        dotColor: 'var(--accent)'
      };
    }

    if (eventsCount > 0 && activeTasksCount > 0) {
      return {
        label: `${eventsCount} ${eventsCount === 1 ? 'event' : 'events'} • ${activeTasksCount} ${activeTasksCount === 1 ? 'task' : 'tasks'}`,
        color: 'var(--accent)',
        dotColor: 'var(--accent)'
      };
    }

    if (eventsCount > 0) {
      return {
        label: `${eventsCount} ${eventsCount === 1 ? 'event' : 'events'} scheduled`,
        color: 'var(--accent)',
        dotColor: 'var(--accent)'
      };
    }

    if (activeTasksCount > 0) {
      return {
        label: `${activeTasksCount} ${activeTasksCount === 1 ? 'task' : 'tasks'} planned`,
        color: 'var(--text-secondary)',
        dotColor: '#10b981'
      };
    }

    if (remindersCount > 0) {
      return {
        label: `${remindersCount} ${remindersCount === 1 ? 'reminder' : 'reminders'} set`,
        color: 'var(--accent)',
        dotColor: 'var(--accent)'
      };
    }

    if (completedTasksCount > 0 && activeTasksCount === 0) {
      return {
        label: 'All tasks completed today',
        color: 'var(--success)',
        dotColor: 'var(--success)'
      };
    }

    return {
      label: 'Clear schedule today',
      color: 'var(--text-secondary)',
      dotColor: 'var(--success)'
    };
  };

  const loadStatus = getScheduleInsight();
  const isOverloadedOrEssential =
    attentionData.lifeLoad?.level === 'overloaded' ||
    attentionData.lifeLoad?.level === 'heavy' ||
    attentionData.minimumDayTasks.length > 0;

  // Unified items scheduled for today in chronological order
  const todayTimelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'event' | 'task' | 'reminder';
      time: string;
      title: string;
      subtitle?: string;
      isCompleted?: boolean;
      rawItem: any;
    }> = [];

    todayEvents.forEach((ev) => {
      items.push({
        id: ev.id,
        type: 'event',
        time: ev.startTime || 'All day',
        title: ev.title,
        subtitle: ev.location,
        rawItem: ev
      });
    });

    todayTasks.forEach((t) => {
      items.push({
        id: t.id,
        type: 'task',
        time: t.dueTime || 'Today',
        title: t.title,
        isCompleted: t.status === 'completed',
        rawItem: t
      });
    });

    todayReminders.forEach((r) => {
      items.push({
        id: r.id,
        type: 'reminder',
        time: r.time || 'Today',
        title: r.title,
        subtitle: 'Reminder',
        rawItem: r
      });
    });

    // Sort items by time string
    items.sort((a, b) => {
      if (a.time === 'All day' || a.time === 'Today') return 1;
      if (b.time === 'All day' || b.time === 'Today') return -1;
      return a.time.localeCompare(b.time);
    });

    return items;
  }, [todayEvents, todayTasks, todayReminders]);

  return (
    <div
      className="page-wrapper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto',
        boxSizing: 'border-box',
        paddingBottom: '3rem'
      }}
    >
      {/* =====================================================================
          1. GREETING & CONTEXT HEADER
          ===================================================================== */}
      <div
        style={{
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'nowrap',
          width: '100%'
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h1
            style={{
              fontSize: '1.625rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              margin: '0 0 2px 0',
              lineHeight: 1.2
            }}
          >
            {greeting}
          </h1>

          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>

          </p>
        </div>

        {/* Right Date Card — Placed sideways with text in the right empty space */}
        <div
          className="card"
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '12px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '3px 7px',
              minWidth: '36px'
            }}
          >
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
              {new Date().toLocaleString('en-US', { month: 'short' })}
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {new Date().getDate()}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {new Date().toLocaleString('en-US', { weekday: 'long' })}
            </span>
            <button
              type="button"
              onClick={() => setIsLifeLoadModalOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: '0.6875rem',
                color: loadStatus.color,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px'
              }}
              title="Click to view day load assessment"
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: loadStatus.dotColor
                }}
              />
              <span>{loadStatus.label}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. QUICK CAPTURE CARD (Image 2)
          ===================================================================== */}
      <section
        className="card"
        onClick={() => onOpenQuickAdd('task')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckSquare size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Quick capture
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              What do you need to remember?
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenQuickAdd();
          }}
          className="btn-ghost"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            padding: 0
          }}
          aria-label="Add item"
        >
          <Plus size={18} />
        </button>
      </section>

      {/* =====================================================================
          SARAL GROWTH & PERSONAL VAULT QUICK LAUNCH HUB
          ===================================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Growth, Habits & Personal Vault</span>
          </div>
          <button
            onClick={() => onNavigateTo('goals')}
            className="btn-ghost"
            style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, padding: '2px 6px' }}
          >
            Open All →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '12px' }}>
          {/* 1. Daily Planner */}
          <button
            onClick={() => onNavigateTo('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Sun size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Daily
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Time Blocks
              </div>
            </div>
          </button>

          {/* 2. Study Planner */}
          <button
            onClick={() => onNavigateTo('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <GraduationCap size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Study
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Syllabus
              </div>
            </div>
          </button>

          {/* 3. Visual Analytics */}
          <button
            onClick={() => onNavigateTo('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <BarChart3 size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Visual
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Metrics
              </div>
            </div>
          </button>

          {/* 4. Habit Tracker */}
          <button
            onClick={() => onNavigateTo('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Flame size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Habits
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Streaks
              </div>
            </div>
          </button>

          {/* 5. Savings Goals */}
          <button
            onClick={() => onNavigateTo('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <PiggyBank size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Savings
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Run-Rate
              </div>
            </div>
          </button>

          {/* 6. Personal Vault */}
          <button
            onClick={() => onNavigateTo('vault')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FolderSearch size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Vault
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Where Is It?
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Missed Reminders Recovery Banner (if any) */}
      {missedReminders.length > 0 && (
        <MissedRemindersBanner
          missedItems={missedReminders}
          onReview={() => onNavigateTo('reminders')}
          onClear={() => setMissedReminders([])}
        />
      )}

      {/* Arrived Messages from Past Self (if any) */}
      {readyFutureMessages.length > 0 && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--accent)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={18} color="var(--accent)" />
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                Note from past self
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {readyFutureMessages[0].title}
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: readyFutureMessages[0] })}
          >
            Open note
          </button>
        </div>
      )}

      {/* =====================================================================
          3. WORTH YOUR ATTENTION (Image 2)
          ===================================================================== */}
      <section
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '16px'
        }}
      >
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Worth your attention
        </div>

        {loadingAttention ? (
          <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ActivityBars />
            <span>Checking commitments...</span>
          </div>
        ) : attentionData.attentionItems.length === 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--success-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <CheckCircle2 size={16} color="var(--success)" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  You're clear.
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Nothing urgent needs your attention right now.
                </div>
              </div>
            </div>

            {/* 3 Metric Columns: Commitments, Waiting, Deadlines */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <CheckCircle2 size={16} color="var(--success)" />
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {counts.commitments}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Commitments
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <Clock size={16} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {counts.waiting}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Waiting
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <AlertTriangle size={16} color="#f97316" />
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {counts.deadlines}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Deadlines
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attentionData.attentionItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAttentionAction(item, 'open_context')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(249, 115, 22, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <AlertTriangle size={15} color="#f97316" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {item.reason}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
          4. TODAY SCHEDULE (Image 2)
          ===================================================================== */}
      <section
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '16px'
        }}
      >
        <div
          onClick={() => onNavigateTo('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Today
            </span>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res = await checkUpcomingTasksAndNotify(true);
                  if (res.tasks.length === 0) {
                    showToast('No upcoming tasks for today', { type: 'info' });
                  } else {
                    showToast(`Checked upcoming tasks: ${res.count} tasks found`, { type: 'success' });
                  }
                } catch {
                  showToast('Error checking upcoming tasks', { type: 'error' });
                }
              }}
              className="btn-ghost btn-sm"
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
              title="Check upcoming tasks and pass notification"
            >
              <Bell size={11} />
              <span>Check Upcoming</span>
            </button>
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" />
        </div>

        {todayTimelineItems.length === 0 ? (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Your day is open.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onOpenQuickAdd('task')}
                className="btn btn-secondary"
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={15} />
                <span>Add task</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenQuickAdd('event')}
                className="btn btn-secondary"
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={15} />
                <span>Add event</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayTimelineItems.map((item) => (
              <div
                key={`${item.type}_${item.id}`}
                onClick={() => setSelectedDetail({ type: item.type, data: item.rawItem })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', width: '48px', flexShrink: 0 }}>
                    {item.time}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
          5. OPEN LOOPS (Image 2)
          ===================================================================== */}
      <section
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '16px'
        }}
      >
        <div
          onClick={() => onNavigateTo('loops')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Open loops
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" />
        </div>

        {openLoopsList.length === 0 ? (
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Nothing unresolved right now.
            </div>
            <button
              type="button"
              onClick={() => onOpenQuickAdd('followup')}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} />
              <span>Add something you're waiting for</span>
            </button>
          </div>
        ) : (
          <div
            onClick={() => onNavigateTo('loops')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <RotateCcw size={15} color="#a855f7" />
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {openLoopsList.length} things you're waiting on
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-tertiary)" />
          </div>
        )}
      </section>

      {/* =====================================================================
          6. MONEY (Image 2)
          ===================================================================== */}
      <section
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '16px'
        }}
      >
        <div
          onClick={() => onNavigateTo('money')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Money
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatMoney(todayTotalSpentMinor, '₹')} today
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {formatMoney(monthlyTotalSpentMinor, '₹')} this month
          </div>
        </div>

        {todayExpenses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {todayExpenses.slice(0, 3).map((exp) => (
              <span
                key={exp.id}
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
              >
                {exp.category} · {formatMoney(exp.amountMinor, '₹')}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigateTo('money')}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>View money</span>
          <ChevronRight size={14} />
        </button>
      </section>

      {/* =====================================================================
          8. UP NEXT
          ===================================================================== */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <Calendar size={15} color="var(--accent)" />
            <span>Up Next</span>
          </div>
          <span className="badge badge-neutral">Tomorrow</span>
        </div>

        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {upNextItems.length > 0 ? `Tomorrow · ${upNextItems.length} things` : 'Tomorrow · Clear schedule'}
        </div>

        {upNextItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {upNextItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: '6px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.type}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =====================================================================
          8. RECENT ACTIVITY — ONLY DISPLAYED WHEN REAL USER DATA EXISTS
          ===================================================================== */}
      {recentActivities.length > 0 && (
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Clock size={15} color="var(--text-muted)" />
              <span>Recently added</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActivities.map((act) => (
              <div
                key={`${act.type}_${act.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontWeight: 600 }}>
                    {act.type}
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {act.title} {act.detail ? `· ${act.detail}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatRelativeTime(act.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <LifeLoadExplanationModal
        isOpen={isLifeLoadModalOpen}
        onClose={() => setIsLifeLoadModalOpen(false)}
        lifeLoad={attentionData.lifeLoad}
      />

      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />

      <LifeReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          refreshAttention();
        }}
      />

      <FutureMessageModal
        isOpen={futureModalConfig.isOpen}
        onClose={() => setFutureModalConfig({ isOpen: false, messageToRead: null })}
        messageToRead={futureModalConfig.messageToRead}
        onSaved={refreshAttention}
      />

      {/* Universal Real-Data Detail Modal */}
      <ItemDetailModal
        isOpen={!!selectedDetail.type}
        onClose={() => setSelectedDetail({ type: null, data: null })}
        itemType={selectedDetail.type}
        itemData={selectedDetail.data}
        onOpenContext={(type, id) => setContextModal({ isOpen: true, type, id })}
      />
    </div>
  );
};
