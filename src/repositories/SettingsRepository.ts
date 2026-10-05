import { db } from '../db/db';
import type { AppSettings } from '../types';

export class SettingsRepository {
  private static readonly SETTINGS_ID = 'current_settings';

  /**
   * Retrieves the current application settings.
   */
  static async getSettings(): Promise<AppSettings> {
    const existing = await db.settings.get(this.SETTINGS_ID);
    if (existing) {
      return existing;
    }

    // Default fallback if database defaults haven't finished
    const defaultSettings: AppSettings = {
      id: this.SETTINGS_ID,
      currencySymbol: '₹',
      currencyCode: 'INR',
      weekStartsMonday: true,
      defaultScreen: 'home',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      budgetWarningThreshold: 90,
      backupReminderDays: 3,
      changesSinceBackup: 0,
      theme: 'light',
      isOnboarded: false
    };

    await db.settings.put(defaultSettings);
    return defaultSettings;
  }

  /**
   * Updates partial application settings.
   */
  static async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    return await db.transaction('rw', [db.settings], async () => {
      const current = await this.getSettings();
      const updated: AppSettings = {
        ...current,
        ...partial,
        id: this.SETTINGS_ID
      };
      await db.settings.put(updated);
      return updated;
    });
  }

  /**
   * Sets or updates the user's preferred display name.
   * Does NOT log the actual display name to audit logs or telemetry.
   */
  static async setDisplayName(displayName: string): Promise<AppSettings> {
    const nowIso = new Date().toISOString();
    return await db.transaction('rw', [db.settings], async () => {
      const current = await this.getSettings();
      const updated: AppSettings = {
        ...current,
        displayName,
        displayNameUpdatedAt: nowIso,
        isOnboarded: true,
        id: this.SETTINGS_ID
      };
      await db.settings.put(updated);
      return updated;
    });
  }
}
