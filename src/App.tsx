import React, { useState, useEffect } from 'react';
import { Plus, Shield, Bell, Check } from 'lucide-react';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { DesktopSidebar } from './components/common/DesktopSidebar';
import { QuickAddModal } from './components/common/QuickAddModal';
import { MoreSheetModal } from './components/common/MoreSheetModal';
import { ToastProvider } from './components/common/ToastContext';
import { AppBootLoader } from './components/common/AppBootLoader';
import { ViewSkeleton } from './components/common/ViewSkeleton';
import { ErrorBoundary } from './components/common/ErrorBoundary';

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
import { requestNotificationPermission, handleNotificationAction } from './services/notificationService';
import { eventBus } from './services/eventBus';
import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityType } from './types';

export function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<EntityType>('task');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  const settings = useLiveQuery(() => db.settings.get('current_settings'));

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    initializeDatabaseDefaults();
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

  const openQuickAddWithType = (type: EntityType = 'task') => {
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  };

  const handleFinishOnboarding = async () => {
    if (settings) {
      await db.settings.update('current_settings', { isOnboarded: true });
    }
    setIsOnboardingDismissed(true);
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
        content = <CalendarView />;
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

  const showOnboarding = settings && !settings.isOnboarded && !isOnboardingDismissed;

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
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

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
          onClick={() => openQuickAddWithType('task')}
          className="fab-quick-add"
          aria-label="Quick capture"
          title="Quick Capture (+)"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>

      {/* Minimal First-Run Onboarding Modal */}
      {showOnboarding && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="bottom-sheet" style={{ maxWidth: '480px' }}>
            <div className="sheet-handle" />
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--text-primary)', color: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>
                K
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Kanso
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                A calm, private personal workspace. All data is kept locally on this device in IndexedDB.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Select Primary Currency
                </label>
                <select
                  value={settings?.currencyCode || 'INR'}
                  onChange={(e) => {
                    const sel = COMMON_CURRENCIES.find((c) => c.code === e.target.value);
                    if (sel) {
                      db.settings.update('current_settings', {
                        currencyCode: sel.code,
                        currencySymbol: sel.symbol
                      });
                    }
                  }}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => requestNotificationPermission()}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
                >
                  <Bell size={15} />
                  <span>Enable Local Notifications</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleFinishOnboarding}
              className="btn btn-primary"
              style={{ width: '100%', gap: '6px' }}
            >
              <Check size={18} />
              <span>Enter Personal Life OS</span>
            </button>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        defaultType={quickAddType}
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
