import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FolderSearch,
  Plus,
  Search,
  Globe,
  GitBranch,
  FileText,
  Wrench,
  KeyRound,
  ExternalLink,
  Copy,
  Pin,
  Trash2,
  Edit2,
  X,
  Tag,
  ShieldAlert,
  Sparkles,
  Check
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { useToast } from '../common/ToastContext';
import { formatDisplayDate } from '../../utils/dates';
import type { VaultResourceItem, VaultCategory } from '../../types';

const CATEGORIES: Array<{ id: VaultCategory; label: string; icon: React.FC<any>; color: string; desc: string }> = [
  { id: 'website', label: 'Websites & Portals', icon: Globe, color: '#3b82f6', desc: 'Bookmarked websites, web apps & portals' },
  { id: 'github_repo', label: 'GitHub & Repos', icon: GitBranch, color: '#10b981', desc: 'Code repositories, gists & forks' },
  { id: 'document', label: 'Documents & Files', icon: FileText, color: '#8b5cf6', desc: 'File location hints, sheets & drives' },
  { id: 'tool', label: 'Tools & Utilities', icon: Wrench, color: '#f59e0b', desc: 'Developer tools, SaaS utilities & apps' },
  { id: 'credential_hint', label: 'Account & Auth Hints', icon: KeyRound, color: '#ec4899', desc: 'Usernames, SSO methods (no passwords)' }
];

export const VaultView: React.FC = () => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultResourceItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VaultCategory>('website');
  const [url, setUrl] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const resources = useLiveQuery(async () => {
    return db.vaultResources.filter(r => !r.deletedAt).reverse().sortBy('createdAt');
  }, []) || [];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setTitle('');
    setCategory(selectedCategory === 'all' ? 'website' : selectedCategory);
    setUrl('');
    setLocationHint('');
    setUsernameHint('');
    setNotes('');
    setTagsInput('');
    setIsPinned(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: VaultResourceItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategory(item.category);
    setUrl(item.url || '');
    setLocationHint(item.locationHint || '');
    setUsernameHint(item.usernameHint || '');
    setNotes(item.notes || '');
    setTagsInput(item.tags ? item.tags.join(', ') : '');
    setIsPinned(!!item.isPinned);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Title is required', { type: 'warning' });
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const nowIso = new Date().toISOString();

    if (editingItem) {
      await db.vaultResources.update(editingItem.id, {
        title: title.trim(),
        category,
        url: url.trim() || undefined,
        locationHint: locationHint.trim() || undefined,
        usernameHint: usernameHint.trim() || undefined,
        notes: notes.trim() || undefined,
        tags,
        isPinned,
        updatedAt: nowIso
      });
      showToast('Resource updated', { type: 'success' });
    } else {
      const id = generateId();
      await db.vaultResources.add({
        id,
        title: title.trim(),
        category,
        url: url.trim() || undefined,
        locationHint: locationHint.trim() || undefined,
        usernameHint: usernameHint.trim() || undefined,
        notes: notes.trim() || undefined,
        tags,
        isPinned,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await logAudit('create', 'document', id, `Added vault item: ${title.trim()}`);
      showToast('Resource saved to Vault', { type: 'success' });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (confirm(`Remove "${itemTitle}" from your Vault?`)) {
      await db.vaultResources.update(id, { deletedAt: new Date().toISOString() });
      showToast('Item moved to Trash');
    }
  };

  const handleCopy = async (text: string, id: string, label: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      showToast(`${label} copied!`, { type: 'success' });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast(`Copy: ${text}`);
    }
  };

  const handleTogglePin = async (item: VaultResourceItem) => {
    await db.vaultResources.update(item.id, { isPinned: !item.isPinned });
    showToast(item.isPinned ? 'Unpinned' : 'Pinned to top');
  };

  // Filter and sort resources
  const filteredResources = resources.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;

    const matchesQuery =
      item.title.toLowerCase().includes(q) ||
      (item.url && item.url.toLowerCase().includes(q)) ||
      (item.locationHint && item.locationHint.toLowerCase().includes(q)) ||
      (item.usernameHint && item.usernameHint.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((t: string) => t.toLowerCase().includes(q)));

    return matchesCat && matchesQuery;
  }).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="view-container animate-fade-in" style={{ paddingBottom: '90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '10px' }}>
              <FolderSearch size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Where Did I Put That?
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Your private bookmark & resource vault for websites, GitHub repos, documents, and credentials without storing passwords
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn btn-primary"
          style={{ gap: '6px', borderRadius: '8px' }}
        >
          <Plus size={16} />
          <span>Save Resource</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          placeholder="Search bookmarks, tools, repos, account hints, tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '40px',
            paddingRight: searchQuery ? '36px' : '14px',
            height: '42px',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-surface)'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="btn-ghost"
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '6px 14px', fontSize: '12.5px' }}
        >
          All Resources ({resources.length})
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = resources.filter(r => r.category === cat.id).length;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '20px', padding: '6px 12px', fontSize: '12.5px', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Icon size={14} color={isActive ? '#ffffff' : cat.color} />
              <span>{cat.label}</span>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Resource Grid */}
      {filteredResources.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            border: '1px dashed var(--border-light)',
            background: 'var(--bg-surface)'
          }}
        >
          <FolderSearch size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            {searchQuery ? 'No matching resources found' : 'Your Vault is empty'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 auto 16px auto', maxWidth: '400px' }}>
            {searchQuery
              ? 'Try searching with different keywords or clear your category filter.'
              : 'Save important links, GitHub repositories, document paths, or username hints so you never lose them.'}
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary" style={{ margin: '0 auto', gap: '6px' }}>
            <Plus size={16} />
            <span>Add First Resource</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {filteredResources.map(item => {
            const catMeta = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
            const Icon = catMeta.icon;
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  border: item.isPinned ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  boxShadow: item.isPinned ? '0 4px 12px rgba(99, 102, 241, 0.08)' : undefined
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: `${catMeta.color}15`, color: catMeta.color, flexShrink: 0 }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {catMeta.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => handleTogglePin(item)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: item.isPinned ? 'var(--accent)' : 'var(--text-tertiary)' }}
                      title={item.isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={15} style={{ transform: item.isPinned ? 'rotate(45deg)' : 'none' }} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--text-secondary)' }}
                      title="Edit resource"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--danger)' }}
                      title="Delete resource"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Details / Hints */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  {item.url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: 'var(--accent)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ExternalLink size={13} style={{ flexShrink: 0 }} />
                        <span>{item.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      </a>
                      <button
                        onClick={() => handleCopy(item.url!, item.id, 'URL')}
                        className="btn-ghost"
                        style={{ padding: '2px 4px', fontSize: '11px' }}
                        title="Copy URL"
                      >
                        {isCopied ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  {item.locationHint && (
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11.5px' }}>Location:</span>
                      <span style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {item.locationHint}
                      </span>
                    </div>
                  )}

                  {item.usernameHint && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11.5px' }}>Account / User:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.usernameHint}</span>
                      <button
                        onClick={() => handleCopy(item.usernameHint!, `${item.id}_user`, 'Username')}
                        className="btn-ghost"
                        style={{ padding: '2px 4px' }}
                        title="Copy username"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}

                  {item.notes && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', lineHeight: 1.4 }}>
                      {item.notes}
                    </div>
                  )}
                </div>

                {/* Tags Footer */}
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto', paddingTop: '6px' }}>
                    {item.tags.map((t: string) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '10.5px',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-secondary)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Resource Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)} role="dialog" aria-modal="true">
          <div
            className="bottom-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="sheet-handle" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '8px' }}>
                  <FolderSearch size={20} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  {editingItem ? 'Edit Resource' : 'Save New Resource'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Privacy Warning */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', fontSize: '11.5px', color: 'var(--danger)' }}>
                <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                <span>Zero-password safety: Store auth hints, SSO methods & usernames only. Never enter passwords.</span>
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Console, Brandex Figma, GitHub Org, Tax Invoices Drive"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  Category
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;

                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '11.5px', padding: '6px 8px', gap: '6px', justifyContent: 'flex-start' }}
                      >
                        <Icon size={14} color={isSelected ? '#ffffff' : cat.color} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* URL */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  URL / Web Link (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/org/repo or https://tool.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Location Hint */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Where Did I Put It? (Location Hint)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Drive > Finances > 2026 or ~/code/work/brandex"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Account / Username Hint */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Account / Login Hint (No Passwords)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Registered with pavankumar@gmail.com / Log in with Google"
                  value={usernameHint}
                  onChange={(e) => setUsernameHint(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Notes & Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context, access instructions, API key location..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="work, brandex, dev, personal"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px' }}
                />
              </div>

              {/* Pin to top */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span>Pin this resource to top of vault</span>
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Sparkles size={16} />
                  <span>{editingItem ? 'Update Resource' : 'Save to Vault'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
