// OpenLoopsView — Follow-ups, Commitments, Decisions & Future Time Capsule

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  Clock,
  User,
  Plus,
  ArrowRight,
  HelpCircle,
  Calendar,
  X,
  Network,
  RotateCcw,
  Mail,
  Lock,
  Eye,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { db } from '../../db/db';
import { OpenLoopRepository, CommitmentRepository, DecisionRepository, FutureMessageRepository } from '../../repositories';
import { getTodayDateString, formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { ContextModal } from '../common/ContextModal';
import { LifeReviewModal } from './LifeReviewModal';
import { FutureMessageModal } from './FutureMessageModal';
import type { OpenLoopItem, CommitmentItem, DecisionItem, FutureMessageItem, EntityType } from '../../types';

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
        showToast('Saved item', { type: 'success' });
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
    <div className="content-max-width" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header with generous spacing & clean typography */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Follow-ups & Commitments
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowReviewModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.5rem 0.875rem', borderColor: '#c7d2fe', color: '#4338ca', background: '#eef2ff' }}
          >
            <RotateCcw size={15} color="#4f46e5" />
            <span>Weekly Review</span>
          </button>

          {activeTab === 'future_self' ? (
            <button
              onClick={() => setFutureModalConfig({ isOpen: true, messageToRead: null })}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} />
              <span>Write Future Note</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} />
              <span>Add Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Color-Accented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border-light)' }}>
        {/* Tab 1: Waiting on Others */}
        <button
          onClick={() => setActiveTab('loops')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderBottom: activeTab === 'loops' ? '2px solid #d97706' : '2px solid transparent',
            color: activeTab === 'loops' ? '#92400e' : 'var(--text-secondary)',
            fontWeight: activeTab === 'loops' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            background: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <span>Waiting on Others</span>
          <span style={{ fontSize: '0.75rem', background: activeTab === 'loops' ? '#fef3c7' : '#f1f5f9', color: activeTab === 'loops' ? '#b45309' : 'var(--text-muted)', padding: '0.125rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
            {waitingCount}
          </span>
        </button>

        {/* Tab 2: My Promises */}
        <button
          onClick={() => setActiveTab('commitments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderBottom: activeTab === 'commitments' ? '2px solid #059669' : '2px solid transparent',
            color: activeTab === 'commitments' ? '#065f46' : 'var(--text-secondary)',
            fontWeight: activeTab === 'commitments' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            background: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <span>My Promises</span>
          <span style={{ fontSize: '0.75rem', background: activeTab === 'commitments' ? '#d1fae5' : '#f1f5f9', color: activeTab === 'commitments' ? '#047857' : 'var(--text-muted)', padding: '0.125rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
            {commitmentsCount}
          </span>
        </button>

        {/* Tab 3: Key Decisions */}
        <button
          onClick={() => setActiveTab('decisions')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderBottom: activeTab === 'decisions' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'decisions' ? '#3730a3' : 'var(--text-secondary)',
            fontWeight: activeTab === 'decisions' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            background: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <span>Key Decisions</span>
          <span style={{ fontSize: '0.75rem', background: activeTab === 'decisions' ? '#e0e7ff' : '#f1f5f9', color: activeTab === 'decisions' ? '#4338ca' : 'var(--text-muted)', padding: '0.125rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
            {decisionsCount}
          </span>
        </button>

        {/* Tab 4: Time Capsule */}
        <button
          onClick={() => setActiveTab('future_self')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderBottom: activeTab === 'future_self' ? '2px solid #7c3aed' : '2px solid transparent',
            color: activeTab === 'future_self' ? '#5b21b6' : 'var(--text-secondary)',
            fontWeight: activeTab === 'future_self' ? 600 : 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            background: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <span>Time Capsule</span>
          <span style={{ fontSize: '0.75rem', background: activeTab === 'future_self' ? '#ede9fe' : '#f1f5f9', color: activeTab === 'future_self' ? '#6d28d9' : 'var(--text-muted)', padding: '0.125rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
            {futureCount}
          </span>
        </button>
      </div>

      {/* 3. Tab Content with Warm Colors & Polished Cards */}

      {/* Tab 1: Waiting on Others */}
      {activeTab === 'loops' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {openLoops.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: '#fffdfa',
                border: '1px dashed #fcd34d',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} color="#d97706" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                You are not waiting on anyone right now
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                When you're waiting for someone to reply, review a document, or send a proposal, record it here so you never forget to follow up.
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.8125rem', borderColor: '#fcd34d', color: '#92400e' }}
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
                  className="card"
                  style={{
                    padding: '1.125rem 1.25rem',
                    borderLeft: `4px solid ${isClosed ? '#cbd5e1' : '#f59e0b'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: isClosed ? '#f8fafc' : '#ffffff',
                    opacity: isClosed ? 0.65 : 1,
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      {loop.waitingOnPersonName ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          Waiting on: {loop.waitingOnPersonName}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          Pending Item
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Created {formatDisplayDate(loop.createdAt.slice(0, 10))}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1rem',
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
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderColor: '#fcd34d', color: '#92400e', background: '#fffdfa' }}
                        onClick={() => OpenLoopRepository.close(loop.id)}
                      >
                        Resolved
                      </button>
                    )}
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'open_loop', id: loop.id })}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '4px' }}
                      title="View Connected Context"
                    >
                      <Network size={16} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {commitments.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: '#fcfdfd',
                border: '1px dashed #a7f3d0',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} color="#059669" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No active commitments recorded
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                When you promise something to a client, colleague, friend, or yourself ("I will send the deck by Friday"), capture it here.
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.8125rem', borderColor: '#a7f3d0', color: '#065f46' }}
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
                  className="card"
                  style={{
                    padding: '1.125rem 1.25rem',
                    borderLeft: `4px solid ${isFulfilled ? '#cbd5e1' : '#10b981'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: isFulfilled ? '#f8fafc' : '#ffffff',
                    opacity: isFulfilled ? 0.65 : 1,
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        Promised to: {comm.who}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Due {formatDisplayDate(comm.promisedDate)}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1rem',
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
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}
                        onClick={() => CommitmentRepository.fulfill(comm.id)}
                      >
                        Fulfilled
                      </button>
                    )}
                    <button
                      onClick={() => setContextModal({ isOpen: true, type: 'commitment', id: comm.id })}
                      className="btn-ghost"
                      style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '4px' }}
                      title="View Connected Context"
                    >
                      <Network size={16} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {decisions.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: '#fafafa',
                border: '1px dashed #c7d2fe',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircle size={22} color="#4f46e5" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No recorded decisions yet
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                Whenever you make a strategic choice, save the reasoning behind it so you never second-guess why you decided on that path months later.
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.8125rem', borderColor: '#c7d2fe', color: '#4338ca' }}
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
                  className="card"
                  style={{
                    padding: '1.25rem',
                    borderLeft: `4px solid ${isReviewDue ? '#ef4444' : '#6366f1'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4338ca', background: '#e0e7ff', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
                          Decided {formatDisplayDate(dec.decisionDate)}
                        </span>
                        {dec.reviewDate && (
                          <span style={{ fontSize: '0.75rem', color: isReviewDue ? '#dc2626' : 'var(--text-muted)', fontWeight: isReviewDue ? 600 : 400 }}>
                            Review {formatDisplayDate(dec.reviewDate)}
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {dec.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isReviewDue && (
                        <span style={{ fontSize: '0.6875rem', background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                          Review Due
                        </span>
                      )}
                      <button
                        onClick={() => setContextModal({ isOpen: true, type: 'decision', id: dec.id })}
                        className="btn-ghost"
                        style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '4px' }}
                        title="View Connected Context"
                      >
                        <Network size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.875rem', borderRadius: '6px', borderLeft: '3px solid #6366f1' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Reasoning
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {dec.reason}
                    </p>
                  </div>

                  {dec.alternativesConsidered.length > 0 && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Alternatives Considered: </span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {futureMessages.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: '#faf5ff',
                border: '1px dashed #c084fc',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={22} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No notes scheduled for your future self
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                Write an intention, reminder, or mindset for 6 months or 1 year from now. It will stay sealed until that exact date arrives.
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.8125rem', borderColor: '#c084fc', color: '#6b21a8' }}
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
                  className="card"
                  style={{
                    padding: '1.125rem 1.25rem',
                    borderLeft: `4px solid ${isLocked ? '#94a3b8' : '#8b5cf6'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: isLocked ? '#f1f5f9' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isLocked ? (
                        <Lock size={18} color="#64748b" />
                      ) : (
                        <Mail size={18} color="#7c3aed" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: isLocked ? 'var(--text-muted)' : '#6d28d9', fontWeight: 600 }}>
                        {isLocked ? `Sealed until ${formatDisplayDate(msg.openDate)}` : `Unlocked on ${formatDisplayDate(msg.openDate)}`}
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                        {msg.title}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isLocked ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.25rem 0.625rem', borderRadius: '12px' }}>
                        Locked
                      </span>
                    ) : (
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', borderColor: '#c084fc', color: '#6b21a8' }}
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

      {/* 4. Add Entry Modal with Clean, Human Forms */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" style={{ maxWidth: '520px', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                {activeTab === 'loops' ? 'Track a Waiting Item' : activeTab === 'commitments' ? 'Record a Promise' : 'Record a Decision'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost btn-icon">
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
                      Who did you promise?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Mom / Client / Rahul / Myself"
                      value={newCommitmentWho}
                      onChange={e => setNewCommitmentWho(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      What did you promise?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Send the budget breakdown document"
                      value={newCommitmentWhat}
                      onChange={e => setNewCommitmentWhat(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Promised By Date
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
                      What did you decide?
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Hold off on public launch until beta feedback is in"
                      value={newDecisionTitle}
                      onChange={e => setNewDecisionTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Reasoning / Why
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Why did you make this decision? What context led to this choice?"
                      value={newDecisionReason}
                      onChange={e => setNewDecisionReason(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Alternatives Considered (comma separated)
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Launch immediately, Invite public users"
                      value={newDecisionAlternatives}
                      onChange={e => setNewDecisionAlternatives(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Review Date (optional)
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guided Weekly Review Modal */}
      <LifeReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />

      {/* Future Message Modal */}
      <FutureMessageModal
        isOpen={futureModalConfig.isOpen}
        onClose={() => setFutureModalConfig({ isOpen: false, messageToRead: null })}
        messageToRead={futureModalConfig.messageToRead}
      />

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
