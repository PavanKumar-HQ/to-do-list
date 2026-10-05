import React, { useState, useEffect } from 'react';
import { Plus, Shield, Bell, Check, X } from 'lucide-react';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { DesktopSidebar } from './components/common/DesktopSidebar';
import { QuickAddModal } from './components/common/QuickAddModal';
import { MoreSheetModal } from './components/common/MoreSheetModal';
import { ToastProvider } from './components/common/ToastContext';
import { AppBootLoader } from './components/common/AppBootLoader';
import { NameOnboardingModal } from './components/common/NameOnboardingModal';
import { ViewSkeleton } from './components/common/ViewSkeleton';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { InAppReminderAlert } from './components/common/InAppReminderAlert';
import { FloatingActionMenu } from './components/common/FloatingActionMenu';

// Core HomeView is loaded eagerly for instant first paint
import { HomeView } from './components/home/HomeView';

// Secondary views are code-split & lazy-loaded on demand (Section 51, 52)
const InboxView = React.lazy(() => import('./components/inbox/InboxView').then(m => ({ default: m.InboxView })));
const TasksView = React.lazy(() => import('./components/tasks/TasksView').then(m => ({ default: m.TasksView })));
const RemindersView = React.lazy(() => import('./components/reminders/RemindersView').then(m => ({ default: m.RemindersView })));
const NotesView = React.lazy(() => import('./components/notes/NotesView').then(m => ({ default: m.NotesView })));
const MoneyView = React.lazy(() => import('./components/money/MoneyView').then(m => ({ default: m.MoneyView })));
const CalendarView = React.lazy(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const JournalView = React.lazy(() => import('./components/journal/JournalView').then(m => ({ default: m.JournalView })));
const PeopleView = React.lazy(() => import('./components/people/PeopleView').then(m => ({ default: m.PeopleView })));
const ListsView = React.lazy(() => import('./components/lists/ListsView').then(m => ({ default: m.ListsView })));
const GoalsView = React.lazy(() => import('./components/goals/GoalsView').then(m => ({ default: m.GoalsView })));
const TrashView = React.lazy(() => import('./components/trash/TrashView').then(m => ({ default: m.TrashView })));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const OpenLoopsView = React.lazy(() => import('./components/loops/OpenLoopsView').then(m => ({ default: m.OpenLoopsView })));

// Heavy Modals code-split
const GlobalSearchModal = React.lazy(() => import('./components/common/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })));
const VoiceRecorderModal = React.lazy(() => import('./components/common/VoiceRecorderModal').then(m => ({ default: m.VoiceRecorderModal })));

import { db, initializeDatabaseDefaults } from './db/db';
import { COMMON_CURRENCIES } from './utils/currency';
import { requestNotificationPermission, handleNotificationAction, refreshNextReminderTimer, checkMissedReminders } from './services/notificationService';
import { eventBus } from './services/eventBus';
import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityType } from './types';

export function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<EntityType>('task');
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  // Notification permission banner state
  const [notificationPermStatus, setNotificationPermStatus] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [isPermBannerDismissed, setIsPermBannerDismissed] = useState(false);

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setNotificationPermStatus(res);
  };

  const settings = useLiveQuery(() => db.settings.get('current_settings'));

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    initializeDatabaseDefaults();
    refreshNextReminderTimer();
    checkMissedReminders();
    const bootTimer = setTimeout(() => {
      setIsBooting(false);
    }, 700);
    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    if (settings?.theme) {
      setTheme(settings.theme);
      document.documentElement.setAttribute('data-theme', settings.theme);
      localStorage.setItem('theme', settings.theme);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [settings?.theme]);

  useEffect(() => {
    if (settings?.accentColor) {
      document.documentElement.setAttribute('data-accent', settings.accentColor);
    }
  }, [settings?.accentColor]);

  // Handle background notification actions sent from Service Worker (Section 37, 44)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NOTIFICATION_ACTION') {
          const { action, reminderId } = event.data;
          handleNotificationAction(action, reminderId);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, []);

  const handleToggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    if (settings) {
      await db.settings.update('current_settings', { theme: next });
    }
  };

  // Global Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Escape closes modals
      if (e.key === 'Escape') {
        setIsQuickAddOpen(false);
        setIsSearchOpen(false);
        setIsVoiceOpen(false);
        setIsMoreSheetOpen(false);
        return;
      }

      if (isInputActive) return;

      // Cmd+K or Ctrl+K or / opens Search
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // 'c' or '+' opens Quick Add
      if (e.key === 'c' || e.key === '+') {
        e.preventDefault();
        openQuickAddWithType('task');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openQuickAddWithType = (type: EntityType = 'task', date?: string) => {
    setQuickAddType(type);
    setQuickAddDate(date);
    setIsQuickAddOpen(true);
  };

  const renderActiveView = () => {
    let content: React.ReactNode;
    switch (currentScreen) {
      case 'home':
        return <HomeView onNavigateTo={setCurrentScreen} onOpenQuickAdd={openQuickAddWithType} />;
      case 'inbox':
        content = <InboxView />;
        break;
      case 'tasks':
        content = <TasksView onOpenQuickAdd={openQuickAddWithType} />;
        break;
      case 'loops':
        content = <OpenLoopsView />;
        break;
      case 'reminders':
        content = <RemindersView onOpenQuickAdd={openQuickAddWithType} />;
        break;
      case 'notes':
        content = <NotesView onOpenQuickAdd={openQuickAddWithType} />;
        break;
      case 'money':
        content = <MoneyView onOpenQuickAdd={openQuickAddWithType} />;
        break;
      case 'calendar':
        content = <CalendarView onOpenQuickAdd={openQuickAddWithType} />;
        break;
      case 'journal':
        content = <JournalView />;
        break;
      case 'people':
        content = <PeopleView />;
        break;
      case 'lists':
        content = <ListsView />;
        break;
      case 'goals':
        content = <GoalsView />;
        break;
      case 'trash':
        content = <TrashView />;
        break;
      case 'settings':
        content = <SettingsView />;
        break;
      default:
        return <HomeView onNavigateTo={setCurrentScreen} onOpenQuickAdd={openQuickAddWithType} />;
    }

    return (
      <React.Suspense fallback={<ViewSkeleton />}>
        {content}
      </React.Suspense>
    );
  };

  if (settings === undefined || isBooting) {
    return <AppBootLoader />;
  }

  // First-launch personalization: if no display name exists, show minimal full-screen onboarding view
  const needsNameSetup = !settings?.displayName?.trim();

  if (needsNameSetup) {
    return (
      <NameOnboardingModal
        onComplete={() => {
          setCurrentScreen('home');
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Desktop Sidebar (visible >= 768px) */}
      <DesktopSidebar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        onOpenQuickAdd={() => openQuickAddWithType('task')}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          currentScreen={currentScreen}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onOpenSettings={() => setCurrentScreen('settings')}
          onOpenMenu={() => setIsMoreSheetOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Polite Notification Permission Banner if not enabled */}
        {notificationPermStatus === 'default' && !isPermBannerDismissed && (
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={15} color="var(--accent)" />
              <span>Enable notifications for timely reminders & event alerts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleEnableNotifications}
                className="btn btn-sm btn-primary"
                style={{ padding: '3px 10px', fontSize: '12px' }}
              >
                Enable
              </button>
              <button
                onClick={() => setIsPermBannerDismissed(true)}
                className="btn-ghost"
                style={{ padding: '2px', color: 'var(--text-muted)' }}
                aria-label="Dismiss banner"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <main style={{ flex: 1, minWidth: 0 }}>
          {renderActiveView()}
        </main>

        {/* Mobile Bottom Navigation (visible < 768px) */}
        <BottomNav
          currentScreen={currentScreen}
          onSelectScreen={setCurrentScreen}
          onOpenMoreSheet={() => setIsMoreSheetOpen(true)}
        />

        {/* Persistent Floating Quick Add Button */}
        <button
          onClick={() => setIsFloatingMenuOpen(!isFloatingMenuOpen)}
          className="fab-quick-add"
          aria-label="Quick capture"
          title="Quick Capture (+)"
        >
          <Plus
            size={26}
            strokeWidth={2.5}
            style={{
              transform: isFloatingMenuOpen ? 'rotate(45deg)' : 'none',
              transition: 'transform 0.16s ease'
            }}
          />
        </button>
      </div>

      {/* Floating Speed-Dial Capture Menu */}
      <FloatingActionMenu
        isOpen={isFloatingMenuOpen}
        onClose={() => setIsFloatingMenuOpen(false)}
        onSelectType={(type) => openQuickAddWithType(type)}
      />

      {/* In-App Reminder Alert System */}
      <InAppReminderAlert />

      {/* Global Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        defaultType={quickAddType}
        defaultDate={quickAddDate}
      />

      <React.Suspense fallback={null}>
        {isSearchOpen && (
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onNavigateTo={setCurrentScreen}
          />
        )}
      </React.Suspense>

      <React.Suspense fallback={null}>
        {isVoiceOpen && (
          <VoiceRecorderModal
            isOpen={isVoiceOpen}
            onClose={() => setIsVoiceOpen(false)}
          />
        )}
      </React.Suspense>

      <MoreSheetModal
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        onSelectScreen={setCurrentScreen}
        currentScreen={currentScreen}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
