import React, { useState, useEffect } from 'react';
import { Download, Bell, X, Check, Smartphone, Sparkles, Share2 } from 'lucide-react';
import { requestNotificationPermission, dispatchNativeNotification } from '../../services/notificationService';
import { triggerHaptic } from '../../utils/haptics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const AppInstallNotificationPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem('kanso_prompt_dismissed_v1') === 'true';
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed PWA)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice && !isStandaloneMode);

    // Check Notification status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    } else {
      setNotificationStatus('unsupported');
    }

    // Capture Chrome/Android/Desktop install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      (window as any).__kansoInstallPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__kansoInstallPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    triggerHaptic('light');
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!deferredPrompt) {
      // In some browsers or desktop, notify how to install
      alert('To install this app on your device, click the Install icon in your browser address bar or menu.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleEnableNotifications = async () => {
    triggerHaptic('medium');
    const result = await requestNotificationPermission();
    setNotificationStatus(result);
    if (result === 'granted') {
      dispatchNativeNotification(
        'welcome-notif',
        'Kanso Notifications Enabled',
        'You will now receive timely alerts for your tasks and reminders.'
      );
    }
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    setIsDismissed(true);
    localStorage.setItem('kanso_prompt_dismissed_v1', 'true');
  };

  // If already installed and notifications are granted/denied, or dismissed by user
  const needsNotification = notificationStatus === 'default';
  const needsInstall = !isInstalled;

  if (isDismissed || (!needsNotification && !needsInstall)) {
    return null;
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface-elevated, #18181b)',
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        padding: '10px 16px',
        color: 'var(--text-primary, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        zIndex: 40,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--accent-subtle, rgba(59, 130, 246, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={16} color="var(--accent, #3b82f6)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>
              {needsInstall && needsNotification
                ? 'Download App & Enable Notifications'
                : needsInstall
                ? 'Download Kanso App'
                : 'Turn On Reminder Notifications'}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #a1a1aa)' }}>
              {needsInstall
                ? 'Install on your home screen for full offline access & fast opening.'
                : 'Get timely alerts on this device even when the app is in the background.'}
            </span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="btn-ghost"
          style={{
            padding: '4px',
            color: 'var(--text-muted, #71717a)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '2px' }}>
        {needsInstall && (
          <button
            onClick={handleInstallClick}
            className="btn btn-sm btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Download size={14} />
            <span>Download / Install App</span>
          </button>
        )}

        {needsNotification && (
          <button
            onClick={handleEnableNotifications}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--bg-surface, rgba(255,255,255,0.08))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
              color: 'var(--text-primary, #ffffff)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Bell size={14} color="var(--accent, #3b82f6)" />
            <span>Allow Notifications</span>
          </button>
        )}
      </div>

      {showIOSInstructions && (
        <div
          style={{
            marginTop: '6px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'var(--bg-surface, rgba(255,255,255,0.05))',
            border: '1px dashed var(--border-subtle, rgba(255,255,255,0.2))',
            fontSize: '12px',
            color: 'var(--text-secondary, #d4d4d8)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Share2 size={16} color="var(--accent, #3b82f6)" />
          <span>
            Tap Safari's <strong>Share</strong> button (bottom bar) and select <strong>"Add to Home Screen"</strong>.
          </span>
          <button
            onClick={() => setShowIOSInstructions(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
