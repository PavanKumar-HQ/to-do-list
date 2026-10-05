import React, { useState, useEffect } from 'react';
import { Search, Mic, WifiOff, ShieldAlert, Settings, Sun, Moon } from 'lucide-react';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface HeaderProps {
  currentScreen: string;
  onOpenSearch: () => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onOpenSearch,
  onOpenVoice,
  onOpenSettings,
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
      case 'home': return 'Today & Focus';
      case 'tasks': return 'Tasks';
      case 'loops': return 'Follow-ups & Commitments';
      case 'reminders': return 'Reminders';
      case 'notes': return 'Notes & Ideas';
      case 'money': return 'Money & Budgets';
      case 'calendar': return 'Calendar';
      case 'journal': return 'Daily Journal';
      case 'people': return 'People & Contacts';
      case 'lists': return 'Lists';
      case 'goals': return 'Goals & Routines';
      case 'settings': return 'Settings & Backups';
      case 'trash': return 'Trash';
      default: return 'Personal Life';
    }
  };

  return (
    <header
      style={{
        height: 'var(--header-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
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
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {screenTitle()}
        </h1>

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

        {isBackupStale && (
          <button
            onClick={onOpenSettings}
            className="badge badge-warning"
            style={{ fontSize: '11px', padding: '2px 6px', border: 'none', cursor: 'pointer' }}
            title="You have unbacked-up changes. Tap to export a backup file."
          >
            <ShieldAlert size={12} />
            Backup recommended
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={onOpenVoice}
          className="btn-ghost"
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Record voice note"
          title="Voice Memo"
        >
          <Mic size={19} />
        </button>

        <button
          onClick={onOpenSearch}
          className="btn-ghost"
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Global search"
          title="Search all data"
        >
          <Search size={19} />
        </button>

        <button
          onClick={onToggleTheme}
          className="btn-ghost"
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#64748b" />}
        </button>

        <button
          onClick={onOpenSettings}
          className="btn-ghost"
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Settings and backups"
          title="Settings & Backups"
        >
          <Settings size={19} />
        </button>
      </div>
    </header>
  );
};
