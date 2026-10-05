import React from 'react';
import {
  Home,
  Inbox,
  CheckSquare,
  Calendar,
  FileText,
  Wallet,
  BookOpen,
  Users,
  ListTodo,
  Target,
  Settings,
  Trash2,
  Plus
} from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface DesktopSidebarProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenQuickAdd: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenQuickAdd
}) => {
  const pendingInboxCount = useLiveQuery(async () => {
    return db.inbox.filter((i) => !i.deletedAt && !i.isProcessed).count();
  }, []) || 0;

  const pendingTasksCount = useLiveQuery(async () => {
    return db.tasks
      .filter((t) => !t.deletedAt && t.status !== 'completed' && t.status !== 'archived')
      .count();
  }, []) || 0;

  const lifeNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'inbox', label: 'Universal Inbox', icon: Inbox, badge: pendingInboxCount },
    { id: 'calendar', label: 'Calendar', icon: Calendar }
  ];

  const rememberNav = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount },
    { id: 'loops', label: 'Follow-ups & Commitments', icon: ListTodo },
    { id: 'notes', label: 'Notes & Memory', icon: FileText },
    { id: 'people', label: 'People & Waiting', icon: Users },
    { id: 'journal', label: 'Daily Journal', icon: BookOpen }
  ];

  const planNav = [
    { id: 'goals', label: 'Goals & Routines', icon: Target },
    { id: 'lists', label: 'Lists & Checklists', icon: ListTodo }
  ];

  const moneyNav = [
    { id: 'money', label: 'Money & Budgets', icon: Wallet }
  ];

  const systemNav = [
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings & Backups', icon: Settings }
  ];

  const renderNavGroup = (title: string, items: typeof lifeNav) => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectScreen(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              fontSize: '13.5px',
              textAlign: 'left',
              width: '100%',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon size={17} />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: item.id === 'inbox' ? 'var(--warning-bg)' : 'var(--bg-surface-elevated)',
                  color: item.id === 'inbox' ? 'var(--warning)' : 'var(--text-primary)',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside
      style={{
        width: '240px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 600,
        padding: '16px 12px'
      }}
      className="desktop-only-sidebar"
    >
      <div style={{ padding: '8px 12px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bg-app)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '-0.02em'
            }}
          >
            K
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Kanso
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Personal Life OS
            </div>
          </div>
        </div>

        <button
          onClick={onOpenQuickAdd}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '16px', borderRadius: 'var(--radius-sm)', gap: '8px' }}
        >
          <Plus size={18} />
          <span>Quick Capture</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
        {renderNavGroup('Life', lifeNav)}
        {renderNavGroup('Remember', rememberNav)}
        {renderNavGroup('Plan', planNav)}
        {renderNavGroup('Money', moneyNav)}
        {renderNavGroup('System', systemNav)}
      </div>
    </aside>
  );
};
