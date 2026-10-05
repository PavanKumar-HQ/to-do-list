import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ListTodo,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  FolderPlus,
  X
} from 'lucide-react';
import { db, generateId, logAudit } from '../../db/db';
import { useToast } from '../common/ToastContext';
import type { CustomListItem, TemplateItem } from '../../types';

export const ListsView: React.FC = () => {
  const { showToast } = useToast();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListCategory, setNewListCategory] = useState('Personal');

  // Queries
  const lists = useLiveQuery(async () => {
    return db.lists.filter((l) => !l.deletedAt).toArray();
  }, []) || [];

  const templates = useLiveQuery(async () => {
    return db.templates.toArray();
  }, []) || [];

  const activeList = lists.find((l) => l.id === activeListId) || lists[0];

  const handleCreateList = async () => {
    if (!newListTitle.trim()) {
      showToast('Please enter a list title', { type: 'warning' });
      return;
    }
    const nowIso = new Date().toISOString();
    const id = generateId();
    await db.lists.add({
      id,
      title: newListTitle.trim(),
      category: newListCategory,
      isPinned: false,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso
    });
    setActiveListId(id);
    setIsNewListModalOpen(false);
    setNewListTitle('');
    showToast(`Created list: ${newListTitle}`, { type: 'success' });
  };

  const handleInstantiateTemplate = async (tmpl: TemplateItem) => {
    try {
      const parsedItems = JSON.parse(tmpl.payloadJson) as string[];
      const nowIso = new Date().toISOString();
      const id = generateId();
      await db.lists.add({
        id,
        title: tmpl.title,
        category: 'Template',
        isPinned: false,
        items: parsedItems.map((text, idx) => ({
          id: generateId(),
          text,
          completed: false,
          order: idx
        })),
        createdAt: nowIso,
        updatedAt: nowIso
      });
      setActiveListId(id);
      showToast(`Created checklist from template: ${tmpl.title}`, { type: 'success' });
    } catch (e) {
      showToast('Failed to load template', { type: 'error' });
    }
  };

  const handleAddItem = async () => {
    if (!activeList || !newItemText.trim()) return;
    try {
      const freshList = await db.lists.get(activeList.id);
      const currentItems = (freshList?.items || activeList.items || []);
      const newItem = {
        id: generateId(),
        text: newItemText.trim(),
        completed: false,
        order: currentItems.length
      };
      await db.lists.update(activeList.id, {
        items: [...currentItems, newItem],
        updatedAt: new Date().toISOString()
      });
      setNewItemText('');
    } catch (err: any) {
      console.error('Failed to add item to list:', err);
      showToast('Failed to add item', { type: 'error' });
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!activeList) return;
    try {
      const freshList = await db.lists.get(activeList.id);
      const currentItems = (freshList?.items || activeList.items || []);
      const updated = currentItems.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i));
      await db.lists.update(activeList.id, {
        items: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Failed to toggle item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeList) return;
    try {
      const freshList = await db.lists.get(activeList.id);
      const currentItems = (freshList?.items || activeList.items || []);
      const updated = currentItems.filter((i) => i.id !== itemId);
      await db.lists.update(activeList.id, {
        items: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleDeleteList = async (listId: string, title: string) => {
    await db.lists.update(listId, { deletedAt: new Date().toISOString() });
    showToast(`Deleted list: ${title}`);
    if (activeListId === listId) {
      setActiveListId(null);
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Lists & Checklists</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Packing lists, books, shopping, and templates
          </p>
        </div>
        <button onClick={() => setIsNewListModalOpen(true)} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
          <Plus size={16} />
          <span>New List</span>
        </button>
      </div>

      {/* List Selector Pills */}
      {lists.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px', scrollbarWidth: 'none' }}>
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveListId(l.id)}
              className={`btn btn-sm ${(activeList?.id === l.id) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', flexShrink: 0, fontSize: '13px' }}
            >
              {l.title} ({(l.items || []).filter(i => !i.completed).length})
            </button>
          ))}
        </div>
      )}

      {/* Active List View */}
      {activeList ? (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>{activeList.title}</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {(activeList.items || []).filter(i => i.completed).length} of {(activeList.items || []).length} completed
              </div>
            </div>
            <button
              onClick={() => handleDeleteList(activeList.id, activeList.title)}
              className="btn-ghost"
              style={{ color: 'var(--danger)', padding: '6px' }}
              title="Delete list"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Add item input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddItem();
            }}
            style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
          >
            <input
              type="text"
              placeholder="Add an item to list..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              style={{ fontSize: '14px', padding: '8px 12px', flex: 1 }}
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 16px' }}
            >
              Add
            </button>
          </form>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(activeList.items || []).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    className={`checkbox-custom ${item.completed ? 'checked' : ''}`}
                    onClick={() => handleToggleItem(item.id)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      textDecoration: item.completed ? 'line-through' : 'none',
                      opacity: item.completed ? 0.6 : 1
                    }}
                  >
                    {item.text}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="btn-ghost"
                  style={{ color: 'var(--text-muted)', padding: '2px 6px', display: 'flex', alignItems: 'center' }}
                  title="Remove item"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '36px 16px', textAlign: 'center', marginBottom: '20px' }}>
          <ListTodo size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: 600 }}>No custom lists yet.</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Create custom lists or choose from built-in templates below.
          </div>
        </div>
      )}

      {/* Templates Section */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Starter Templates
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{tmpl.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{tmpl.description}</div>
              </div>
              <button
                onClick={() => handleInstantiateTemplate(tmpl)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', gap: '6px', fontSize: '12px' }}
              >
                <FolderPlus size={14} />
                <span>Use Template</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* New List Modal */}
      {isNewListModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewListModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Create New List</h3>
              <button onClick={() => setIsNewListModalOpen(false)} className="btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  List Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip Packing, Books to Read"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Category
                </label>
                <select value={newListCategory} onChange={(e) => setNewListCategory(e.target.value)}>
                  <option value="Personal">Personal</option>
                  <option value="Travel">Travel</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Work">Work</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsNewListModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={handleCreateList} className="btn btn-primary" style={{ flex: 2 }}>
                Create List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
