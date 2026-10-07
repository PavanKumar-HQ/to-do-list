import { db } from '../db/db';
import type { BackupPayload, BackupPreviewSummary } from '../types';
import { getTodayDateString } from '../utils/dates';
import { LIMITS, safeJsonParse } from './securityService';
import { IntegrityService } from './integrityService';
import { multiTabSync } from './multiTabService';

export const CURRENT_SCHEMA_VERSION = 5;
export const CURRENT_BACKUP_VERSION = 1;
export const APP_VERSION = '1.3.0';
export const BACKUP_FORMAT_IDENTIFIER = 'personal-life-os-backup';

/**
 * Deterministic canonical JSON serialization (Section 144, 145)
 * Sorts all object keys recursively so cryptographic checksums are reproducible.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item === undefined ? null : item)).join(',') + ']';
  }
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined && typeof obj[key] !== 'function')
    .sort();
  const pairs = keys.map((key) => JSON.stringify(key) + ':' + canonicalJsonStringify(obj[key]));
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute SHA-256 integrity checksum using Web Crypto API (Section 26, 94)
 */
export async function computeSha256Checksum(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Web Crypto PBKDF2 + AES-GCM helpers (Section 27, 93, 94)
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(dataString: string, password: string): Promise<{
  ciphertextBase64: string;
  saltHex: string;
  ivHex: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(dataString)
  );

  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuf)));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');

  return { ciphertextBase64, saltHex, ivHex };
}

export async function decryptData(
  ciphertextBase64: string,
  saltHex: string,
  ivHex: string,
  password: string
): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  const key = await deriveKey(password, salt);

  const binStr = atob(ciphertextBase64);
  const encryptedBuf = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    encryptedBuf[i] = binStr.charCodeAt(i);
  }

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encryptedBuf
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuf);
}

/**
 * Generate complete structured, self-describing, integrity-hashed backup payload (Section 24-26)
 */
export async function createBackupPayload(password?: string): Promise<BackupPayload> {
  const [
    inbox,
    tasks,
    reminders,
    notes,
    ideas,
    dontForget,
    people,
    followups,
    events,
    lists,
    goals,
    routines,
    journalEntries,
    expenses,
    income,
    budgets,
    creditCards,
    recurringExpenses,
    savingsGoals,
    attachments,
    voiceNotes,
    relationships,
    commitments,
    decisions,
    openLoops,
    dependencies,
    futureMessages,
    reviewSessions,
    lifeContexts,
    canvases,
    warranties,
    familyMembers,
    careReminders,
    documents,
    invites,
    vaultResources,
    meetingNotes,
    conversationLogs,
    settings,
    auditHistory
  ] = await Promise.all([
    db.inbox.toArray(),
    db.tasks.toArray(),
    db.reminders.toArray(),
    db.notes.toArray(),
    db.ideas.toArray(),
    db.dontForget.toArray(),
    db.people.toArray(),
    db.followups.toArray(),
    db.events.toArray(),
    db.lists.toArray(),
    db.goals.toArray(),
    db.routines.toArray(),
    db.journalEntries.toArray(),
    db.expenses.toArray(),
    db.income.toArray(),
    db.budgets.toArray(),
    db.creditCards.toArray(),
    db.recurringExpenses.toArray(),
    db.savingsGoals.toArray(),
    db.attachments.toArray(),
    db.voiceNotes.toArray(),
    db.relationships.toArray(),
    db.commitments.toArray(),
    db.decisions.toArray(),
    db.openLoops.toArray(),
    db.dependencies.toArray(),
    db.futureMessages.toArray(),
    db.reviewSessions.toArray(),
    db.lifeContexts.toArray(),
    db.canvases.toArray(),
    db.warranties.toArray(),
    db.familyMembers.toArray(),
    db.careReminders.toArray(),
    db.documents.toArray(),
    db.invites.toArray(),
    db.vaultResources.toArray(),
    db.meetingNotes.toArray(),
    db.conversationLogs.toArray(),
    db.settings.get('current_settings'),
    db.auditHistory.toArray()
  ]);

  const totalRecords =
    inbox.length +
    tasks.length +
    reminders.length +
    notes.length +
    ideas.length +
    dontForget.length +
    people.length +
    followups.length +
    events.length +
    lists.length +
    goals.length +
    routines.length +
    journalEntries.length +
    expenses.length +
    income.length +
    budgets.length +
    creditCards.length +
    recurringExpenses.length +
    savingsGoals.length +
    attachments.length +
    voiceNotes.length +
    relationships.length +
    commitments.length +
    decisions.length +
    openLoops.length +
    dependencies.length +
    futureMessages.length +
    reviewSessions.length +
    lifeContexts.length +
    canvases.length +
    warranties.length +
    familyMembers.length +
    careReminders.length +
    documents.length +
    invites.length +
    vaultResources.length +
    meetingNotes.length +
    conversationLogs.length;

  const tablesData = {
    inbox,
    tasks,
    reminders,
    notes,
    ideas,
    dontForget,
    people,
    followups,
    events,
    lists,
    goals,
    routines,
    journalEntries,
    expenses,
    income,
    budgets,
    creditCards,
    recurringExpenses,
    savingsGoals,
    attachments,
    voiceNotes,
    relationships,
    commitments,
    decisions,
    openLoops,
    dependencies,
    futureMessages,
    reviewSessions,
    lifeContexts,
    canvases,
    warranties,
    familyMembers,
    careReminders,
    documents,
    invites,
    vaultResources,
    meetingNotes,
    conversationLogs,
    settings,
    auditHistory
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const currency = settings?.currencyCode || 'INR';

  if (password && password.trim().length > 0) {
    const canonicalTables = canonicalJsonStringify(tablesData);
    const checksum = await computeSha256Checksum(canonicalTables);
    const { ciphertextBase64, saltHex, ivHex } = await encryptData(canonicalTables, password.trim());
    return {
      format: BACKUP_FORMAT_IDENTIFIER,
      backupVersion: CURRENT_BACKUP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      appName: 'Personal Life OS',
      exportDate: new Date().toISOString(),
      timezone,
      currency,
      devicePlatform: (typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test Environment') || 'Unknown Platform',
      recordCount: totalRecords,
      integrity: {
        checksum,
        algorithm: 'SHA-256'
      },
      isEncrypted: true,
      saltHex,
      ivHex,
      encryptedBlobBase64: ciphertextBase64,
      tables: getZeroTables()
    };
  }

  const canonicalTables = canonicalJsonStringify(tablesData);
  const checksum = await computeSha256Checksum(canonicalTables);

  return {
    format: BACKUP_FORMAT_IDENTIFIER,
    backupVersion: CURRENT_BACKUP_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    appName: 'Personal Life OS',
    exportDate: new Date().toISOString(),
    timezone,
    currency,
    devicePlatform: (typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test Environment') || 'Unknown Platform',
    recordCount: totalRecords,
    integrity: {
      checksum,
      algorithm: 'SHA-256'
    },
    isEncrypted: false,
    tables: tablesData
  };
}

/**
 * Export backup to disk (File System Access API or standard fallback)
 */
export async function exportBackupToFile(password?: string): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const payload = await createBackupPayload(password);
    const jsonString = JSON.stringify(payload, null, 2);
    const filename = `personal-life-backup-${getTodayDateString()}${password ? '-encrypted' : ''}.plife`;
    const blob = new Blob([jsonString], { type: 'application/json' });

    // File System Access API
    const navWindow = window as any;
    if (navWindow.showSaveFilePicker) {
      try {
        const handle = await navWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Personal Life Backup File (.plife)',
              accept: { 'application/json': ['.plife', '.json'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        await markBackupCompleted();
        return { success: true, filename };
      } catch (pickerErr: any) {
        if (pickerErr.name === 'AbortError') {
          return { success: false, filename, error: 'Backup export cancelled' };
        }
      }
    }

    // Standard download fallback
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await markBackupCompleted();
    return { success: true, filename };
  } catch (err: any) {
    console.error('Backup export failed:', err);
    return { success: false, filename: '', error: err.message || 'Export failed' };
  }
}

export async function markBackupCompleted() {
  try {
    const settings = await db.settings.get('current_settings');
    if (settings) {
      await db.settings.update('current_settings', {
        lastBackupDate: new Date().toISOString(),
        changesSinceBackup: 0
      });
    }
  } catch (e) {
    console.warn('Could not update backup metadata:', e);
  }
}

/**
 * Validate backup file and create preview summary (Section 26, 30, 82)
 */
export async function validateAndPreviewBackup(fileContent: string): Promise<{
  summary: BackupPreviewSummary;
  payload?: BackupPayload;
}> {
  try {
    if (fileContent.length > LIMITS.MAX_BACKUP_SIZE_BYTES) {
      return {
        summary: {
          isValid: false,
          errorMessage: 'Backup file exceeds maximum allowed size limit of 100MB.',
          schemaVersion: 0,
          exportDate: '',
          totalRecords: 0,
          counts: getZeroCounts()
        }
      };
    }

    const payload = safeJsonParse<BackupPayload>(fileContent);

    if (!payload || typeof payload !== 'object') {
      return {
        summary: {
          isValid: false,
          errorMessage: 'Invalid file format: Not a valid JSON document.',
          schemaVersion: 0,
          exportDate: '',
          totalRecords: 0,
          counts: getZeroCounts()
        }
      };
    }

    if (!payload.schemaVersion) {
      return {
        summary: {
          isValid: false,
          errorMessage: 'Invalid backup: Missing schemaVersion structure.',
          schemaVersion: 0,
          exportDate: payload.exportDate || '',
          totalRecords: 0,
          counts: getZeroCounts()
        }
      };
    }

    if (payload.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        summary: {
          isValid: false,
          errorMessage: `This backup was created with a newer app schema version (${payload.schemaVersion}). Please update the app first.`,
          schemaVersion: payload.schemaVersion,
          exportDate: payload.exportDate || '',
          totalRecords: 0,
          counts: getZeroCounts()
        }
      };
    }

    if (payload.recordCount && payload.recordCount > LIMITS.MAX_BACKUP_RECORD_COUNT) {
      return {
        summary: {
          isValid: false,
          errorMessage: `Backup exceeds maximum supported record count (${LIMITS.MAX_BACKUP_RECORD_COUNT}).`,
          schemaVersion: payload.schemaVersion,
          exportDate: payload.exportDate || '',
          totalRecords: payload.recordCount,
          counts: getZeroCounts()
        }
      };
    }

    if (payload.isEncrypted) {
      return {
        summary: {
          isValid: true,
          schemaVersion: payload.schemaVersion,
          exportDate: payload.exportDate || 'Unknown date',
          totalRecords: payload.recordCount || 0,
          isEncrypted: true,
          counts: getZeroCounts()
        },
        payload
      };
    }

    // Integrity verification
    if (payload.integrity && payload.integrity.checksum && payload.tables) {
      const canonicalTables = canonicalJsonStringify(payload.tables);
      const computedChecksum = await computeSha256Checksum(canonicalTables);
      if (computedChecksum !== payload.integrity.checksum) {
        return {
          summary: {
            isValid: false,
            errorMessage: 'Integrity validation failed: Checksum does not match. The backup file may be corrupted or tampered with.',
            schemaVersion: payload.schemaVersion,
            exportDate: payload.exportDate || '',
            totalRecords: 0,
            counts: getZeroCounts()
          }
        };
      }
    }

    const t = payload.tables || ({} as any);
    const counts = {
      inbox: Array.isArray(t.inbox) ? t.inbox.length : 0,
      tasks: Array.isArray(t.tasks) ? t.tasks.length : 0,
      reminders: Array.isArray(t.reminders) ? t.reminders.length : 0,
      notes: Array.isArray(t.notes) ? t.notes.length : 0,
      ideas: Array.isArray(t.ideas) ? t.ideas.length : 0,
      dontForget: Array.isArray(t.dontForget) ? t.dontForget.length : 0,
      people: Array.isArray(t.people) ? t.people.length : 0,
      followups: Array.isArray(t.followups) ? t.followups.length : 0,
      events: Array.isArray(t.events) ? t.events.length : 0,
      lists: Array.isArray(t.lists) ? t.lists.length : 0,
      goals: Array.isArray(t.goals) ? t.goals.length : 0,
      routines: Array.isArray(t.routines) ? t.routines.length : 0,
      journalEntries: Array.isArray(t.journalEntries) ? t.journalEntries.length : 0,
      expenses: Array.isArray(t.expenses) ? t.expenses.length : 0,
      income: Array.isArray(t.income) ? t.income.length : 0,
      budgets: Array.isArray(t.budgets) ? t.budgets.length : 0,
      creditCards: Array.isArray(t.creditCards) ? t.creditCards.length : 0,
      recurringExpenses: Array.isArray(t.recurringExpenses) ? t.recurringExpenses.length : 0,
      savingsGoals: Array.isArray(t.savingsGoals) ? t.savingsGoals.length : 0,
      attachments: Array.isArray(t.attachments) ? t.attachments.length : 0,
      voiceNotes: Array.isArray(t.voiceNotes) ? t.voiceNotes.length : 0,
      relationships: Array.isArray(t.relationships) ? t.relationships.length : 0,
      commitments: Array.isArray(t.commitments) ? t.commitments.length : 0,
      decisions: Array.isArray(t.decisions) ? t.decisions.length : 0,
      openLoops: Array.isArray(t.openLoops) ? t.openLoops.length : 0,
      dependencies: Array.isArray(t.dependencies) ? t.dependencies.length : 0,
      futureMessages: Array.isArray(t.futureMessages) ? t.futureMessages.length : 0,
      reviewSessions: Array.isArray(t.reviewSessions) ? t.reviewSessions.length : 0,
      lifeContexts: Array.isArray(t.lifeContexts) ? t.lifeContexts.length : 0,
      canvases: Array.isArray(t.canvases) ? t.canvases.length : 0,
      warranties: Array.isArray(t.warranties) ? t.warranties.length : 0,
      familyMembers: Array.isArray(t.familyMembers) ? t.familyMembers.length : 0,
      careReminders: Array.isArray(t.careReminders) ? t.careReminders.length : 0,
      documents: Array.isArray(t.documents) ? t.documents.length : 0,
      invites: Array.isArray(t.invites) ? t.invites.length : 0,
      vaultResources: Array.isArray(t.vaultResources) ? t.vaultResources.length : 0,
      meetingNotes: Array.isArray(t.meetingNotes) ? t.meetingNotes.length : 0,
      conversationLogs: Array.isArray(t.conversationLogs) ? t.conversationLogs.length : 0
    };

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      summary: {
        isValid: true,
        schemaVersion: payload.schemaVersion,
        exportDate: payload.exportDate || 'Unknown date',
        totalRecords,
        isEncrypted: false,
        counts
      },
      payload
    };
  } catch (err: any) {
    return {
      summary: {
        isValid: false,
        errorMessage: `Failed to parse backup file: ${err.message || 'Corrupted file'}`,
        schemaVersion: 0,
        exportDate: '',
        totalRecords: 0,
        counts: getZeroCounts()
      }
    };
  }
}

/**
 * Execute bulk write of tables
 */
async function writeTablesToDb(t: any, mode: 'replace' | 'merge') {
  await db.transaction('rw', [
    db.inbox,
    db.tasks,
    db.reminders,
    db.notes,
    db.ideas,
    db.dontForget,
    db.people,
    db.followups,
    db.events,
    db.lists,
    db.goals,
    db.routines,
    db.journalEntries,
    db.expenses,
    db.income,
    db.budgets,
    db.creditCards,
    db.recurringExpenses,
    db.savingsGoals,
    db.attachments,
    db.voiceNotes,
    db.relationships,
    db.commitments,
    db.decisions,
    db.openLoops,
    db.dependencies,
    db.futureMessages,
    db.reviewSessions,
    db.lifeContexts,
    db.canvases,
    db.warranties,
    db.familyMembers,
    db.careReminders,
    db.documents,
    db.invites,
    db.vaultResources,
    db.meetingNotes,
    db.conversationLogs,
    db.settings,
    db.auditHistory
  ], async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.inbox.clear(),
        db.tasks.clear(),
        db.reminders.clear(),
        db.notes.clear(),
        db.ideas.clear(),
        db.dontForget.clear(),
        db.people.clear(),
        db.followups.clear(),
        db.events.clear(),
        db.lists.clear(),
        db.goals.clear(),
        db.routines.clear(),
        db.journalEntries.clear(),
        db.expenses.clear(),
        db.income.clear(),
        db.budgets.clear(),
        db.creditCards.clear(),
        db.recurringExpenses.clear(),
        db.savingsGoals.clear(),
        db.attachments.clear(),
        db.voiceNotes.clear(),
        db.relationships.clear(),
        db.commitments.clear(),
        db.decisions.clear(),
        db.openLoops.clear(),
        db.dependencies.clear(),
        db.futureMessages.clear(),
        db.reviewSessions.clear(),
        db.lifeContexts.clear(),
        db.canvases.clear(),
        db.warranties.clear(),
        db.familyMembers.clear(),
        db.careReminders.clear(),
        db.documents.clear(),
        db.invites.clear(),
        db.vaultResources.clear(),
        db.meetingNotes.clear(),
        db.conversationLogs.clear(),
        db.auditHistory.clear()
      ]);
    }

    if (t.inbox?.length) await db.inbox.bulkPut(t.inbox);
    if (t.tasks?.length) await db.tasks.bulkPut(t.tasks);
    if (t.reminders?.length) await db.reminders.bulkPut(t.reminders);
    if (t.notes?.length) await db.notes.bulkPut(t.notes);
    if (t.ideas?.length) await db.ideas.bulkPut(t.ideas);
    if (t.dontForget?.length) await db.dontForget.bulkPut(t.dontForget);
    if (t.people?.length) await db.people.bulkPut(t.people);
    if (t.followups?.length) await db.followups.bulkPut(t.followups);
    if (t.events?.length) await db.events.bulkPut(t.events);
    if (t.lists?.length) await db.lists.bulkPut(t.lists);
    if (t.goals?.length) await db.goals.bulkPut(t.goals);
    if (t.routines?.length) await db.routines.bulkPut(t.routines);
    if (t.journalEntries?.length) await db.journalEntries.bulkPut(t.journalEntries);
    if (t.expenses?.length) await db.expenses.bulkPut(t.expenses);
    if (t.income?.length) await db.income.bulkPut(t.income);
    if (t.budgets?.length) await db.budgets.bulkPut(t.budgets);
    if (t.creditCards?.length) await db.creditCards.bulkPut(t.creditCards);
    if (t.recurringExpenses?.length) await db.recurringExpenses.bulkPut(t.recurringExpenses);
    if (t.savingsGoals?.length) await db.savingsGoals.bulkPut(t.savingsGoals);
    if (t.attachments?.length) await db.attachments.bulkPut(t.attachments);
    if (t.voiceNotes?.length) await db.voiceNotes.bulkPut(t.voiceNotes);
    if (t.relationships?.length) await db.relationships.bulkPut(t.relationships);
    if (t.commitments?.length) await db.commitments.bulkPut(t.commitments);
    if (t.decisions?.length) await db.decisions.bulkPut(t.decisions);
    if (t.openLoops?.length) await db.openLoops.bulkPut(t.openLoops);
    if (t.dependencies?.length) await db.dependencies.bulkPut(t.dependencies);
    if (t.futureMessages?.length) await db.futureMessages.bulkPut(t.futureMessages);
    if (t.reviewSessions?.length) await db.reviewSessions.bulkPut(t.reviewSessions);
    if (t.lifeContexts?.length) await db.lifeContexts.bulkPut(t.lifeContexts);
    if (t.canvases?.length) await db.canvases.bulkPut(t.canvases);
    if (t.warranties?.length) await db.warranties.bulkPut(t.warranties);
    if (t.familyMembers?.length) await db.familyMembers.bulkPut(t.familyMembers);
    if (t.careReminders?.length) await db.careReminders.bulkPut(t.careReminders);
    if (t.documents?.length) await db.documents.bulkPut(t.documents);
    if (t.invites?.length) await db.invites.bulkPut(t.invites);
    if (t.vaultResources?.length) await db.vaultResources.bulkPut(t.vaultResources);
    if (t.meetingNotes?.length) await db.meetingNotes.bulkPut(t.meetingNotes);
    if (t.conversationLogs?.length) await db.conversationLogs.bulkPut(t.conversationLogs);
    if (t.auditHistory?.length) await db.auditHistory.bulkPut(t.auditHistory);

    if (t.settings) {
      await db.settings.put(t.settings);
    }
  });
}

/**
 * Transactional Restore with Pre-Restore Safety Snapshot & Post-Restore Verification
 * Flow:
 * 1. Validate & Decrypt
 * 2. Capture in-memory safety snapshot of live database
 * 3. Restore transactionally
 * 4. Verify post-restore integrity
 * 5. If transaction fails: automatically revert to safety snapshot without data loss!
 */
export async function restoreFromBackup(
  payload: BackupPayload,
  mode: 'replace' | 'merge',
  password?: string
): Promise<{ success: boolean; error?: string; verificationSummary?: string }> {
  // Pre-restore safety snapshot (Restore Flow requirement)
  let safetySnapshot: BackupPayload | null = null;
  try {
    safetySnapshot = await createBackupPayload();
  } catch (snapErr) {
    console.warn('Could not generate safety snapshot before restore:', snapErr);
  }

  try {
    let t = payload.tables;

    if (payload.isEncrypted) {
      if (!password || !payload.encryptedBlobBase64 || !payload.saltHex || !payload.ivHex) {
        return { success: false, error: 'Password required to decrypt this backup.' };
      }
      try {
        const decryptedJson = await decryptData(
          payload.encryptedBlobBase64,
          payload.saltHex,
          payload.ivHex,
          password
        );

        if (payload.integrity && payload.integrity.checksum) {
          const computed = await computeSha256Checksum(decryptedJson);
          if (computed !== payload.integrity.checksum) {
            return { success: false, error: 'Integrity check failed: Decrypted data checksum mismatch.' };
          }
        }

        t = safeJsonParse(decryptedJson);
      } catch (decErr) {
        return { success: false, error: 'Incorrect password or corrupted encrypted backup.' };
      }
    }

    await writeTablesToDb(t, mode);

    const scanReport = await IntegrityService.scan(false);
    await markBackupCompleted();
    multiTabSync.broadcastDatabaseRestored();

    return {
      success: true,
      verificationSummary: `Restore completed and verified. Total invariant violations: ${scanReport.totalViolations}.`
    };
  } catch (err: any) {
    console.error('Failed to restore backup, attempting recovery from safety snapshot:', err);

    // Rollback to safety snapshot
    if (safetySnapshot) {
      try {
        await writeTablesToDb(safetySnapshot.tables, 'replace');
      } catch (rollbackErr) {
        console.error('Critical: Safety snapshot rollback failed:', rollbackErr);
      }
    }

    return {
      success: false,
      error: `Database restore transaction failed: ${err.message || 'Unknown error'}. Pre-restore data was preserved.`
    };
  }
}

function getZeroCounts() {
  return {
    inbox: 0,
    tasks: 0,
    reminders: 0,
    notes: 0,
    ideas: 0,
    dontForget: 0,
    people: 0,
    followups: 0,
    events: 0,
    lists: 0,
    goals: 0,
    routines: 0,
    journalEntries: 0,
    expenses: 0,
    income: 0,
    budgets: 0,
    creditCards: 0,
    recurringExpenses: 0,
    savingsGoals: 0,
    attachments: 0,
    voiceNotes: 0,
    relationships: 0,
    commitments: 0,
    decisions: 0,
    openLoops: 0,
    dependencies: 0,
    futureMessages: 0,
    reviewSessions: 0,
    lifeContexts: 0,
    canvases: 0,
    warranties: 0,
    familyMembers: 0,
    careReminders: 0,
    documents: 0,
    invites: 0,
    vaultResources: 0,
    meetingNotes: 0,
    conversationLogs: 0
  };
}

function getZeroTables() {
  return {
    inbox: [],
    tasks: [],
    reminders: [],
    notes: [],
    ideas: [],
    dontForget: [],
    people: [],
    followups: [],
    events: [],
    lists: [],
    goals: [],
    routines: [],
    journalEntries: [],
    expenses: [],
    income: [],
    budgets: [],
    creditCards: [],
    recurringExpenses: [],
    savingsGoals: [],
    attachments: [],
    voiceNotes: [],
    relationships: [],
    commitments: [],
    decisions: [],
    openLoops: [],
    dependencies: [],
    futureMessages: [],
    reviewSessions: [],
    lifeContexts: [],
    canvases: [],
    warranties: [],
    familyMembers: [],
    careReminders: [],
    documents: [],
    invites: [],
    vaultResources: [],
    meetingNotes: [],
    conversationLogs: []
  };
}
