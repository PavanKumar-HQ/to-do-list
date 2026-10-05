import React from 'react';
import { Home, Inbox, Calendar, Wallet, MoreHorizontal } from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getTodayDateString } from '../../utils/dates';

interface BottomNavProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenMoreSheet: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenMoreSheet
}) => {
  const todayStr = getTodayDateString();

  // Active counts for badges
  const pendingInboxCount = useLiveQuery(async () => {
    return db.inbox.filter((i) => !i.deletedAt && !i.isProcessed).count();
  }, []) || 0;

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: pendingInboxCount > 0 ? pendingInboxCount : undefined },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'money', label: 'Money', icon: Wallet },
    { id: 'more', label: 'More', icon: MoreHorizontal, isAction: true }
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-bar-height)',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-light)',
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
              if (item.isAction) {
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
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              position: 'relative',
              background: 'none',
              padding: '6px 0'
            }}
            aria-label={item.label}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              {item.badge !== undefined && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    background: item.id === 'inbox' ? 'var(--warning)' : 'var(--accent)',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    lineHeight: '12px'
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
