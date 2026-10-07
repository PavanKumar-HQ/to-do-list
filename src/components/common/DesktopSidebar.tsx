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
  Plus,
  PenTool,
  Heart,
  FolderLock,
  FolderSearch,
  Bell,
  Share2
} from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimalAvatar } from '../../utils/avatars';

interface DesktopSidebarProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenQuickAdd: () => void;
  onOpenInvite?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenQuickAdd,
  onOpenInvite
}) => {
  const pendingInboxCount = useLiveQuery(async () => {
    return db.inbox.filter((i) => !i.deletedAt && !i.isProcessed).count();
  }, []) || 0;

  const pendingTasksCount = useLiveQuery(async () => {
    return db.tasks
      .filter((t) => !t.deletedAt && t.status !== 'completed' && t.status !== 'archived')
      .count();
  }, []) || 0;

  const settings = useLiveQuery(async () => {
    return db.settings.get('app_settings');
  }, []);

  // Calm logical grouping per Section 37
  const homeNav = [
    { id: 'home', label: 'Home', icon: Home }
  ];

  const planNav = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'inbox', label: 'Universal Inbox', icon: Inbox, badge: pendingInboxCount }
  ];

  const memoryNav = [
    { id: 'notes', label: 'Notes & Ideas', icon: FileText },
    { id: 'canvas', label: 'Canvas Studio', icon: PenTool },
    { id: 'journal', label: 'Daily Journal', icon: BookOpen },
    { id: 'vault', label: 'Resource Vault (Where Did I Put That?)', icon: FolderSearch }
  ];

  const peopleNav = [
    { id: 'family', label: 'Family Care', icon: Heart },
    { id: 'loops', label: 'Follow-ups & Loops', icon: ListTodo }
  ];

  const moneyNav = [
    { id: 'money', label: 'Money & Warranties', icon: Wallet },
    { id: 'documents', label: 'Documents Archive', icon: FolderLock }
  ];

  const goalsNav = [
    { id: 'goals', label: 'Habits, Planner & Goals', icon: Target },
    { id: 'lists', label: 'Lists & Checklists', icon: ListTodo }
  ];

  const systemNav = [
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings & Backups', icon: Settings }
  ];

  const renderNavGroup = (title: string, items: typeof planNav) => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
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
          <AnimalAvatar avatarId={settings?.avatarId} size={28} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Saral
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              सरल • Simple & Calm
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
        {renderNavGroup('Home', homeNav)}
        {renderNavGroup('Plan', planNav)}
        {renderNavGroup('Memory', memoryNav)}
        {renderNavGroup('People', peopleNav)}
        {renderNavGroup('Money', moneyNav)}
        {renderNavGroup('Goals', goalsNav)}
        {renderNavGroup('System', systemNav)}
      </div>

      {onOpenInvite && (
        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
          <button
            onClick={onOpenInvite}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface-elevated)',
              fontWeight: 500,
              fontSize: '13px',
              textAlign: 'left',
              width: '100%',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-light)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-elevated)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            <Share2 size={16} />
            <span>Invite & Share App</span>
          </button>
        </div>
      )}
    </aside>
  );
};
