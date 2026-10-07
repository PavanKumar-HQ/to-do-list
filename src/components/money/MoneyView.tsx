import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Plus,
  Calendar,
  CreditCard,
  PiggyBank,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ShieldCheck,
  Edit2,
  Copy
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { getCurrentMonthString, getTodayDateString, formatDisplayDate, calculateNextOccurrence } from '../../utils/dates';
import { formatMoney, toMinorUnits, fromMinorUnits } from '../../utils/currency';
import { useToast } from '../common/ToastContext';
import { ItemDetailModal } from '../common/ItemDetailModal';
import { ContextModal } from '../common/ContextModal';
import { WarrantyRepository, ExpenseRepository } from '../../repositories';
import { eventBus } from '../../services/eventBus';
import type { ExpenseItem, IncomeItem, BudgetItem, RecurringExpenseItem, CreditCardItem, SavingsGoalItem, WarrantyItem, EntityType, PaymentMethod } from '../../types';

export const MoneyView: React.FC<{ onOpenQuickAdd: (type: any) => void }> = ({ onOpenQuickAdd }) => {
  const { showToast } = useToast();
  const currentMonth = getCurrentMonthString();
  const todayStr = getTodayDateString();

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'budget' | 'recurring' | 'cards' | 'savings' | 'warranties'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Detail Modal & Context Modal State
  const [selectedDetail, setSelectedDetail] = useState<{ type: EntityType | null; data: any | null }>({ type: null, data: null });
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({ isOpen: false, type: null, id: null });

  // Add Warranty Modal State
  const [isAddWarrantyOpen, setIsAddWarrantyOpen] = useState(false);
  const [warrantyItemName, setWarrantyItemName] = useState('');
  const [warrantyBrand, setWarrantyBrand] = useState('');
  const [warrantyPurchaseDate, setWarrantyPurchaseDate] = useState(todayStr);
  const [warrantyEnd, setWarrantyEnd] = useState('');
  const [warrantyPrice, setWarrantyPrice] = useState('');
  const [warrantyNotes, setWarrantyNotes] = useState('');

  // Edit Expense In-Place Modal
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseCategory, setEditExpenseCategory] = useState('Food');
  const [editExpensePaymentMethod, setEditExpensePaymentMethod] = useState<PaymentMethod>('upi');
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editExpenseNotes, setEditExpenseNotes] = useState('');
  const [editExpenseIsBusiness, setEditExpenseIsBusiness] = useState(false);

  // Edit Budget Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState('Overall');
  const [budgetAmount, setBudgetAmount] = useState('');

  // Add Savings Modal State
  const [savingsModalGoal, setSavingsModalGoal] = useState<SavingsGoalItem | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');

  // Add Credit Card Modal State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardName, setCardName] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [billingDay, setBillingDay] = useState('15');
  const [paymentDueDay, setPaymentDueDay] = useState('5');

  // Queries
  const expenses = useLiveQuery(async () => {
    return db.expenses
      .filter((e) => !e.deletedAt && e.date.startsWith(selectedMonth))
      .reverse()
      .sortBy('date');
  }, [selectedMonth]) || [];

  const income = useLiveQuery(async () => {
    return db.income
      .filter((i) => !i.deletedAt && i.date.startsWith(selectedMonth))
      .reverse()
      .sortBy('date');
  }, [selectedMonth]) || [];

  const budgets = useLiveQuery(async () => {
    return db.budgets.filter((b) => b.month === selectedMonth).toArray();
  }, [selectedMonth]) || [];

  const recurringExpenses = useLiveQuery(async () => {
    return db.recurringExpenses.filter((r) => !r.deletedAt).toArray();
  }, []) || [];

  const creditCards = useLiveQuery(async () => {
    return db.creditCards.filter((c) => !c.deletedAt).toArray();
  }, []) || [];

  const savingsGoals = useLiveQuery(async () => {
    return db.savingsGoals.filter((s) => !s.deletedAt).toArray();
  }, []) || [];

  const warranties = useLiveQuery(async () => {
    return db.warranties.filter((w) => !w.deletedAt).reverse().sortBy('warrantyEnd');
  }, []) || [];

  const handleSaveWarranty = async () => {
    if (!warrantyItemName.trim() || !warrantyEnd) {
      showToast('Item name and warranty expiration date are required', { type: 'warning' });
      return;
    }
    const numPrice = parseFloat(warrantyPrice);
    await WarrantyRepository.create({
      itemName: warrantyItemName.trim(),
      brand: warrantyBrand.trim() || undefined,
      purchaseDate: warrantyPurchaseDate || todayStr,
      warrantyEnd,
      purchasePriceMinor: !isNaN(numPrice) && numPrice > 0 ? toMinorUnits(numPrice) : undefined,
      notes: warrantyNotes.trim() || undefined
    });
    showToast(`Saved warranty for ${warrantyItemName}`, { type: 'success' });
    setIsAddWarrantyOpen(false);
    setWarrantyItemName('');
    setWarrantyBrand('');
    setWarrantyEnd('');
    setWarrantyPrice('');
    setWarrantyNotes('');
  };

  // Computed Financial Totals (Minor Integer units)
  const totalExpenseMinor = expenses.reduce((acc, curr) => acc + curr.amountMinor, 0);
  const totalIncomeMinor = income.reduce((acc, curr) => acc + curr.amountMinor, 0);
  const netCashFlowMinor = totalIncomeMinor - totalExpenseMinor;

  const overallBudget = budgets.find((b) => b.category === 'Overall');
  const overallBudgetMinor = overallBudget?.budgetAmountMinor || 0;
  const overallRemainingMinor = overallBudgetMinor - totalExpenseMinor;
  const overallUsedPercent = overallBudgetMinor > 0 ? Math.round((totalExpenseMinor / overallBudgetMinor) * 100) : 0;

  // Category breakdown for expenses
  const categorySpending = React.useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amountMinor;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Actions
  const handleDeleteExpense = async (id: string, amountMinor: number) => {
    await db.expenses.update(id, { deletedAt: new Date().toISOString() });
    await logAudit('delete', 'expense', id, `Deleted expense of ${formatMoney(amountMinor)}`);
    eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: id });
    showToast(`Expense of ${formatMoney(amountMinor)} deleted`, {
      type: 'info',
      action: {
        label: 'Undo',
        onClick: async () => {
          await db.expenses.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() });
          eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: id });
          showToast('Expense restored', { type: 'success' });
        }
      }
    });
  };

  const handleOpenEditExpense = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setEditExpenseAmount((fromMinorUnits(exp.amountMinor)).toString());
    setEditExpenseCategory(exp.category);
    setEditExpensePaymentMethod(exp.paymentMethod);
    setEditExpenseDate(exp.date);
    setEditExpenseNotes(exp.notes || '');
    setEditExpenseIsBusiness(!!exp.isBusiness);
  };

  const handleSaveExpenseEdit = async () => {
    if (!editingExpense) return;
    const num = parseFloat(editExpenseAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid expense amount', { type: 'warning' });
      return;
    }
    const minorUnits = toMinorUnits(num);
    try {
      await ExpenseRepository.update(editingExpense.id, {
        amountMinor: minorUnits,
        category: editExpenseCategory,
        paymentMethod: editExpensePaymentMethod,
        date: editExpenseDate || editingExpense.date,
        notes: editExpenseNotes.trim() || undefined,
        isBusiness: editExpenseIsBusiness
      });
      eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: editingExpense.id });
      showToast(`Expense updated to ${formatMoney(minorUnits)}`, { type: 'success' });
      setEditingExpense(null);
    } catch (err: any) {
      showToast(`Failed to update: ${err.message}`, { type: 'error' });
    }
  };

  const handleDuplicateExpense = async (expId: string) => {
    try {
      const duplicated = await ExpenseRepository.duplicate(expId);
      eventBus.emit('EXPENSE_MUTATED', { type: 'EXPENSE_MUTATED', entityId: duplicated.id });
      showToast(`Duplicated: ${duplicated.category} (${formatMoney(duplicated.amountMinor)})`, { type: 'success' });
    } catch (err: any) {
      showToast(`Duplicate failed: ${err.message}`, { type: 'error' });
    }
  };

  const handleSaveBudget = async () => {
    const num = parseFloat(budgetAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid budget amount', { type: 'warning' });
      return;
    }
    const minorUnits = toMinorUnits(num);
    const existing = await db.budgets
      .filter((b) => b.month === selectedMonth && b.category === budgetCategory)
      .first();

    const nowIso = new Date().toISOString();
    if (existing) {
      await db.budgets.update(existing.id, { budgetAmountMinor: minorUnits, updatedAt: nowIso });
    } else {
      await db.budgets.add({
        id: generateId(),
        month: selectedMonth,
        category: budgetCategory,
        budgetAmountMinor: minorUnits,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await logAudit('update', 'budget', selectedMonth, `Set ${budgetCategory} budget to ${formatMoney(minorUnits)} for ${selectedMonth}`);
    showToast(`Budget saved for ${budgetCategory}`, { type: 'success' });
    setIsBudgetModalOpen(false);
    setBudgetAmount('');
  };

  const handlePayRecurringExpense = async (rec: RecurringExpenseItem) => {
    const nowIso = new Date().toISOString();
    const nextDate = calculateNextOccurrence(rec.nextDueDate, rec.frequency);
    const newExpenseId = generateId();

    try {
      await db.transaction('rw', [db.expenses, db.recurringExpenses, db.auditHistory, db.settings], async () => {
        // 1. Record an actual expense item transaction
        const newExpense: ExpenseItem = {
          id: newExpenseId,
          amountMinor: rec.amountMinor,
          currency: 'INR',
          date: todayStr,
          category: rec.category,
          paymentMethod: rec.paymentMethod,
          isBusiness: false,
          notes: `Recurring payment: ${rec.title}`,
          recurringExpenseId: rec.id,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await db.expenses.add(newExpense);

        // 2. Advance recurring item to next due date atomically
        await db.recurringExpenses.update(rec.id, {
          nextDueDate: nextDate,
          updatedAt: nowIso
        });

        await logAudit('create', 'expense', newExpense.id, `Paid recurring ${rec.title}: ${formatMoney(rec.amountMinor)}`);
      });

      showToast(`Payment recorded. Next due on ${formatDisplayDate(nextDate)}`, { type: 'success' });
    } catch (err: any) {
      showToast(`Failed to process recurring payment: ${err.message}`, { type: 'error' });
    }
  };

  const handleAddSavingsContribution = async () => {
    if (!savingsModalGoal) return;
    const num = parseFloat(contributionAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid contribution', { type: 'warning' });
      return;
    }
    const contributionMinor = toMinorUnits(num);
    const newTotal = savingsModalGoal.currentAmountMinor + contributionMinor;

    await db.savingsGoals.update(savingsModalGoal.id, {
      currentAmountMinor: newTotal,
      updatedAt: new Date().toISOString()
    });

    await logAudit('update', 'savings_goal', savingsModalGoal.id, `Contributed ${formatMoney(contributionMinor)} to ${savingsModalGoal.title}`);
    showToast(`Contributed ${formatMoney(contributionMinor)}! Total: ${formatMoney(newTotal)}`, { type: 'success' });
    setSavingsModalGoal(null);
    setContributionAmount('');
  };

  const handleSaveCreditCard = async () => {
    if (!cardName.trim() || !creditLimit) {
      showToast('Please enter card name and credit limit', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    await db.creditCards.add({
      id: generateId(),
      cardName: cardName.trim(),
      creditLimitMinor: toMinorUnits(parseFloat(creditLimit) || 0),
      currentBalanceMinor: toMinorUnits(parseFloat(currentBalance) || 0),
      billingDay: parseInt(billingDay, 10) || 15,
      paymentDueDay: parseInt(paymentDueDay, 10) || 5,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    showToast(`Added card: ${cardName}`, { type: 'success' });
    setIsCardModalOpen(false);
    setCardName('');
    setCreditLimit('');
    setCurrentBalance('');
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Money
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Private offline financial overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => onOpenQuickAdd('expense')}
            className="btn btn-primary btn-sm"
            style={{ gap: '4px' }}
          >
            <Plus size={16} />
            <span>Expense</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '16px',
          scrollbarWidth: 'none'
        }}
      >
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'budget', label: 'Budgets' },
          { id: 'recurring', label: 'Recurring' },
          { id: 'cards', label: 'Credit Cards' },
          { id: 'savings', label: 'Savings' },
          { id: 'warranties', label: 'Warranties' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px', flexShrink: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Monthly Cash Flow Card */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Cash Flow ({selectedMonth})
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success)' }}>
                  <ArrowDownLeft size={16} />
                  <span>Total Income</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {formatMoney(totalIncomeMinor)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)' }}>
                  <ArrowUpRight size={16} />
                  <span>Total Expenses</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {formatMoney(totalExpenseMinor)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Net Balance</span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: netCashFlowMinor >= 0 ? 'var(--success)' : 'var(--danger)'
                }}
              >
                {formatMoney(netCashFlowMinor)}
              </span>
            </div>
          </div>

          {/* Budget Progress Card */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Monthly Budget</div>
              <button
                onClick={() => {
                  setBudgetCategory('Overall');
                  setIsBudgetModalOpen(true);
                }}
                className="btn btn-secondary btn-sm"
              >
                {overallBudgetMinor > 0 ? 'Edit Budget' : '+ Set Budget'}
              </button>
            </div>

            {overallBudgetMinor > 0 ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>
                    {formatMoney(totalExpenseMinor)}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    of {formatMoney(overallBudgetMinor)} ({overallUsedPercent}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(overallUsedPercent, 100)}%`,
                      background: overallUsedPercent >= 90 ? 'var(--danger)' : overallUsedPercent >= 75 ? 'var(--warning)' : 'var(--accent)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>{overallUsedPercent >= 100 ? 'Over budget' : 'Remaining'}</span>
                  <span style={{ fontWeight: 600, color: overallRemainingMinor < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {formatMoney(Math.abs(overallRemainingMinor))}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No overall budget set for this month. Set a target to keep track of spending limits.
              </div>
            )}
          </div>

          {/* Top Categories */}
          {categorySpending.length > 0 && (
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  Spending by Category
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('expenses')}
                  className="btn-ghost"
                  style={{ fontSize: '12px', color: 'var(--accent)', padding: '2px 6px' }}
                >
                  View All Expenses →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {categorySpending.map(([cat, amountMinor]) => {
                  const percent = totalExpenseMinor > 0 ? Math.round((amountMinor / totalExpenseMinor) * 100) : 0;
                  return (
                    <div
                      key={cat}
                      onClick={() => setActiveTab('expenses')}
                      style={{ cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'background 0.15s ease' }}
                      title={`Click to view all ${cat} expenses`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 500 }}>{cat}</span>
                        <span style={{ fontWeight: 600 }}>{formatMoney(amountMinor)} ({percent}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Expenses directly on Overview */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                Recent Expenses
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('expense')}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '4px', fontSize: '12px', padding: '4px 10px' }}
                >
                  <Plus size={14} />
                  <span>+ Add Expense</span>
                </button>
                {expenses.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('expenses')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    View All ({expenses.length})
                  </button>
                )}
              </div>
            </div>

            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No expenses logged yet. Tap "+ Add Expense" above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expenses.slice(0, 8).map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => setSelectedDetail({ type: 'expense', data: exp })}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {exp.notes || exp.category}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <span>{formatDisplayDate(exp.date)}</span>
                        <span>• {exp.category}</span>
                        <span style={{ textTransform: 'uppercase' }}>• {exp.paymentMethod}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--danger)', marginRight: '4px' }}>
                        -{formatMoney(exp.amountMinor)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditExpense(exp);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '11px', minHeight: '26px', gap: '3px' }}
                        title="Edit expense"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateExpense(exp.id);
                        }}
                        className="btn-ghost"
                        style={{ color: 'var(--text-muted)', padding: '4px' }}
                        title="Duplicate expense"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete expense of ${formatMoney(exp.amountMinor)}?`)) {
                            handleDeleteExpense(exp.id, exp.amountMinor);
                          }
                        }}
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', padding: '4px' }}
                        title="Delete expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
              All Recorded Expenses ({expenses.length})
            </span>
            <button
              onClick={() => onOpenQuickAdd('expense')}
              className="btn btn-primary btn-sm"
              style={{ gap: '6px' }}
            >
              <Plus size={15} />
              <span>+ Add Expense</span>
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Wallet size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                No expenses recorded yet.
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tap "+ Add Expense" to log your transactions.
              </div>
            </div>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp.id}
                className="card"
                onClick={() => setSelectedDetail({ type: 'expense', data: exp })}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {exp.notes || exp.category}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span>{formatDisplayDate(exp.date)}</span>
                    <span>• {exp.category}</span>
                    <span style={{ textTransform: 'uppercase' }}>• {exp.paymentMethod}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--danger)', marginRight: '6px' }}>
                    -{formatMoney(exp.amountMinor)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditExpense(exp);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '12px', minHeight: '28px', gap: '4px' }}
                    title="Edit expense"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateExpense(exp.id);
                    }}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)', padding: '5px' }}
                    title="Duplicate expense"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete expense of ${formatMoney(exp.amountMinor)}?`)) {
                        handleDeleteExpense(exp.id, exp.amountMinor);
                      }
                    }}
                    className="btn-ghost"
                    style={{ color: 'var(--danger)', padding: '5px' }}
                    title="Delete expense"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Recurring Tab */}
      {activeTab === 'recurring' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Active Subscriptions & Recurring Bills</span>
            <button
              onClick={() => onOpenQuickAdd('expense')}
              className="btn btn-secondary btn-sm"
            >
              + Add Bill
            </button>
          </div>

          {recurringExpenses.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Repeat size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No recurring expenses set up.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Track rent, broadband, subscriptions, and regular bills.
              </div>
            </div>
          ) : (
            recurringExpenses.map((rec) => (
              <div key={rec.id} className="card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{rec.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Due {formatDisplayDate(rec.nextDueDate)} • {rec.frequency} • {rec.category}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                    {formatMoney(rec.amountMinor)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => handlePayRecurringExpense(rec)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, gap: '4px', color: 'var(--success)' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Mark Paid</span>
                  </button>
                  <button
                    onClick={async () => {
                      const nextDate = calculateNextOccurrence(rec.nextDueDate, rec.frequency);
                      await db.recurringExpenses.update(rec.id, { nextDueDate: nextDate });
                      showToast(`Skipped. Next date: ${formatDisplayDate(nextDate)}`);
                    }}
                    className="btn btn-sm btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Skip Occurrence
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Credit Cards Tab */}
      {activeTab === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Manual Limit & Balance Tracking (Zero bank linking)</span>
            <button
              onClick={() => setIsCardModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '12px' }}
            >
              + Add Card
            </button>
          </div>

          {creditCards.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <CreditCard size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No credit cards added.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Keep track of credit limits, billing dates, and outstanding balances safely on your device.
              </div>
            </div>
          ) : (
            creditCards.map((card) => {
              const available = card.creditLimitMinor - card.currentBalanceMinor;
              const usedPercent = card.creditLimitMinor > 0 ? Math.round((card.currentBalanceMinor / card.creditLimitMinor) * 100) : 0;
              return (
                <div key={card.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{card.cardName}</div>
                    <span className={`badge ${usedPercent > 50 ? 'badge-warning' : 'badge-neutral'}`}>
                      {usedPercent}% limit used
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outstanding Balance</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)' }}>
                        {formatMoney(card.currentBalanceMinor)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Available Credit</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>
                        {formatMoney(available)}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Billing day: {card.billingDay}th of month • Payment due: {card.paymentDueDay}th
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Savings Goals Tab */}
      {activeTab === 'savings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Savings & Purchase Milestones</span>
            <button
              onClick={() => {
                const title = prompt('Goal Title (e.g. MacBook, Emergency Fund):');
                const target = prompt('Target Amount (e.g. 50000):');
                if (title && target) {
                  db.savingsGoals.add({
                    id: generateId(),
                    title,
                    targetAmountMinor: toMinorUnits(parseFloat(target) || 0),
                    currentAmountMinor: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  });
                  showToast('Savings goal created!', { type: 'success' });
                }
              }}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '12px' }}
            >
              + New Goal
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <PiggyBank size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No savings goals created.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Set savings goals to stay motivated for big expenses.
              </div>
            </div>
          ) : (
            savingsGoals.map((sg) => {
              const percent = sg.targetAmountMinor > 0 ? Math.round((sg.currentAmountMinor / sg.targetAmountMinor) * 100) : 0;
              return (
                <div key={sg.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{sg.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatMoney(sg.currentAmountMinor)} of {formatMoney(sg.targetAmountMinor)}
                      </div>
                    </div>
                    <span className="badge badge-accent">{percent}%</span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: 'var(--success)' }} />
                  </div>

                  <button
                    onClick={() => {
                      setSavingsModalGoal(sg);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                  >
                    + Add Contribution
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Warranties Tab */}
      {activeTab === 'warranties' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Active Warranties & Deadlines
            </span>
            <button
              onClick={() => setIsAddWarrantyOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ gap: '4px' }}
            >
              <Plus size={15} />
              <span>Add Warranty</span>
            </button>
          </div>

          {warranties.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <ShieldCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No warranties tracked yet.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Track laptop, appliance, phone, and gadget warranty deadlines.
              </div>
            </div>
          ) : (
            warranties.map((w) => {
              const status = WarrantyRepository.calculateStatus(w.warrantyEnd);
              return (
                <div
                  key={w.id}
                  className="card"
                  onClick={() => setSelectedDetail({ type: 'warranty', data: w })}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>{w.itemName}</span>
                      {w.brand && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({w.brand})</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Expires: <strong>{formatDisplayDate(w.warrantyEnd)}</strong>
                      {w.purchasePriceMinor ? ` · ${formatMoney(w.purchasePriceMinor)}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background:
                          status === 'active'
                            ? 'var(--success-light)'
                            : status === 'expiring_soon'
                            ? 'var(--warning-light)'
                            : 'var(--danger-light)',
                        color:
                          status === 'active'
                            ? 'var(--success)'
                            : status === 'expiring_soon'
                            ? 'var(--warning)'
                            : 'var(--danger)'
                      }}
                    >
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Set/Edit Budget Modal */}
      {isBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBudgetModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '14px' }}>
              Set Monthly Budget ({selectedMonth})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Category
                </label>
                <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                  <option value="Overall">Overall Monthly Budget</option>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Bills">Bills & Utilities</option>
                  <option value="Entertainment">Entertainment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Budget Limit (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsBudgetModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSaveBudget} className="btn btn-primary" style={{ flex: 2 }}>
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contribution to Savings Goal Modal */}
      {savingsModalGoal && (
        <div className="modal-overlay" onClick={() => setSavingsModalGoal(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '14px' }}>
              Contribute to: {savingsModalGoal.title}
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Contribution Amount (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setSavingsModalGoal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleAddSavingsContribution} className="btn btn-primary" style={{ flex: 2 }}>
                Save Contribution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Card Modal */}
      {isCardModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCardModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '14px' }}>
              Track Credit Card
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Card Name / Bank
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Regalia, ICICI Amazon"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="100000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Current Due (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Billing Cycle Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingDay}
                    onChange={(e) => setBillingDay(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Payment Due Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={paymentDueDay}
                    onChange={(e) => setPaymentDueDay(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsCardModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSaveCreditCard} className="btn btn-primary" style={{ flex: 2 }}>
                Save Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Warranty Modal */}
      {isAddWarrantyOpen && (
        <div className="modal-overlay" onClick={() => setIsAddWarrantyOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '14px' }}>
              Add Product Warranty
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Item / Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. MacBook Air, Sony Headphones"
                  value={warrantyItemName}
                  onChange={(e) => setWarrantyItemName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apple, Sony"
                    value={warrantyBrand}
                    onChange={(e) => setWarrantyBrand(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 85000"
                    value={warrantyPrice}
                    onChange={(e) => setWarrantyPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={warrantyPurchaseDate}
                    onChange={(e) => setWarrantyPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Warranty Expiration
                  </label>
                  <input
                    type="date"
                    value={warrantyEnd}
                    onChange={(e) => setWarrantyEnd(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Notes / Serial Number
                </label>
                <textarea
                  rows={2}
                  placeholder="Serial #, warranty terms, store receipt..."
                  value={warrantyNotes}
                  onChange={(e) => setWarrantyNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setIsAddWarrantyOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleSaveWarranty} className="btn btn-primary" style={{ flex: 2 }}>
                  Save Warranty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-Place Edit Expense Modal */}
      {editingExpense && (
        <div className="modal-overlay" onClick={() => setEditingExpense(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Edit Expense
              </h3>
              <button onClick={() => setEditingExpense(null)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editExpenseAmount}
                  onChange={(e) => setEditExpenseAmount(e.target.value)}
                  style={{ fontSize: '18px', fontWeight: 700 }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={editExpenseCategory}
                    onChange={(e) => setEditExpenseCategory(e.target.value)}
                  >
                    {['Food', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Education', 'Personal', 'Work', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={editExpensePaymentMethod}
                    onChange={(e) => setEditExpensePaymentMethod(e.target.value as any)}
                  >
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="net_banking">Net Banking</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={editExpenseDate}
                  onChange={(e) => setEditExpenseDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lunch with team, Grocery run"
                  value={editExpenseNotes}
                  onChange={(e) => setEditExpenseNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  id="editIsBusiness"
                  checked={editExpenseIsBusiness}
                  onChange={(e) => setEditExpenseIsBusiness(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="editIsBusiness" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Mark as Business Expense
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setEditingExpense(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleSaveExpenseEdit} className="btn btn-primary" style={{ flex: 2 }}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Detail Modal */}
      <ItemDetailModal
        isOpen={!!selectedDetail.type}
        onClose={() => setSelectedDetail({ type: null, data: null })}
        itemType={selectedDetail.type}
        itemData={selectedDetail.data}
        onOpenContext={(type, id) => setContextModal({ isOpen: true, type, id })}
      />

      {/* Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type || 'expense'}
        entityId={contextModal.id || ''}
      />
    </div>
  );
};
