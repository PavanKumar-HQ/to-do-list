// Haptic feedback utility with native Capacitor support and graceful web fallback
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export async function triggerHaptic(type: HapticType = 'light'): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (Capacitor.isNativePlatform()) {
      switch (type) {
        case 'light':
        case 'selection':
          await Haptics.impact({ style: ImpactStyle.Light });
          return;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          return;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          return;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          return;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          return;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          return;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
          return;
      }
    }
  } catch {
    // Fall back to web navigator.vibrate
  }

  // Web fallback
  try {
    if ('navigator' in window && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
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
    }
  } catch {
    // Graceful fallback
  }
}
