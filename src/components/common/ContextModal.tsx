// Context Modal Component (Sections 4, 5, 25)
// Shows the 360-degree Life Graph of any record: Why it exists, Connected People, Connected Tasks, Expenses, Notes, and Decisions.

import React, { useEffect, useState } from 'react';
import { X, Network, User, Calendar, CheckSquare, FileText, IndianRupee, Paperclip, HelpCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { LifeGraphService, type LifeEntityContext } from '../../services/lifeGraphService';
import type { EntityType } from '../../types';
import { formatMoney } from '../../utils/currency';

interface ContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType | null;
  entityId: string | null;
}

export const ContextModal: React.FC<ContextModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId
}) => {
  const [context, setContext] = useState<LifeEntityContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entityType && entityId) {
      setLoading(true);
      LifeGraphService.getEntityContext(entityType, entityId)
        .then(res => setContext(res))
        .catch(err => console.error('Failed to load context:', err))
        .finally(() => setLoading(false));
    } else {
      setContext(null);
    }
  }, [isOpen, entityType, entityId]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Network size={16} color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Life Memory Graph
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {context?.title || 'Entity Context'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Assembling connected context...
          </div>
        ) : !context ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No context found for this item.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Why does this exist? */}
            {context.why && (
              <div style={{ background: '#f8fafc', padding: '0.875rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  <HelpCircle size={14} />
                  <span>WHY DOES THIS EXIST?</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {context.why}
                </p>
              </div>
            )}

            {/* Next Action */}
            {context.nextAction && (
              <div style={{ background: '#f0fdf4', padding: '0.875rem', borderRadius: '8px', borderLeft: '3px solid #16a34a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.25rem' }}>
                  <ArrowRight size={14} />
                  <span>NEXT ACTION</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#14532d' }}>
                  {context.nextAction}
                </p>
              </div>
            )}

            {/* Consequence if missed */}
            {context.consequence && context.consequence !== 'none' && (
              <div style={{ background: '#fffbeb', padding: '0.875rem', borderRadius: '8px', borderLeft: '3px solid #d97706' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#b45309', marginBottom: '0.25rem' }}>
                  <ShieldAlert size={14} />
                  <span>CONSEQUENCE LEVEL: {context.consequence.toUpperCase()}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#78350f' }}>
                  Unresolved delay on this item carries tangible real-world impact.
                </p>
              </div>
            )}

            {/* Connected People */}
            {context.connectedPeople.length > 0 && (
              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <User size={15} />
                  <span>CONNECTED PEOPLE ({context.connectedPeople.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {context.connectedPeople.map(p => (
                    <span
                      key={p.id}
                      style={{
                        fontSize: '0.8125rem',
                        background: '#f1f5f9',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {p.name} {p.relationship ? `(${p.relationship})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Tasks */}
            {context.connectedTasks.length > 0 && (
              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <CheckSquare size={15} />
                  <span>CONNECTED TASKS ({context.connectedTasks.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {context.connectedTasks.map(t => (
                    <div
                      key={t.id}
                      style={{
                        fontSize: '0.8125rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.375rem 0',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      <span style={{ color: t.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
                        {t.title}
                      </span>
                      {t.dueDate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.dueDate}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Expenses & Financial Impact */}
            {context.connectedExpenses.length > 0 && (
              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <IndianRupee size={15} />
                    <span>FINANCIAL FOOTPRINT</span>
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                    {formatMoney(context.totalExpenseMinor, '₹')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {context.connectedExpenses.map(e => (
                    <div
                      key={e.id}
                      style={{
                        fontSize: '0.8125rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0'
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{e.category} {e.notes ? `— ${e.notes}` : ''}</span>
                      <span style={{ fontWeight: 500 }}>{formatMoney(e.amountMinor, '₹')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Notes & Decisions */}
            {(context.connectedNotes.length > 0 || context.connectedDecisions.length > 0) && (
              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <FileText size={15} />
                  <span>REASONING & DOCUMENTATION</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {context.connectedDecisions.map(d => (
                    <div key={d.id} style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Decision: {d.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        {d.reason}
                      </div>
                    </div>
                  ))}
                  {context.connectedNotes.map(n => (
                    <div key={n.id} style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      Note: {n.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Attachments */}
            {context.connectedAttachments.length > 0 && (
              <div className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <Paperclip size={15} />
                  <span>ATTACHMENTS ({context.connectedAttachments.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {context.connectedAttachments.map(a => (
                    <span
                      key={a.id}
                      style={{
                        fontSize: '0.75rem',
                        background: '#f1f5f9',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      {a.name} ({(a.sizeBytes / 1024).toFixed(0)} KB)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
