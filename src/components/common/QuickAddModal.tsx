import React, { useState } from 'react';
import {
  X,
  CheckSquare,
  Wallet,
  Bell,
  FileText,
  Lightbulb,
  Calendar,
  UserCheck,
  Bookmark,
  TrendingUp,
  Compass,
  AlertCircle
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { parseNaturalQuickInput } from '../../utils/naturalParser';
import { getTodayDateString, getCurrentTimeString } from '../../utils/dates';
import { toMinorUnits } from '../../utils/currency';
import { useToast } from './ToastContext';
import { EventReminderService } from '../../services/eventReminderService';
import type { EntityType, Priority, PaymentMethod } from '../../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: EntityType;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'task'
}) => {
  const { showToast } = useToast();
  const [activeType, setActiveType] = useState<EntityType>(defaultType);
  const [naturalText, setNaturalText] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [personName, setPersonName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventCategory, setEventCategory] = useState<'meeting' | 'personal' | 'deadline' | 'health' | 'travel'>('meeting');
  const [eventRemindOneDayBefore, setEventRemindOneDayBefore] = useState(true);
  const [eventRemindEvery2Hours, setEventRemindEvery2Hours] = useState(true);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNaturalParse = () => {
    if (!naturalText.trim()) return;
    const parsed = parseNaturalQuickInput(naturalText);
    setActiveType(parsed.detectedType);
    setTitle(parsed.title);
    if (parsed.notes) setNotes(parsed.notes);
    if (parsed.amountMinor) setAmount((parsed.amountMinor / 100).toString());
    if (parsed.category) setCategory(parsed.category);
    if (parsed.dueDate) setDueDate(parsed.dueDate);
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setAmount('');
    setNaturalText('');
    setDuplicateWarning(null);
    setDueTime('');
    setPersonName('');
    setEventLocation('');
  };

  const handleSave = async (forceDuplicate: boolean = false) => {
    if (isSubmitting) return;

    const cleanTitle = title.trim() || naturalText.trim();
    if (!cleanTitle && activeType !== 'expense' && activeType !== 'income') {
      showToast('Please enter a title', { type: 'warning' });
      return;
    }

    // Duplicate check for tasks & reminders
    if (!forceDuplicate && (activeType === 'task' || activeType === 'reminder')) {
      const existing = await db.tasks
        .filter((t) => !t.deletedAt && t.title.toLowerCase() === cleanTitle.toLowerCase())
        .first();
      if (existing) {
        setDuplicateWarning(`A task with the title "${cleanTitle}" already exists.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      switch (activeType) {
        case 'task': {
          const newTask = {
            id: generateId(),
            title: cleanTitle,
            description: notes.trim(),
            status: 'todo' as const,
            priority,
            category: category || 'General',
            dueDate: dueDate || undefined,
            dueTime: dueTime || undefined,
            recurrence: recurrence || 'none',
            subtasks: [],
            tags: [],
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.tasks.add(newTask);
          await logAudit('create', 'task', newTask.id, `Created task: ${cleanTitle}`);
          showToast(`Task added: ${cleanTitle}`, { type: 'success' });
          break;
        }

        case 'expense': {
          const numAmount = parseFloat(amount);
          if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid amount', { type: 'warning' });
            return;
          }
          const minorUnits = toMinorUnits(numAmount);
          const newExpense = {
            id: generateId(),
            amountMinor: minorUnits,
            currency: 'INR',
            date: dueDate || getTodayDateString(),
            time: dueTime || getCurrentTimeString(),
            category: category || 'Other',
            paymentMethod,
            isBusiness: false,
            notes: (cleanTitle || notes).trim(),
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.expenses.add(newExpense);
          await logAudit('create', 'expense', newExpense.id, `Recorded expense of ₹${numAmount} (${category})`);
          showToast(`Expense saved: ₹${numAmount}`, { type: 'success' });
          break;
        }

        case 'reminder': {
          const newReminder = {
            id: generateId(),
            title: cleanTitle,
            date: dueDate || getTodayDateString(),
            time: dueTime || undefined,
            recurrence: recurrence || 'none',
            status: 'active' as const,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.reminders.add(newReminder);
          await logAudit('create', 'reminder', newReminder.id, `Created reminder: ${cleanTitle}`);
          showToast(`Reminder set for ${dueDate}`, { type: 'success' });
          break;
        }

        case 'note': {
          const newNote = {
            id: generateId(),
            title: cleanTitle,
            content: notes.trim(),
            category: category || 'Personal',
            tags: [],
            isPinned: false,
            checklistItems: [],
            attachmentIds: [],
            voiceNoteIds: [],
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.notes.add(newNote);
          await logAudit('create', 'note', newNote.id, `Created note: ${cleanTitle}`);
          showToast(`Note saved: ${cleanTitle}`, { type: 'success' });
          break;
        }

        case 'idea': {
          const newIdea = {
            id: generateId(),
            title: cleanTitle,
            description: notes.trim(),
            category: category || 'General',
            tags: [],
            isPinned: false,
            status: 'active' as const,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.ideas.add(newIdea);
          await logAudit('create', 'idea', newIdea.id, `Saved idea: ${cleanTitle}`);
          showToast(`Idea captured: ${cleanTitle}`, { type: 'success' });
          break;
        }

        case 'dont_forget': {
          const newDF = {
            id: generateId(),
            text: cleanTitle,
            triggerDate: dueDate || undefined,
            priority,
            isPinned: true,
            isDismissed: false,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.dontForget.add(newDF);
          await logAudit('create', 'dont_forget', newDF.id, `Saved memory: ${cleanTitle}`);
          showToast(`Added to Don't Forget`, { type: 'success' });
          break;
        }

        case 'income': {
          const numAmount = parseFloat(amount);
          if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid amount', { type: 'warning' });
            return;
          }
          const minorUnits = toMinorUnits(numAmount);
          const newIncome = {
            id: generateId(),
            amountMinor: minorUnits,
            currency: 'INR',
            source: cleanTitle || 'Income Source',
            date: dueDate || getTodayDateString(),
            category: category || 'Salary',
            isRecurring: false,
            notes: notes.trim(),
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.income.add(newIncome);
          await logAudit('create', 'income', newIncome.id, `Recorded income of ₹${numAmount}`);
          showToast(`Income added: ₹${numAmount}`, { type: 'success' });
          break;
        }

        case 'event': {
          const colorMap: Record<string, string> = {
            meeting: '#3b82f6',
            personal: '#10b981',
            deadline: '#f59e0b',
            health: '#f43f5e',
            travel: '#8b5cf6'
          };
          const newEvent = {
            id: generateId(),
            title: cleanTitle,
            date: dueDate || getTodayDateString(),
            startTime: dueTime || '10:00',
            location: eventLocation.trim() || undefined,
            notes: notes.trim() || undefined,
            category: eventCategory,
            color: colorMap[eventCategory] || '#3b82f6',
            recurrence: recurrence || 'none',
            reminderSchedule: {
              oneDayBefore: eventRemindOneDayBefore,
              recurringHours: eventRemindEvery2Hours ? 2 : undefined,
              enabled: eventRemindOneDayBefore || eventRemindEvery2Hours
            },
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.events.add(newEvent);
          await EventReminderService.syncEventReminders(newEvent);
          await logAudit('create', 'event', newEvent.id, `Created event: ${cleanTitle}`);
          showToast(`Event scheduled with alerts`, { type: 'success' });
          break;
        }

        case 'followup': {
          let person = await db.people.filter(p => !p.deletedAt && p.name.toLowerCase() === personName.trim().toLowerCase()).first();
          if (!person && personName.trim()) {
            person = {
              id: generateId(),
              name: personName.trim(),
              createdAt: nowIso,
              updatedAt: nowIso
            };
            await db.people.add(person);
          }

          const newFollowup = {
            id: generateId(),
            personId: person ? person.id : 'unknown',
            personName: person ? person.name : (personName.trim() || 'Contact'),
            subject: cleanTitle,
            description: notes.trim() || undefined,
            dueDate: dueDate || undefined,
            status: 'waiting' as const,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.followups.add(newFollowup);
          await logAudit('create', 'followup', newFollowup.id, `Created follow-up: ${cleanTitle}`);
          showToast(`Follow-up tracked: ${cleanTitle}`, { type: 'success' });
          break;
        }
      }

      resetForm();
      onClose();
    } catch (err: any) {
      showToast(`Error saving: ${err.message}`, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeTabs: { id: EntityType; label: string; icon: React.ComponentType<{ size: number }> }[] = [
    { id: 'task', label: 'Task', icon: CheckSquare },
    { id: 'expense', label: 'Expense', icon: Wallet },
    { id: 'reminder', label: 'Reminder', icon: Bell },
    { id: 'note', label: 'Note', icon: FileText },
    { id: 'idea', label: 'Idea', icon: Lightbulb },
    { id: 'dont_forget', label: 'Remember', icon: Bookmark },
    { id: 'income', label: 'Income', icon: TrendingUp },
    { id: 'event', label: 'Event', icon: Calendar },
    { id: 'followup', label: 'Follow-up', icon: UserCheck }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Quick Capture
          </h2>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Natural Quick Input Bar */}
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. ₹450 food lunch, or Call school tomorrow..."
              value={naturalText}
              onChange={(e) => {
                setNaturalText(e.target.value);
                if (duplicateWarning) setDuplicateWarning(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNaturalParse();
                }
              }}
              style={{ flex: 1, padding: '10px 12px', fontSize: '14px' }}
            />
            {naturalText.trim() && (
              <button
                type="button"
                onClick={handleNaturalParse}
                className="btn btn-secondary btn-sm"
                title="Smart parse input"
                style={{ whiteSpace: 'nowrap', gap: '4px' }}
              >
                <Compass size={14} color="var(--accent)" />
                <span>Parse</span>
              </button>
            )}
          </div>
        </div>

        {/* Domain Type Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '10px',
            marginBottom: '14px',
            scrollbarWidth: 'none'
          }}
        >
          {typeTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveType(tab.id);
                  if (tab.id === 'expense') setCategory('Food');
                  else if (tab.id === 'income') setCategory('Salary');
                }}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 12px',
                  flexShrink: 0,
                  fontSize: '13px'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Duplicate Warning Alert */}
        {duplicateWarning && (
          <div
            style={{
              background: 'var(--warning-light)',
              border: '1px solid var(--warning-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '13px'
            }}
          >
            <AlertCircle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div>{duplicateWarning}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  Create anyway
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Form per Entity Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Main Title or Amount */}
          {activeType === 'expense' || activeType === 'income' ? (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {activeType === 'dont_forget' ? 'What do you need to remember?' : 'Title / Summary'}
              </label>
              <input
                type="text"
                placeholder={
                  activeType === 'task' ? 'e.g. Submit quarterly tax report' :
                  activeType === 'reminder' ? 'e.g. Call dentist at 4 PM' :
                  activeType === 'note' ? 'Note heading' :
                  activeType === 'idea' ? 'Idea headline' :
                  'Title'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Description / Note / Expense Merchant */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {activeType === 'expense' ? 'What was this for? (Merchant / Item)' :
               activeType === 'income' ? 'Source / Description' :
               activeType === 'note' ? 'Note content' :
               'Description / Notes (Optional)'}
            </label>
            {activeType === 'note' ? (
              <textarea
                rows={4}
                placeholder="Write your note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            ) : (
              <input
                type="text"
                placeholder={activeType === 'expense' ? 'e.g. Grocery items, Lunch' : 'Additional context...'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </div>

          {/* Type-Specific Fields */}
          {activeType === 'expense' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Category
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: '12px' }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['upi', 'cash', 'card', 'bank'] as PaymentMethod[]).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPaymentMethod(pm)}
                      className={`btn btn-sm ${paymentMethod === pm ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'uppercase', fontSize: '12px', flex: 1 }}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeType === 'followup' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Person / Organization
              </label>
              <input
                type="text"
                placeholder="e.g. School office, Landlord, Dr. Gupta"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            </div>
          )}

          {activeType === 'event' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Location / Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conference Hall B or Google Meet"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Event Type & Color
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'meeting', label: 'Meeting', color: '#3b82f6' },
                    { id: 'personal', label: 'Personal', color: '#10b981' },
                    { id: 'deadline', label: 'Deadline', color: '#f59e0b' },
                    { id: 'health', label: 'Health', color: '#f43f5e' },
                    { id: 'travel', label: 'Travel', color: '#8b5cf6' }
                  ].map((cat) => {
                    const isSelected = eventCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEventCategory(cat.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 400,
                          background: isSelected ? `${cat.color}22` : 'var(--bg-surface-elevated)',
                          color: isSelected ? cat.color : 'var(--text-secondary)',
                          border: isSelected ? `1.5px solid ${cat.color}` : '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color }} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '8px 10px', background: 'var(--bg-surface-elevated)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Smart Reminders
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventRemindOneDayBefore}
                    onChange={(e) => setEventRemindOneDayBefore(e.target.checked)}
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>1 day before at 09:00 AM</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventRemindEvery2Hours}
                    onChange={(e) => setEventRemindEvery2Hours(e.target.checked)}
                    style={{ width: '15px', height: '15px' }}
                  />
                  <span>Every 2 hours leading up to event</span>
                </label>
              </div>
            </>
          )}

          {/* Date & Priority for Tasks, Reminders, Events */}
          {(activeType === 'task' || activeType === 'reminder' || activeType === 'event' || activeType === 'followup' || activeType === 'dont_forget') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {activeType !== 'dont_forget' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Priority selector for tasks and memories */}
          {(activeType === 'task' || activeType === 'dont_forget') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Priority
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`btn btn-sm ${priority === p ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      flex: 1,
                      textTransform: 'capitalize',
                      fontSize: '12px',
                      background: priority === p
                        ? (p === 'high' ? 'var(--danger)' : p === 'medium' ? 'var(--warning)' : 'var(--accent)')
                        : undefined
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recurrence for Task / Reminder / Event */}
          {(activeType === 'task' || activeType === 'reminder' || activeType === 'event') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Repeat
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="btn btn-primary"
            style={{ flex: 2 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : `Save ${typeTabs.find(t => t.id === activeType)?.label || 'Item'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
