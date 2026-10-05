import React, { useState, useEffect } from 'react';
import { Download, Bell, X, Sparkles, Share2, Monitor, Smartphone, HelpCircle, CheckCircle2 } from 'lucide-react';
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
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    isIOS: boolean;
    isMac: boolean;
    isAndroid: boolean;
    isWindows: boolean;
    browser: 'brave' | 'chrome' | 'safari' | 'edge' | 'firefox' | 'other';
  }>({
    isIOS: false,
    isMac: false,
    isAndroid: false,
    isWindows: false,
    browser: 'other'
  });

  useEffect(() => {
    // Check if running in standalone mode (already installed PWA)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandaloneMode);

    // Detect platform & browser
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isMacDevice = /macintosh|mac os x/.test(ua) && !isIOSDevice;
    const isAndroidDevice = /android/.test(ua);
    const isWindowsDevice = /windows/.test(ua);

    let detectedBrowser: 'brave' | 'chrome' | 'safari' | 'edge' | 'firefox' | 'other' = 'other';
    if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
      detectedBrowser = 'brave';
    } else if (ua.includes('edg/')) {
      detectedBrowser = 'edge';
    } else if (ua.includes('chrome') && !ua.includes('chromium')) {
      detectedBrowser = 'chrome';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      detectedBrowser = 'safari';
    } else if (ua.includes('firefox')) {
      detectedBrowser = 'firefox';
    }

    setDeviceInfo({
      isIOS: isIOSDevice,
      isMac: isMacDevice,
      isAndroid: isAndroidDevice,
      isWindows: isWindowsDevice,
      browser: detectedBrowser
    });

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
      setShowInstallModal(false);
    });

    // Also listen for custom event from Settings view or elsewhere
    const handleOpenGuide = () => {
      const activePrompt = (window as any).__kansoInstallPrompt || deferredPrompt;
      if (activePrompt) {
        activePrompt.prompt();
      } else {
        setShowInstallModal(true);
      }
    };
    window.addEventListener('kanso:open-install-guide', handleOpenGuide);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('kanso:open-install-guide', handleOpenGuide);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    triggerHaptic('light');
    const promptToUse = deferredPrompt || (window as any).__kansoInstallPrompt;
    if (promptToUse) {
      try {
        promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          (window as any).__kansoInstallPrompt = null;
          setShowInstallModal(false);
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    // If no programmatic prompt is available, open the visual instruction guide
    setShowInstallModal(true);
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

  const needsNotification = notificationStatus === 'default';
  const needsInstall = !isInstalled;

  return (
    <>
      {/* Top Banner */}
      {!isDismissed && (needsNotification || needsInstall) && (
        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            borderBottom: '1px solid var(--border-light, #e8e8e7)',
            padding: '10px 16px',
            color: 'var(--text-primary, #171717)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            zIndex: 40,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
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
                  background: 'var(--accent-light, rgba(13, 148, 136, 0.12))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Sparkles size={16} color="var(--accent, #0d9488)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary, #171717)' }}>
                  {needsInstall && needsNotification
                    ? 'Download App & Enable Notifications'
                    : needsInstall
                    ? 'Download Kanso App'
                    : 'Turn On Reminder Notifications'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #525252)' }}>
                  {needsInstall
                    ? 'Install to your home screen or dock for instant offline access.'
                    : 'Get timely alerts on this device even when the app is in the background.'}
                </span>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="btn-ghost"
              style={{
                padding: '4px',
                color: 'var(--text-muted, #737373)',
                borderRadius: '6px',
                cursor: 'pointer',
                background: 'none',
                border: 'none'
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
                className="btn btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'var(--text-primary, #171717)',
                  color: 'var(--bg-surface, #ffffff)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: 'var(--bg-subtle, #f4f4f3)',
                  border: '1px solid var(--border-light, #e8e8e7)',
                  color: 'var(--text-primary, #171717)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Bell size={14} color="var(--accent, #0d9488)" />
                <span>Allow Notifications</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Installation Instruction Modal */}
      {showInstallModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInstallModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface, #ffffff)',
              borderRadius: '20px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
              border: '1px solid var(--border-light, #e8e8e7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: 'var(--text-primary, #171717)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'var(--accent-light, rgba(13, 148, 136, 0.12))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Download size={22} color="var(--accent, #0d9488)" />
                </div>
                <div>
                  <h3 id="install-guide-title" style={{ fontSize: '17px', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
                    Install Kanso App
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary, #525252)', margin: '2px 0 0 0' }}>
                    Run directly from your Dock, Applications, or Home Screen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="btn-ghost"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px',
                  color: 'var(--text-muted, #737373)',
                  cursor: 'pointer',
                  borderRadius: '8px'
                }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Instruction Body based on Platform */}
            <div
              style={{
                background: 'var(--bg-subtle, #f4f4f3)',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid var(--border-light, #e8e8e7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {deviceInfo.isIOS ? (
                // iOS Safari Steps
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                    <Smartphone size={16} color="var(--accent, #0d9488)" />
                    <span>Instructions for iPhone & iPad (Safari)</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #525252)' }}>
                    <li>
                      Tap the <strong>Share</strong> button <Share2 size={13} style={{ display: 'inline', verticalAlign: '-1px' }} /> in the bottom toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>"Add to Home Screen"</strong>.
                    </li>
                    <li>
                      Tap <strong>"Add"</strong> in the top-right corner to finish.
                    </li>
                  </ol>
                </>
              ) : deviceInfo.isMac && deviceInfo.browser === 'safari' ? (
                // Mac Safari Steps
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                    <Monitor size={16} color="var(--accent, #0d9488)" />
                    <span>Instructions for Safari on macOS</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #525252)' }}>
                    <li>
                      Click <strong>File</strong> in the top Mac menu bar.
                    </li>
                    <li>
                      Select <strong>"Add to Dock..."</strong>.
                    </li>
                    <li>
                      Click <strong>"Add"</strong> to run Kanso as a standalone Mac desktop app.
                    </li>
                  </ol>
                </>
              ) : deviceInfo.isAndroid ? (
                // Android Steps
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                    <Smartphone size={16} color="var(--accent, #0d9488)" />
                    <span>Instructions for Android (Chrome / Brave)</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #525252)' }}>
                    <li>
                      Tap the <strong>Menu (⋮)</strong> in the top right corner.
                    </li>
                    <li>
                      Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </li>
                    <li>
                      Confirm to add the Kanso icon to your home screen.
                    </li>
                  </ol>
                </>
              ) : (
                // Chrome / Brave / Edge on Desktop (Mac / Windows / Linux)
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                    <Monitor size={16} color="var(--accent, #0d9488)" />
                    <span>Instructions for Brave / Chrome / Edge on Desktop</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #525252)' }}>
                    <li>
                      Look at the <strong>right side of your address / URL bar</strong> at the top of the browser.
                    </li>
                    <li>
                      Click the <strong>Install</strong> icon (computer screen with down arrow 🖥️ ⬇️).
                    </li>
                    <li>
                      Click <strong>"Install"</strong> to add Kanso directly to your Mac Applications or Windows Start Menu.
                    </li>
                    <li style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted, #737373)' }}>
                      Alternatively, click the browser menu (⋮) ➔ <strong>"Install Kanso..."</strong>.
                    </li>
                  </ol>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              {(deferredPrompt || (window as any).__kansoInstallPrompt) && (
                <button
                  onClick={async () => {
                    const prompt = deferredPrompt || (window as any).__kansoInstallPrompt;
                    if (prompt) {
                      prompt.prompt();
                      const { outcome } = await prompt.userChoice;
                      if (outcome === 'accepted') {
                        setIsInstalled(true);
                        setShowInstallModal(false);
                      }
                    }
                  }}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600
                  }}
                >
                  <Download size={14} />
                  <span>Install Prompt</span>
                </button>
              )}
              <button
                onClick={() => setShowInstallModal(false)}
                className="btn btn-sm"
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  background: 'var(--bg-subtle, #f4f4f3)',
                  border: '1px solid var(--border-light, #e8e8e7)',
                  color: 'var(--text-primary, #171717)',
                  cursor: 'pointer'
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
