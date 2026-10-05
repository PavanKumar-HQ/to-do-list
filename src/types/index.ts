// Strict types for Personal Life OS (Local-first, offline-first)

export type EntityType = 
  | 'inbox'
  | 'task' 
  | 'reminder' 
  | 'note' 
  | 'idea' 
  | 'dont_forget' 
  | 'person' 
  | 'followup' 
  | 'event' 
  | 'list' 
  | 'goal' 
  | 'routine' 
  | 'journal' 
  | 'expense' 
  | 'income' 
  | 'budget' 
  | 'credit_card' 
  | 'recurring_expense' 
  | 'savings_goal' 
  | 'attachment' 
  | 'voice_note'
  | 'relationship'
  | 'commitment'
  | 'decision'
  | 'open_loop'
  | 'dependency'
  | 'future_message'
  | 'review_session'
  | 'life_context';

export type Priority = 'low' | 'medium' | 'high';
export type ConsequenceLevel = 'none' | 'minor' | 'important' | 'significant' | 'critical';
export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'waiting' | 'completed' | 'archived';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

// Provenance Metadata: Answers "Where did this come from, why, and what caused it?"
export interface ProvenanceMetadata {
  source: 'manual' | 'inbox' | 'conversion' | 'recurrence' | 'backup_restore' | 'quick_capture';
  sourceEntityId?: string;
  sourceEntityType?: EntityType;
  createdVia?: string; // e.g. "Quick Add", "Natural Parser", "Note Conversion"
}

export interface InboxItem {
  id: string;
  rawText: string;
  notes?: string;
  tags: string[];
  isProcessed: boolean;
  processedToType?: EntityType;
  processedToId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RelationshipItem {
  id: string;
  sourceId: string;
  sourceType: EntityType;
  targetId: string;
  targetType: EntityType;
  relationshipLabel?: string;
  createdAt: string;
}

export interface CommitmentItem {
  id: string;
  who: string; // Contact name or "Self"
  personId?: string;
  what: string; // Commitment / promise description
  promisedDate: string; // YYYY-MM-DD
  context?: string; // Why it was made / background
  status: 'pending' | 'fulfilled' | 'broken' | 'rescheduled';
  provenance?: ProvenanceMetadata;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DecisionItem {
  id: string;
  title: string;
  reason: string; // The "Why" behind the decision
  alternativesConsidered: string[];
  decisionDate: string; // YYYY-MM-DD
  reviewDate?: string; // YYYY-MM-DD (e.g. 6 months later)
  status: 'active' | 'reviewed' | 'superseded' | 'abandoned';
  linkedEntityIds?: string[];
  provenance?: ProvenanceMetadata;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type OpenLoopType = 'waiting_on' | 'promised' | 'stale' | 'overdue' | 'financial' | 'someday' | 'unresolved_thought';

export interface OpenLoopItem {
  id: string;
  title: string;
  loopType: OpenLoopType;
  sourceEntityId?: string;
  sourceEntityType?: EntityType;
  waitingOnPersonId?: string;
  waitingOnPersonName?: string;
  consequence?: ConsequenceLevel;
  nextAction?: string;
  notes?: string;
  status: 'open' | 'closed' | 'snoozed';
  snoozedUntil?: string;
  provenance?: ProvenanceMetadata;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  deletedAt?: string;
}

export interface DependencyItem {
  id: string;
  blockerType: EntityType;
  blockerId: string;
  blockedType: EntityType;
  blockedId: string;
  reason?: string;
  createdAt: string;
}

export interface FutureMessageItem {
  id: string;
  title: string;
  message: string;
  openDate: string; // YYYY-MM-DD (Message to Future Self)
  isOpened: boolean;
  openedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ReviewSessionItem {
  id: string;
  reviewType: 'weekly' | 'monthly' | 'clean_life';
  completedAt: string;
  loopsClosedCount: number;
  commitmentsReviewedCount: number;
  tasksCleanedCount: number;
  notesArchivedCount: number;
  notes?: string;
}

export interface LifeContextItem {
  id: string;
  name: string; // e.g. "Work", "Brandex", "Personal Health", "Finance"
  description?: string;
  color?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  why?: string; // "Why does this exist?" context
  consequence?: ConsequenceLevel; // Real-world consequence if missed
  status: TaskStatus;
  priority: Priority;
  category?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  reminderAt?: string; // ISO string
  recurrence: RecurrenceType;
  subtasks: Subtask[];
  tags: string[];
  linkedPersonId?: string;
  linkedEventId?: string;
  linkedNoteId?: string;
  attachmentIds?: string[];
  isPinned?: boolean;
  isMinimumDay?: boolean; // Highlighted for Minimum Day focus
  postponeCount?: number; // Times this task was postponed
  lastPostponedAt?: string;
  lastActivityAt?: string;
  blockedByTaskIds?: string[]; // Dependencies
  waitingOnPersonId?: string;
  waitingOnSince?: string;
  nextAction?: string;
  provenance?: ProvenanceMetadata;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deletedAt?: string; // If in trash
}

export interface AttentionItem {
  id: string;
  type: 'overdue' | 'waiting' | 'commitment' | 'stale' | 'financial' | 'resurface' | 'postponed' | 'decision_review';
  title: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  consequence?: ConsequenceLevel;
  entityType?: EntityType;
  entityId?: string;
  date?: string;
  actionLabel?: string;
  suggestedActions: Array<'complete' | 'snooze' | 'reschedule' | 'archive' | 'make_smaller' | 'open_context' | 'dismiss'>;
}

export interface LifeLoadAssessment {
  level: 'light' | 'moderate' | 'heavy' | 'overloaded';
  score: number;
  summary: string;
  breakdown: {
    overdueCount: number;
    todayCount: number;
    waitingCount: number;
    staleCount: number;
    upcomingPaymentMinor: number;
    criticalCount: number;
    openLoopCount: number;
  };
}

export type ReminderStatus = 'active' | 'snoozed' | 'dismissed' | 'completed';

export interface ReminderItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  recurrence: RecurrenceType;
  snoozedUntil?: string; // ISO string
  status: ReminderStatus;
  notificationState?: 'scheduled' | 'cancelled' | 'delivered';
  linkedType?: EntityType;
  linkedId?: string;
  snoozeCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}


export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  why?: string; // Reason or context for creating this note
  resurfaceDate?: string; // Temporal note resurface trigger (YYYY-MM-DD)
  category?: string;
  tags: string[];
  isPinned: boolean;
  checklistItems: ChecklistItem[];
  attachmentIds: string[];
  voiceNoteIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
}

export interface IdeaItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  tags: string[];
  isPinned: boolean;
  status: 'active' | 'converted' | 'archived';
  convertedToType?: EntityType;
  convertedToId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DontForgetItem {
  id: string;
  text: string;
  triggerDate?: string; // YYYY-MM-DD
  priority: Priority;
  isPinned: boolean;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PersonItem {
  id: string;
  name: string;
  relationship?: string;
  notes?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type FollowupStatus = 'waiting' | 'followup' | 'resolved';

export interface FollowupItem {
  id: string;
  personId: string;
  personName: string;
  subject: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  reminderAt?: string;
  status: FollowupStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface EventReminderSchedule {
  oneDayBefore: boolean;
  recurringHours?: number; // e.g. 2 for every 2 hours until event/dismissed
  customTime?: string;
  enabled: boolean;
  lastNotifiedAt?: string;
  isDismissed?: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  notes?: string;
  personId?: string;
  category?: 'meeting' | 'personal' | 'deadline' | 'travel' | 'health' | 'work' | string;
  color?: string; // e.g. #3b82f6, #10b981, #f59e0b, #8b5cf6, #f43f5e
  reminderAt?: string;
  reminderSchedule?: EventReminderSchedule;
  recurrence: RecurrenceType;
  preparationTaskIds?: string[]; // Tasks to do before you go
  followupNotes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CustomListItem {
  id: string;
  title: string;
  category?: string;
  isPinned: boolean;
  items: {
    id: string;
    text: string;
    completed: boolean;
    order: number;
  }[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Milestone {
  id: string;
  title: string;
  target: number;
  completed: boolean;
}

export interface GoalItem {
  id: string;
  title: string;
  description?: string;
  why?: string; // "Why does this exist?" purpose
  nextAction?: string; // Single clear next step
  lastActivityAt?: string; // Tracks staleness
  targetAmount: number;
  currentAmount: number;
  unit: string; // e.g. "₹", "%", "pages", "hours"
  deadline?: string;
  status: 'not_started' | 'active' | 'completed' | 'archived';
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RoutineStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface RoutineItem {
  id: string;
  title: string;
  frequency: 'morning' | 'evening' | 'daily' | 'weekly' | 'monthly';
  steps: RoutineStep[];
  lastCompletedDate?: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD (canonical identifier)
  title?: string;
  content: string;
  mood?: 'great' | 'good' | 'neutral' | 'tough' | 'exhausted';
  tags: string[];
  attachmentIds: string[];
  voiceNoteIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank' | 'other';

export interface ExpenseItem {
  id: string;
  amountMinor: number; // Integer minor units (e.g. 45050 paise for ₹450.50)
  currency: string; // e.g. "INR", "USD"
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category: string;
  paymentMethod: PaymentMethod;
  isBusiness: boolean;
  notes?: string;
  why?: string; // Purpose / reason for the spend
  linkedPersonId?: string; // Connect money to people
  receiptAttachmentId?: string;
  recurringExpenseId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface IncomeItem {
  id: string;
  amountMinor: number; // Minor units
  currency: string;
  source: string;
  date: string; // YYYY-MM-DD
  category: string;
  isRecurring: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BudgetItem {
  id: string;
  month: string; // YYYY-MM
  category: string; // "Overall" or specific category
  budgetAmountMinor: number; // Minor units
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardItem {
  id: string;
  cardName: string;
  creditLimitMinor: number;
  currentBalanceMinor: number;
  billingDay: number; // 1-31
  paymentDueDay: number; // 1-31
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RecurringExpenseItem {
  id: string;
  title: string;
  amountMinor: number;
  category: string;
  paymentMethod: PaymentMethod;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  reminderAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SavingsGoalItem {
  id: string;
  title: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  deadline?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string; // Stored securely locally in IndexedDB
  createdAt: string;
  deletedAt?: string;
}

export interface VoiceNoteItem {
  id: string;
  title: string;
  durationSeconds: number;
  audioBase64: string;
  linkedType?: EntityType;
  linkedId?: string;
  createdAt: string;
  deletedAt?: string;
}

export interface TemplateItem {
  id: string;
  type: 'task_list' | 'travel' | 'routine' | 'followup';
  title: string;
  description: string;
  payloadJson: string;
  createdAt: string;
}

export interface AppSettings {
  id: string; // 'current_settings'
  currencySymbol: string; // e.g. "₹", "$", "€", "£"
  currencyCode: string; // "INR", "USD", etc.
  weekStartsMonday: boolean;
  defaultScreen: 'home' | 'inbox' | 'tasks' | 'calendar' | 'more';
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  budgetWarningThreshold: number; // 50, 75, 90, 100%
  backupReminderDays: number; // 1, 3, 7, 0 (manual)
  lastBackupDate?: string;
  changesSinceBackup: number;
  theme: 'light' | 'dark';
  accentColor?: AccentColor;
  isOnboarded?: boolean;
  momentumEnabled?: boolean;
}

export type AccentColor =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'violet'
  | 'green'
  | 'teal'
  | 'orange'
  | 'red'
  | 'rose'
  | 'slate';

export interface AuditHistoryEntry {
  id: string;
  action: 'create' | 'update' | 'complete' | 'delete' | 'restore' | 'archive';
  entityType: EntityType;
  entityId: string;
  summary: string;
  timestamp: string;
}

// Full portable versioned backup package definition (.plife) - Section 24
export interface BackupPayload {
  format?: string; // 'personal-life-os-backup'
  backupVersion?: number; // 1
  schemaVersion: number;
  appVersion: string;
  appName: string;
  exportDate: string;
  timezone?: string;
  currency?: string;
  devicePlatform: string;
  recordCount: number;
  integrity?: {
    checksum: string;
    algorithm: string;
  };
  isEncrypted?: boolean;
  saltHex?: string;
  ivHex?: string;
  encryptedBlobBase64?: string;
  tables: {
    inbox: InboxItem[];
    tasks: TaskItem[];
    reminders: ReminderItem[];
    notes: NoteItem[];
    ideas: IdeaItem[];
    dontForget: DontForgetItem[];
    people: PersonItem[];
    followups: FollowupItem[];
    events: EventItem[];
    lists: CustomListItem[];
    goals: GoalItem[];
    routines: RoutineItem[];
    journalEntries: JournalEntry[];
    expenses: ExpenseItem[];
    income: IncomeItem[];
    budgets: BudgetItem[];
    creditCards: CreditCardItem[];
    recurringExpenses: RecurringExpenseItem[];
    savingsGoals: SavingsGoalItem[];
    attachments: AttachmentItem[];
    voiceNotes: VoiceNoteItem[];
    relationships: RelationshipItem[];
    commitments?: CommitmentItem[];
    decisions?: DecisionItem[];
    openLoops?: OpenLoopItem[];
    dependencies?: DependencyItem[];
    futureMessages?: FutureMessageItem[];
    reviewSessions?: ReviewSessionItem[];
    lifeContexts?: LifeContextItem[];
    settings?: AppSettings;
    auditHistory?: AuditHistoryEntry[];
  };
}

export interface BackupPreviewSummary {
  isValid: boolean;
  errorMessage?: string;
  schemaVersion: number;
  exportDate: string;
  totalRecords: number;
  isEncrypted?: boolean;
  counts: {
    inbox: number;
    tasks: number;
    reminders: number;
    notes: number;
    ideas: number;
    dontForget: number;
    people: number;
    followups: number;
    events: number;
    lists: number;
    goals: number;
    routines: number;
    journalEntries: number;
    expenses: number;
    income: number;
    budgets: number;
    creditCards: number;
    recurringExpenses: number;
    savingsGoals: number;
    attachments: number;
    voiceNotes: number;
    relationships: number;
    commitments?: number;
    decisions?: number;
    openLoops?: number;
    dependencies?: number;
    futureMessages?: number;
    reviewSessions?: number;
    lifeContexts?: number;
  };
}
