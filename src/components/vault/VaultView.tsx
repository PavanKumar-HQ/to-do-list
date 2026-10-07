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
  Check,
  Key,
  Headphones,
  Glasses,
  Home,
  Briefcase,
  MapPin,
  Package,
  Layers,
  Smartphone
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { useToast } from '../common/ToastContext';
import { formatDisplayDate } from '../../utils/dates';
import type { VaultResourceItem, VaultCategory } from '../../types';

const CATEGORIES: Array<{ id: VaultCategory; label: string; icon: React.FC<any>; color: string; desc: string }> = [
  { id: 'keys_essentials', label: 'Keys, Wallets & IDs', icon: Key, color: '#f59e0b', desc: 'House keys, car/bike keys, wallet, access badges & physical IDs' },
  { id: 'gadgets_buds', label: 'Earbuds, Tech & Cables', icon: Headphones, color: '#3b82f6', desc: 'AirPods/buds, chargers, dongles, cables & portable gadgets' },
  { id: 'personal_items', label: 'Personal & Valuables', icon: Glasses, color: '#10b981', desc: 'Glasses, watch, medication, passport & physical documents' },
  { id: 'tools_home', label: 'Home, Tools & Storage', icon: Wrench, color: '#8b5cf6', desc: 'Hardware tools, spare keys, storage bins, luggage & drawers' },
  { id: 'website_tech', label: 'Websites & Portals', icon: Globe, color: '#06b6d4', desc: 'Bookmarked websites, web portals, cloud drive links & GitHub repos' },
  { id: 'credential_hint', label: 'Account & Login Hints', icon: KeyRound, color: '#ec4899', desc: 'Usernames, SSO email methods (safe login hints, no passwords)' },
  { id: 'general', label: 'General Items', icon: Package, color: '#64748b', desc: 'Any miscellaneous physical belongings or digital items' }
];

const PRESETS = [
  { title: 'House & Car Keys', category: 'keys_essentials' as VaultCategory, locationHint: 'Key hanger by the main door / side drawer', icon: '🔑' },
  { title: 'AirPods / Earbuds', category: 'gadgets_buds' as VaultCategory, locationHint: 'Work desk organizer tray / backpack front pocket', icon: '🎧' },
  { title: 'Reading / Sun Glasses', category: 'personal_items' as VaultCategory, locationHint: 'Bedside table nightstand / case in car glovebox', icon: '👓' },
  { title: 'Passport & Physical IDs', category: 'personal_items' as VaultCategory, locationHint: 'Wardrobe locker / document folder on shelf 2', icon: '🛂' },
  { title: 'Laptop Charger & USB-C Cable', category: 'gadgets_buds' as VaultCategory, locationHint: 'Laptop sleeve side pouch / power strip station', icon: '🔌' },
  { title: 'Toolbox & Spare Keys', category: 'tools_home' as VaultCategory, locationHint: 'Utility cupboard / garage shelf box A', icon: '🛠️' }
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
  const [category, setCategory] = useState<VaultCategory>('keys_essentials');
  const [url, setUrl] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const resources = useLiveQuery(async () => {
    return db.vaultResources.filter(r => !r.deletedAt).reverse().sortBy('createdAt');
  }, []) || [];

  const handleOpenAdd = (preset?: typeof PRESETS[0]) => {
    setEditingItem(null);
    if (preset) {
      setTitle(preset.title);
      setCategory(preset.category);
      setLocationHint(preset.locationHint);
      setUrl('');
      setUsernameHint('');
      setNotes('');
      setTagsInput(preset.category.replace('_', ' '));
    } else {
      setTitle('');
      setCategory(selectedCategory === 'all' ? 'keys_essentials' : selectedCategory);
      setUrl('');
      setLocationHint('');
      setUsernameHint('');
      setNotes('');
      setTagsInput('');
    }
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
      showToast('Title / Item Name is required', { type: 'warning' });
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
      showToast('Vault item updated', { type: 'success' });
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
      showToast(`Saved "${title.trim()}" to Vault ✨`, { type: 'success' });
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
    let itemCat = item.category as string;
    // Map legacy categories
    if (itemCat === 'website' || itemCat === 'github_repo' || itemCat === 'tool') {
      itemCat = 'website_tech';
    } else if (itemCat === 'document') {
      itemCat = 'personal_items';
    }

    const matchesCat = selectedCategory === 'all' || itemCat === selectedCategory || item.category === selectedCategory;
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

  const getCategoryMeta = (cat: VaultCategory) => {
    let searchCat = cat as string;
    if (searchCat === 'website' || searchCat === 'github_repo' || searchCat === 'tool') searchCat = 'website_tech';
    if (searchCat === 'document') searchCat = 'personal_items';
    return CATEGORIES.find(c => c.id === searchCat) || CATEGORIES[0];
  };

  return (
    <div className="view-container animate-fade-in" style={{ paddingBottom: '90px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Where Did I Put That? (Personal Vault)
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'var(--accent-light)',
                color: 'var(--accent)'
              }}
            >
              100% Offline
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Never lose keys, earbuds, glasses, passports, tools, bookmarks or account hints again.
          </p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="btn btn-primary btn-sm"
          style={{ gap: '6px' }}
        >
          <Plus size={16} />
          <span>Save Item</span>
        </button>
      </div>

      {/* Quick Preset Chips for Everyday Physical Items */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
          Quick Add Everyday Items
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {PRESETS.map((p) => (
            <button
              key={p.title}
              onClick={() => handleOpenAdd(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-light)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <span>{p.icon}</span>
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Category Filter Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />
          <input
            type="text"
            className="input-text"
            style={{ paddingLeft: '36px', borderRadius: 'var(--radius-md)' }}
            placeholder="Search items by name, drawer location, buds, keys, passport, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="btn-ghost btn-icon"
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: '12px' }}
          >
            All Items ({resources.length})
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = resources.filter(r => {
              let c = r.category as string;
              if (c === 'website' || c === 'github_repo' || c === 'tool') c = 'website_tech';
              if (c === 'document') c = 'personal_items';
              return c === cat.id || r.category === cat.id;
            }).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: '12px', gap: '6px' }}
              >
                <Icon size={14} style={{ color: selectedCategory === cat.id ? '#ffffff' : cat.color }} />
                <span>{cat.label}</span>
                {count > 0 && <span style={{ opacity: 0.8 }}>({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid */}
      {filteredResources.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-subtle)'
          }}
        >
          <FolderSearch size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            No vault items found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '380px', margin: '6px auto 16px' }}>
            Store the physical location of your keys, earbuds, sunglasses, chargers, or websites and tool credentials.
          </p>
          <button onClick={() => handleOpenAdd()} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
            <Plus size={15} />
            <span>Store First Item</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {filteredResources.map((item) => {
            const meta = getCategoryMeta(item.category);
            const Icon = meta.icon;

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: item.isPinned ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: `${meta.color}18`,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon size={18} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: meta.color,
                            background: `${meta.color}15`,
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {meta.label}
                        </span>
                        {item.isPinned && (
                          <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Pin size={10} /> Pinned
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      onClick={() => handleTogglePin(item)}
                      className="btn-ghost btn-icon"
                      style={{ width: '26px', height: '26px', color: item.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
                      title={item.isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={13} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="btn-ghost btn-icon"
                      style={{ width: '26px', height: '26px' }}
                      title="Edit Item"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="btn-ghost btn-icon"
                      style={{ width: '26px', height: '26px', color: 'var(--danger)' }}
                      title="Delete Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Physical Location Hint (High visibility) */}
                {item.locationHint && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      padding: '8px 10px',
                      borderRadius: '8px'
                    }}
                  >
                    <MapPin size={15} style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Where It Is Kept
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {item.locationHint}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(item.locationHint!, item.id + '-loc', 'Location')}
                      className="btn-ghost btn-icon"
                      style={{ width: '24px', height: '24px' }}
                      title="Copy Location"
                    >
                      {copiedId === item.id + '-loc' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {/* Digital URL / Link */}
                {item.url && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px' }}>
                    <a
                      href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.url}</span>
                    </a>
                    <button
                      onClick={() => handleCopy(item.url!, item.id + '-url', 'Link')}
                      className="btn-ghost btn-icon"
                      style={{ width: '24px', height: '24px', flexShrink: 0 }}
                      title="Copy Link"
                    >
                      {copiedId === item.id + '-url' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {/* Username / SSO Hint */}
                {item.usernameHint && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(236, 72, 153, 0.06)',
                      border: '1px solid rgba(236, 72, 153, 0.2)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <KeyRound size={13} style={{ color: '#ec4899', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-muted)' }}>Login Hint:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.usernameHint}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(item.usernameHint!, item.id + '-usr', 'Username Hint')}
                      className="btn-ghost btn-icon"
                      style={{ width: '22px', height: '22px', flexShrink: 0 }}
                    >
                      {copiedId === item.id + '-usr' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {item.notes}
                  </div>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '10.5px',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-surface-elevated)',
                          padding: '1px 6px',
                          borderRadius: '4px'
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {editingItem ? 'Edit Vault Item' : 'Store Item in Vault'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Item / Resource Name *</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. House & Car Keys, AirPods Pro, Glasses Case, AWS Portal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="form-label">Category</label>
                <select
                  className="input-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VaultCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  📍 Where is it kept? (Physical Location Hint)
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Side table drawer, key hook by main door, backpack pouch"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">🔗 Web URL / Portal Link (Optional)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">
                  🔐 Login / Username Hint (No Passwords!)
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Signed in with Google (pavan@...), or user: admin_pavan"
                  value={usernameHint}
                  onChange={(e) => setUsernameHint(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Notes & Details</label>
                <textarea
                  className="input-textarea"
                  rows={2}
                  placeholder="e.g. Spare key is wrapped in blue tape; AirPods case has black sticker"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Tags (comma separated)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="keys, home, daily, important"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="vault-pin-check"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <label htmlFor="vault-pin-check" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Pin to top of Vault for quick access
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Save Changes' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
