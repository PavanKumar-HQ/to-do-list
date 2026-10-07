import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wallet,
  PiggyBank,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { SavingsGoalItem } from '../../types';

export const SavingsGoalsTab: React.FC = () => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoalItem | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const savingsGoals = useLiveQuery(async () => {
    return db.savingsGoals.filter((g) => !g.deletedAt).toArray();
  }, []) || [];

  const handleOpenAdd = () => {
    setSelectedGoal(null);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setDeadline('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: SavingsGoalItem) => {
    setSelectedGoal(goal);
    setTitle(goal.title);
    setTargetAmount((goal.targetAmountMinor / 100).toString());
    setCurrentAmount((goal.currentAmountMinor / 100).toString());
    setDeadline(goal.deadline || '');
    setNotes(goal.notes || '');
    setIsModalOpen(true);
  };

  const handleOpenDeposit = (goal: SavingsGoalItem) => {
    setSelectedGoal(goal);
    setDepositAmount('');
    setIsDepositModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount) {
      showToast('Please enter a goal title and target amount', { type: 'warning' });
      return;
    }

    const targetMinor = Math.round(parseFloat(targetAmount) * 100) || 0;
    const currentMinor = Math.round(parseFloat(currentAmount || '0') * 100) || 0;
    const nowIso = new Date().toISOString();

    if (selectedGoal) {
      await db.savingsGoals.update(selectedGoal.id, {
        title: title.trim(),
        targetAmountMinor: targetMinor,
        currentAmountMinor: currentMinor,
        deadline: deadline || undefined,
        notes: notes.trim() || undefined,
        updatedAt: nowIso
      });
      await logAudit('update', 'savings_goal', selectedGoal.id, `Updated savings goal: ${title.trim()}`);
      showToast(`Savings goal updated: ${title.trim()}`, { type: 'success' });
    } else {
      const newGoal: SavingsGoalItem = {
        id: generateId(),
        title: title.trim(),
        targetAmountMinor: targetMinor,
        currentAmountMinor: currentMinor,
        deadline: deadline || undefined,
        notes: notes.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await db.savingsGoals.add(newGoal);
      await logAudit('create', 'savings_goal', newGoal.id, `Created savings goal: ${title.trim()}`);
      showToast(`Savings goal created: ${title.trim()} 🎯`, { type: 'success' });
    }

    setIsModalOpen(false);
  };

  const handleAddDeposit = async (addMinor: number) => {
    if (!selectedGoal || addMinor <= 0) return;

    const newCurrent = selectedGoal.currentAmountMinor + addMinor;
    const nowIso = new Date().toISOString();

    await db.savingsGoals.update(selectedGoal.id, {
      currentAmountMinor: newCurrent,
      updatedAt: nowIso
    });

    await logAudit('update', 'savings_goal', selectedGoal.id, `Added ₹${(addMinor / 100).toLocaleString('en-IN')} to ${selectedGoal.title}`);
    showToast(`Added ₹${(addMinor / 100).toLocaleString('en-IN')} to ${selectedGoal.title}! 💰`, { type: 'success' });
    setIsDepositModalOpen(false);
  };

  const handleDeleteGoal = async (goal: SavingsGoalItem) => {
    if (confirm(`Delete savings goal "${goal.title}"?`)) {
      await db.savingsGoals.update(goal.id, { deletedAt: new Date().toISOString() });
      await logAudit('delete', 'savings_goal', goal.id, `Deleted savings goal: ${goal.title}`);
      showToast('Savings goal deleted', { type: 'info' });
    }
  };

  // Helper for monthly / daily required calculations
  const calculateRequiredSavings = (targetMinor: number, currentMinor: number, deadlineStr?: string) => {
    const remainingMinor = Math.max(0, targetMinor - currentMinor);
    if (!deadlineStr || remainingMinor <= 0) {
      return { monthsRemaining: 0, daysRemaining: 0, monthlyNeeded: 0, dailyNeeded: 0, isPassed: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(deadlineStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffMs = targetDate.getTime() - today.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4));

    if (diffMs < 0) {
      return { monthsRemaining: 0, daysRemaining: 0, monthlyNeeded: remainingMinor / 100, dailyNeeded: remainingMinor / 100, isPassed: true };
    }

    const monthlyNeeded = Math.ceil((remainingMinor / 100) / monthsRemaining);
    const dailyNeeded = Math.ceil((remainingMinor / 100) / daysRemaining);

    return { monthsRemaining, daysRemaining, monthlyNeeded, dailyNeeded, isPassed: false };
  };

  const totalTargetMinor = savingsGoals.reduce((sum, g) => sum + g.targetAmountMinor, 0);
  const totalSavedMinor = savingsGoals.reduce((sum, g) => sum + g.currentAmountMinor, 0);
  const totalPercentage = totalTargetMinor > 0 ? Math.round((totalSavedMinor / totalTargetMinor) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner with Savings Overview */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
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
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            <PiggyBank size={24} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Savings Goals & Trajectory
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ₹{(totalSavedMinor / 100).toLocaleString('en-IN')} saved of ₹{(totalTargetMinor / 100).toLocaleString('en-IN')} total ({totalPercentage}%)
            </div>
          </div>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
          <Plus size={16} />
          <span>New Savings Goal</span>
        </button>
      </div>

      {/* Savings Goal Cards */}
      {savingsGoals.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          <PiggyBank size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No savings goals set</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '360px', margin: '4px auto 16px' }}>
            Set a target amount and deadline. Saral will auto-calculate your required monthly savings.
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            <Plus size={15} />
            <span>Create First Goal</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {savingsGoals.map((goal) => {
            const current = goal.currentAmountMinor / 100;
            const target = goal.targetAmountMinor / 100;
            const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const isCompleted = current >= target;
            const req = calculateRequiredSavings(goal.targetAmountMinor, goal.currentAmountMinor, goal.deadline);

            return (
              <div
                key={goal.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: isCompleted ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {goal.title}
                    </h4>
                    {goal.deadline && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <Calendar size={12} />
                        <span>Deadline: {formatDisplayDate(goal.deadline)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleOpenEdit(goal)}
                      className="btn-ghost btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      title="Edit Goal"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal)}
                      className="btn-ghost btn-icon"
                      style={{ width: '28px', height: '28px', color: 'var(--danger)' }}
                      title="Delete Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress Numbers */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{current.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Target: ₹{target.toLocaleString('en-IN')} ({percent}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface-elevated)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: isCompleted ? '#10b981' : 'linear-gradient(90deg, #10b981, #3b82f6)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>

                {/* Required Monthly Saving Callout */}
                {isCompleted ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: '#10b981',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Goal Achieved! Outstanding work!</span>
                  </div>
                ) : goal.deadline ? (
                  <div
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Required Monthly Saving
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>
                        ₹{req.monthlyNeeded.toLocaleString('en-IN')} / month
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Time Remaining</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {req.monthsRemaining} months ({req.daysRemaining}d)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Add a deadline to get automatic monthly saving calculations.
                  </div>
                )}

                {/* Quick Deposit Actions */}
                <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                  <button
                    onClick={() => handleAddDeposit(50000)} // ₹500
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontSize: '11.5px', padding: '5px' }}
                  >
                    +₹500
                  </button>
                  <button
                    onClick={() => handleAddDeposit(100000)} // ₹1,000
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontSize: '11.5px', padding: '5px' }}
                  >
                    +₹1,000
                  </button>
                  <button
                    onClick={() => handleAddDeposit(500000)} // ₹5,000
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontSize: '11.5px', padding: '5px' }}
                  >
                    +₹5,000
                  </button>
                  <button
                    onClick={() => handleOpenDeposit(goal)}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                  >
                    Deposit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Goal Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {selectedGoal ? 'Edit Savings Goal' : 'New Savings Goal'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Goal Title *</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Emergency Fund, MacBook Pro, Goa Vacation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Target Amount (₹) *</label>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="100000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Current Saved (₹)</label>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Target Deadline (Optional)</label>
                <input
                  type="date"
                  className="input-text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  placeholder="Why is this goal important to you?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Deposit Modal */}
      {isDepositModalOpen && selectedGoal && (
        <div className="modal-overlay" onClick={() => setIsDepositModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>
                Add Deposit to {selectedGoal.title}
              </h3>
              <button onClick={() => setIsDepositModalOpen(false)} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  className="input-text"
                  placeholder="e.g. 2500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsDepositModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const amt = parseFloat(depositAmount);
                    if (amt > 0) handleAddDeposit(Math.round(amt * 100));
                  }}
                  className="btn btn-primary"
                >
                  Deposit ₹{depositAmount || '0'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
