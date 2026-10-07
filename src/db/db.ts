import Dexie, { type EntityTable } from 'dexie';
import type {
  InboxItem,
  RelationshipItem,
  TaskItem,
  ReminderItem,
  NoteItem,
  IdeaItem,
  DontForgetItem,
  PersonItem,
  FollowupItem,
  EventItem,
  CustomListItem,
  GoalItem,
  RoutineItem,
  JournalEntry,
  ExpenseItem,
  IncomeItem,
  BudgetItem,
  CreditCardItem,
  RecurringExpenseItem,
  SavingsGoalItem,
  AttachmentItem,
  VoiceNoteItem,
  TemplateItem,
  CommitmentItem,
  DecisionItem,
  OpenLoopItem,
  DependencyItem,
  FutureMessageItem,
  ReviewSessionItem,
  LifeContextItem,
  CanvasItem,
  WarrantyItem,
  FamilyMemberItem,
  CareReminderItem,
  DocumentItem,
  InviteItem,
  VaultResourceItem,
  MeetingNoteItem,
  ConversationLogItem,
  HabitItem,
  StudySubjectItem,
  AppSettings,
  AuditHistoryEntry,
  EntityType
} from '../types';

export class PersonalLifeDatabase extends Dexie {
  inbox!: EntityTable<InboxItem, 'id'>;
  relationships!: EntityTable<RelationshipItem, 'id'>;
  tasks!: EntityTable<TaskItem, 'id'>;
  reminders!: EntityTable<ReminderItem, 'id'>;
  notes!: EntityTable<NoteItem, 'id'>;
  ideas!: EntityTable<IdeaItem, 'id'>;
  dontForget!: EntityTable<DontForgetItem, 'id'>;
  people!: EntityTable<PersonItem, 'id'>;
  followups!: EntityTable<FollowupItem, 'id'>;
  events!: EntityTable<EventItem, 'id'>;
  lists!: EntityTable<CustomListItem, 'id'>;
  goals!: EntityTable<GoalItem, 'id'>;
  routines!: EntityTable<RoutineItem, 'id'>;
  journalEntries!: EntityTable<JournalEntry, 'id'>;
  expenses!: EntityTable<ExpenseItem, 'id'>;
  income!: EntityTable<IncomeItem, 'id'>;
  budgets!: EntityTable<BudgetItem, 'id'>;
  creditCards!: EntityTable<CreditCardItem, 'id'>;
  recurringExpenses!: EntityTable<RecurringExpenseItem, 'id'>;
  savingsGoals!: EntityTable<SavingsGoalItem, 'id'>;
  attachments!: EntityTable<AttachmentItem, 'id'>;
  voiceNotes!: EntityTable<VoiceNoteItem, 'id'>;
  templates!: EntityTable<TemplateItem, 'id'>;
  commitments!: EntityTable<CommitmentItem, 'id'>;
  decisions!: EntityTable<DecisionItem, 'id'>;
  openLoops!: EntityTable<OpenLoopItem, 'id'>;
  dependencies!: EntityTable<DependencyItem, 'id'>;
  futureMessages!: EntityTable<FutureMessageItem, 'id'>;
  reviewSessions!: EntityTable<ReviewSessionItem, 'id'>;
  lifeContexts!: EntityTable<LifeContextItem, 'id'>;
  canvases!: EntityTable<CanvasItem, 'id'>;
  warranties!: EntityTable<WarrantyItem, 'id'>;
  familyMembers!: EntityTable<FamilyMemberItem, 'id'>;
  careReminders!: EntityTable<CareReminderItem, 'id'>;
  documents!: EntityTable<DocumentItem, 'id'>;
  invites!: EntityTable<InviteItem, 'id'>;
  vaultResources!: EntityTable<VaultResourceItem, 'id'>;
  meetingNotes!: EntityTable<MeetingNoteItem, 'id'>;
  conversationLogs!: EntityTable<ConversationLogItem, 'id'>;
  habits!: EntityTable<HabitItem, 'id'>;
  studySubjects!: EntityTable<StudySubjectItem, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  auditHistory!: EntityTable<AuditHistoryEntry, 'id'>;

  constructor() {
    super('PersonalLifeOS_DB');

    this.version(1).stores({
      tasks: 'id, status, priority, category, dueDate, recurrence, linkedPersonId, createdAt, completedAt, deletedAt',
      reminders: 'id, date, status, recurrence, linkedType, linkedId, createdAt, deletedAt',
      notes: 'id, category, isPinned, createdAt, archivedAt, deletedAt',
      ideas: 'id, category, status, isPinned, createdAt, deletedAt',
      dontForget: 'id, triggerDate, priority, isPinned, isDismissed, createdAt, deletedAt',
      people: 'id, name, createdAt, deletedAt',
      followups: 'id, personId, dueDate, status, createdAt, deletedAt',
      events: 'id, date, personId, createdAt, deletedAt',
      lists: 'id, category, isPinned, createdAt, deletedAt',
      goals: 'id, status, deadline, createdAt, deletedAt',
      routines: 'id, frequency, createdAt, deletedAt',
      journalEntries: 'id, date, mood, createdAt, deletedAt',
      expenses: 'id, date, category, paymentMethod, isBusiness, recurringExpenseId, goalId, createdAt, deletedAt',
      income: 'id, date, category, isRecurring, createdAt, deletedAt',
      budgets: 'id, month, category',
      creditCards: 'id, cardName, createdAt, deletedAt',
      recurringExpenses: 'id, frequency, nextDueDate, isActive, createdAt, deletedAt',
      savingsGoals: 'id, deadline, createdAt, deletedAt',
      attachments: 'id, name, mimeType, createdAt, deletedAt',
      voiceNotes: 'id, linkedType, linkedId, createdAt, deletedAt',
      templates: 'id, type, createdAt',
      settings: 'id',
      auditHistory: 'id, action, entityType, entityId, timestamp'
    });

    // Version 2 adds inbox and explicit relationships store
    this.version(2).stores({
      inbox: 'id, isProcessed, createdAt, deletedAt',
      relationships: 'id, sourceId, sourceType, targetId, targetType, createdAt'
    });

    // Version 3 adds commitments, decisions, open loops, and dependencies
    this.version(3).stores({
      commitments: 'id, personId, promisedDate, status, createdAt, deletedAt',
      decisions: 'id, reviewDate, status, createdAt, deletedAt',
      openLoops: 'id, loopType, sourceEntityId, waitingOnPersonId, status, createdAt, deletedAt',
      dependencies: 'id, blockerId, blockedId, createdAt'
    });

    // Version 4 adds future messages, review sessions, and life contexts
    this.version(4).stores({
      futureMessages: 'id, openDate, isOpened, createdAt, deletedAt',
      reviewSessions: 'id, reviewType, completedAt',
      lifeContexts: 'id, name, isArchived, createdAt'
    });

    // Version 5 adds canvas, warranty, family members, care reminders, documents, invites
    this.version(5).stores({
      canvases: 'id, name, createdAt, updatedAt, archivedAt, deletedAt',
      warranties: 'id, itemName, brand, warrantyEnd, status, createdAt, deletedAt',
      familyMembers: 'id, name, relationship, createdAt, deletedAt',
      careReminders: 'id, familyMemberId, reminderType, dueDate, status, createdAt, deletedAt',
      documents: 'id, title, category, relatedEntityType, relatedEntityId, createdAt, deletedAt',
      invites: 'id, token, expiresAt, createdAt'
    });

    // Version 6 adds "Where Did I Put That?" vault, meeting notes & transcripts, and personal CRM conversation memory
    this.version(6).stores({
      vaultResources: 'id, title, category, isPinned, createdAt, deletedAt',
      meetingNotes: 'id, title, personId, meetingDate, createdAt, deletedAt',
      conversationLogs: 'id, personId, date, createdAt, deletedAt'
    });

    // Version 7 adds streak-based Habits and Study Planner with syllabus & chapter tracking
    this.version(7).stores({
      habits: 'id, name, category, streak, createdAt, deletedAt',
      studySubjects: 'id, title, deadline, createdAt, deletedAt'
    });
  }
}

export const db = new PersonalLifeDatabase();

export function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export async function incrementChangeCounter() {
  try {
    const current = await db.settings.get('current_settings');
    if (current) {
      await db.settings.update('current_settings', {
        changesSinceBackup: (current.changesSinceBackup || 0) + 1
      });
    }
  } catch (err) {
    console.warn('Failed to increment change counter:', err);
  }
}

export async function logAudit(
  action: AuditHistoryEntry['action'],
  entityType: EntityType,
  entityId: string,
  summary: string
) {
  try {
    const entry: AuditHistoryEntry = {
      id: generateId(),
      action,
      entityType,
      entityId,
      summary,
      timestamp: new Date().toISOString()
    };
    await db.auditHistory.add(entry);
    await incrementChangeCounter();
  } catch (err) {
    console.warn('Failed to log audit:', err);
  }
}

// Relationship Manager helpers
export async function addRelationship(
  sourceId: string,
  sourceType: EntityType,
  targetId: string,
  targetType: EntityType,
  relationshipLabel?: string
) {
  const existing = await db.relationships
    .filter(
      (r) =>
        (r.sourceId === sourceId && r.targetId === targetId) ||
        (r.sourceId === targetId && r.targetId === sourceId)
    )
    .first();

  if (!existing) {
    await db.relationships.add({
      id: generateId(),
      sourceId,
      sourceType,
      targetId,
      targetType,
      relationshipLabel,
      createdAt: new Date().toISOString()
    });
    await incrementChangeCounter();
  }
}

export async function removeRelationship(id: string) {
  await db.relationships.delete(id);
  await incrementChangeCounter();
}

export async function getLinkedRecords(recordId: string): Promise<RelationshipItem[]> {
  return db.relationships
    .filter((r) => r.sourceId === recordId || r.targetId === recordId)
    .toArray();
}

// Data Integrity Checker
export interface IntegrityReport {
  scannedAt: string;
  isHealthy: boolean;
  orphanedRelationships: number;
  brokenAttachmentRefs: number;
  duplicateIdsFound: number;
  repairedCount: number;
}

export async function checkAndRepairDatabaseIntegrity(repair: boolean = false): Promise<IntegrityReport> {
  let orphanedRelCount = 0;
  let brokenAttRefCount = 0;
  let repairedCount = 0;

  const [allRelationships, allAttachments, tasks, notes, journal] = await Promise.all([
    db.relationships.toArray(),
    db.attachments.toArray(),
    db.tasks.toArray(),
    db.notes.toArray(),
    db.journalEntries.toArray()
  ]);

  const attachmentIdSet = new Set(allAttachments.map((a) => a.id));

  // Check attachments in tasks, notes, journal
  for (const t of tasks) {
    if (t.attachmentIds) {
      const valid = t.attachmentIds.filter((id) => attachmentIdSet.has(id));
      if (valid.length !== t.attachmentIds.length) {
        brokenAttRefCount += t.attachmentIds.length - valid.length;
        if (repair) {
          await db.tasks.update(t.id, { attachmentIds: valid });
          repairedCount++;
        }
      }
    }
  }

  for (const n of notes) {
    if (n.attachmentIds) {
      const valid = n.attachmentIds.filter((id) => attachmentIdSet.has(id));
      if (valid.length !== n.attachmentIds.length) {
        brokenAttRefCount += n.attachmentIds.length - valid.length;
        if (repair) {
          await db.notes.update(n.id, { attachmentIds: valid });
          repairedCount++;
        }
      }
    }
  }

  for (const j of journal) {
    if (j.attachmentIds) {
      const valid = j.attachmentIds.filter((id) => attachmentIdSet.has(id));
      if (valid.length !== j.attachmentIds.length) {
        brokenAttRefCount += j.attachmentIds.length - valid.length;
        if (repair) {
          await db.journalEntries.update(j.id, { attachmentIds: valid });
          repairedCount++;
        }
      }
    }
  }

  // Check orphaned relationships
  const toDeleteRels: string[] = [];
  for (const rel of allRelationships) {
    // Check if source or target exists
    const [sourceExists, targetExists] = await Promise.all([
      recordExists(rel.sourceType, rel.sourceId),
      recordExists(rel.targetType, rel.targetId)
    ]);
    if (!sourceExists || !targetExists) {
      orphanedRelCount++;
      if (repair) toDeleteRels.push(rel.id);
    }
  }

  if (repair && toDeleteRels.length > 0) {
    await db.relationships.bulkDelete(toDeleteRels);
    repairedCount += toDeleteRels.length;
  }

  return {
    scannedAt: new Date().toISOString(),
    isHealthy: orphanedRelCount === 0 && brokenAttRefCount === 0,
    orphanedRelationships: orphanedRelCount,
    brokenAttachmentRefs: brokenAttRefCount,
    duplicateIdsFound: 0,
    repairedCount
  };
}

async function recordExists(type: EntityType, id: string): Promise<boolean> {
  try {
    switch (type) {
      case 'task': return !!(await db.tasks.get(id));
      case 'reminder': return !!(await db.reminders.get(id));
      case 'note': return !!(await db.notes.get(id));
      case 'idea': return !!(await db.ideas.get(id));
      case 'person': return !!(await db.people.get(id));
      case 'event': return !!(await db.events.get(id));
      case 'expense': return !!(await db.expenses.get(id));
      case 'goal': return !!(await db.goals.get(id));
      case 'list': return !!(await db.lists.get(id));
      case 'canvas': return !!(await db.canvases.get(id));
      case 'warranty': return !!(await db.warranties.get(id));
      case 'family_member': return !!(await db.familyMembers.get(id));
      case 'care_reminder': return !!(await db.careReminders.get(id));
      case 'document': return !!(await db.documents.get(id));
      case 'commitment': return !!(await db.commitments.get(id));
      case 'decision': return !!(await db.decisions.get(id));
      case 'open_loop': return !!(await db.openLoops.get(id));
      default: return true;
    }
  } catch {
    return true;
  }
}

// Initial defaults
export async function initializeDatabaseDefaults() {
  try {
    const existingSettings = await db.settings.get('current_settings');
    if (!existingSettings) {
      const defaultSettings: AppSettings = {
        id: 'current_settings',
        currencySymbol: '₹',
        currencyCode: 'INR',
        weekStartsMonday: true,
        defaultScreen: 'home',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        budgetWarningThreshold: 90,
        backupReminderDays: 3,
        changesSinceBackup: 0,
        theme: 'light',
        isOnboarded: false
      };
      await db.settings.put(defaultSettings);
    }

    const templatesCount = await db.templates.count();
    if (templatesCount === 0) {
      await db.templates.bulkPut([
        {
          id: 'template_packing',
          type: 'travel',
          title: 'Travel & Packing Essentials',
          description: 'Standard checklist for domestic and international trips',
          payloadJson: JSON.stringify([
            'Tickets & Government ID / Passport',
            'Phone Charger & Power Bank',
            'Medications & First Aid',
            'Change of Clothes & Toiletries',
            'Laptop & Work Cables',
            'House Keys & Wallet'
          ]),
          createdAt: new Date().toISOString()
        },
        {
          id: 'template_client_followup',
          type: 'followup',
          title: 'Client / Contact Follow-up',
          description: 'Standard stages for following up on discussions',
          payloadJson: JSON.stringify([
            'Send summary notes from discussion',
            'Confirm receipt of proposal / requirements',
            'Check feedback within 3 days',
            'Schedule next milestone review'
          ]),
          createdAt: new Date().toISOString()
        },
        {
          id: 'template_monthly_finance',
          type: 'routine',
          title: 'Monthly Finance Review',
          description: 'End of month financial wellness checklist',
          payloadJson: JSON.stringify([
            'Review bank statements for unintended charges',
            'Check recurring subscription active statuses',
            'Compare monthly spending with category budgets',
            'Transfer scheduled savings to goal account',
            'Verify credit card billing amounts'
          ]),
          createdAt: new Date().toISOString()
        }
      ]);
    }
  } catch (err) {
    console.error('Error initializing database defaults:', err);
  }
}
