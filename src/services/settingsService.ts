import { SettingsRepository } from '../repositories/SettingsRepository';
import type { AppSettings } from '../types';

export class SettingsServiceError extends Error {
  public readonly userMessage: string;

  constructor(message: string, userMessage: string = message) {
    super(message);
    this.userMessage = userMessage;
    this.name = 'SettingsServiceError';
  }
}

export class SettingsService {
  public static readonly MAX_NAME_LENGTH = 50;

  /**
   * Sanitizes and validates a preferred display name.
   * Preserves full Unicode (accents, non-Latin scripts, emojis).
   */
  static validateDisplayName(rawName: string): { isValid: boolean; error?: string; cleanName: string } {
    if (!rawName) {
      return { isValid: false, error: 'Please enter your name.', cleanName: '' };
    }

    const cleanName = rawName.trim();
    if (!cleanName) {
      return { isValid: false, error: 'Please enter your name.', cleanName: '' };
    }

    // Check code point length (handles unicode/emoji without breaking surrogate pairs)
    const codePointLength = Array.from(cleanName).length;
    if (codePointLength > this.MAX_NAME_LENGTH) {
      return {
        isValid: false,
        error: `Name is too long (maximum ${this.MAX_NAME_LENGTH} characters).`,
        cleanName
      };
    }

    return { isValid: true, cleanName };
  }

  /**
   * Saves the user's preferred display name.
   * Throws SettingsServiceError on validation failure or database write failure.
   */
  static async saveDisplayName(rawName: string): Promise<AppSettings> {
    const validation = this.validateDisplayName(rawName);
    if (!validation.isValid) {
      throw new SettingsServiceError(validation.error || 'Invalid name', validation.error);
    }

    try {
      return await SettingsRepository.setDisplayName(validation.cleanName);
    } catch (err: any) {
      // Failed to write to IndexedDB (e.g. QuotaExceededError or private browsing limitation)
      throw new SettingsServiceError(
        `Failed to save display name: ${err?.message || err}`,
        "Couldn't save your name. Your data hasn't been changed."
      );
    }
  }

  /**
   * Retrieves the current user's display name if configured.
   */
  static async getDisplayName(): Promise<string | undefined> {
    try {
      const settings = await SettingsRepository.getSettings();
      return settings?.displayName?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Updates partial application settings.
   */
  static async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    try {
      return await SettingsRepository.updateSettings(partial);
    } catch (err: any) {
      throw new SettingsServiceError(
        `Failed to update settings: ${err?.message || err}`,
        'Could not update settings. Please try again.'
      );
    }
  }
}
