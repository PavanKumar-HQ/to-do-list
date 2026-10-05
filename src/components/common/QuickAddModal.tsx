import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
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
  AlertCircle,
  Plus,
  Sparkles,
  Search,
  Tag,
  MapPin,
  Clock,
  User,
  CreditCard,
  Target
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, logAudit } from '../../db/db';
import { parseNaturalQuickInput } from '../../utils/naturalParser';
import { getTodayDateString } from '../../utils/dates';

function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
import { toMinorUnits } from '../../utils/currency';
import { useToast } from './ToastContext';
import { EventReminderService } from '../../services/eventReminderService';
import { requestNotificationPermission } from '../../services/notificationService';
import { eventBus } from '../../services/eventBus';
import { TaskRepository, ReminderRepository, ExpenseRepository } from '../../repositories';
import { ClockTimeSetter } from './ClockTimeSetter';
import type { EntityType, Priority, PaymentMethod } from '../../types';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: EntityType;
  defaultDate?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  defaultType,
  defaultDate
}) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'form'>('grid');
  const [activeType, setActiveType] = useState<EntityType>('task');
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
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [personName, setPersonName] = useState('');
  const [contextTag, setContextTag] = useState('Brandex');
  const [eventLocation, setEventLocation] = useState('');
  const [eventCategory, setEventCategory] = useState<'meeting' | 'personal' | 'deadline' | 'health' | 'travel'>('meeting');
  const [eventRemindOneDayBefore, setEventRemindOneDayBefore] = useState(true);
  const [eventRemindAtStart, setEventRemindAtStart] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  const goals = useLiveQuery(() => db.goals.filter(g => !g.deletedAt && g.status !== 'archived').toArray()) || [];

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync mode and activeType when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultType) {
        setActiveType(defaultType);
        setViewMode('form');
      } else {
        setViewMode('grid');
        setActiveType('task');
      }
      if (defaultDate) {
        setDueDate(defaultDate);
      } else {
        setDueDate(getTodayDateString());
      }
      setDuplicateWarning(null);
    }
  }, [isOpen, defaultType, defaultDate]);

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
    setViewMode('form');
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setAmount('');
    setNaturalText('');
    setDuplicateWarning(null);
    setDueTime('');
    setEndTime('');
    setPersonName('');
    setEventLocation('');
    setSelectedGoalId('');
  };

  const handleSave = async (forceDuplicate: boolean = false) => {
    if (isSubmitting) return;

    const cleanTitle = title.trim() || naturalText.trim();
    if (!cleanTitle && activeType !== 'expense' && activeType !== 'income') {
      showToast('Please enter a title', { type: 'warning' });
      return;
    }

    // Duplicate check for tasks & reminders
    if (!forceDuplicate) {
      if (activeType === 'task') {
        const existing = await db.tasks
          .filter((t) => !t.deletedAt && t.title.toLowerCase() === cleanTitle.toLowerCase())
          .first();
        if (existing) {
          setDuplicateWarning(`A task with the title "${cleanTitle}" already exists.`);
          return;
        }
      } else if (activeType === 'reminder') {
        const existing = await db.reminders
          .filter((r) => !r.deletedAt && r.title.toLowerCase() === cleanTitle.toLowerCase())
          .first();
        if (existing) {
          setDuplicateWarning(`A reminder with the title "${cleanTitle}" already exists.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();

    try {
      switch (activeType) {
        case 'task': {
          const newTask = await TaskRepository.create({
            title: cleanTitle,
            description: notes.trim() || undefined,
            dueDate: dueDate || undefined,
            dueTime: dueTime || undefined,
            priority,
            recurrence: recurrence || 'none',
            tags: contextTag ? [contextTag] : [],
            goalId: selectedGoalId || undefined
          });
          if (selectedGoalId) {
            await db.relationships.add({
              id: generateId(),
              sourceId: newTask.id,
              sourceType: 'task',
              targetId: selectedGoalId,
              targetType: 'goal',
              relationshipLabel: 'contributes_to',
              createdAt: nowIso
            });
          }
          await logAudit('create', 'task', newTask.id, `Created task: ${cleanTitle}`);
          showToast(`Task created: ${cleanTitle}`, { type: 'success' });
          break;
        }

        case 'reminder': {
          const newReminder = await ReminderRepository.create({
            title: cleanTitle,
            date: dueDate || getTodayDateString(),
            time: dueTime || '09:00',
            recurrence: recurrence || 'none'
          });
          await logAudit('create', 'reminder', newReminder.id, `Scheduled reminder: ${cleanTitle}`);
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            requestNotificationPermission();
          }
          showToast(`Reminder set for ${dueDate || 'today'} at ${dueTime || '09:00'}`, { type: 'success' });
          break;
        }

        case 'expense': {
          const numAmount = parseFloat(amount);
          if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid expense amount', { type: 'warning' });
            return;
          }
          const minorUnits = toMinorUnits(numAmount);
          const newExpense = await ExpenseRepository.create({
            amountMinor: minorUnits,
            category: category || 'Food',
            paymentMethod: paymentMethod || 'upi',
            date: dueDate || getTodayDateString(),
            notes: (cleanTitle ? `${cleanTitle}${notes ? ' - ' + notes : ''}` : notes).trim() || undefined
          });
          await logAudit('create', 'expense', newExpense.id, `Logged expense of ₹${numAmount}`);
          showToast(`Expense logged: ₹${numAmount}`, { type: 'success' });
          break;
        }

        case 'note': {
          const newNote = {
            id: generateId(),
            title: cleanTitle,
            content: notes.trim(),
            tags: contextTag ? [contextTag] : [],
            attachmentIds: [],
            isPinned: false,
            checklistItems: [],
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
            status: 'active' as const,
            isPinned: false,
            tags: contextTag ? [contextTag] : [],
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.ideas.add(newIdea);
          await logAudit('create', 'idea', newIdea.id, `Saved idea: ${cleanTitle}`);
          showToast(`Idea captured: ${cleanTitle}`, { type: 'success' });
          break;
        }

        case 'income': {
          const numAmount = parseFloat(amount);
          if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid income amount', { type: 'warning' });
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
            meeting: '#38bdf8',
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
            endTime: endTime || undefined,
            location: eventLocation.trim() || undefined,
            notes: notes.trim() || undefined,
            category: eventCategory,
            color: colorMap[eventCategory] || '#38bdf8',
            recurrence: recurrence || 'none',
            reminderSchedule: {
              oneDayBefore: eventRemindOneDayBefore,
              enabled: eventRemindOneDayBefore || eventRemindAtStart
            },
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.events.add(newEvent);
          await EventReminderService.syncEventReminders(newEvent);
          if (newEvent.reminderSchedule.enabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            requestNotificationPermission();
          }
          await logAudit('create', 'event', newEvent.id, `Created event: ${cleanTitle}`);
          eventBus.emit('EVENT_MUTATED', { type: 'EVENT_MUTATED', entityId: newEvent.id });
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
          showToast(`Follow-up tracked for ${newFollowup.personName}`, { type: 'success' });
          break;
        }

        case 'person': {
          const newPerson = {
            id: generateId(),
            name: cleanTitle,
            contactInfo: notes.trim() || undefined,
            notes: eventLocation.trim() || undefined,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.people.add(newPerson);
          await logAudit('create', 'person', newPerson.id, `Added contact: ${cleanTitle}`);
          showToast(`Contact saved: ${cleanTitle}`, { type: 'success' });
          break;
        }

        default:
          break;
      }

      resetForm();
      onClose();
    } catch (err: any) {
      showToast(`Error creating item: ${err?.message || 'Database transaction error'}`, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8 utility grid items matching Image 2 Screen 3
  const utilityItems: {
    id: EntityType;
    label: string;
    icon: React.ComponentType<{ size: number; color?: string }>;
    color: string;
    bgColor: string;
  }[] = [
    { id: 'task', label: 'Task', icon: CheckSquare, color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.14)' },
    { id: 'reminder', label: 'Reminder', icon: Bell, color: '#818cf8', bgColor: 'rgba(129, 140, 248, 0.14)' },
    { id: 'note', label: 'Note', icon: FileText, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.14)' },
    { id: 'idea', label: 'Idea', icon: Lightbulb, color: '#c084fc', bgColor: 'rgba(192, 132, 252, 0.14)' },
    { id: 'expense', label: 'Expense', icon: Wallet, color: '#f43f5e', bgColor: 'rgba(244, 63, 94, 0.14)' },
    { id: 'income', label: 'Income', icon: TrendingUp, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.14)' },
    { id: 'event', label: 'Event', icon: Calendar, color: '#0ea5e9', bgColor: 'rgba(14, 165, 233, 0.14)' },
    { id: 'person', label: 'Person', icon: UserCheck, color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.14)' }
  ];

  const handleSelectUtility = (type: EntityType) => {
    setActiveType(type);
    if (type === 'expense') setCategory('Food');
    else if (type === 'income') setCategory('Salary');
    setViewMode('form');
  };

  const getTypeName = (type: EntityType) => {
    const item = utilityItems.find((u) => u.id === type);
    return item ? item.label : type;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        {/* 1. SCREEN 3: QUICK CAPTURE PULL DOWN (GRID VIEW) */}
        {viewMode === 'grid' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Capture
              </span>
              <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            {/* Top Search / Natural Input Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '12px 14px',
                marginBottom: '20px'
              }}
            >
              <input
                type="text"
                placeholder="Capture something..."
                value={naturalText}
                onChange={(e) => setNaturalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNaturalParse();
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  padding: 0
                }}
                autoFocus
              />
              {naturalText.trim() ? (
                <button
                  type="button"
                  onClick={handleNaturalParse}
                  className="btn btn-sm btn-primary"
                  style={{ borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: '12px' }}
                >
                  <Compass size={13} />
                  <span>Parse</span>
                </button>
              ) : (
                <Search size={16} color="var(--text-tertiary)" />
              )}
            </div>

            {/* 4x2 Circular Utility Icons Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px 12px',
                marginBottom: '24px',
                textAlign: 'center'
              }}
            >
              {utilityItems.map((u) => {
                const Icon = u.icon;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUtility(u.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: u.bgColor,
                        border: `1.5px solid ${u.color}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: `0 4px 12px ${u.color}1a`
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <Icon size={24} color={u.color} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {u.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* "Just tell me..." Box */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                Just tell me...
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. ₹300 lunch tomorrow"
                  value={naturalText}
                  onChange={(e) => setNaturalText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNaturalParse();
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    padding: 0
                  }}
                />
                <button
                  type="button"
                  onClick={handleNaturalParse}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                  title="Parse natural text"
                >
                  <Sparkles size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. SCREEN 4: PROGRESSIVE TAILORED FORM VIEW */}
        {viewMode === 'form' && (
          <div>
            {/* Header: < Create [Utility] */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', marginLeft: '-8px' }}
              >
                <ChevronLeft size={20} color="var(--text-primary)" />
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Create {getTypeName(activeType).toLowerCase()}
                </span>
              </button>
              <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            {/* Duplicate Alert */}
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

            {/* Progressive Inputs Unique to Entity Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* =======================
                  A. TASK FORM
                  ======================= */}
              {activeType === 'task' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>What needs doing?</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Send revised proposal"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      When?
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setDueDate(getTodayDateString())}
                        className={`btn btn-sm ${dueDate === getTodayDateString() ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px' }}
                      >
                        Today {dueDate === getTodayDateString() ? '•' : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDueDate(getTomorrowDateString())}
                        className={`btn btn-sm ${dueDate === getTomorrowDateString() ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px' }}
                      >
                        Tomorrow {dueDate === getTomorrowDateString() ? '•' : ''}
                      </button>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', width: '60px' }}>
                      Time:
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>(Optional)</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Priority
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                        const isSelected = priority === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPriority(p)}
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              flex: 1,
                              textTransform: 'capitalize',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              borderRadius: '12px',
                              padding: '8px',
                              border: isSelected && p === 'high' ? '1.5px solid var(--danger)' : undefined
                            }}
                          >
                            {p === 'high' && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
                            )}
                            <span>{p}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Project / Context</span>
                      <button
                        type="button"
                        onClick={() => {
                          const custom = prompt('Enter project/context tag:');
                          if (custom && custom.trim()) setContextTag(custom.trim());
                        }}
                        className="btn-ghost"
                        style={{ padding: '2px 6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={12} />
                        <span>Custom</span>
                      </button>
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['Brandex', 'Personal', 'Work', 'Health'].map((ctx) => (
                        <button
                          key={ctx}
                          type="button"
                          onClick={() => setContextTag(ctx)}
                          className={`btn btn-sm ${contextTag === ctx ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            borderRadius: 'var(--radius-full)',
                            padding: '6px 12px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Tag size={12} />
                          <span>{ctx}</span>
                        </button>
                      ))}
                      {contextTag && !['Brandex', 'Personal', 'Work', 'Health'].includes(contextTag) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{ borderRadius: 'var(--radius-full)', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Tag size={12} />
                          <span>{contextTag}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Goal Association */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Target size={14} color="var(--accent)" />
                        <span>Link to Goal (Optional)</span>
                      </span>
                      {selectedGoalId && (
                        <button
                          type="button"
                          onClick={() => setSelectedGoalId('')}
                          className="btn-ghost"
                          style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <select
                      value={selectedGoalId}
                      onChange={(e) => setSelectedGoalId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '13.5px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="">No goal linked (Standalone)</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          🎯 {g.title} {g.targetAmount > 0 ? `(${Math.round((g.currentAmount / g.targetAmount) * 100)}%)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Add subtasks or extra details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        borderRadius: '12px',
                        padding: '10px 12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </>
              )}

              {/* =======================
                  B. REMINDER FORM
                  ======================= */}
              {activeType === 'reminder' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Remind me about what?</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Doctor appointment, Take tablets, Call mom"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Alarm Date
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setDueDate(getTodayDateString())}
                        className={`btn btn-sm ${dueDate === getTodayDateString() ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px' }}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setDueDate(getTomorrowDateString())}
                        className={`btn btn-sm ${dueDate === getTomorrowDateString() ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '13px' }}
                      >
                        Tomorrow
                      </button>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <ClockTimeSetter
                    value={dueTime}
                    onChange={(t) => setDueTime(t)}
                    isRequired={true}
                    label="Alarm Time & Tone"
                    showToneSelector={true}
                  />

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Repeat
                    </label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as any)}
                      style={{
                        borderRadius: '12px',
                        padding: '10px 12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        fontSize: '14px'
                      }}
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </>
              )}

              {/* =======================
                  C. EVENT FORM
                  ======================= */}
              {activeType === 'event' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>What's happening?</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Design review meeting"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Location or Video Link
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Google Meet or Conference Room B"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      style={{
                        fontSize: '14px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Event Category
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'meeting', label: 'Meeting', color: '#38bdf8' },
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
                              gap: '6px',
                              padding: '6px 12px',
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

                  <div style={{ padding: '10px 14px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Notification Alerts
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={eventRemindOneDayBefore}
                        onChange={(e) => setEventRemindOneDayBefore(e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>Remind 1 day before at 09:00 AM</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={eventRemindAtStart}
                        onChange={(e) => setEventRemindAtStart(e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>Alert when event starts</span>
                    </label>
                  </div>
                </>
              )}

              {/* =======================
                  D. EXPENSE FORM
                  ======================= */}
              {activeType === 'expense' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Amount (₹)</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Merchant / What was this for?</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Swiggy, Groceries, Fuel"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Category
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ borderRadius: 'var(--radius-full)', padding: '5px 12px', fontSize: '12px' }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Payment Method
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['upi', 'cash', 'card', 'bank'] as PaymentMethod[]).map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPaymentMethod(pm)}
                          className={`btn btn-sm ${paymentMethod === pm ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, textTransform: 'uppercase', fontSize: '12px', borderRadius: '10px' }}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        width: '100%'
                      }}
                    />
                  </div>
                </>
              )}

              {/* =======================
                  E. INCOME FORM
                  ======================= */}
              {activeType === 'income' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Income Amount (₹)</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Source / Client</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Salary, Client payment, Freelance"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Income Category
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['Salary', 'Business', 'Freelance', 'Investment', 'Gift', 'Other'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ borderRadius: 'var(--radius-full)', padding: '5px 12px', fontSize: '12px' }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Date Received
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        width: '100%'
                      }}
                    />
                  </div>
                </>
              )}

              {/* =======================
                  F. NOTE FORM
                  ======================= */}
              {activeType === 'note' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Note Heading</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Project brainstorm, Meeting minutes"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Content
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Write your note in markdown or plain text..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        borderRadius: '12px',
                        padding: '12px 14px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        fontSize: '14px',
                        lineHeight: 1.5
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Tag / Folder
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['Work', 'Personal', 'Ideas', 'Reference'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setContextTag(t)}
                          className={`btn btn-sm ${contextTag === t ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: '12px' }}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* =======================
                  G. IDEA FORM
                  ======================= */}
              {activeType === 'idea' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Idea Headline</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Brandex community pricing model"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Description & Potential
                    </label>
                    <textarea
                      rows={4}
                      placeholder="What is the concept? What makes it exciting?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        borderRadius: '12px',
                        padding: '12px 14px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </>
              )}

              {/* =======================
                  H. PERSON FORM
                  ======================= */}
              {activeType === 'person' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Person's Name</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Contact Details (Phone / Email / Handle)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. rahul@example.com or +91 98765 43210"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        fontSize: '14px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Relationship & Context Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Where do you know them from? Key topics discussed..."
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      style={{
                        borderRadius: '12px',
                        padding: '10px 14px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </>
              )}

              {/* =======================
                  I. FOLLOW-UP FORM
                  ======================= */}
              {activeType === 'followup' && (
                <>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Person or Organization</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma, Bank, Landlord"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>What are you waiting on / following up?</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: '3px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Send contract feedback, Confirm meeting time"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      style={{
                        fontSize: '15px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        width: '100%'
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Glowing Save Pill Button */}
            <div style={{ marginTop: '24px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => handleSave()}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-full)',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 600,
                  boxShadow: '0 4px 18px rgba(20, 184, 166, 0.42)'
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : `Save ${getTypeName(activeType)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
