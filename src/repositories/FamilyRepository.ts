// Family Care Repository (Section 27-30)
// Personal organization for family members, care reminders, documents, and 360 context.

import { db, generateId, logAudit, addRelationship } from '../db/db';
import type { FamilyMemberItem, CareReminderItem, TaskItem, EventItem, DocumentItem } from '../types';
import { sanitizeObject } from '../services/securityService';
import { multiTabSync } from '../services/multiTabService';

export class FamilyRepository {
  // --- FAMILY MEMBERS ---

  public static async createMember(input: {
    name: string;
    relationship: string;
    phone?: string;
    email?: string;
    notes?: string;
    importantDates?: { id?: string; label: string; date: string }[];
  }): Promise<FamilyMemberItem> {
    if (!input.name?.trim()) throw new Error('Family member name is required.');
    if (!input.relationship?.trim()) throw new Error('Relationship is required.');

    const now = new Date().toISOString();
    const id = generateId();

    const dates = (input.importantDates || []).map(d => ({
      id: d.id || generateId(),
      label: d.label.trim(),
      date: d.date
    }));

    const member: FamilyMemberItem = sanitizeObject({
      id,
      name: input.name.trim(),
      relationship: input.relationship.trim(),
      phone: input.phone?.trim(),
      email: input.email?.trim(),
      notes: input.notes?.trim(),
      importantDates: dates,
      documentIds: [],
      createdAt: now,
      updatedAt: now
    });

    await db.familyMembers.add(member);
    await logAudit('create', 'family_member', id, `Added family member: ${member.name} (${member.relationship})`);
    multiTabSync.broadcastMutation('family_member', id, 'create', now);

    return member;
  }

  public static async getMemberById(id: string): Promise<FamilyMemberItem | undefined> {
    return db.familyMembers.get(id);
  }

  public static async updateMember(id: string, updates: Partial<FamilyMemberItem>): Promise<FamilyMemberItem> {
    const existing = await db.familyMembers.get(id);
    if (!existing) throw new Error(`Family member ${id} not found.`);

    const now = new Date().toISOString();
    const cleanUpdates = sanitizeObject({
      ...updates,
      updatedAt: now
    });

    await db.familyMembers.update(id, cleanUpdates);
    await logAudit('update', 'family_member', id, `Updated family member: ${cleanUpdates.name || existing.name}`);
    multiTabSync.broadcastMutation('family_member', id, 'update', now);

    return (await db.familyMembers.get(id))!;
  }

  public static async softDeleteMember(id: string): Promise<void> {
    const existing = await db.familyMembers.get(id);
    if (!existing || existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.familyMembers.update(id, {
      deletedAt: now,
      updatedAt: now
    });

    await logAudit('delete', 'family_member', id, `Moved family member to trash: ${existing.name}`);
    multiTabSync.broadcastMutation('family_member', id, 'delete', now);
  }

  public static async restoreMember(id: string): Promise<void> {
    const existing = await db.familyMembers.get(id);
    if (!existing || !existing.deletedAt) return;

    const now = new Date().toISOString();
    await db.familyMembers.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });

    await logAudit('restore', 'family_member', id, `Restored family member: ${existing.name}`);
    multiTabSync.broadcastMutation('family_member', id, 'restore', now);
  }

  public static async permanentDeleteMember(id: string): Promise<void> {
    const existing = await db.familyMembers.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.familyMembers, db.careReminders, db.relationships, db.auditHistory, db.settings], async () => {
      // Remove care reminders
      const reminders = await db.careReminders.filter(r => r.familyMemberId === id).toArray();
      if (reminders.length > 0) {
        await db.careReminders.bulkDelete(reminders.map(r => r.id));
      }

      // Remove relationships
      const rels = await db.relationships
        .filter(r => (r.sourceId === id && r.sourceType === 'family_member') || (r.targetId === id && r.targetType === 'family_member'))
        .toArray();
      if (rels.length > 0) {
        await db.relationships.bulkDelete(rels.map(r => r.id));
      }

      await db.familyMembers.delete(id);
    });

    await logAudit('delete', 'family_member', id, `Permanently deleted family member: ${existing.name}`);
    multiTabSync.broadcastMutation('family_member', id, 'delete');
  }

  public static async queryActiveMembers(): Promise<FamilyMemberItem[]> {
    return db.familyMembers.filter(m => !m.deletedAt).sortBy('name');
  }

  // --- CARE REMINDERS ---

  public static async addCareReminder(input: {
    familyMemberId: string;
    title: string;
    reminderType: CareReminderItem['reminderType'];
    dueDate: string;
    dueTime?: string;
    notes?: string;
  }): Promise<CareReminderItem> {
    const member = await db.familyMembers.get(input.familyMemberId);
    if (!member) throw new Error('Valid family member required for care reminder.');
    if (!input.title?.trim()) throw new Error('Care reminder title is required.');
    if (!input.dueDate) throw new Error('Due date is required.');

    const now = new Date().toISOString();
    const id = generateId();

    const reminder: CareReminderItem = sanitizeObject({
      id,
      familyMemberId: member.id,
      familyMemberName: member.name,
      title: input.title.trim(),
      reminderType: input.reminderType || 'check_in',
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      notes: input.notes?.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    await db.careReminders.add(reminder);
    await logAudit('create', 'care_reminder', id, `Added care reminder for ${member.name}: ${reminder.title}`);
    multiTabSync.broadcastMutation('care_reminder', id, 'create', now);

    return reminder;
  }

  public static async completeCareReminder(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.careReminders.update(id, {
      status: 'completed',
      updatedAt: now
    });
    multiTabSync.broadcastMutation('care_reminder', id, 'update', now);
  }

  public static async softDeleteCareReminder(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.careReminders.update(id, {
      deletedAt: now,
      updatedAt: now
    });
    multiTabSync.broadcastMutation('care_reminder', id, 'delete', now);
  }

  public static async restoreCareReminder(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.careReminders.update(id, {
      deletedAt: undefined,
      updatedAt: now
    });
    multiTabSync.broadcastMutation('care_reminder', id, 'restore', now);
  }

  public static async permanentDeleteCareReminder(id: string): Promise<void> {
    await db.careReminders.delete(id);
    multiTabSync.broadcastMutation('care_reminder', id, 'delete');
  }

  public static async queryCareRemindersForMember(memberId: string): Promise<CareReminderItem[]> {
    return db.careReminders
      .filter(r => !r.deletedAt && r.familyMemberId === memberId)
      .reverse()
      .sortBy('dueDate');
  }

  public static async queryAllActiveCareReminders(): Promise<CareReminderItem[]> {
    return db.careReminders
      .filter(r => !r.deletedAt && r.status === 'active')
      .sortBy('dueDate');
  }

  // --- 360 DEGREE FAMILY CONTEXT (Section 30) ---

  public static async getFamilyContext(memberId: string): Promise<{
    member: FamilyMemberItem;
    reminders: CareReminderItem[];
    documents: DocumentItem[];
    relatedTasks: TaskItem[];
    relatedEvents: EventItem[];
  }> {
    const member = await db.familyMembers.get(memberId);
    if (!member) throw new Error('Family member not found');

    const [reminders, documents, allTasks, allEvents] = await Promise.all([
      db.careReminders.filter(r => !r.deletedAt && r.familyMemberId === memberId).toArray(),
      db.documents.filter(d => !d.deletedAt && d.relatedEntityId === memberId).toArray(),
      db.tasks.filter(t => !t.deletedAt && (t.linkedPersonId === memberId || (t.title.toLowerCase().includes(member.name.toLowerCase())))).toArray(),
      db.events.filter(e => !e.deletedAt && (e.personId === memberId || (e.title.toLowerCase().includes(member.name.toLowerCase())))).toArray()
    ]);

    return {
      member,
      reminders,
      documents,
      relatedTasks: allTasks,
      relatedEvents: allEvents
    };
  }
}
