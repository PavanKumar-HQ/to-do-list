import React, { useState, useEffect } from 'react';
import { Search, Mic, WifiOff, ShieldAlert, Settings, Sun, Moon, Menu, ChevronDown } from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface HeaderProps {
  currentScreen: string;
  onOpenSearch: () => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  onOpenMenu?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onOpenSearch,
  onOpenVoice,
  onOpenSettings,
  onOpenMenu,
  theme = 'light',
  onToggleTheme
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const settings = useLiveQuery(() => db.settings.get('current_settings'));

  // Calculate if backup is stale
  const isBackupStale = React.useMemo(() => {
    if (!settings) return false;
    if ((settings.changesSinceBackup || 0) >= 15) return true;
    if (!settings.lastBackupDate) return (settings.changesSinceBackup || 0) > 0;
    const lastDate = new Date(settings.lastBackupDate);
    const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= (settings.backupReminderDays || 3);
  }, [settings]);

  const screenTitle = () => {
    switch (currentScreen) {
      case 'home': return 'Today';
      case 'tasks': return 'Tasks';
      case 'loops': return 'Follow-ups';
      case 'reminders': return 'Reminders';
      case 'notes': return 'Notes';
      case 'money': return 'Money';
      case 'calendar': return 'Calendar';
      case 'journal': return 'Journal';
      case 'people': return 'People';
      case 'lists': return 'Lists';
      case 'habits': return 'Habit Tracker';
      case 'daily': return 'Daily Planner';
      case 'study': return 'Study Planner';
      case 'vault': return 'Where Did I Put That?';
      case 'settings': return 'Settings';
      case 'trash': return 'Trash';
      default: return 'Saral';
    }
  };

  return (
    <header
      className="app-header"
      style={{
        height: 'var(--header-height)',
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onOpenMenu && (
          <button
            onClick={onOpenMenu}
            className="btn-ghost mobile-menu-btn"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              padding: 0
            }}
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu size={20} />
          </button>
        )}
        {screenTitle() ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              {screenTitle()}
            </h1>
            {currentScreen === 'home' && (
              <ChevronDown size={15} color="var(--text-tertiary)" style={{ marginTop: '1px' }} />
            )}
          </div>
        ) : null}

        {!isOnline && (
          <span
            className="badge badge-warning"
            title="Application is working fully offline. All data is saved safely in IndexedDB."
            style={{ fontSize: '11px', padding: '2px 6px' }}
          >
            <WifiOff size={12} />
            Offline
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={onOpenVoice}
          className="btn-ghost"
          style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Record voice note"
          title="Voice Memo"
        >
          <Mic size={18} />
        </button>

        <button
          onClick={onOpenSearch}
          className="btn-ghost"
          style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Global search"
          title="Search"
        >
          <Search size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          className="btn-ghost"
          style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
