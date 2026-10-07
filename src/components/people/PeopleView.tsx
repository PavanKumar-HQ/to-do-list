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
  Trash2,
  Sparkles,
  MessageSquare,
  ListTodo,
  FileText,
  Mic,
  Tag,
  ArrowRight,
  Heart,
  Briefcase,
  UserPlus,
  Search
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { formatDisplayDate, getTodayDateString } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import { MeetingTranscriberModal } from './MeetingTranscriberModal';
import type { PersonItem, FollowupItem, FollowupStatus, EntityType, MeetingNoteItem, ConversationLogItem } from '../../types';

export const PeopleView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'people' | 'meetings' | 'followups'>('people');
  const [searchQuery, setSearchQuery] = useState('');

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Transcriber Modal
  const [isTranscriberOpen, setIsTranscriberOpen] = useState(false);
  const [transcriberPersonId, setTranscriberPersonId] = useState<string | undefined>(undefined);

  // Quick Log Conversation Modal
  const [isLogConversationOpen, setIsLogConversationOpen] = useState(false);
  const [logPersonId, setLogPersonId] = useState('');
  const [logTopic, setLogTopic] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logMyPromises, setLogMyPromises] = useState('');
  const [logTheirPromises, setLogTheirPromises] = useState('');
  const [logNextFollowup, setLogNextFollowup] = useState('');

  // Add Person Modal
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personRelationship, setPersonRelationship] = useState('Friend');
  const [personNotes, setPersonNotes] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personEmail, setPersonEmail] = useState('');

  // Add Follow-up Modal
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

  const meetingNotes = useLiveQuery(async () => {
    return db.meetingNotes.filter((m) => !m.deletedAt).reverse().sortBy('meetingDate');
  }, []) || [];

  const conversationLogs = useLiveQuery(async () => {
    return db.conversationLogs.filter((c) => !c.deletedAt).reverse().sortBy('date');
  }, []) || [];

  const handleSavePerson = async () => {
    if (!personName.trim()) {
      showToast('Please enter a name', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    const id = generateId();
    await db.people.add({
      id,
      name: personName.trim(),
      relationship: personRelationship.trim() || undefined,
      notes: personNotes.trim() || undefined,
      phone: personPhone.trim() || undefined,
      email: personEmail.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await logAudit('create', 'person', id, `Added contact: ${personName.trim()}`);
    showToast(`Added ${personName.trim()}`, { type: 'success' });
    setIsAddPersonOpen(false);
    setPersonName('');
    setPersonRelationship('Friend');
    setPersonNotes('');
    setPersonPhone('');
    setPersonEmail('');
  };

  const handleSaveConversationLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTopic.trim() || !logPersonId) {
      showToast('Person and Topic are required', { type: 'warning' });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = generateId();

    const promisesText = [
      logMyPromises.trim() ? `I promised: ${logMyPromises.trim()}` : '',
      logTheirPromises.trim() ? `They promised: ${logTheirPromises.trim()}` : ''
    ].filter(Boolean).join('; ');

    await db.conversationLogs.add({
      id,
      personId: logPersonId,
      date: getTodayDateString(),
      topic: logTopic.trim(),
      notes: logNotes.trim(),
      promises: promisesText || undefined,
      nextFollowupDate: logNextFollowup || undefined,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // If I promised something, automatically add to Tasks as an action item!
    if (logMyPromises.trim()) {
      await db.tasks.add({
        id: generateId(),
        title: `Promise to ${people.find(p => p.id === logPersonId)?.name || 'contact'}: ${logMyPromises.trim()}`,
        status: 'todo',
        priority: 'high',
        dueDate: logNextFollowup || getTodayDateString(),
        recurrence: 'none',
        subtasks: [],
        tags: ['promise', 'crm'],
        linkedPersonId: logPersonId,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      showToast('Promise converted to a high-priority task!', { type: 'info' });
    }

    showToast('Conversation memory logged!', { type: 'success' });
    setIsLogConversationOpen(false);
    setLogTopic('');
    setLogNotes('');
    setLogMyPromises('');
    setLogTheirPromises('');
    setLogNextFollowup('');
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

  // Filtered people
  const filteredPeople = people.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) ||
      (p.relationship && p.relationship.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q));
  });

  return (
    <div className="view-container animate-fade-in" style={{ paddingBottom: '90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '10px' }}>
              <Users size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Personal CRM & Conversations
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Remember people, conversations, what you discussed, and promises you made
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setTranscriberPersonId(undefined);
              setIsTranscriberOpen(true);
            }}
            className="btn btn-secondary"
            style={{ gap: '6px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', borderColor: 'var(--accent)' }}
          >
            <Sparkles size={16} color="var(--accent)" />
            <span>Gemini Transcriber</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'meetings') setIsLogConversationOpen(true);
              else if (activeTab === 'followups') setIsAddFollowupOpen(true);
              else setIsAddPersonOpen(true);
            }}
            className="btn btn-primary"
            style={{ gap: '6px', borderRadius: '8px' }}
          >
            <Plus size={16} />
            <span>
              {activeTab === 'meetings' ? 'Log Conversation' : activeTab === 'followups' ? 'New Follow-up' : 'Add Person'}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('people')}
          className={`btn btn-sm ${activeTab === 'people' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '12.5px' }}
        >
          People & CRM ({people.length})
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={`btn btn-sm ${activeTab === 'meetings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '12.5px', gap: '6px' }}
        >
          <MessageSquare size={14} />
          <span>Meeting & Conversation Memory ({meetingNotes.length + conversationLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`btn btn-sm ${activeTab === 'followups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '6px 16px', fontSize: '12.5px' }}
        >
          Follow-ups ({followups.filter(f => f.status !== 'resolved').length})
        </button>
      </div>

      {/* TAB 1: People & Personal CRM */}
      {activeTab === 'people' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search people by name, relationship, interests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px', height: '40px', borderRadius: '8px' }}
            />
          </div>

          {filteredPeople.length === 0 ? (
            <div className="card" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No people added yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Track friends, mentors, colleagues, and family with notes and conversation history.
              </div>
              <button onClick={() => setIsAddPersonOpen(true)} className="btn btn-primary btn-sm" style={{ margin: '14px auto 0 auto', gap: '6px' }}>
                <UserPlus size={15} />
                <span>Add First Contact</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {filteredPeople.map((p) => {
                const recentLogs = conversationLogs.filter(c => c.personId === p.id);
                const lastLog = recentLogs[0];

                return (
                  <div
                    key={p.id}
                    className="card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'var(--accent-light)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '15px'
                          }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                            {p.name}
                          </div>
                          {p.relationship && (
                            <span
                              style={{
                                fontSize: '11px',
                                background: 'var(--bg-surface-elevated)',
                                color: 'var(--text-secondary)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              {p.relationship}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setLogPersonId(p.id);
                            setIsLogConversationOpen(true);
                          }}
                          className="btn-ghost"
                          style={{ padding: '4px', color: 'var(--accent)' }}
                          title="Log conversation"
                        >
                          <MessageSquare size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setTranscriberPersonId(p.id);
                            setIsTranscriberOpen(true);
                          }}
                          className="btn-ghost"
                          style={{ padding: '4px', color: 'var(--accent)' }}
                          title="Transcribe meeting with person"
                        >
                          <Mic size={16} />
                        </button>
                        <button
                          onClick={() => setContextModal({ isOpen: true, type: 'person', id: p.id })}
                          className="btn-ghost"
                          style={{ padding: '4px', color: 'var(--text-muted)' }}
                          title="View Life Context"
                        >
                          <Network size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${p.name}?`)) {
                              await db.people.update(p.id, { deletedAt: new Date().toISOString() });
                              showToast('Contact moved to trash');
                            }
                          }}
                          className="btn-ghost"
                          style={{ padding: '4px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {p.notes && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: '6px' }}>
                        {p.notes}
                      </div>
                    )}

                    {/* Last Conversation Summary */}
                    {lastLog ? (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Last Spoke:</span> {formatDisplayDate(lastLog.date)} • <em>"{lastLog.topic}"</em>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
                        No conversations logged yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Meeting & Conversation Memory */}
      {activeTab === 'meetings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Action Bar */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                Meeting & Conversation Intelligence
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Capture discussions, promises made, and auto-generate Gemini meeting notes.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsLogConversationOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ gap: '6px' }}
              >
                <Plus size={14} />
                <span>Quick Log Notes</span>
              </button>

              <button
                onClick={() => setIsTranscriberOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>Gemini Transcriber</span>
              </button>
            </div>
          </div>

          {/* Combined Meeting Notes & Conversation Logs */}
          {meetingNotes.length === 0 && conversationLogs.length === 0 ? (
            <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <MessageSquare size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 600 }}>No meeting or conversation notes yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Log notes manually or click "Gemini Transcriber" to record live audio and auto-extract promises.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Gemini Meeting Notes */}
              {meetingNotes.map((note) => (
                <div
                  key={note.id}
                  className="card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderLeft: '4px solid var(--accent)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'var(--accent-light)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>
                          GEMINI NOTES
                        </span>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {note.title}
                        </h4>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {formatDisplayDate(note.meetingDate)} {note.personName ? `• With ${note.personName}` : ''} {note.durationMinutes ? `• ${note.durationMinutes} min` : ''}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await db.meetingNotes.update(note.id, { deletedAt: new Date().toISOString() });
                        showToast('Meeting note deleted');
                      }}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--danger)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {note.summary}
                  </p>

                  {/* Key Takeaways */}
                  {note.keyTakeaways && note.keyTakeaways.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>Key Discussion:</strong>
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {note.keyTakeaways.map((k: string, idx: number) => (
                          <li key={idx}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Promises */}
                  {note.promisesMade && note.promisesMade.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
                      {note.promisesMade.map((p: any, idx: number) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '11px',
                            background: p.who === 'me' ? 'var(--accent-light)' : 'var(--warning-bg)',
                            color: p.who === 'me' ? 'var(--accent)' : 'var(--warning)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 500
                          }}
                        >
                          {p.who === 'me' ? 'I promised:' : 'They promised:'} {p.what}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Quick Conversation Logs */}
              {conversationLogs.map((log) => {
                const person = people.find(p => p.id === log.personId);

                return (
                  <div
                    key={log.id}
                    className="card"
                    style={{
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      borderLeft: '4px solid #10b981'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>
                            CONVERSATION LOG
                          </span>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                            {log.topic}
                          </h4>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatDisplayDate(log.date)} • With <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{person?.name || 'Contact'}</span>
                          {log.nextFollowupDate && ` • Follow-up: ${formatDisplayDate(log.nextFollowupDate)}`}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          await db.conversationLogs.update(log.id, { deletedAt: new Date().toISOString() });
                          showToast('Conversation log deleted');
                        }}
                        className="btn-ghost"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {log.notes && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {log.notes}
                      </div>
                    )}

                    {log.promises && (
                      <div style={{ fontSize: '11.5px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '4px 8px', borderRadius: '4px', fontWeight: 500 }}>
                        ⚡ {log.promises}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Follow-ups List */}
      {activeTab === 'followups' && (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                      style={{ color: 'var(--danger)', padding: '4px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
      )}

      {/* Log Conversation Modal */}
      {isLogConversationOpen && (
        <div className="modal-overlay" onClick={() => setIsLogConversationOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                  <MessageSquare size={20} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>Log Conversation & Promises</h3>
              </div>
              <button onClick={() => setIsLogConversationOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConversationLog} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Who did you speak with? *
                </label>
                <select
                  required
                  value={logPersonId}
                  onChange={(e) => setLogPersonId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                >
                  <option value="">Select a person...</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.relationship ? `(${p.relationship})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  What was discussed? (Topic) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 budget review, Project roadmap, Personal check-in"
                  value={logTopic}
                  onChange={(e) => setLogTopic(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Key Notes & Takeaways
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of details, ideas shared, or things to remember..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                  ⚡ What did I promise to do? (Auto-adds to Tasks)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Send the Figma wireframes by Friday"
                  value={logMyPromises}
                  onChange={(e) => setLogMyPromises(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--accent)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>
                  ⏳ What did they promise to do?
                </label>
                <input
                  type="text"
                  placeholder="e.g. Send the revised contract by Tuesday"
                  value={logTheirPromises}
                  onChange={(e) => setLogTheirPromises(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Next Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={logNextFollowup}
                  onChange={(e) => setLogNextFollowup(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsLogConversationOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Conversation Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Person Modal */}
      {isAddPersonOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPersonOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Add Person (Personal CRM)</h3>
              <button onClick={() => setIsAddPersonOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins, Rahul Sharma"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Relationship / Circle
                </label>
                <select
                  value={personRelationship}
                  onChange={(e) => setPersonRelationship(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                >
                  <option value="Friend">Friend</option>
                  <option value="Colleague">Colleague / Work</option>
                  <option value="Family">Family</option>
                  <option value="Mentor">Mentor / Advisor</option>
                  <option value="Client">Client / Partner</option>
                  <option value="Contractor">Contractor / Vendor</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Phone / Contact
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={personPhone}
                  onChange={(e) => setPersonPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={personEmail}
                  onChange={(e) => setPersonEmail(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Notes & Context
                </label>
                <textarea
                  rows={2}
                  placeholder="How you met, birthdays, interests, common connections..."
                  value={personNotes}
                  onChange={(e) => setPersonNotes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setIsAddPersonOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSavePerson} className="btn btn-primary">
                  Save Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-up Modal */}
      {isAddFollowupOpen && (
        <div className="modal-overlay" onClick={() => setIsAddFollowupOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Track Follow-up</h3>
              <button onClick={() => setIsAddFollowupOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Person / Organization *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Verma, School Admin, Contractor"
                  value={followupPerson}
                  onChange={(e) => setFollowupPerson(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Waiting for insurance claim approval"
                  value={followupSubject}
                  onChange={(e) => setFollowupSubject(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={followupDueDate}
                  onChange={(e) => setFollowupDueDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Status
                </label>
                <select
                  value={followupStatus}
                  onChange={(e: any) => setFollowupStatus(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                >
                  <option value="waiting">Waiting for response</option>
                  <option value="followup">Action required by me</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => setIsAddFollowupOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveFollowup} className="btn btn-primary">
                  Save Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Meeting Transcriber Modal */}
      {isTranscriberOpen && (
        <MeetingTranscriberModal
          isOpen={isTranscriberOpen}
          onClose={() => setIsTranscriberOpen(false)}
          preselectedPersonId={transcriberPersonId}
        />
      )}

      {/* Life Context Modal */}
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
