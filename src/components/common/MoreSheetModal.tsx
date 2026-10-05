import React from 'react';
import {
  FileText,
  ListTodo,
  CheckSquare,
  Users,
  Calendar,
  Target,
  BookOpen,
  Wallet,
  Search,
  Trash2,
  Settings,
  Bell,
  Inbox,
  Home,
  X
} from 'lucide-react';

interface MoreSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreen: (screen: string) => void;
  currentScreen?: string;
}

export const MoreSheetModal: React.FC<MoreSheetModalProps> = ({
  isOpen,
  onClose,
  onSelectScreen,
  currentScreen
}) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Daily Core',
      items: [
        { id: 'home', label: 'Today (Home)', icon: Home },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'inbox', label: 'Universal Inbox', icon: Inbox }
      ]
    },
    {
      title: 'Remember & Track',
      items: [
        { id: 'reminders', label: 'Reminders & Alerts', icon: Bell },
        { id: 'loops', label: 'Follow-ups & Commitments', icon: ListTodo },
        { id: 'notes', label: 'Notes & Ideas', icon: FileText },
        { id: 'people', label: 'People & Waiting', icon: Users },
        { id: 'journal', label: 'Daily Journal', icon: BookOpen }
      ]
    },
    {
      title: 'Plan & Goals',
      items: [
        { id: 'goals', label: 'Goals & Routines', icon: Target },
        { id: 'lists', label: 'Lists & Checklists', icon: ListTodo },
        { id: 'money', label: 'Money & Budgets', icon: Wallet }
      ]
    },
    {
      title: 'System & Tools',
      items: [
        { id: 'settings', label: 'Settings & Backups', icon: Settings },
        { id: 'trash', label: 'Trash & Recovery', icon: Trash2 }
      ]
    }
  ];

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-left" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
              K
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Kanso
              </h2>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Workspace
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close menu" style={{ width: '32px', height: '32px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
          {sections.map((sec) => (
            <div key={sec.title}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.6px', paddingLeft: '4px' }}>
                {sec.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectScreen(item.id);
                        onClose();
                      }}
                      className={isActive ? 'btn-primary' : 'btn-ghost'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        width: '100%',
                        justifyContent: 'flex-start',
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                        background: isActive ? 'var(--accent)' : 'transparent',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'background 0.12s ease'
                      }}
                    >
                      <Icon size={16} color={isActive ? '#ffffff' : 'var(--accent)'} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px' }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
