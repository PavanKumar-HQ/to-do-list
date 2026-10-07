// Attention Engine & Life Load Evaluator (Core OS Component)
// Evaluates the user's local database to surface what genuinely needs attention:
// Overdue, Waiting on someone, Promises made, Stale goals/tasks, Financial horizons, and Decisions due for review.

import { db } from '../db/db';
import type { AttentionItem, LifeLoadAssessment, TaskItem, ConsequenceLevel } from '../types';
import { getTodayDateString } from '../utils/dates';

export class AttentionService {
  /**
   * Evaluate the database and generate explainable attention items
   */
  public static async evaluateAttention(): Promise<{
    attentionItems: AttentionItem[];
    lifeLoad: LifeLoadAssessment;
    minimumDayTasks: TaskItem[];
  }> {
    const today = getTodayDateString();
    const todayMs = new Date(today).getTime();

    // Query active records
    const [
      tasks,
      followups,
      commitments,
      goals,
      decisions,
      recurringExpenses,
      notes,
      openLoops,
      people,
      warranties,
      careReminders
    ] = await Promise.all([
      db.tasks.filter(t => !t.deletedAt && t.status !== 'completed' && t.status !== 'archived').toArray(),
      db.followups.filter(f => !f.deletedAt && f.status !== 'resolved').toArray(),
      db.commitments.filter(c => !c.deletedAt && c.status === 'pending').toArray(),
      db.goals.filter(g => !g.deletedAt && g.status === 'active').toArray(),
      db.decisions.filter(d => !d.deletedAt && d.status === 'active').toArray(),
      db.recurringExpenses.filter(r => !r.deletedAt && r.isActive).toArray(),
      db.notes.filter(n => !n.deletedAt && !n.archivedAt).toArray(),
      db.openLoops.filter(l => !l.deletedAt && l.status === 'open').toArray(),
      db.people.filter(p => !p.deletedAt).toArray(),
      db.warranties.filter(w => !w.deletedAt && w.status !== 'archived').toArray(),
      db.careReminders.filter(c => !c.deletedAt && c.status === 'active').toArray()
    ]);

    const peopleMap = new Map(people.map(p => [p.id, p.name]));
    const attentionItems: AttentionItem[] = [];

    // 1. OVERDUE TASKS & HIGH CONSEQUENCE ITEMS
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today);
    for (const t of overdueTasks) {
      const consequence = t.consequence || (t.priority === 'high' ? 'important' : 'none');
      const isCritical = consequence === 'critical' || consequence === 'significant';
      attentionItems.push({
        id: `att_task_overdue_${t.id}`,
        type: 'overdue',
        title: t.title,
        reason: t.why ? `Overdue since ${t.dueDate} · Why: ${t.why}` : `Overdue since ${t.dueDate}`,
        severity: isCritical ? 'critical' : 'high',
        consequence,
        entityType: 'task',
        entityId: t.id,
        date: t.dueDate,
        actionLabel: 'Complete',
        suggestedActions: ['complete', 'reschedule', 'make_smaller', 'open_context']
      });
    }

    // 2. REPEATED POSTPONEMENTS (Section 9)
    const postponedTasks = tasks.filter(t => (t.postponeCount || 0) >= 3);
    for (const t of postponedTasks) {
      attentionItems.push({
        id: `att_task_postponed_${t.id}`,
        type: 'postponed',
        title: t.title,
        reason: `You've postponed this ${t.postponeCount} times. Decide whether to act or let it go.`,
        severity: 'medium',
        consequence: t.consequence,
        entityType: 'task',
        entityId: t.id,
        suggestedActions: ['complete', 'make_smaller', 'archive', 'snooze']
      });
    }

    // 3. WAITING ON SOMEONE (Section 13)
    for (const f of followups) {
      const personName = peopleMap.get(f.personId) || f.personName;
      const daysWaiting = f.dueDate ? Math.max(0, Math.floor((todayMs - new Date(f.dueDate).getTime()) / 86400000)) : 0;
      attentionItems.push({
        id: `att_followup_${f.id}`,
        type: 'waiting',
        title: `Waiting on ${personName}: ${f.subject}`,
        reason: daysWaiting > 0 ? `Waiting for ${daysWaiting} days past expected date.` : `Expected response from ${personName}.`,
        severity: daysWaiting > 4 ? 'high' : 'medium',
        entityType: 'followup',
        entityId: f.id,
        actionLabel: 'Follow Up',
        suggestedActions: ['complete', 'snooze', 'open_context']
      });
    }

    // 4. COMMITMENTS & PROMISES (Section 14)
    for (const c of commitments) {
      const isOverdue = c.promisedDate < today;
      const isDueToday = c.promisedDate === today;
      if (isOverdue || isDueToday) {
        attentionItems.push({
          id: `att_commitment_${c.id}`,
          type: 'commitment',
          title: `You promised ${c.who}: ${c.what}`,
          reason: isOverdue ? `Commitment was due on ${c.promisedDate}.` : `Promised for today.`,
          severity: isOverdue ? 'critical' : 'high',
          entityType: 'commitment',
          entityId: c.id,
          date: c.promisedDate,
          actionLabel: 'Fulfill',
          suggestedActions: ['complete', 'reschedule', 'open_context']
        });
      }
    }

    // 5. STALE GOALS (Section 8)
    for (const g of goals) {
      const lastActive = g.lastActivityAt || g.updatedAt || g.createdAt;
      const daysInactive = Math.floor((todayMs - new Date(lastActive).getTime()) / 86400000);
      if (daysInactive >= 21) {
        attentionItems.push({
          id: `att_stale_goal_${g.id}`,
          type: 'stale',
          title: `Stale Goal: ${g.title}`,
          reason: `No activity for ${daysInactive} days. Still relevant?`,
          severity: 'medium',
          entityType: 'goal',
          entityId: g.id,
          suggestedActions: ['open_context', 'make_smaller', 'archive']
        });
      }
    }

    // 6. DECISIONS DUE FOR REVIEW (Section 6)
    for (const d of decisions) {
      if (d.reviewDate && d.reviewDate <= today) {
        attentionItems.push({
          id: `att_decision_${d.id}`,
          type: 'decision_review',
          title: `Review Decision: ${d.title}`,
          reason: `Scheduled review date reached. Reason was: "${d.reason}"`,
          severity: 'medium',
          entityType: 'decision',
          entityId: d.id,
          suggestedActions: ['open_context', 'complete']
        });
      }
    }

    // 7. UPCOMING FINANCIAL COMMITMENTS (Section 18, 20)
    const upcomingThreshold = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
    let upcomingPaymentSum = 0;
    for (const r of recurringExpenses) {
      if (r.nextDueDate >= today && r.nextDueDate <= upcomingThreshold) {
        upcomingPaymentSum += r.amountMinor;
        attentionItems.push({
          id: `att_payment_${r.id}`,
          type: 'financial',
          title: `Upcoming Payment: ${r.title}`,
          reason: `Due on ${r.nextDueDate} (₹${(r.amountMinor / 100).toFixed(0)})`,
          severity: 'medium',
          entityType: 'recurring_expense',
          entityId: r.id,
          date: r.nextDueDate,
          suggestedActions: ['complete', 'open_context']
        });
      }
    }

    // 8. TEMPORAL MEMORY RESURFACING (Section 31)
    for (const n of notes) {
      if (n.resurfaceDate && n.resurfaceDate <= today) {
        attentionItems.push({
          id: `att_note_resurface_${n.id}`,
          type: 'resurface',
          title: `Memory Resurfaced: ${n.title}`,
          reason: n.why ? `Revisit note · Why: ${n.why}` : `Scheduled to be revisited today.`,
          severity: 'info',
          entityType: 'note',
          entityId: n.id,
          suggestedActions: ['open_context', 'archive']
        });
      }
    }

    // 9. EXPIRING WARRANTIES (Section 26, 39)
    for (const w of warranties) {
      const daysLeft = Math.ceil((new Date(w.warrantyEnd).getTime() - todayMs) / 86400000);
      const threshold = w.reminderDaysBefore ?? 30;
      if (daysLeft >= 0 && daysLeft <= threshold) {
        attentionItems.push({
          id: `att_warranty_${w.id}`,
          type: 'resurface',
          title: `Warranty expiring: ${w.itemName}`,
          reason: daysLeft === 0 ? `Warranty expires today!` : `Expires in ${daysLeft} days (${w.warrantyEnd}).`,
          severity: daysLeft <= 7 ? 'high' : 'medium',
          entityType: 'warranty',
          entityId: w.id,
          date: w.warrantyEnd,
          suggestedActions: ['open_context']
        });
      }
    }

    // 10. FAMILY CARE REMINDERS (Section 29, 39)
    for (const cr of careReminders) {
      const isDue = cr.dueDate <= today;
      if (isDue) {
        attentionItems.push({
          id: `att_care_${cr.id}`,
          type: 'waiting',
          title: `Family Care: ${cr.familyMemberName} · ${cr.title}`,
          reason: `Due: ${cr.dueDate}${cr.dueTime ? ' ' + cr.dueTime : ''} (${cr.reminderType.replace('_', ' ')})`,
          severity: cr.dueDate < today ? 'critical' : 'high',
          entityType: 'care_reminder',
          entityId: cr.id,
          date: cr.dueDate,
          actionLabel: 'Complete',
          suggestedActions: ['complete', 'open_context']
        });
      }
    }

    // Sort attention items by severity
    const severityWeight = { critical: 4, high: 3, medium: 2, info: 1 };
    attentionItems.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

    // Compute Life Load (Section 23)
    const todayTasks = tasks.filter(t => t.dueDate === today);
    const criticalItems = attentionItems.filter(a => a.severity === 'critical' || a.consequence === 'critical');
    const waitingItems = attentionItems.filter(a => a.type === 'waiting');
    const staleItems = attentionItems.filter(a => a.type === 'stale');

    const score =
      overdueTasks.length * 3 +
      todayTasks.length * 1 +
      waitingItems.length * 2 +
      commitments.length * 2 +
      criticalItems.length * 4 +
      staleItems.length * 1;

    let level: LifeLoadAssessment['level'] = 'light';
    let summary = 'Everything is calm and under control.';
    if (score > 22) {
      level = 'overloaded';
      summary = 'High volume of urgent commitments. Focus only on the Minimum Day.';
    } else if (score > 12) {
      level = 'heavy';
      summary = 'Substantial load requiring active attention across multiple loops.';
    } else if (score > 5) {
      level = 'moderate';
      summary = 'A balanced set of commitments requiring focused execution.';
    }

    const lifeLoad: LifeLoadAssessment = {
      level,
      score,
      summary,
      breakdown: {
        overdueCount: overdueTasks.length,
        todayCount: todayTasks.length,
        waitingCount: waitingItems.length,
        staleCount: staleItems.length,
        upcomingPaymentMinor: upcomingPaymentSum,
        criticalCount: criticalItems.length,
        openLoopCount: openLoops.length + attentionItems.length
      }
    };

    // Calculate The "Minimum Day" (Section 10)
    // If you only do three things today, do these:
    const candidateTasks = [...tasks].sort((a, b) => {
      // 1. Manually starred for minimum day
      if (a.isMinimumDay && !b.isMinimumDay) return -1;
      if (!a.isMinimumDay && b.isMinimumDay) return 1;

      // 2. Consequence hierarchy
      const consequenceRanks: Record<ConsequenceLevel, number> = {
        critical: 5,
        significant: 4,
        important: 3,
        minor: 2,
        none: 1
      };
      const rankA = consequenceRanks[a.consequence || 'none'];
      const rankB = consequenceRanks[b.consequence || 'none'];
      if (rankA !== rankB) return rankB - rankA;

      // 3. Overdue state
      const isOverdueA = a.dueDate && a.dueDate < today ? 1 : 0;
      const isOverdueB = b.dueDate && b.dueDate < today ? 1 : 0;
      if (isOverdueA !== isOverdueB) return isOverdueB - isOverdueA;

      // 4. Due today
      const isTodayA = a.dueDate === today ? 1 : 0;
      const isTodayB = b.dueDate === today ? 1 : 0;
      return isTodayB - isTodayA;
    });

    const minimumDayTasks = candidateTasks.slice(0, 3);

    return {
      attentionItems: attentionItems.slice(0, 8), // Top 8 items to prevent overload
      lifeLoad,
      minimumDayTasks
    };
  }
}
