import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Heart,
  Plus,
  Calendar,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  Trash2,
  Edit2,
  ChevronRight,
  X,
  Activity,
  Sparkles
} from 'lucide-react';
import { FamilyRepository } from '../../repositories/FamilyRepository';
import { db } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ItemDetailModal } from '../common/ItemDetailModal';
import { ContextModal } from '../common/ContextModal';
import type { FamilyMemberItem, CareReminderItem, EntityType } from '../../types';

export const FamilyView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'members' | 'reminders'>('members');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMemberItem | null>(null);

  // Form states for Member
  const [memberName, setMemberName] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  const [importantDateLabel, setImportantDateLabel] = useState('');
  const [importantDateVal, setImportantDateVal] = useState('');

  // Form states for Care Reminder
  const [reminderTargetMemberId, setReminderTargetMemberId] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderType, setReminderType] = useState<CareReminderItem['reminderType']>('check_in');
  const [reminderDate, setReminderDate] = useState(getTodayDateString());
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  // Detail Modal
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    type: EntityType;
    item: any;
  }>({
    isOpen: false,
    type: 'family_member',
    item: null
  });

  // Context Modal
  const [contextModal, setContextModal] = useState<{
    isOpen: boolean;
    type: EntityType | null;
    id: string | null;
  }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Queries
  const familyMembers = useLiveQuery(async () => {
    return FamilyRepository.queryActiveMembers();
  }, []) || [];

  const careReminders = useLiveQuery(async () => {
    return db.careReminders.filter(r => !r.deletedAt).reverse().sortBy('dueDate');
  }, []) || [];

  // 360 Context for selected member
  const memberContext = useLiveQuery(async () => {
    if (!selectedMemberId) return null;
    try {
      return await FamilyRepository.getFamilyContext(selectedMemberId);
    } catch {
      return null;
    }
  }, [selectedMemberId]);

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberName('');
    setMemberRelationship('');
    setMemberPhone('');
    setMemberEmail('');
    setMemberNotes('');
    setImportantDateLabel('');
    setImportantDateVal('');
    setIsAddMemberOpen(true);
  };

  const handleOpenEditMember = (member: FamilyMemberItem) => {
    setEditingMember(member);
    setMemberName(member.name);
    setMemberRelationship(member.relationship);
    setMemberPhone(member.phone || '');
    setMemberEmail(member.email || '');
    setMemberNotes(member.notes || '');
    setIsAddMemberOpen(true);
  };

  const handleSaveMember = async () => {
    if (!memberName.trim() || !memberRelationship.trim()) {
      showToast('Name and Relationship are required', { type: 'warning' });
      return;
    }

    try {
      if (editingMember) {
        await FamilyRepository.updateMember(editingMember.id, {
          name: memberName.trim(),
          relationship: memberRelationship.trim(),
          phone: memberPhone.trim() || undefined,
          email: memberEmail.trim() || undefined,
          notes: memberNotes.trim() || undefined
        });
        showToast(`Updated ${memberName.trim()}`, { type: 'success' });
      } else {
        const importantDates = importantDateLabel && importantDateVal ? [
          { label: importantDateLabel.trim(), date: importantDateVal }
        ] : [];

        await FamilyRepository.createMember({
          name: memberName.trim(),
          relationship: memberRelationship.trim(),
          phone: memberPhone.trim() || undefined,
          email: memberEmail.trim() || undefined,
          notes: memberNotes.trim() || undefined,
          importantDates
        });
        showToast(`Added ${memberName.trim()} to Family Care`, { type: 'success' });
      }
      setIsAddMemberOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save', { type: 'error' });
    }
  };

  const handleSaveReminder = async () => {
    if (!reminderTargetMemberId || !reminderTitle.trim() || !reminderDate) {
      showToast('Member, title, and due date are required', { type: 'warning' });
      return;
    }

    try {
      await FamilyRepository.addCareReminder({
        familyMemberId: reminderTargetMemberId,
        title: reminderTitle.trim(),
        reminderType,
        dueDate: reminderDate,
        dueTime: reminderTime || undefined,
        notes: reminderNotes.trim() || undefined
      });
      showToast('Care reminder created', { type: 'success' });
      setIsAddReminderOpen(false);
      setReminderTitle('');
      setReminderNotes('');
      setReminderTime('');
    } catch (err: any) {
      showToast(err.message || 'Failed to save reminder', { type: 'error' });
    }
  };

  const handleToggleReminderComplete = async (r: CareReminderItem) => {
    try {
      if (r.status === 'completed') {
        await db.careReminders.update(r.id, { status: 'active', updatedAt: new Date().toISOString() });
        showToast('Marked as active');
      } else {
        await FamilyRepository.completeCareReminder(r.id);
        showToast('Care reminder marked complete', { type: 'success' });
      }
    } catch (err: any) {
      showToast('Failed to update', { type: 'error' });
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (confirm(`Move ${name} to trash?`)) {
      await FamilyRepository.softDeleteMember(id);
      showToast(`${name} moved to trash`, { type: 'info' });
      if (selectedMemberId === id) setSelectedMemberId(null);
    }
  };

  return (
    <div style={{ padding: '16px 20px 80px 20px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(244, 63, 94, 0.12)', borderRadius: '10px', color: '#f43f5e' }}>
              <Heart size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Family Care
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Personal care organization, check-ins, appointments & reminders for loved ones
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              if (familyMembers.length === 0) {
                showToast('Add a family member first', { type: 'warning' });
                return;
              }
              setReminderTargetMemberId(familyMembers[0].id);
              setIsAddReminderOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ gap: '6px' }}
          >
            <Clock size={15} color="#f43f5e" />
            <span>+ Care Reminder</span>
          </button>
          <button
            onClick={handleOpenAddMember}
            className="btn btn-primary btn-sm"
            style={{ gap: '6px' }}
          >
            <Plus size={15} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button
          onClick={() => setActiveTab('members')}
          className={`btn-pill ${activeTab === 'members' ? 'btn-pill-primary' : ''}`}
        >
          <Heart size={14} />
          <span>Members ({familyMembers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`btn-pill ${activeTab === 'reminders' ? 'btn-pill-primary' : ''}`}
        >
          <Activity size={14} />
          <span>Care Reminders ({careReminders.filter(r => r.status === 'active').length})</span>
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'members' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '20px' }}>
          {/* Members List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {familyMembers.length === 0 ? (
              <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
                <Heart size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                  No family members added yet
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Keep track of birthdays, appointments, and medical check-ins for family.
                </p>
                <button
                  onClick={handleOpenAddMember}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '12px' }}
                >
                  Add First Member
                </button>
              </div>
            ) : (
              familyMembers.map(member => {
                const isSelected = selectedMemberId === member.id;
                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border-subtle)',
                      background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                          {member.name}
                        </span>
                        <span className="badge badge-neutral">
                          {member.relationship}
                        </span>
                      </div>
                      {member.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <Phone size={12} />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.importantDates && member.importantDates.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <Calendar size={12} color="#f43f5e" />
                          <span>
                            {member.importantDates[0].label}: {formatDisplayDate(member.importantDates[0].date)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditMember(member);
                        }}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                        title="Edit member"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMember(member.id, member.name);
                        }}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                        title="Delete member"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 360 Context Column */}
          <div>
            {selectedMemberId && memberContext ? (
              <div className="card" style={{ padding: '20px' }}>
                {/* Profile Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {memberContext.member.name}
                      </h2>
                      <span className="badge badge-accent">
                        {memberContext.member.relationship}
                      </span>
                    </div>
                    {memberContext.member.notes && (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {memberContext.member.notes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'family_member', id: memberContext.member.id })}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: '5px' }}
                    >
                      <Sparkles size={14} color="var(--warning)" />
                      <span>360 Context</span>
                    </button>
                    <button
                      onClick={() => {
                        setReminderTargetMemberId(memberContext.member.id);
                        setIsAddReminderOpen(true);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ gap: '5px' }}
                    >
                      <Plus size={14} />
                      <span>Care Item</span>
                    </button>
                  </div>
                </div>

                {/* Important Dates */}
                {memberContext.member.importantDates && memberContext.member.importantDates.length > 0 && (
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Important Dates
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      {memberContext.member.importantDates.map(d => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', fontSize: '13px' }}>
                          <Calendar size={15} color="#f43f5e" />
                          <span style={{ fontWeight: 600 }}>{d.label}:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{formatDisplayDate(d.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Care Reminders */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Care Reminders & Check-ins
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--accent)' }}>
                      {memberContext.reminders.filter(r => r.status === 'active').length} active
                    </span>
                  </div>

                  {memberContext.reminders.length === 0 ? (
                    <div style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-light)', borderRadius: '8px' }}>
                      No care reminders scheduled. Tap "+ Care Item" to add appointments or check-ins.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {memberContext.reminders.map(r => (
                        <div
                          key={r.id}
                          className="card"
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            opacity: r.status === 'completed' ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              onClick={() => handleToggleReminderComplete(r)}
                              className="btn-ghost"
                              style={{ padding: '2px' }}
                            >
                              <CheckCircle
                                size={18}
                                color={r.status === 'completed' ? 'var(--success)' : 'var(--text-tertiary)'}
                              />
                            </button>
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 600, textDecoration: r.status === 'completed' ? 'line-through' : 'none' }}>
                                {r.title}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                <span style={{ textTransform: 'capitalize' }}>{r.reminderType.replace('_', ' ')}</span>
                                <span>• Due: {formatDisplayDate(r.dueDate)} {r.dueTime || ''}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setDetailModal({ isOpen: true, type: 'care_reminder', item: r })}
                            className="btn-ghost"
                            style={{ padding: '4px' }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Heart size={44} color="var(--text-muted)" style={{ margin: '0 auto 12px auto' }} />
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Select a family member
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  View 360-degree context including appointments, birthdays, and check-ins.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Care Reminders Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {careReminders.length === 0 ? (
            <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <Clock size={40} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '15px' }}>No care reminders yet</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Set health check-ins, medicine refills, or doctor appointments for family.
              </p>
            </div>
          ) : (
            careReminders.map(r => (
              <div
                key={r.id}
                className="card"
                onClick={() => setDetailModal({ isOpen: true, type: 'care_reminder', item: r })}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  opacity: r.status === 'completed' ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReminderComplete(r);
                    }}
                    className="btn-ghost"
                    style={{ padding: '2px' }}
                  >
                    <CheckCircle
                      size={18}
                      color={r.status === 'completed' ? 'var(--success)' : 'var(--text-tertiary)'}
                    />
                  </button>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, textDecoration: r.status === 'completed' ? 'line-through' : 'none' }}>
                        {r.title}
                      </span>
                      <span className="badge badge-accent">
                        {r.familyMemberName}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span style={{ textTransform: 'capitalize' }}>{r.reminderType.replace('_', ' ')}</span>
                      <span>• {formatDisplayDate(r.dueDate)} {r.dueTime || ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Family Member Modal */}
      {isAddMemberOpen && (
        <div className="modal-overlay" onClick={() => setIsAddMemberOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingMember ? 'Edit Family Member' : 'Add Family Member'}
              </div>
              <button onClick={() => setIsAddMemberOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mother, Sathvik, Emma"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  style={{ marginTop: '4px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Relationship *</label>
                <input
                  type="text"
                  placeholder="e.g. Mother, Father, Spouse, Child, Sibling"
                  value={memberRelationship}
                  onChange={e => setMemberRelationship(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone</label>
                  <input
                    type="tel"
                    placeholder="+91..."
                    value={memberPhone}
                    onChange={e => setMemberPhone(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={memberEmail}
                    onChange={e => setMemberEmail(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              {!editingMember && (
                <div style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Important Date (e.g. Birthday)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="text"
                      placeholder="Label (e.g. Birthday)"
                      value={importantDateLabel}
                      onChange={e => setImportantDateLabel(e.target.value)}
                    />
                    <input
                      type="date"
                      value={importantDateVal}
                      onChange={e => setImportantDateVal(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Preferences, allergy notes, background..."
                  value={memberNotes}
                  onChange={e => setMemberNotes(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMember}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {editingMember ? 'Update Member' : 'Save Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Care Reminder Modal */}
      {isAddReminderOpen && (
        <div className="modal-overlay" onClick={() => setIsAddReminderOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add Care Reminder
              </div>
              <button onClick={() => setIsAddReminderOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Family Member *</label>
                <select
                  value={reminderTargetMemberId}
                  onChange={e => setReminderTargetMemberId(e.target.value)}
                  style={{ marginTop: '4px' }}
                >
                  {familyMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.relationship})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Reminder Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Dental appointment, Weekly call, Collect lab report"
                  value={reminderTitle}
                  onChange={e => setReminderTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</label>
                <select
                  value={reminderType}
                  onChange={e => setReminderType(e.target.value as any)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="check_in">Check-in / Call</option>
                  <option value="appointment">Doctor / Clinic Appointment</option>
                  <option value="medication">Medication / Prescription Refill</option>
                  <option value="document_expiry">Document Renewal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date *</label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={e => setReminderDate(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Time</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea
                  rows={2}
                  placeholder="Clinic address, doctor contact, instructions..."
                  value={reminderNotes}
                  onChange={e => setReminderNotes(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddReminderOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReminder}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  Save Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Detail Modal */}
      {detailModal.isOpen && (
        <ItemDetailModal
          isOpen={detailModal.isOpen}
          itemType={detailModal.type}
          itemData={detailModal.item}
          onClose={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* 360 Context Modal */}
      {contextModal.isOpen && contextModal.type && contextModal.id && (
        <ContextModal
          isOpen={contextModal.isOpen}
          entityType={contextModal.type}
          entityId={contextModal.id}
          onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        />
      )}
    </div>
  );
};
