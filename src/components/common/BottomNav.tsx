import React from 'react';
import { Home, CheckSquare, Target, FolderSearch, MoreHorizontal, Flame } from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface BottomNavProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenMoreSheet?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenMoreSheet
}) => {
  const pendingTasksCount = useLiveQuery(async () => {
    return db.tasks.filter((t) => !t.deletedAt && t.status !== 'completed' && t.status !== 'archived').count();
  }, []) || 0;

  const habitsCount = useLiveQuery(async () => {
    return db.habits.filter((h) => !h.deletedAt).count();
  }, []) || 0;

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'goals', label: 'Habits & Plan', icon: Target, badge: habitsCount > 0 ? habitsCount : undefined },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined },
    { id: 'vault', label: 'Vault', icon: FolderSearch },
    { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true }
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-bar-height)',
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 800,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
      className="mobile-only-nav"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;

        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.isMore && onOpenMoreSheet) {
                onOpenMoreSheet();
              } else {
                onSelectScreen(item.id);
              }
            }}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
              position: 'relative',
              background: 'none',
              border: 'none',
              padding: '6px 0',
              cursor: 'pointer'
            }}
            aria-label={item.label}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
              {item.badge !== undefined && !item.isMore && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    background: item.id === 'goals' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-elevated)',
                    color: item.id === 'goals' ? '#ef4444' : 'var(--text-primary)',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    lineHeight: '12px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
