import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Target,
  Repeat,
  Plus,
  CheckCircle,
  RotateCcw,
  Trash2,
  Calendar,
  X
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { GoalItem, RoutineItem, Milestone } from '../../types';

export const GoalsView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'goals' | 'routines'>('routines');

  // New Routine State
  const [isNewRoutineOpen, setIsNewRoutineOpen] = useState(false);
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineFrequency, setRoutineFrequency] = useState<RoutineItem['frequency']>('daily');
  const [routineSteps, setRoutineSteps] = useState<string[]>(['Step 1', 'Step 2']);

  // New Goal State
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalUnit, setGoalUnit] = useState('₹');
  const [goalDeadline, setGoalDeadline] = useState('');

  // Queries
  const routines = useLiveQuery(async () => {
    return db.routines.filter((r) => !r.deletedAt).toArray();
  }, []) || [];

  const goals = useLiveQuery(async () => {
    return db.goals.filter((g) => !g.deletedAt).toArray();
  }, []) || [];

  // Toggle routine step
  const handleToggleRoutineStep = async (routine: RoutineItem, stepId: string) => {
    const updatedSteps = routine.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
    const allCompleted = updatedSteps.every((s) => s.completed);
    await db.routines.update(routine.id, {
      steps: updatedSteps,
      lastCompletedDate: allCompleted ? getTodayDateString() : routine.lastCompletedDate,
      updatedAt: new Date().toISOString()
    });
  };

  // Reset routine
  const handleResetRoutine = async (routine: RoutineItem) => {
    const resetSteps = routine.steps.map((s) => ({ ...s, completed: false }));
    await db.routines.update(routine.id, {
      steps: resetSteps,
      updatedAt: new Date().toISOString()
    });
    showToast(`Routine reset: ${routine.title}`);
  };

  const handleSaveRoutine = async () => {
    if (!routineTitle.trim()) {
      showToast('Please enter routine title', { type: 'warning' });
      return;
    }
    const cleanSteps = routineSteps.filter((s) => s.trim().length > 0);
    const nowIso = new Date().toISOString();
    await db.routines.add({
      id: generateId(),
      title: routineTitle.trim(),
      frequency: routineFrequency,
      steps: cleanSteps.map((title) => ({ id: generateId(), title, completed: false })),
      createdAt: nowIso,
      updatedAt: nowIso
    });
    showToast(`Created routine: ${routineTitle}`, { type: 'success' });
    setIsNewRoutineOpen(false);
    setRoutineTitle('');
  };

  const handleSaveGoal = async () => {
    if (!goalTitle.trim() || !goalTarget) {
      showToast('Title and target are required', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    await db.goals.add({
      id: generateId(),
      title: goalTitle.trim(),
      targetAmount: parseFloat(goalTarget) || 0,
      currentAmount: 0,
      unit: goalUnit,
      deadline: goalDeadline || undefined,
      status: 'active',
      milestones: [],
      createdAt: nowIso,
      updatedAt: nowIso
    });
    showToast(`Goal set: ${goalTitle}`, { type: 'success' });
    setIsNewGoalOpen(false);
    setGoalTitle('');
    setGoalTarget('');
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Goals & Routines</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Habitual checklists and long-term milestones
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'routines') setIsNewRoutineOpen(true);
            else setIsNewGoalOpen(true);
          }}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>New {activeTab === 'routines' ? 'Routine' : 'Goal'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('routines')}
          className={`btn btn-sm ${activeTab === 'routines' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px' }}
        >
          Routines ({routines.length})
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`btn btn-sm ${activeTab === 'goals' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px' }}
        >
          Goals ({goals.length})
        </button>
      </div>

      {activeTab === 'routines' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {routines.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Repeat size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No recurring routines configured.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Setup morning routines, evening checklists, or weekly reviews.
              </div>
            </div>
          ) : (
            routines.map((routine) => {
              const completedCount = routine.steps.filter((s) => s.completed).length;
              const isAllDone = completedCount === routine.steps.length && routine.steps.length > 0;

              return (
                <div key={routine.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{routine.title}</span>
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {routine.frequency}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {completedCount} of {routine.steps.length} completed
                        {routine.lastCompletedDate && ` • Last completed ${formatDisplayDate(routine.lastCompletedDate)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleResetRoutine(routine)}
                        className="btn-ghost"
                        style={{ padding: '6px', color: 'var(--text-secondary)' }}
                        title="Reset steps"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          await db.routines.update(routine.id, { deletedAt: new Date().toISOString() });
                          showToast('Routine moved to trash');
                        }}
                        className="btn-ghost"
                        style={{ padding: '6px', color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {routine.steps.map((step) => (
                      <div
                        key={step.id}
                        onClick={() => handleToggleRoutineStep(routine, step.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          background: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer'
                        }}
                      >
                        <div className={`checkbox-custom ${step.completed ? 'checked' : ''}`} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontSize: '14px', textDecoration: step.completed ? 'line-through' : 'none', opacity: step.completed ? 0.6 : 1 }}>
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Goals View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {goals.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Target size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No active goals.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Set targets for career, learning, or fitness.
              </div>
            </div>
          ) : (
            goals.map((g) => {
              const percent = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
              return (
                <div key={g.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{g.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {g.currentAmount} / {g.targetAmount} {g.unit}
                        {g.deadline && ` • Deadline ${formatDisplayDate(g.deadline)}`}
                      </div>
                    </div>
                    <span className="badge badge-accent">{percent}%</span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: 'var(--accent)' }} />
                  </div>

                  <button
                    onClick={async () => {
                      const addVal = prompt(`Add progress to ${g.title} (${g.unit}):`);
                      if (addVal) {
                        const num = parseFloat(addVal) || 0;
                        await db.goals.update(g.id, {
                          currentAmount: g.currentAmount + num,
                          updatedAt: new Date().toISOString()
                        });
                        showToast('Goal progress updated');
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                  >
                    + Log Progress
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* New Routine Modal */}
      {isNewRoutineOpen && (
        <div className="modal-overlay" onClick={() => setIsNewRoutineOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Create Routine</h3>
              <button onClick={() => setIsNewRoutineOpen(false)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Routine Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Focus, Weekly Review"
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Frequency
                </label>
                <select value={routineFrequency} onChange={(e) => setRoutineFrequency(e.target.value as any)}>
                  <option value="daily">Daily</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Routine Steps
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {routineSteps.map((step, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={step}
                      onChange={(e) => {
                        const updated = [...routineSteps];
                        updated[idx] = e.target.value;
                        setRoutineSteps(updated);
                      }}
                      placeholder={`Step ${idx + 1}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setRoutineSteps([...routineSteps, ''])}
                    className="btn btn-ghost btn-sm"
                    style={{ alignSelf: 'flex-start', fontSize: '12px' }}
                  >
                    + Add Step
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsNewRoutineOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSaveRoutine} className="btn btn-primary" style={{ flex: 2 }}>
                Save Routine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Goal Modal */}
      {isNewGoalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewGoalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Create Goal</h3>
              <button onClick={() => setIsNewGoalOpen(false)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Goal Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Read 20 Books, Run 100km"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Target Amount
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="books, km, hours, %"
                    value={goalUnit}
                    onChange={(e) => setGoalUnit(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsNewGoalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSaveGoal} className="btn btn-primary" style={{ flex: 2 }}>
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
