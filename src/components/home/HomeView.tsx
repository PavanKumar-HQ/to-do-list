// HomeView — Private Memory & Action Operating System (Sections 1, 10, 23, 37, 38)
// Replaces generic productivity dashboard with Attention Engine, Minimum Day, Life Load, Open Loops, and Context Graph.

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Network,
  ArrowRight,
  TrendingDown,
  Layers,
  Target,
  RotateCcw,
  TrendingUp,
  Filter,
  Compass,
  Inbox,
  User,
  Plus,
  HelpCircle,
  Archive,
  Eye,
  CheckSquare,
  Mail
} from 'lucide-react';
import { db, logAudit } from '../../db/db';
import { getTodayDateString, getCurrentMonthString, formatDisplayDate } from '../../utils/dates';
import { formatMoney } from '../../utils/currency';
import { useToast } from '../common/ToastContext';
import { AttentionService } from '../../services/attentionService';
import { TaskRepository, CommitmentRepository, OpenLoopRepository } from '../../repositories';
import { ContextModal } from '../common/ContextModal';
import { LifeReviewModal } from '../loops/LifeReviewModal';
import { FutureMessageModal } from '../loops/FutureMessageModal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { MissedRemindersBanner } from '../reminders/MissedRemindersBanner';
import { checkMissedReminders } from '../../services/notificationService';
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

  // Minimum Day mode toggle (Section 10)
  const [minimumDayOnly, setMinimumDayOnly] = useState(false);

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

  // Missed Reminders recovery state (Section 41)
  const [missedReminders, setMissedReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    checkMissedReminders().then(setMissedReminders);

    const unsubMissed = eventBus.subscribe('MISSED_REMINDERS', (e) => {
      if (e.data?.items) {
        setMissedReminders(e.data.items);
      }
    });

    const unsubMutated = eventBus.subscribe('REMINDER_MUTATED', () => {
      checkMissedReminders().then(setMissedReminders);
    });

    return () => {
      unsubMissed();
      unsubMutated();
    };
  }, []);

  const readyFutureMessages = useLiveQuery(() => {
    return db.futureMessages.filter(m => !m.deletedAt && !m.isOpened && m.openDate <= todayStr).toArray();
  }, [todayStr]) || [];

  const lastReviewSession = useLiveQuery(() => {
    return db.reviewSessions.orderBy('completedAt').reverse().first();
  }, []);

  const closedLoopsCount = useLiveQuery(() => {
    return db.openLoops.filter(l => !l.deletedAt && l.status === 'closed').count();
  }, []) || 0;

  const fulfilledCommitmentsCount = useLiveQuery(() => {
    return db.commitments.filter(c => !c.deletedAt && c.status === 'fulfilled').count();
  }, []) || 0;

  const completedTasksCount = useLiveQuery(() => {
    return db.tasks.filter(t => !t.deletedAt && t.status === 'completed').count();
  }, []) || 0;

  // Live queries for quick tallies
  const settings = useLiveQuery(() => db.settings.get('current_settings'), []);

  const inboxCount = useLiveQuery(() => {
    return db.inbox.filter((i) => !i.deletedAt && !i.isProcessed).count();
  }, []) || 0;

  const todayEvents = useLiveQuery(() => {
    return db.events.filter((e) => !e.deletedAt && e.date === todayStr).toArray();
  }, [todayStr]) || [];

  const todayExpenses = useLiveQuery(() => {
    return db.expenses.filter((e) => !e.deletedAt && e.date === todayStr).toArray();
  }, [todayStr]) || [];

  const monthlyExpenses = useLiveQuery(() => {
    return db.expenses.filter((e) => !e.deletedAt && e.date.startsWith(currentMonth)).toArray();
  }, [currentMonth]) || [];

  const openLoopsList = useLiveQuery(() => {
    return db.openLoops.filter((l) => !l.deletedAt && l.status === 'open').limit(4).toArray();
  }, []) || [];

  const todayTotalSpentMinor = todayExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const monthlyTotalSpentMinor = monthlyExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

  // Backup status
  const lastBackup = settings?.lastBackupDate ? settings.lastBackupDate.split('T')[0] : null;

  // Actions for Attention items
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

  const getLifeLoadBadge = (level?: string) => {
    switch (level) {
      case 'overloaded':
        return { label: 'Life Load: Overloaded', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'heavy':
        return { label: 'Life Load: Heavy', bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' };
      case 'moderate':
        return { label: 'Life Load: Moderate', bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      default:
        return { label: 'Life Load: Light', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    }
  };

  const loadBadge = getLifeLoadBadge(attentionData.lifeLoad?.level);

  return (
    <div className="content-max-width" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header with Clean, Professional Typography */}
      <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              {formatDisplayDate(todayStr)}
            </h1>
          </div>

          {/* Backup & Inbox Status Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {inboxCount > 0 && (
              <button
                onClick={() => onNavigateTo('inbox')}
                className="btn btn-sm btn-secondary"
                style={{ borderRadius: '20px', gap: '0.375rem' }}
              >
                <Inbox size={13} color="var(--primary)" />
                <span>Inbox: {inboxCount} to process</span>
              </button>
            )}

            <button
              onClick={() => onNavigateTo('settings')}
              className="btn btn-sm btn-secondary"
              style={{
                borderRadius: '20px',
                gap: '0.375rem',
                color: lastBackup ? 'var(--text-muted)' : 'var(--danger)',
                borderColor: lastBackup ? 'var(--border-strong)' : 'var(--danger-border)'
              }}
            >
              <span>{lastBackup ? `Backup: ${lastBackup}` : 'No backup yet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Missed Reminders Recovery Banner (Section 41) */}
      {missedReminders.length > 0 && (
        <MissedRemindersBanner
          missedItems={missedReminders}
          onReview={() => onNavigateTo('reminders')}
          onClear={() => setMissedReminders([])}
        />
      )}

      {/* Arrived Messages from Past Self */}
      {readyFutureMessages.length > 0 && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Mail size={18} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Message From Past Self Arrived
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {readyFutureMessages[0].title}
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
            onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: readyFutureMessages[0] })}
          >
            Read Message
          </button>
        </div>
      )}

      {/* Weekly Review Prompt */}
      {(!lastReviewSession || (new Date().getTime() - new Date(lastReviewSession.completedAt).getTime() > 7 * 86400000)) && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <RotateCcw size={18} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Weekly Life Review Due
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {lastReviewSession ? `Last completed ${formatDisplayDate(lastReviewSession.completedAt.slice(0, 10))}` : 'Review open loops, commitments, and stagnant backlog.'}
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setIsReviewModalOpen(true)}
          >
            Start Life Review
          </button>
        </div>
      )}

      {/* Momentum (Meaningful Outcomes) - Section 1, 38 */}
      {settings?.momentumEnabled && (
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <TrendingUp size={16} color="#059669" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Overview
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {closedLoopsCount}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Loops Closed
              </div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fulfilledCommitmentsCount}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Promises Kept
              </div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {completedTasksCount}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tasks Completed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Life Load Radar Banner (Section 23) */}
      {attentionData.lifeLoad && (
        <div
          style={{
            background: loadBadge.bg,
            border: `1px solid ${loadBadge.border}`,
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: loadBadge.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {loadBadge.label}
            </span>
            <span style={{ fontSize: '0.75rem', color: loadBadge.text }}>
              Load Score: {attentionData.lifeLoad.score}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: loadBadge.text }}>
            {attentionData.lifeLoad.summary}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            {attentionData.lifeLoad.breakdown.overdueCount > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: loadBadge.text }}>
                {attentionData.lifeLoad.breakdown.overdueCount} Overdue
              </span>
            )}
            {attentionData.lifeLoad.breakdown.waitingCount > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: loadBadge.text }}>
                {attentionData.lifeLoad.breakdown.waitingCount} Waiting on others
              </span>
            )}
            {attentionData.lifeLoad.breakdown.staleCount > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: loadBadge.text }}>
                {attentionData.lifeLoad.breakdown.staleCount} Going stale
              </span>
            )}
            {attentionData.lifeLoad.breakdown.upcomingPaymentMinor > 0 && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: loadBadge.text }}>
                {formatMoney(attentionData.lifeLoad.breakdown.upcomingPaymentMinor, '₹')} Upcoming payments
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. The "Needs Your Attention" Engine (Section 1, 52) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Needs Your Attention
            </h2>
          </div>
        </div>

        {loadingAttention ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <LoadingSpinner message="Checking what needs your attention..." />
          </div>
        ) : attentionData.attentionItems.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', border: '1px dashed var(--border-strong)' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>All clear</div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No overdue commitments, waiting items, or critical deadlines right now.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {attentionData.attentionItems.map((item) => {
              const isCrit = item.severity === 'critical';
              const isHigh = item.severity === 'high';
              const borderCol = isCrit ? '#ef4444' : isHigh ? '#f59e0b' : 'var(--border)';

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    padding: '0.875rem 1rem',
                    borderLeft: `4px solid ${borderCol}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '3px',
                            background: isCrit ? '#fee2e2' : isHigh ? '#fef3c7' : '#f1f5f9',
                            color: isCrit ? '#991b1b' : isHigh ? '#92400e' : 'var(--text-muted)'
                          }}
                        >
                          {item.type.replace('_', ' ')}
                        </span>
                        {item.consequence && item.consequence !== 'none' && (
                          <span style={{ fontSize: '0.6875rem', color: '#b45309', fontWeight: 500 }}>
                            Consequence: {item.consequence}
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {item.title}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {item.reason}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
                    {item.suggestedActions.includes('complete') && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAttentionAction(item, 'complete')}
                      >
                        {item.actionLabel || 'Do It'}
                      </button>
                    )}
                    {item.suggestedActions.includes('open_context') && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ gap: '0.25rem' }}
                        onClick={() => handleAttentionAction(item, 'open_context')}
                      >
                        <Network size={12} />
                        <span>Context</span>
                      </button>
                    )}
                    {item.suggestedActions.includes('snooze') && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleAttentionAction(item, 'snooze')}
                      >
                        Snooze
                      </button>
                    )}
                    {item.suggestedActions.includes('archive') && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => handleAttentionAction(item, 'archive')}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. The "Minimum Day" Focus Engine (Section 10) */}
      <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #d97706' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 26, height: 26, borderRadius: '6px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={15} color="#d97706" />
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
              The Minimum Day
            </span>
          </div>
          <button
            onClick={() => setMinimumDayOnly(!minimumDayOnly)}
            className={`btn btn-sm ${minimumDayOnly ? 'btn-primary' : 'btn-secondary'}`}
            style={{ gap: '0.375rem' }}
          >
            <Filter size={13} />
            <span>{minimumDayOnly ? 'Show All Tasks' : 'Filter Minimum Day'}</span>
          </button>
        </div>

        {attentionData.minimumDayTasks.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
            No critical tasks assigned for today. You are fully clear.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {attentionData.minimumDayTasks.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  padding: '0.5rem 0',
                  borderBottom: idx < attentionData.minimumDayTasks.length - 1 ? '1px solid var(--border-light)' : 'none'
                }}
              >
                <button
                  onClick={async () => {
                    await TaskRepository.complete(task.id);
                    refreshAttention();
                    showToast('Minimum day task completed', { type: 'success' });
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0.125rem',
                    marginTop: '0.125rem'
                  }}
                >
                  <CheckSquare size={16} />
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {task.title}
                  </div>
                  {task.why && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      Why: {task.why}
                    </div>
                  )}
                  {task.consequence && task.consequence !== 'none' && (
                    <div style={{ fontSize: '0.6875rem', color: '#b45309', fontWeight: 500, marginTop: '0.125rem' }}>
                      Consequence if missed: {task.consequence}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'task', id: task.id })}
                  className="btn btn-sm btn-secondary"
                  style={{ padding: '4px 8px', minHeight: '28px' }}
                  title="View Context"
                >
                  <Eye size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Schedule & Today's Events */}
      {todayEvents.length > 0 && (
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Calendar size={16} color="var(--primary)" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Today's Schedule & Events ({todayEvents.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {todayEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.625rem 0.75rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {evt.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {evt.startTime ? `${evt.startTime} - ${evt.endTime || 'End'}` : 'All Day'} {evt.location ? `· ${evt.location}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setContextModal({ isOpen: true, type: 'event', id: evt.id })}
                  className="btn btn-sm btn-secondary"
                  style={{ gap: '0.25rem' }}
                >
                  <Compass size={12} />
                  <span>Pre-Event Brief</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Money Connected to Life (Section 19, 20) */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Financial Horizon
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => onOpenQuickAdd('expense')}
              className="btn btn-sm btn-secondary"
              style={{ gap: '0.375rem' }}
            >
              <Plus size={13} />
              <span>Log Expense</span>
            </button>
            <button
              onClick={() => onNavigateTo('money')}
              className="btn btn-sm btn-primary"
              style={{ gap: '0.375rem' }}
            >
              <span>Manage Money</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.875rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Spent Today
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {formatMoney(todayTotalSpentMinor, '₹')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', padding: '0.875rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              This Month
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {formatMoney(monthlyTotalSpentMinor, '₹')}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />

      {/* 8. Life Review Modal */}
      <LifeReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          refreshAttention();
        }}
      />

      {/* 9. Future Message Modal */}
      <FutureMessageModal
        isOpen={futureModalConfig.isOpen}
        onClose={() => setFutureModalConfig({ isOpen: false, messageToRead: null })}
        messageToRead={futureModalConfig.messageToRead}
        onSaved={refreshAttention}
      />
    </div>
  );
};
