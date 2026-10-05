// LifeReviewModal — Guided Weekly & Monthly Life Review (Sections 33, 34)
// Allows the user to systematically clear cognitive load, close open loops, review commitments, and purge stagnant tasks.

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Trash2,
  RotateCcw,
  HelpCircle,
  Layers,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { db } from '../../db/db';
import { OpenLoopRepository, CommitmentRepository, TaskRepository, ReviewSessionRepository } from '../../repositories';
import { getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { OpenLoopItem, CommitmentItem, TaskItem, DecisionItem, GoalItem } from '../../types';

interface LifeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const LifeReviewModal: React.FC<LifeReviewModalProps> = ({ isOpen, onClose, onCompleted }) => {
  const { showToast } = useToast();
  const today = getTodayDateString();

  const [step, setStep] = useState<number>(1);
  const totalSteps = 5;

  // Review State Data
  const [openLoops, setOpenLoops] = useState<OpenLoopItem[]>([]);
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [postponedTasks, setPostponedTasks] = useState<TaskItem[]>([]);
  const [decisionsForReview, setDecisionsForReview] = useState<DecisionItem[]>([]);
  const [reflectionNote, setReflectionNote] = useState('');

  // Counters for review session record
  const [closedLoopsCount, setClosedLoopsCount] = useState(0);
  const [reviewedCommitmentsCount, setReviewedCommitmentsCount] = useState(0);
  const [cleanedTasksCount, setCleanedTasksCount] = useState(0);

  // Load all review items on open
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setReflectionNote('');
      setClosedLoopsCount(0);
      setReviewedCommitmentsCount(0);
      setCleanedTasksCount(0);
      return;
    }

    const loadData = async () => {
      const loops = await db.openLoops.filter(l => !l.deletedAt && l.status === 'open').toArray();
      const comms = await db.commitments.filter(c => !c.deletedAt && c.status === 'pending').toArray();
      const tasks = await db.tasks
        .filter(t => !t.deletedAt && t.status !== 'completed' && ((t.postponeCount || 0) > 0 || (!!t.dueDate && t.dueDate < today)))
        .toArray();
      const decs = await db.decisions
        .filter(d => !d.deletedAt && d.status === 'active' && !!d.reviewDate && d.reviewDate <= today)
        .toArray();

      setOpenLoops(loops);
      setCommitments(comms);
      setPostponedTasks(tasks);
      setDecisionsForReview(decs);
    };

    loadData();
  }, [isOpen, today]);

  if (!isOpen) return null;

  const handleCloseLoop = async (loopId: string) => {
    try {
      await OpenLoopRepository.close(loopId);
      setOpenLoops(prev => prev.filter(l => l.id !== loopId));
      setClosedLoopsCount(c => c + 1);
      showToast('Open loop closed', { type: 'success' });
    } catch (err: any) {
      showToast(err.message || 'Failed to close loop', { type: 'error' });
    }
  };

  const handleFulfillCommitment = async (commId: string) => {
    try {
      await CommitmentRepository.fulfill(commId);
      setCommitments(prev => prev.filter(c => c.id !== commId));
      setReviewedCommitmentsCount(c => c + 1);
      showToast('Commitment fulfilled', { type: 'success' });
    } catch (err: any) {
      showToast(err.message || 'Failed to update commitment', { type: 'error' });
    }
  };

  const handleDropTask = async (taskId: string) => {
    try {
      await TaskRepository.softDelete(taskId);
      setPostponedTasks(prev => prev.filter(t => t.id !== taskId));
      setCleanedTasksCount(c => c + 1);
      showToast('Task dropped / moved to trash', { type: 'info' });
    } catch (err: any) {
      showToast(err.message || 'Failed to drop task', { type: 'error' });
    }
  };

  const handleReviewDecision = async (decisionId: string) => {
    try {
      await db.decisions.update(decisionId, {
        status: 'reviewed',
        updatedAt: new Date().toISOString()
      });
      setDecisionsForReview(prev => prev.filter(d => d.id !== decisionId));
      showToast('Decision marked as reviewed', { type: 'success' });
    } catch (err: any) {
      showToast(err.message || 'Failed to review decision', { type: 'error' });
    }
  };

  const handleFinishReview = async () => {
    try {
      await ReviewSessionRepository.recordSession({
        reviewType: 'weekly',
        loopsClosedCount: closedLoopsCount,
        commitmentsReviewedCount: reviewedCommitmentsCount,
        tasksCleanedCount: cleanedTasksCount,
        notesArchivedCount: 0,
        notes: reflectionNote.trim() || undefined
      });

      showToast('Weekly Life Review completed & logged', { type: 'success' });
      if (onCompleted) onCompleted();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save review session', { type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          minHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '680px',
          margin: '0 auto'
        }}
      >
        <div className="sheet-handle" />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={16} color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Life Review · Step {step} of {totalSteps}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.25rem 0 0', color: 'var(--text-primary)' }}>
              {step === 1 && 'What are you waiting on from others?'}
              {step === 2 && 'What did you promise to others or yourself?'}
              {step === 3 && 'What tasks have been delayed multiple times?'}
              {step === 4 && 'Which decisions need a second look?'}
              {step === 5 && 'Weekly Review Summary & Reflection'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '1.5rem' }}>
          {/* Step 1: Waiting Items */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Review active items where you are waiting on a response, document, or deliverable from someone else.
              </p>
              {openLoops.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  You are not waiting on anything right now. Slate is clear.
                </div>
              ) : (
                openLoops.map(loop => (
                  <div key={loop.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#b45309', background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '3px', display: 'inline-block', fontWeight: 600 }}>
                        {loop.waitingOnPersonName ? `Waiting on ${loop.waitingOnPersonName}` : 'Pending Item'}
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                        {loop.title}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', borderColor: '#fcd34d', color: '#92400e' }}
                      onClick={() => handleCloseLoop(loop.id)}
                    >
                      Resolved
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 2: Commitments */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Promises made to colleagues, family, friends, or yourself. Check if any are fulfilled or need proactive renegotiation.
              </p>
              {commitments.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No pending commitments. Your slate is clean.
                </div>
              ) : (
                commitments.map(comm => (
                  <div key={comm.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                        Promised to: {comm.who} · Due {comm.promisedDate}
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                        {comm.what}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                      onClick={() => handleFulfillCommitment(comm.id)}
                    >
                      Fulfill Promise
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 3: Repeatedly Postponed / Overdue Tasks */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Tasks that have been repeatedly delayed or missed. If a task has been postponed multiple times, consider dropping it rather than perpetually rescheduling guilt.
              </p>
              {postponedTasks.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No overdue or repeatedly postponed tasks.
                </div>
              ) : (
                postponedTasks.map(task => (
                  <div key={task.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '0.125rem 0.375rem', borderRadius: '3px' }}>
                          Postponed {task.postponeCount || 0} times
                        </span>
                        {task.dueDate && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Due {task.dueDate}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                        {task.title}
                      </div>
                      {task.why && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                          Why: {task.why}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--danger)' }}
                        onClick={() => handleDropTask(task.id)}
                        title="Drop / Delete from backlog"
                      >
                        <Trash2 size={13} style={{ marginRight: '4px' }} />
                        Drop
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={async () => {
                          await TaskRepository.complete(task.id);
                          setPostponedTasks(prev => prev.filter(t => t.id !== task.id));
                          setCleanedTasksCount(c => c + 1);
                          showToast('Task marked complete', { type: 'success' });
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 4: Decisions Due for Review */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Decisions you recorded with a scheduled review date. Review whether the original reasoning still holds.
              </p>
              {decisionsForReview.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No decisions currently scheduled for review.
                </div>
              ) : (
                decisionsForReview.map(dec => (
                  <div key={dec.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          Decided on {dec.decisionDate}
                        </span>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0.125rem 0 0' }}>
                          {dec.title}
                        </h4>
                      </div>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => handleReviewDecision(dec.id)}
                      >
                        Mark Reviewed
                      </button>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.625rem', borderRadius: '4px', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Reasoning: </span>
                      {dec.reason}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 5: Summary & Reflection */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {closedLoopsCount}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Loops Closed
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {reviewedCommitmentsCount}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Promises Checked
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {cleanedTasksCount}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Backlog Cleaned
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Weekly Life Reflections / Notes (Private)
                </label>
                <textarea
                  rows={4}
                  className="input"
                  placeholder="What worked this week? What needs adjustment? What load should be dropped?"
                  value={reflectionNote}
                  onChange={e => setReflectionNote(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
          {step > 1 ? (
            <button
              className="btn btn-secondary"
              onClick={() => setStep(s => s - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <ArrowLeft size={14} />
              Previous
            </button>
          ) : <div />}

          {step < totalSteps ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleFinishReview}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            >
              <CheckCircle2 size={15} />
              Complete Life Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
