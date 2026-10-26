import React from 'react';
import { Home, CheckSquare, Target, Folder, MoreHorizontal } from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { triggerHaptic } from '../../utils/haptics';

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
    { id: 'goals', label: 'Habits', icon: Target, badge: habitsCount > 0 ? habitsCount : undefined },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined },
    { id: 'vault', label: 'Vault', icon: Folder },
    { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true }
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px))',
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 800,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.03)'
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
              triggerHaptic('selection');
              if (item.isMore && onOpenMoreSheet) {
                onOpenMoreSheet();
              } else {
                onSelectScreen(item.id);
              }
            }}
            className="mobile-nav-item"
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
              position: 'relative',
              background: 'none',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
            aria-label={item.label}
          >
            <div
              style={{
                position: 'relative',
                width: '46px',
                height: '26px',
                borderRadius: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                transition: 'background 0.16s ease, transform 0.12s ease'
              }}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 1.7} />
              {item.badge !== undefined && !item.isMore && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-2px',
                    background: item.id === 'goals' ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent)',
                    color: item.id === 'goals' ? '#ef4444' : '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '0.5px 4.5px',
                    lineHeight: '11px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                letterSpacing: '-0.01em',
                transition: 'color 0.16s ease'
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

