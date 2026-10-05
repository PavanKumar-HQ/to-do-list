// Life Graph & Context Engine (Sections 4, 17, 25, 26)
// Traverses relationships and foreign keys to assemble the unified 360-degree context of any life entity.

import { db } from '../db/db';
import type {
  EntityType,
  TaskItem,
  PersonItem,
  EventItem,
  NoteItem,
  ExpenseItem,
  GoalItem,
  CommitmentItem,
  DecisionItem,
  AttachmentItem
} from '../types';

export interface LifeEntityContext {
  entityId: string;
  entityType: EntityType;
  title: string;
  why?: string;
  nextAction?: string;
  consequence?: string;
  connectedPeople: PersonItem[];
  connectedEvents: EventItem[];
  connectedTasks: TaskItem[];
  connectedNotes: NoteItem[];
  connectedExpenses: ExpenseItem[];
  connectedGoals: GoalItem[];
  connectedCommitments: CommitmentItem[];
  connectedDecisions: DecisionItem[];
  connectedAttachments: AttachmentItem[];
  totalExpenseMinor: number;
  preparationTasks?: TaskItem[];
}

export class LifeGraphService {
  /**
   * Traverse the entire life graph for an entity and assemble its complete context
   */
  public static async getEntityContext(type: EntityType, id: string): Promise<LifeEntityContext> {
    // 1. Fetch relationships connected to this entity
    const rels = await db.relationships
      .filter(r => (r.sourceId === id && r.sourceType === type) || (r.targetId === id && r.targetType === type))
      .toArray();

    const targetPairs: Array<{ type: EntityType; id: string }> = rels.map(r => {
      return r.sourceId === id ? { type: r.targetType, id: r.targetId } : { type: r.sourceType, id: r.sourceId };
    });

    // 2. Also inspect direct foreign key linkages based on entity type
    let title = 'Context';
    let why: string | undefined;
    let nextAction: string | undefined;
    let consequence: string | undefined;

    if (type === 'person') {
      const p = await db.people.get(id);
      if (p) title = p.name;
    } else if (type === 'event') {
      const e = await db.events.get(id);
      if (e) {
        title = e.title;
        if (e.personId) targetPairs.push({ type: 'person', id: e.personId });
      }
    } else if (type === 'task') {
      const t = await db.tasks.get(id);
      if (t) {
        title = t.title;
        why = t.why;
        nextAction = t.nextAction;
        consequence = t.consequence;
        if (t.linkedPersonId) targetPairs.push({ type: 'person', id: t.linkedPersonId });
        if (t.linkedEventId) targetPairs.push({ type: 'event', id: t.linkedEventId });
        if (t.linkedNoteId) targetPairs.push({ type: 'note', id: t.linkedNoteId });
        if (t.attachmentIds) {
          for (const attId of t.attachmentIds) targetPairs.push({ type: 'attachment', id: attId });
        }
      }
    } else if (type === 'goal') {
      const g = await db.goals.get(id);
      if (g) {
        title = g.title;
        why = g.why;
        nextAction = g.nextAction;
      }
    } else if (type === 'note') {
      const n = await db.notes.get(id);
      if (n) {
        title = n.title;
        why = n.why;
      }
    } else if (type === 'decision') {
      const d = await db.decisions.get(id);
      if (d) {
        title = d.title;
        why = d.reason;
      }
    }

    // Direct reverse searches (e.g. tasks linking to this person/event/goal)
    if (type === 'person') {
      const linkedTasks = await db.tasks.filter(t => t.linkedPersonId === id && !t.deletedAt).toArray();
      linkedTasks.forEach(t => targetPairs.push({ type: 'task', id: t.id }));

      const linkedExpenses = await db.expenses.filter(e => e.linkedPersonId === id && !e.deletedAt).toArray();
      linkedExpenses.forEach(e => targetPairs.push({ type: 'expense', id: e.id }));

      const linkedEvents = await db.events.filter(e => e.personId === id && !e.deletedAt).toArray();
      linkedEvents.forEach(e => targetPairs.push({ type: 'event', id: e.id }));

      const linkedCommitments = await db.commitments.filter(c => c.personId === id && !c.deletedAt).toArray();
      linkedCommitments.forEach(c => targetPairs.push({ type: 'commitment', id: c.id }));
    } else if (type === 'event') {
      const linkedTasks = await db.tasks.filter(t => t.linkedEventId === id && !t.deletedAt).toArray();
      linkedTasks.forEach(t => targetPairs.push({ type: 'task', id: t.id }));
    } else if (type === 'goal') {
      const linkedExpenses = await db.expenses.filter(e => e.goalId === id && !e.deletedAt).toArray();
      linkedExpenses.forEach(e => targetPairs.push({ type: 'expense', id: e.id }));
    }

    // Resolve entities from pairs
    const connectedPeople: PersonItem[] = [];
    const connectedEvents: EventItem[] = [];
    const connectedTasks: TaskItem[] = [];
    const connectedNotes: NoteItem[] = [];
    const connectedExpenses: ExpenseItem[] = [];
    const connectedGoals: GoalItem[] = [];
    const connectedCommitments: CommitmentItem[] = [];
    const connectedDecisions: DecisionItem[] = [];
    const connectedAttachments: AttachmentItem[] = [];

    const seenIds = new Set<string>();

    for (const pair of targetPairs) {
      if (pair.id === id || seenIds.has(pair.id)) continue;
      seenIds.add(pair.id);

      switch (pair.type) {
        case 'person': {
          const rec = await db.people.get(pair.id);
          if (rec && !rec.deletedAt) connectedPeople.push(rec);
          break;
        }
        case 'event': {
          const rec = await db.events.get(pair.id);
          if (rec && !rec.deletedAt) connectedEvents.push(rec);
          break;
        }
        case 'task': {
          const rec = await db.tasks.get(pair.id);
          if (rec && !rec.deletedAt) connectedTasks.push(rec);
          break;
        }
        case 'note': {
          const rec = await db.notes.get(pair.id);
          if (rec && !rec.deletedAt && !rec.archivedAt) connectedNotes.push(rec);
          break;
        }
        case 'expense': {
          const rec = await db.expenses.get(pair.id);
          if (rec && !rec.deletedAt) connectedExpenses.push(rec);
          break;
        }
        case 'goal': {
          const rec = await db.goals.get(pair.id);
          if (rec && !rec.deletedAt) connectedGoals.push(rec);
          break;
        }
        case 'commitment': {
          const rec = await db.commitments.get(pair.id);
          if (rec && !rec.deletedAt) connectedCommitments.push(rec);
          break;
        }
        case 'decision': {
          const rec = await db.decisions.get(pair.id);
          if (rec && !rec.deletedAt) connectedDecisions.push(rec);
          break;
        }
        case 'attachment': {
          const rec = await db.attachments.get(pair.id);
          if (rec && !rec.deletedAt) connectedAttachments.push(rec);
          break;
        }
      }
    }

    const totalExpenseMinor = connectedExpenses.reduce((sum, e) => sum + e.amountMinor, 0);

    return {
      entityId: id,
      entityType: type,
      title,
      why,
      nextAction,
      consequence,
      connectedPeople,
      connectedEvents,
      connectedTasks,
      connectedNotes,
      connectedExpenses,
      connectedGoals,
      connectedCommitments,
      connectedDecisions,
      connectedAttachments,
      totalExpenseMinor,
      preparationTasks: connectedTasks.filter(t => t.status === 'todo')
    };
  }
}
