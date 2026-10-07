import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  X,
  Trash2,
  Eye,
  ExternalLink,
  Zap,
  ArrowRight
} from 'lucide-react';
import { InviteRepository } from '../../repositories/InviteRepository';
import { useToast } from './ToastContext';
import { formatDisplayDate } from '../../utils/dates';
import { InviteLandingModal } from './InviteLandingModal';
import type { InviteItem } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [duration, setDuration] = useState<'24 hours' | '7 days' | '30 days'>('7 days');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'preview'>('generate');

  const invites = useLiveQuery(async () => {
    return InviteRepository.queryAll();
  }, []) || [];

  if (!isOpen) return null;

  const handleGenerateInvite = async () => {
    try {
      const invite = await InviteRepository.createInvite(duration);
      await copyLink(invite, true);
      showToast(`Secure invite link generated & copied to clipboard! (${duration})`, { type: 'success' });
    } catch (err: any) {
      showToast('Failed to create invite', { type: 'error' });
    }
  };

  const getFullInviteUrl = (token: string) => {
    if (typeof window === 'undefined') return `https://lifeos.local/#invite=${token}`;
    // Preserve current base URL (including GitHub Pages path or sub-folders) without trailing query/hash
    const base = window.location.href.split('#')[0].split('?')[0];
    return `${base}#invite=${token}`;
  };

  const copyLink = async (invite: InviteItem, silent: boolean = false) => {
    const url = getFullInviteUrl(invite.token);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedToken(invite.token);
      if (!silent) {
        showToast('Invite link copied to clipboard!', { type: 'success' });
      }
      setTimeout(() => setCopiedToken(null), 3000);
    } catch {
      if (!silent) {
        showToast(`Copy URL: ${url}`);
      }
    }
  };

  const handleShare = async (invite: InviteItem) => {
    const url = getFullInviteUrl(invite.token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Personal Life OS',
          text: 'Here is your private invite to Personal Life OS — a calm, local-first system to organize your life.',
          url
        });
        showToast('Shared successfully');
      } catch (err) {
        // user cancelled share
      }
    } else {
      copyLink(invite);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    await InviteRepository.delete(id);
    showToast('Invite link revoked');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() < Date.now();
  };

  const activeInvite = invites.find(i => !isExpired(i.expiresAt)) || invites[0];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div
          className="bottom-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '520px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div className="sheet-handle" />

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                <Share2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Invite & Share App
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Privacy-first private workspace sharing
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Tabs: Generator vs Recipient Live Preview */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-surface-elevated)',
              padding: '3px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              onClick={() => setActiveTab('generate')}
              className={`btn btn-sm ${activeTab === 'generate' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: '12px', padding: '6px' }}
            >
              Generate & Manage
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: '12px', padding: '6px', gap: '4px' }}
            >
              <Eye size={13} />
              <span>Live Recipient Preview</span>
            </button>
          </div>

          {activeTab === 'preview' ? (
            /* Live Recipient Preview Card Section */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                This is the exact landing card your friend or colleague will see when opening the invite link:
              </div>

              {/* Preview Card Mockup */}
              <div
                style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%)',
                    padding: '18px 16px',
                    color: '#ffffff'
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginBottom: '8px'
                    }}
                  >
                    <Sparkles size={11} />
                    <span>Invitation</span>
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    Welcome to Personal Life OS
                  </h4>
                  <p style={{ margin: 0, fontSize: '11.5px', opacity: 0.9, lineHeight: 1.3 }}>
                    A calm, private, offline-first workspace to organize your life with zero cloud trackers.
                  </p>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <ShieldCheck size={14} color="var(--success)" />
                    <span>Zero data stored on cloud servers</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Zap size={14} color="var(--accent)" />
                    <span>Works offline on mobile and desktop</span>
                  </div>

                  <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setPreviewToken(activeInvite?.token || 'sample-invite-token')}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, gap: '6px', fontSize: '12px' }}
                    >
                      <Eye size={13} />
                      <span>Open Full Screen Preview</span>
                    </button>
                    {activeInvite && (
                      <button
                        onClick={() => copyLink(activeInvite)}
                        className="btn btn-secondary btn-sm"
                        style={{ gap: '4px', fontSize: '12px' }}
                        title="Copy link"
                      >
                        <Copy size={13} />
                        <span>Copy Link</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setActiveTab('generate')}
                  className="btn-ghost"
                  style={{ fontSize: '12px', color: 'var(--accent)' }}
                >
                  ← Back to Link Management
                </button>
              </div>
            </div>
          ) : (
            /* Generator & Active Invites List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Privacy Guarantee Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  background: 'var(--success-light)',
                  border: '1px solid var(--success-border)',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  color: 'var(--success)'
                }}
              >
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Zero Personal Data Shared</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Invites allow someone to install and use Personal Life OS. Your tasks, expenses, notes, and records never leave your device.
                  </span>
                </div>
              </div>

              {/* Generator Controls */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px'
                  }}
                >
                  Link Expiry Duration
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(['24 hours', '7 days', '30 days'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`btn ${duration === d ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ gap: '4px', fontSize: '12px' }}
                    >
                      <Clock size={13} />
                      <span>{d}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateInvite}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px', gap: '6px' }}
                >
                  <Sparkles size={16} />
                  <span>Generate Invite Link</span>
                </button>
              </div>

              {/* Active Invites List */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px'
                  }}
                >
                  Your Generated Links ({invites.length})
                </div>

                {invites.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '12.5px',
                      color: 'var(--text-muted)',
                      border: '1px dashed var(--border-light)',
                      borderRadius: '8px'
                    }}
                  >
                    No active invite links generated yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {invites.map((inv) => {
                      const expired = isExpired(inv.expiresAt);
                      const isCopied = copiedToken === inv.token;

                      return (
                        <div
                          key={inv.id}
                          className="card"
                          style={{
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            opacity: expired ? 0.6 : 1
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                token:{inv.token.slice(0, 10)}...
                              </span>
                              <span className={`badge ${expired ? 'badge-danger' : 'badge-success'}`}>
                                {expired ? 'Expired' : inv.durationLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Expires: {formatDisplayDate(inv.expiresAt.split('T')[0])}
                              {inv.attributionCount ? ` • ${inv.attributionCount} uses` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {!expired && (
                              <>
                                <button
                                  onClick={() => setPreviewToken(inv.token)}
                                  className="btn-ghost"
                                  style={{ padding: '5px', color: 'var(--accent)' }}
                                  title="Preview recipient landing screen"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => copyLink(inv)}
                                  className="btn-ghost"
                                  style={{ padding: '5px' }}
                                  title="Copy invite URL"
                                >
                                  {isCopied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                                </button>
                                <button
                                  onClick={() => handleShare(inv)}
                                  className="btn-ghost"
                                  style={{ padding: '5px' }}
                                  title="Share via system sheet"
                                >
                                  <Share2 size={16} color="var(--accent)" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteInvite(inv.id)}
                              className="btn-ghost"
                              style={{ padding: '5px', color: 'var(--danger)' }}
                              title="Revoke invite"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Recipient Full Screen Preview Modal */}
      {previewToken && (
        <InviteLandingModal
          isOpen={!!previewToken}
          token={previewToken}
          onAccept={() => {
            setPreviewToken(null);
            showToast('Preview completed!', { type: 'success' });
          }}
          onDismiss={() => setPreviewToken(null)}
        />
      )}
    </>
  );
};
