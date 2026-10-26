import React, { useState, useEffect } from 'react';
import { Download, Bell, X, Sparkles, Share2, Monitor, Smartphone, ExternalLink, HelpCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { requestNotificationPermission, dispatchNativeNotification } from '../../services/notificationService';
import { triggerHaptic } from '../../utils/haptics';
import { getApkDownloadUrl, getGitHubRawApkUrl } from '../../utils/downloadUrls';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const AppInstallNotificationPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [showApkInstructions, setShowApkInstructions] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return (
      localStorage.getItem('saral_prompt_dismissed_v1') === 'true' ||
      localStorage.getItem('kanso_prompt_dismissed_v1') === 'true'
    );
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
      (window as any).__saralInstallPrompt = e;
      (window as any).__kansoInstallPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__saralInstallPrompt = null;
      (window as any).__kansoInstallPrompt = null;
      setShowInstallModal(false);
    });

    // Listen for custom event from Settings view or elsewhere
    const handleOpenGuide = () => {
      setShowInstallModal(true);
    };
    window.addEventListener('saral:open-install-guide', handleOpenGuide);
    window.addEventListener('saral:open-download-options', handleOpenGuide);
    window.addEventListener('kanso:open-install-guide', handleOpenGuide);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('saral:open-install-guide', handleOpenGuide);
      window.removeEventListener('saral:open-download-options', handleOpenGuide);
      window.removeEventListener('kanso:open-install-guide', handleOpenGuide);
    };
  }, [deferredPrompt]);

  const handleInstallClick = () => {
    triggerHaptic('light');
    // Open choice modal so the user can freely decide between Android APK and PWA
    setShowInstallModal(true);
  };

  const handleTriggerPwaPrompt = async () => {
    triggerHaptic('medium');
    const promptToUse =
      deferredPrompt ||
      (window as any).__saralInstallPrompt ||
      (window as any).__kansoInstallPrompt;
    if (promptToUse) {
      try {
        promptToUse.prompt();
        const { outcome } = await promptToUse.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          (window as any).__saralInstallPrompt = null;
          (window as any).__kansoInstallPrompt = null;
          setShowInstallModal(false);
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
  };

  const handleEnableNotifications = async () => {
    triggerHaptic('medium');
    const result = await requestNotificationPermission();
    setNotificationStatus(result);
    if (result === 'granted') {
      dispatchNativeNotification(
        'welcome-notif',
        'Saral Notifications Enabled',
        'You will now receive timely alerts for your tasks and reminders.'
      );
    }
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    setIsDismissed(true);
    localStorage.setItem('saral_prompt_dismissed_v1', 'true');
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
                    ? 'Download or Install Saral App'
                    : 'Turn On Reminder Notifications'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #525252)' }}>
                  {needsInstall
                    ? 'Choose between the native Android APK package or instant Home Screen PWA.'
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
                <span>Download / Install Options</span>
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

      {/* Download & Installation Options Modal */}
      {showInstallModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-light, #e8e8e7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              color: 'var(--text-primary, #171717)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--accent-light, rgba(13, 148, 136, 0.12))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Download size={22} color="var(--accent, #0d9488)" />
                </div>
                <div>
                  <h3 id="install-guide-title" style={{ fontSize: '18px', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
                    Download & Install Saral
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary, #525252)', margin: '2px 0 0 0' }}>
                    Choose how you would like to run Saral on your device
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

            {/* Option 1: Native Android APK */}
            <div
              style={{
                background: 'var(--bg-subtle, #f4f4f3)',
                borderRadius: '14px',
                padding: '16px',
                border: deviceInfo.isAndroid ? '1.5px solid var(--accent, #0d9488)' : '1px solid var(--border-light, #e8e8e7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--success, #10b981)'
                    }}
                  >
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      Android Native App (.apk)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #525252)' }}>
                      Standalone Android package • 8.3 MB
                    </div>
                  </div>
                </div>

                {deviceInfo.isAndroid && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'var(--accent-light, rgba(13, 148, 136, 0.15))',
                      color: 'var(--accent, #0d9488)',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}
                  >
                    Recommended for Android
                  </span>
                )}
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #525252)', margin: 0, lineHeight: 1.5 }}>
                Directly installable APK for Android phones and tablets. Pure native performance, full offline storage, and background notifications without browser address bars.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
                <a
                  href={getApkDownloadUrl()}
                  download="saral-life-os.apk"
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                  onClick={() => triggerHaptic('medium')}
                >
                  <Download size={14} />
                  <span>Download APK (8.3 MB)</span>
                </a>

                <a
                  href={getGitHubRawApkUrl()}
                  download="saral-life-os.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    background: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-light, #e8e8e7)',
                    color: 'var(--text-primary, #171717)'
                  }}
                  title="Direct download from GitHub mirror in case GitHub Pages is blocked"
                  onClick={() => triggerHaptic('light')}
                >
                  <ExternalLink size={13} />
                  <span>GitHub Mirror</span>
                </a>

                <button
                  onClick={() => setShowApkInstructions(!showApkInstructions)}
                  className="btn-ghost"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11.5px',
                    color: 'var(--accent, #0d9488)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    marginLeft: 'auto'
                  }}
                >
                  <HelpCircle size={13} />
                  <span>{showApkInstructions ? 'Hide instructions' : 'How to install?'}</span>
                  {showApkInstructions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Collapsible APK Installation Instructions */}
              {showApkInstructions && (
                <div
                  style={{
                    background: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-light, #e8e8e7)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #525252)',
                    lineHeight: 1.6,
                    marginTop: '4px'
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary, #171717)', marginBottom: '4px' }}>
                    Android Installation Steps:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '18px' }}>
                    <li>Tap <strong>Download APK</strong> above.</li>
                    <li>When the download completes, tap the notification or open your device's <strong>Files / Downloads</strong> app.</li>
                    <li>Tap <strong>saral-life-os.apk</strong>. If Android prompts <em>"For your security, your phone is not allowed to install unknown apps"</em>, tap <strong>Settings</strong> and switch <strong>"Allow from this source"</strong> to ON.</li>
                    <li>Tap <strong>Install</strong> to complete setup.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Option 2: Progressive Web App (PWA) */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent, #0d9488)'
                    }}
                  >
                    <Monitor size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      Progressive Web App (PWA)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary, #525252)' }}>
                      Zero download • Instant install to Home Screen or Dock
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--text-secondary, #525252)',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}
                >
                  0 MB Storage
                </span>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #525252)', margin: 0, lineHeight: 1.5 }}>
                Run Saral directly from your Home Screen or Desktop dock without downloading any APK binary. Stays automatically updated.
              </p>

              {(deferredPrompt || (window as any).__saralInstallPrompt || (window as any).__kansoInstallPrompt) ? (
                <div>
                  <button
                    onClick={handleTriggerPwaPrompt}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      background: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-light, #e8e8e7)',
                      color: 'var(--text-primary, #171717)'
                    }}
                  >
                    <Download size={14} />
                    <span>Install PWA to Home Screen</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-light, #e8e8e7)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: 'var(--text-secondary, #525252)',
                    lineHeight: 1.6
                  }}
                >
                  {deviceInfo.isIOS ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #171717)', marginBottom: '2px' }}>
                        iPhone & iPad (Safari):
                      </div>
                      <div>Tap the <strong>Share</strong> button <Share2 size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> in the bottom toolbar, scroll down, and tap <strong>"Add to Home Screen"</strong>.</div>
                    </div>
                  ) : deviceInfo.isMac && deviceInfo.browser === 'safari' ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #171717)', marginBottom: '2px' }}>
                        macOS (Safari):
                      </div>
                      <div>Click <strong>File</strong> in the top menu bar &gt; Select <strong>"Add to Dock..."</strong>.</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #171717)', marginBottom: '2px' }}>
                        Desktop / Browser:
                      </div>
                      <div>Look at the right side of your address / URL bar and click the <strong>Install</strong> icon (or browser Menu ⋮ &gt; <strong>Install Saral</strong>).</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setShowInstallModal(false)}
                className="btn btn-sm"
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  background: 'var(--bg-subtle, #f4f4f3)',
                  border: '1px solid var(--border-light, #e8e8e7)',
                  color: 'var(--text-primary, #171717)',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
