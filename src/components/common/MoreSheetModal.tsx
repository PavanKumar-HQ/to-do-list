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
  X
} from 'lucide-react';

interface MoreSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScreen: (screen: string) => void;
}

export const MoreSheetModal: React.FC<MoreSheetModalProps> = ({
  isOpen,
  onClose,
  onSelectScreen
}) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Remember',
      items: [
        { id: 'loops', label: 'Follow-ups & Commitments', icon: ListTodo },
        { id: 'notes', label: 'Notes & Memory', icon: FileText },
        { id: 'people', label: 'People & Waiting', icon: Users },
        { id: 'journal', label: 'Daily Journal', icon: BookOpen }
      ]
    },
    {
      title: 'Plan',
      items: [
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'goals', label: 'Goals & Routines', icon: Target },
        { id: 'lists', label: 'Lists & Checklists', icon: ListTodo },
        { id: 'calendar', label: 'Calendar', icon: Calendar }
      ]
    },
    {
      title: 'Money',
      items: [
        { id: 'money', label: 'Money & Budgets', icon: Wallet }
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'trash', label: 'Trash & Recovery', icon: Trash2 },
        { id: 'settings', label: 'Settings & Backups', icon: Settings }
      ]
    }
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              More Sections
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Personal operating modules
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {sections.map((sec) => (
            <div key={sec.title}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                {sec.title}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectScreen(item.id);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left'
                      }}
                    >
                      <Icon size={16} color="var(--accent)" />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
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
