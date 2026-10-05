// Haptic feedback utility with graceful fallback for web/mobile browsers

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || !('navigator' in window)) return;

  try {
    // Check if user disabled haptics in settings or system
    const canVibrate = 'vibrate' in navigator && typeof navigator.vibrate === 'function';
    if (!canVibrate) return;

    switch (type) {
      case 'light':
      case 'selection':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'heavy':
      case 'error':
        navigator.vibrate([35, 30, 45]);
        break;
      case 'success':
        navigator.vibrate([15, 40, 20]);
        break;
      case 'warning':
        navigator.vibrate([25, 30, 25]);
        break;
      default:
        navigator.vibrate(12);
        break;
    }
  } catch {
    // Graceful fallback: vibration API failure should never throw
  }
}
