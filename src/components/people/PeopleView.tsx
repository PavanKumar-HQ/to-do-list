import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Plus,
  Clock,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  X,
  Network,
  Trash2
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import type { PersonItem, FollowupItem, FollowupStatus, EntityType } from '../../types';

export const PeopleView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'followups' | 'people'>('followups');

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Modal States
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personRelationship, setPersonRelationship] = useState('');
  const [personNotes, setPersonNotes] = useState('');

  const [isAddFollowupOpen, setIsAddFollowupOpen] = useState(false);
  const [followupPerson, setFollowupPerson] = useState('');
  const [followupSubject, setFollowupSubject] = useState('');
  const [followupDueDate, setFollowupDueDate] = useState(getTodayDateString());
  const [followupStatus, setFollowupStatus] = useState<FollowupStatus>('waiting');

  // Queries
  const people = useLiveQuery(async () => {
    return db.people.filter((p) => !p.deletedAt).sortBy('name');
  }, []) || [];

  const followups = useLiveQuery(async () => {
    return db.followups.filter((f) => !f.deletedAt).reverse().sortBy('createdAt');
  }, []) || [];

  const handleSavePerson = async () => {
    if (!personName.trim()) {
      showToast('Please enter a name', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    await db.people.add({
      id: generateId(),
      name: personName.trim(),
      relationship: personRelationship.trim() || undefined,
      notes: personNotes.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    showToast(`Added ${personName.trim()}`, { type: 'success' });
    setIsAddPersonOpen(false);
    setPersonName('');
    setPersonRelationship('');
    setPersonNotes('');
  };

  const handleSaveFollowup = async () => {
    if (!followupSubject.trim() || !followupPerson.trim()) {
      showToast('Subject and Person are required', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    await db.followups.add({
      id: generateId(),
      personId: 'custom',
      personName: followupPerson.trim(),
      subject: followupSubject.trim(),
      dueDate: followupDueDate || undefined,
      status: followupStatus,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    showToast('Follow-up ticket saved', { type: 'success' });
    setIsAddFollowupOpen(false);
    setFollowupSubject('');
    setFollowupPerson('');
  };

  const handleUpdateFollowupStatus = async (id: string, status: FollowupStatus) => {
    await db.followups.update(id, { status, updatedAt: new Date().toISOString() });
    showToast(`Follow-up marked as ${status}`);
  };

  const handleDeleteFollowup = async (id: string) => {
    await db.followups.update(id, { deletedAt: new Date().toISOString() });
    showToast('Follow-up moved to trash');
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>People & Follow-ups</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Pending conversations, waiting tickets, and key contacts
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'followups') setIsAddFollowupOpen(true);
            else setIsAddPersonOpen(true);
          }}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>New {activeTab === 'followups' ? 'Follow-up' : 'Contact'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('followups')}
          className={`btn btn-sm ${activeTab === 'followups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px' }}
        >
          Follow-ups ({followups.filter(f => f.status !== 'resolved').length})
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`btn btn-sm ${activeTab === 'people' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px' }}
        >
          Key People ({people.length})
        </button>
      </div>

      {/* Follow-ups List */}
      {activeTab === 'followups' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {followups.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <UserCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No pending follow-ups.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Track responses you are waiting for or scheduled catchups.
              </div>
            </div>
          ) : (
            followups.map((f) => (
              <div
                key={f.id}
                className="card"
                style={{
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: f.status === 'waiting' ? '4px solid var(--warning)' : f.status === 'resolved' ? '4px solid var(--success)' : '4px solid var(--accent)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{f.subject}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      With: <span style={{ fontWeight: 600 }}>{f.personName}</span>
                      {f.dueDate && <span> • Due {formatDisplayDate(f.dueDate)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setContextModal({ isOpen: true, type: 'followup', id: f.id })}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                    title="View Life Context"
                  >
                    <Network size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteFollowup(f.id)}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)', padding: '4px' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => handleUpdateFollowupStatus(f.id, 'waiting')}
                    className={`btn btn-sm ${f.status === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px' }}
                  >
                    Waiting
                  </button>
                  <button
                    onClick={() => handleUpdateFollowupStatus(f.id, 'followup')}
                    className={`btn btn-sm ${f.status === 'followup' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px' }}
                  >
                    Follow up
                  </button>
                  <button
                    onClick={() => handleUpdateFollowupStatus(f.id, 'resolved')}
                    className={`btn btn-sm ${f.status === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '12px' }}
                  >
                    Resolved
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* People List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {people.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No contacts recorded.</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Add important personal contacts or organization references.
              </div>
            </div>
          ) : (
            people.map((p) => (
              <div key={p.id} className="card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{p.name}</div>
                  {p.relationship && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.relationship}</div>
                  )}
                  {p.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => setContextModal({ isOpen: true, type: 'person', id: p.id })}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)' }}
                    title="View Life Context"
                  >
                    <Network size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      await db.people.update(p.id, { deletedAt: new Date().toISOString() });
                      showToast('Contact moved to trash');
                    }}
                    className="btn-ghost"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Follow-up Modal */}
      {isAddFollowupOpen && (
        <div className="modal-overlay" onClick={() => setIsAddFollowupOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Track Follow-up</h3>
              <button onClick={() => setIsAddFollowupOpen(false)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Person / Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Verma, School Admin, Contractor"
                  value={followupPerson}
                  onChange={(e) => setFollowupPerson(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab results confirmation, Quotation response"
                  value={followupSubject}
                  onChange={(e) => setFollowupSubject(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target Follow-up Date
                </label>
                <input
                  type="date"
                  value={followupDueDate}
                  onChange={(e) => setFollowupDueDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsAddFollowupOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSaveFollowup} className="btn btn-primary" style={{ flex: 2 }}>
                Save Follow-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Person Modal */}
      {isAddPersonOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPersonOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>New Contact Reference</h3>
              <button onClick={() => setIsAddPersonOpen(false)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Context / Relationship
                </label>
                <input
                  type="text"
                  placeholder="e.g. Landlord, Accountant, Family"
                  value={personRelationship}
                  onChange={(e) => setPersonRelationship(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Any details to remember..."
                  value={personNotes}
                  onChange={(e) => setPersonNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsAddPersonOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleSavePerson} className="btn btn-primary" style={{ flex: 2 }}>
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />
    </div>
  );
};
