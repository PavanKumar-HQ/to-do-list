import { db } from '../db/db';

export interface StorageEstimateResult {
  usageBytes: number;
  quotaBytes: number;
  usagePercentage: number;
  isLowStorage: boolean;
  tableCounts: Record<string, number>;
  mediaSizeEstimateBytes: number;
}

export async function getStorageMetrics(): Promise<StorageEstimateResult> {
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }

  const [
    tasksCount,
    remindersCount,
    notesCount,
    ideasCount,
    expensesCount,
    journalCount,
    attachments,
    voiceNotes
  ] = await Promise.all([
    db.tasks.count(),
    db.reminders.count(),
    db.notes.count(),
    db.ideas.count(),
    db.expenses.count(),
    db.journalEntries.count(),
    db.attachments.toArray(),
    db.voiceNotes.toArray()
  ]);

  // Estimate media size
  let mediaSizeEstimateBytes = 0;
  attachments.forEach((a) => {
    mediaSizeEstimateBytes += a.sizeBytes || (a.dataBase64 ? a.dataBase64.length * 0.75 : 0);
  });
  voiceNotes.forEach((v) => {
    mediaSizeEstimateBytes += v.audioBase64 ? v.audioBase64.length * 0.75 : 0;
  });

  const usagePercentage = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;
  const remainingBytes = quotaBytes - usageBytes;
  const isLowStorage = usagePercentage > 85 || (quotaBytes > 0 && remainingBytes < 50 * 1024 * 1024);

  return {
    usageBytes,
    quotaBytes,
    usagePercentage,
    isLowStorage,
    tableCounts: {
      tasks: tasksCount,
      reminders: remindersCount,
      notes: notesCount,
      ideas: ideasCount,
      expenses: expensesCount,
      journal: journalCount,
      attachments: attachments.length,
      voiceNotes: voiceNotes.length
    },
    mediaSizeEstimateBytes
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
