// OpenLoopsView — Follow-ups, Commitments, Decisions & Future Time Capsule

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  Clock,
  Plus,
  HelpCircle,
  X,
  Network,
  RotateCcw,
  Mail,
  Lock,
  Eye,
  Check
} from 'lucide-react';
import { db } from '../../db/db';
import { OpenLoopRepository, CommitmentRepository, DecisionRepository } from '../../repositories';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import { LifeReviewModal } from './LifeReviewModal';
import { FutureMessageModal } from './FutureMessageModal';
import type { OpenLoopItem, FutureMessageItem, EntityType } from '../../types';

export const OpenLoopsView: React.FC = () => {
  const { showToast } = useToast();
  const today = getTodayDateString();

  const [activeTab, setActiveTab] = useState<'loops' | 'commitments' | 'decisions' | 'future_self'>('loops');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [futureModalConfig, setFutureModalConfig] = useState<{ isOpen: boolean; messageToRead: FutureMessageItem | null }>({
    isOpen: false,
    messageToRead: null
  });

  // Context Modal state
  const [contextModal, setContextModal] = useState<{ isOpen: boolean; type: EntityType | null; id: string | null }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Live Queries
  const openLoops = useLiveQuery(() => db.openLoops.filter(l => !l.deletedAt).toArray(), []) || [];
  const commitments = useLiveQuery(() => db.commitments.filter(c => !c.deletedAt).toArray(), []) || [];
  const decisions = useLiveQuery(() => db.decisions.filter(d => !d.deletedAt).toArray(), []) || [];
  const futureMessages = useLiveQuery(() => db.futureMessages.filter(m => !m.deletedAt).reverse().toArray(), []) || [];

  // Form states for Add Modal
  const [newLoopTitle, setNewLoopTitle] = useState('');
  const [newLoopType, setNewLoopType] = useState<OpenLoopItem['loopType']>('waiting_on');
  const [newLoopWaitingOn, setNewLoopWaitingOn] = useState('');

  const [newCommitmentWho, setNewCommitmentWho] = useState('');
  const [newCommitmentWhat, setNewCommitmentWhat] = useState('');
  const [newCommitmentDate, setNewCommitmentDate] = useState(today);

  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionReason, setNewDecisionReason] = useState('');
  const [newDecisionAlternatives, setNewDecisionAlternatives] = useState('');
  const [newDecisionReviewDate, setNewDecisionReviewDate] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'loops') {
        if (!newLoopTitle.trim()) return;
        await OpenLoopRepository.create({
          title: newLoopTitle,
          loopType: newLoopType,
          waitingOnPersonName: newLoopWaitingOn.trim() || undefined
        });
        setNewLoopTitle('');
        setNewLoopWaitingOn('');
        showToast('Waiting item recorded', { type: 'success' });
      } else if (activeTab === 'commitments') {
        if (!newCommitmentWhat.trim()) return;
        await CommitmentRepository.create({
          who: newCommitmentWho || 'Self',
          what: newCommitmentWhat,
          promisedDate: newCommitmentDate
        });
        setNewCommitmentWhat('');
        setNewCommitmentWho('');
        showToast('Promise recorded', { type: 'success' });
      } else if (activeTab === 'decisions') {
        if (!newDecisionTitle.trim() || !newDecisionReason.trim()) return;
        await DecisionRepository.create({
          title: newDecisionTitle,
          reason: newDecisionReason,
          alternativesConsidered: newDecisionAlternatives.split(',').map(s => s.trim()).filter(Boolean),
          decisionDate: today,
          reviewDate: newDecisionReviewDate || undefined
        });
        setNewDecisionTitle('');
        setNewDecisionReason('');
        setNewDecisionAlternatives('');
        setNewDecisionReviewDate('');
        showToast('Decision recorded with reasoning', { type: 'success' });
      }
      setShowAddModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to save', { type: 'error' });
    }
  };

  const waitingCount = openLoops.filter(l => l.status === 'open').length;
  const commitmentsCount = commitments.filter(c => c.status === 'pending').length;
  const decisionsCount = decisions.length;
  const futureCount = futureMessages.length;

  return (
    <div className="content-max-width" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => setShowReviewModal(true)}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.375rem' }}
        >
          <RotateCcw size={13} color="var(--accent)" />
          <span>Weekly Review</span>
        </button>

        {activeTab === 'future_self' ? (
          <button
            onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: null })}
            className="btn btn-primary btn-sm"
            style={{ gap: '0.375rem' }}
          >
            <Plus size={14} />
            <span>Write Future Note</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
            style={{ gap: '0.375rem' }}
          >
            <Plus size={14} />
            <span>Add Entry</span>
          </button>
        )}
      </div>

      {/* 2. Color-Accented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '2px', borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { id: 'loops', label: 'Waiting on Others', count: waitingCount, color: 'var(--warning)' },
          { id: 'commitments', label: 'My Promises', count: commitmentsCount, color: 'var(--success)' },
          { id: 'decisions', label: 'Key Decisions', count: decisionsCount, color: 'var(--info)' },
          { id: 'future_self', label: 'Time Capsule', count: futureCount, color: 'var(--accent)' }
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.875rem',
                borderBottom: isSelected ? `2px solid ${tab.color}` : '2px solid transparent',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 400,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  background: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isSelected ? tab.color : 'var(--text-muted)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 600
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content */}

      {/* Tab 1: Waiting on Others */}
      {activeTab === 'loops' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {openLoops.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} color="var(--warning)" />
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                You are not waiting on anyone right now
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
                When you're waiting for someone to reply, review a document, or send a proposal, record it here so you never forget to follow up.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setShowAddModal(true)}
              >
                + Track a Waiting Item
              </button>
            </div>
          ) : (
            openLoops.map(loop => {
              const isClosed = loop.status === 'closed';

              return (
                <div
                  key={loop.id}
                  className="animate-row-enter"
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isClosed ? 'var(--border-subtle)' : 'var(--warning)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: 'var(--bg-surface)',
                    opacity: isClosed ? 0.6 : 1,
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {loop.waitingOnPersonName && (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                          Waiting on: {loop.waitingOnPersonName}
                        </span>
                      )}
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Logged {formatDisplayDate(loop.createdAt.slice(0, 10))}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                        textDecoration: isClosed ? 'line-through' : 'none'
                      }}
                    >
                      {loop.title}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!isClosed && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                        onClick={() => OpenLoopRepository.close(loop.id)}
                      >
                        <Check size={13} />
                        <span>Resolved</span>
                      </button>
                    )}
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'open_loop', id: loop.id })}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '4px' }}
                      title="Context"
                    >
                      <Network size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: My Promises & Commitments */}
      {activeTab === 'commitments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {commitments.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} color="var(--success)" />
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No active commitments recorded
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
                When you promise something to a client, colleague, friend, or yourself ("I will send the deck by Friday"), capture it here.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setShowAddModal(true)}
              >
                + Record a Promise
              </button>
            </div>
          ) : (
            commitments.map(comm => {
              const isFulfilled = comm.status === 'fulfilled';

              return (
                <div
                  key={comm.id}
                  className="animate-row-enter"
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isFulfilled ? 'var(--border-subtle)' : 'var(--success)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: 'var(--bg-surface)',
                    opacity: isFulfilled ? 0.6 : 1,
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--success)', background: 'var(--success-bg)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        Promised to: {comm.who}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        Due {formatDisplayDate(comm.promisedDate)}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                        textDecoration: isFulfilled ? 'line-through' : 'none'
                      }}
                    >
                      {comm.what}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!isFulfilled && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                        onClick={() => CommitmentRepository.fulfill(comm.id)}
                      >
                        <Check size={13} />
                        <span>Kept</span>
                      </button>
                    )}
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'commitment', id: comm.id })}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '4px' }}
                      title="Context"
                    >
                      <Network size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 3: Key Decisions */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {decisions.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircle size={20} color="var(--info)" />
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No recorded decisions yet
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
                Whenever you make a strategic choice, save the reasoning behind it so you never second-guess why you decided on that path months later.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setShowAddModal(true)}
              >
                + Record a Decision
              </button>
            </div>
          ) : (
            decisions.map(dec => {
              const isReviewDue = dec.status === 'active' && dec.reviewDate && dec.reviewDate <= today;

              return (
                <div
                  key={dec.id}
                  className="animate-row-enter"
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isReviewDue ? 'var(--danger)' : 'var(--info)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.625rem',
                    background: 'var(--bg-surface)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--info)', background: 'var(--info-bg)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                          Decided {formatDisplayDate(dec.decisionDate)}
                        </span>
                        {dec.reviewDate && (
                          <span style={{ fontSize: '0.6875rem', color: isReviewDue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isReviewDue ? 600 : 400 }}>
                            Review {formatDisplayDate(dec.reviewDate)}
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {dec.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isReviewDue && (
                        <span style={{ fontSize: '0.6875rem', background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.125rem 0.375rem', borderRadius: '4px', fontWeight: 600 }}>
                          Review Due
                        </span>
                      )}
                      <button
                        onClick={() => setContextModal({ isOpen: true, type: 'decision', id: dec.id })}
                        className="btn-ghost"
                        style={{ color: 'var(--text-muted)', padding: '4px' }}
                        title="Context"
                      >
                        <Network size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Reasoning
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {dec.reason}
                    </p>
                  </div>

                  {dec.alternativesConsidered.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Alternatives: </span>
                      {dec.alternativesConsidered.join(', ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 4: Time Capsule */}
      {activeTab === 'future_self' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {futureMessages.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={20} color="var(--accent)" />
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No notes scheduled for your future self
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.5 }}>
                Write an intention, reminder, or mindset for 6 months or 1 year from now. It will stay sealed until that exact date arrives.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: null })}
              >
                + Write to Your Future Self
              </button>
            </div>
          ) : (
            futureMessages.map(msg => {
              const isReady = msg.openDate <= today;
              const isLocked = !isReady && !msg.isOpened;

              return (
                <div
                  key={msg.id}
                  className="animate-row-enter"
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isLocked ? 'var(--border-subtle)' : 'var(--accent)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'var(--bg-surface)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isLocked ? (
                        <Lock size={15} color="var(--text-muted)" />
                      ) : (
                        <Mail size={15} color="var(--accent)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: isLocked ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 500 }}>
                        {isLocked ? `Sealed until ${formatDisplayDate(msg.openDate)}` : `Unlocked on ${formatDisplayDate(msg.openDate)}`}
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                        {msg.title}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isLocked ? (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                        Locked
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', gap: '0.25rem' }}
                        onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: msg })}
                      >
                        <Eye size={13} />
                        <span>{msg.isOpened ? 'Read Again' : 'Open Note'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Add Entry Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" style={{ maxWidth: '480px', margin: '0 auto', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                {activeTab === 'loops' ? 'Track a Waiting Item' : activeTab === 'commitments' ? 'Record a Promise' : 'Record a Decision'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeTab === 'loops' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      What are you waiting for?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Waiting for revised contract / Lab report approval"
                      value={newLoopTitle}
                      onChange={e => setNewLoopTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Who are you waiting on?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Sathvik / Professor / Landlord"
                      value={newLoopWaitingOn}
                      onChange={e => setNewLoopWaitingOn(e.target.value)}
                    />
                  </div>
                </>
              )}

              {activeTab === 'commitments' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      What did you promise?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Deliver redesign draft by 5 PM"
                      value={newCommitmentWhat}
                      onChange={e => setNewCommitmentWhat(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Who did you promise this to?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Team, Client, Self"
                      value={newCommitmentWho}
                      onChange={e => setNewCommitmentWho(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Promised Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={newCommitmentDate}
                      onChange={e => setNewCommitmentDate(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {activeTab === 'decisions' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      What decision was made?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Chose IndexedDB instead of Cloud sync"
                      value={newDecisionTitle}
                      onChange={e => setNewDecisionTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Reasoning (The "Why")
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Why did you make this choice? What made it the best path?"
                      value={newDecisionReason}
                      onChange={e => setNewDecisionReason(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Alternatives Considered (comma-separated)
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Firebase, Supabase, SQLite"
                      value={newDecisionAlternatives}
                      onChange={e => setNewDecisionAlternatives(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Revisit / Review Date (Optional)
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={newDecisionReviewDate}
                      onChange={e => setNewDecisionReviewDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={() => setContextModal({ isOpen: false, type: null, id: null })}
        entityType={contextModal.type}
        entityId={contextModal.id}
      />

      {/* 6. Life Review Modal */}
      <LifeReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />

      {/* 7. Future Message Modal */}
      <FutureMessageModal
        isOpen={futureModalConfig.isOpen}
        onClose={() => setFutureModalConfig({ isOpen: false, messageToRead: null })}
        messageToRead={futureModalConfig.messageToRead}
      />
    </div>
  );
};
