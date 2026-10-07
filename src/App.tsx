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
import { AppInstallNotificationPrompt } from './components/common/AppInstallNotificationPrompt';
import { applyAccentToDocument } from './utils/theme';
import { lazyRetry } from './utils/lazyRetry';

// Core HomeView is loaded eagerly for instant first paint
import { HomeView } from './components/home/HomeView';

// Secondary views are code-split with automatic deployment chunk retry
const InboxView = lazyRetry(() => import('./components/inbox/InboxView').then(m => ({ default: m.InboxView })), 'InboxView');
const TasksView = lazyRetry(() => import('./components/tasks/TasksView').then(m => ({ default: m.TasksView })), 'TasksView');
const RemindersView = lazyRetry(() => import('./components/reminders/RemindersView').then(m => ({ default: m.RemindersView })), 'RemindersView');
const NotesView = lazyRetry(() => import('./components/notes/NotesView').then(m => ({ default: m.NotesView })), 'NotesView');
const MoneyView = lazyRetry(() => import('./components/money/MoneyView').then(m => ({ default: m.MoneyView })), 'MoneyView');
const CalendarView = lazyRetry(() => import('./components/calendar/CalendarView').then(m => ({ default: m.CalendarView })), 'CalendarView');
const JournalView = lazyRetry(() => import('./components/journal/JournalView').then(m => ({ default: m.JournalView })), 'JournalView');
const PeopleView = lazyRetry(() => import('./components/people/PeopleView').then(m => ({ default: m.PeopleView })), 'PeopleView');
const ListsView = lazyRetry(() => import('./components/lists/ListsView').then(m => ({ default: m.ListsView })), 'ListsView');
const GoalsView = lazyRetry(() => import('./components/goals/GoalsView').then(m => ({ default: m.GoalsView })), 'GoalsView');
const TrashView = lazyRetry(() => import('./components/trash/TrashView').then(m => ({ default: m.TrashView })), 'TrashView');
const SettingsView = lazyRetry(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })), 'SettingsView');
const OpenLoopsView = lazyRetry(() => import('./components/loops/OpenLoopsView').then(m => ({ default: m.OpenLoopsView })), 'OpenLoopsView');
const CanvasView = lazyRetry(() => import('./components/canvas/CanvasView').then(m => ({ default: m.CanvasView })), 'CanvasView');
const FamilyView = lazyRetry(() => import('./components/family/FamilyView').then(m => ({ default: m.FamilyView })), 'FamilyView');
const DocumentsView = lazyRetry(() => import('./components/documents/DocumentsView').then(m => ({ default: m.DocumentsView })), 'DocumentsView');
const VaultView = lazyRetry(() => import('./components/vault/VaultView').then(m => ({ default: m.VaultView })), 'VaultView');

// Heavy Modals code-split
const GlobalSearchModal = lazyRetry(() => import('./components/common/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })), 'GlobalSearchModal');
const VoiceRecorderModal = lazyRetry(() => import('./components/common/VoiceRecorderModal').then(m => ({ default: m.VoiceRecorderModal })), 'VoiceRecorderModal');
const InviteModal = lazyRetry(() => import('./components/common/InviteModal').then(m => ({ default: m.InviteModal })), 'InviteModal');

import { InviteLandingModal } from './components/common/InviteLandingModal';
import { db, initializeDatabaseDefaults } from './db/db';
import { COMMON_CURRENCIES } from './utils/currency';
import {
  requestNotificationPermission,
  handleNotificationAction,
  refreshNextReminderTimer,
  checkMissedReminders,
  checkUpcomingTasksAndNotify
} from './services/notificationService';
import { useToast } from './components/common/ToastContext';
import { checkForAppUpdateOnBoot, registerServiceWorkerUpdateListener, APP_VERSION } from './services/updateService';
import { eventBus } from './services/eventBus';
import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityType } from './types';

export function AppContent() {
  const { showToast } = useToast();
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<EntityType>('task');
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [recipientInviteToken, setRecipientInviteToken] = useState<string | null>(null);
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

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    initializeDatabaseDefaults();
    refreshNextReminderTimer();
    checkMissedReminders();
    checkUpcomingTasksAndNotify();

    // Check for App Updates and alert user
    checkForAppUpdateOnBoot((version) => {
      showToast(`🎉 App updated to v${version} with the latest features!`, { type: 'success' });
    });

    registerServiceWorkerUpdateListener(() => {
      showToast('✨ New version available!', {
        type: 'info',
        actionLabel: 'Refresh',
        onAction: () => {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((reg) => {
              reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
            });
          }
          window.location.reload();
        }
      });
    });

    // Force light theme
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    const bootTimer = setTimeout(() => {
      setIsBooting(false);
    }, 200);
    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    const activeTheme = settings?.theme === 'dark' ? 'dark' : 'light';
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [settings?.theme]);

  useEffect(() => {
    applyAccentToDocument(settings?.accentColor);
  }, [settings?.accentColor]);

  // Detect and process invite tokens from URL hash (#invite=...) or query params (?invite=...)
  useEffect(() => {
    const parseInviteToken = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      let token: string | null = null;
      if (hash.includes('invite=')) {
        const match = hash.match(/invite=([^&]+)/);
        if (match && match[1]) token = match[1];
      } else if (search.includes('invite=')) {
        const params = new URLSearchParams(search);
        token = params.get('invite');
      }

      if (token) {
        setRecipientInviteToken(token);
      }
    };

    parseInviteToken();
    window.addEventListener('hashchange', parseInviteToken);
    return () => window.removeEventListener('hashchange', parseInviteToken);
  }, []);

  const handleAcceptInvite = () => {
    setRecipientInviteToken(null);
    if (typeof window !== 'undefined' && window.history) {
      const cleanUrl = window.location.href.split('#')[0].split('?')[0];
      window.history.replaceState(null, '', cleanUrl);
    }
  };

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
      case 'canvas':
        content = <CanvasView />;
        break;
      case 'family':
        content = <FamilyView />;
        break;
      case 'documents':
        content = <DocumentsView />;
        break;
      case 'vault':
        content = <VaultView />;
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
        onOpenInvite={() => setIsInviteOpen(true)}
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

        {/* PWA Download / Install App and Notification Permission Prompt */}
        <AppInstallNotificationPrompt />

        <main style={{ flex: 1, minWidth: 0 }}>
          {renderActiveView()}
        </main>

        {/* Mobile Bottom Navigation (visible < 768px) */}
        <BottomNav
          currentScreen={currentScreen}
          onSelectScreen={setCurrentScreen}
          onOpenMoreSheet={() => setIsMoreSheetOpen(true)}
        />

        {/* Persistent Floating Quick Add Button - Directly opens Task Creation */}
        <button
          onClick={() => openQuickAddWithType('task')}
          className="fab-quick-add"
          aria-label="Create new task"
          title="Create New Task (+)"
        >
          <Plus
            size={26}
            strokeWidth={2.5}
          />
        </button>
      </div>

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

      <React.Suspense fallback={null}>
        {isInviteOpen && (
          <InviteModal
            isOpen={isInviteOpen}
            onClose={() => setIsInviteOpen(false)}
          />
        )}
      </React.Suspense>

      <MoreSheetModal
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        onSelectScreen={setCurrentScreen}
        onOpenInvite={() => setIsInviteOpen(true)}
        currentScreen={currentScreen}
      />

      {/* Recipient Onboarding & Preview Modal */}
      {recipientInviteToken && (
        <InviteLandingModal
          isOpen={!!recipientInviteToken}
          token={recipientInviteToken}
          onAccept={handleAcceptInvite}
          onDismiss={handleAcceptInvite}
        />
      )}
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
