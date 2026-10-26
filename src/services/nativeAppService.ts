import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { triggerHaptic } from '../utils/haptics';
import { refreshNextReminderTimer } from './notificationService';

export interface BackButtonRegistry {
  hasOpenModal: () => boolean;
  closeActiveModal: () => boolean;
  canNavigateBack: () => boolean;
  navigateBack: () => void;
}

let activeRegistry: BackButtonRegistry | null = null;

export function registerBackButtonHandler(registry: BackButtonRegistry) {
  activeRegistry = registry;
}

export function unregisterBackButtonHandler() {
  activeRegistry = null;
}

/**
 * Initialize all native Android / Capacitor system features
 */
export async function initializeNativeApp(isDarkMode: boolean = false): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Configure Status Bar for Android
    await updateNativeStatusBar(isDarkMode);

    // 2. Hide splash screen smoothly
    await SplashScreen.hide();

    // 3. Register native Android Hardware Back Button listener
    App.addListener('backButton', ({ canGoBack }) => {
      triggerHaptic('light');

      // First priority: Close any open modal or bottom sheet
      if (activeRegistry && activeRegistry.hasOpenModal()) {
        const closed = activeRegistry.closeActiveModal();
        if (closed) return;
      }

      // Second priority: Navigate back to Home screen if on another view
      if (activeRegistry && activeRegistry.canNavigateBack()) {
        activeRegistry.navigateBack();
        return;
      }

      // Third priority: Standard browser history back or minimize app
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // 4. App state lifecycle: refresh reminders when app resumes from background
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        refreshNextReminderTimer();
      }
    });
  } catch (err) {
    console.warn('Native App initialization notice:', err);
  }
}

/**
 * Update Android status bar theme color and icon contrast dynamically
 */
export async function updateNativeStatusBar(isDarkMode: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (isDarkMode) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#09090b' });
    } else {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch (err) {
    console.warn('Status bar update notice:', err);
  }
}
