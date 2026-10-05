import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  History,
  Lock,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { db, checkAndRepairDatabaseIntegrity, type IntegrityReport } from '../../db/db';
import {
  exportBackupToFile,
  validateAndPreviewBackup,
  restoreFromBackup
} from '../../services/backupService';
import { getStorageMetrics, formatBytes, type StorageEstimateResult } from '../../services/storageService';
import { COMMON_CURRENCIES } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import type { BackupPreviewSummary, BackupPayload, AppSettings } from '../../types';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();

  const settings = useLiveQuery(async () => {
    return db.settings.get('current_settings');
  }, []);

  const auditLogs = useLiveQuery(async () => {
    return db.auditHistory.reverse().limit(25).toArray();
  }, []) || [];

  // Storage estimation state
  const [storageData, setStorageData] = useState<StorageEstimateResult | null>(null);

  // Backup Password State
  const [backupPassword, setBackupPassword] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Restore Modal State
  const [restoreFileSummary, setRestoreFileSummary] = useState<BackupPreviewSummary | null>(null);
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Integrity Check State
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [isScanningIntegrity, setIsScanningIntegrity] = useState(false);

  // Delete All Data Confirmation State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');

  useEffect(() => {
    getStorageMetrics().then(setStorageData);
  }, []);

  const handleExportBackup = async (password?: string) => {
    const res = await exportBackupToFile(password);
    if (res.success) {
      showToast(`Backup exported: ${res.filename}`, { type: 'success' });
      getStorageMetrics().then(setStorageData);
      setIsPasswordModalOpen(false);
      setBackupPassword('');
    } else {
      showToast(`Backup error: ${res.error}`, { type: 'error' });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const { summary, payload } = await validateAndPreviewBackup(content);
      if (summary.isValid && payload) {
        setRestoreFileSummary(summary);
        setRestorePayload(payload);
        setRestorePasswordInput('');
      } else {
        showToast(`Invalid backup file: ${summary.errorMessage}`, { type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeRestore = async () => {
    if (!restorePayload) return;
    setIsRestoring(true);
    try {
      const res = await restoreFromBackup(
        restorePayload,
        restoreMode,
        restorePayload.isEncrypted ? restorePasswordInput : undefined
      );
      if (res.success) {
        showToast('Data restored successfully into IndexedDB!', { type: 'success' });
        setRestoreFileSummary(null);
        setRestorePayload(null);
        setRestorePasswordInput('');
        getStorageMetrics().then(setStorageData);
      } else {
        showToast(`Restore failed: ${res.error}`, { type: 'error' });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRunIntegrityScan = async (repair: boolean = false) => {
    setIsScanningIntegrity(true);
    try {
      const report = await checkAndRepairDatabaseIntegrity(repair);
      setIntegrityReport(report);
      if (repair) {
        showToast(`Integrity check complete. Repaired ${report.repairedCount} issues.`, { type: 'success' });
      } else {
        showToast(report.isHealthy ? 'Database is healthy with no broken references.' : 'Found integrity discrepancies.');
      }
    } finally {
      setIsScanningIntegrity(false);
    }
  };

  const executeFullReset = async () => {
    if (resetConfirmationText !== 'DELETE') {
      showToast('Please type DELETE to confirm', { type: 'warning' });
      return;
    }

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
      db.auditHistory.clear()
    ]);

    showToast('All local application records have been erased.', { type: 'info' });
    setIsResetModalOpen(false);
    setResetConfirmationText('');
    getStorageMetrics().then(setStorageData);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    await db.settings.update('current_settings', { [key]: value });
    showToast('Setting updated');
  };

  const isBackupStale = React.useMemo(() => {
    if (!settings) return false;
    if ((settings.changesSinceBackup || 0) >= 15) return true;
    if (!settings.lastBackupDate) return (settings.changesSinceBackup || 0) > 0;
    const lastDate = new Date(settings.lastBackupDate);
    const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= (settings.backupReminderDays || 3);
  }, [settings]);

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Settings & Recovery</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Private offline system, portable backups, and device storage
        </p>
      </div>

      {/* Critical Backup & Recovery Card */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px', borderLeft: isBackupStale ? '4px solid var(--warning)' : '4px solid var(--success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {isBackupStale ? (
            <ShieldAlert size={20} color="var(--warning)" />
          ) : (
            <ShieldCheck size={20} color="var(--success)" />
          )}
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
            {isBackupStale ? 'Backup Recommended' : 'Data Safe & Versioned'}
          </h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
          Your data lives privately inside your device's IndexedDB. Because browsers may evict local data if you uninstall the app or under severe storage pressure, always export a versioned <strong>.plife</strong> backup file to your Files, Google Drive, or iCloud.
        </p>

        <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div>Last successful backup: <strong>{settings?.lastBackupDate ? formatDisplayDate(settings.lastBackupDate.slice(0, 10)) : 'Never'}</strong></div>
          <div style={{ marginTop: '2px' }}>Unsaved database changes: <strong>{settings?.changesSinceBackup || 0} modifications</strong></div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => handleExportBackup()} className="btn btn-primary" style={{ flex: 1, minWidth: '150px', gap: '6px' }}>
            <Download size={16} />
            <span>Export Backup</span>
          </button>

          <button onClick={() => setIsPasswordModalOpen(true)} className="btn btn-secondary" style={{ flex: 1, minWidth: '150px', gap: '6px' }}>
            <Lock size={16} />
            <span>Encrypted Backup</span>
          </button>

          <label className="btn btn-secondary" style={{ flex: 1, minWidth: '150px', gap: '6px', cursor: 'pointer', margin: 0 }}>
            <Upload size={16} />
            <span>Restore Backup</span>
            <input type="file" accept=".plife,.json" onChange={handleFileInputChange} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Device Storage Monitor */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <HardDrive size={18} color="var(--text-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Local Device Storage</h3>
        </div>

        {storageData ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span>Estimated Usage</span>
              <span style={{ fontWeight: 600 }}>
                {formatBytes(storageData.usageBytes)} of {formatBytes(storageData.quotaBytes)} ({storageData.usagePercentage}%)
              </span>
            </div>

            <div style={{ width: '100%', height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(storageData.usagePercentage, 100)}%`,
                  background: storageData.isLowStorage ? 'var(--danger)' : 'var(--accent)'
                }}
              />
            </div>

            {storageData.isLowStorage && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--danger)', marginBottom: '12px' }}>
                Your device storage is getting low. Export a backup to prevent automatic browser data eviction.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', fontSize: '12px' }}>
              <div style={{ background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'var(--text-muted)' }}>Tasks</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{storageData.tableCounts.tasks}</div>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'var(--text-muted)' }}>Expenses</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{storageData.tableCounts.expenses}</div>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'var(--text-muted)' }}>Notes</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{storageData.tableCounts.notes}</div>
              </div>
              <div style={{ background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ color: 'var(--text-muted)' }}>Journal</div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{storageData.tableCounts.journal}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Calculating storage metrics...</div>
        )}
      </div>

      {/* Database Integrity & Diagnostics */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Wrench size={18} color="var(--text-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Data Integrity & Diagnostics</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Scan your local IndexedDB tables for orphaned references, broken attachments, or conflicting foreign keys.
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleRunIntegrityScan(false)}
            className="btn btn-secondary btn-sm"
            disabled={isScanningIntegrity}
          >
            {isScanningIntegrity ? 'Scanning...' : 'Check Data Integrity'}
          </button>
          {integrityReport && !integrityReport.isHealthy && (
            <button
              onClick={() => handleRunIntegrityScan(true)}
              className="btn btn-primary btn-sm"
              disabled={isScanningIntegrity}
            >
              Repair Issues
            </button>
          )}
        </div>

        {integrityReport && (
          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
            <div>Status: <strong>{integrityReport.isHealthy ? 'Healthy' : 'Discrepancies found'}</strong></div>
            <div>Orphaned relationships: {integrityReport.orphanedRelationships}</div>
            <div>Broken attachment references: {integrityReport.brokenAttachmentRefs}</div>
            {integrityReport.repairedCount > 0 && <div>Repaired items: {integrityReport.repairedCount}</div>}
          </div>
        )}
      </div>

      {/* General Preferences */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
          Preferences
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Color Theme
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  updateSetting('theme', 'light');
                  document.documentElement.setAttribute('data-theme', 'light');
                  localStorage.setItem('theme', 'light');
                }}
                className={`btn btn-sm ${settings?.theme !== 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, gap: '6px' }}
              >
                <Sun size={15} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSetting('theme', 'dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                  localStorage.setItem('theme', 'dark');
                }}
                className={`btn btn-sm ${settings?.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, gap: '6px' }}
              >
                <Moon size={15} />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Accent Color (Section 12)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { name: 'blue', color: '#2563eb', label: 'Blue' },
                { name: 'indigo', color: '#4f46e5', label: 'Indigo' },
                { name: 'purple', color: '#7c3aed', label: 'Purple' },
                { name: 'violet', color: '#8b5cf6', label: 'Violet' },
                { name: 'green', color: '#059669', label: 'Green' },
                { name: 'teal', color: '#0d9488', label: 'Teal' },
                { name: 'orange', color: '#ea580c', label: 'Orange' },
                { name: 'red', color: '#dc2626', label: 'Red' },
                { name: 'rose', color: '#e11d48', label: 'Rose' },
                { name: 'slate', color: '#475569', label: 'Slate' }
              ].map((acc) => {
                const isSelected = (settings?.accentColor || 'blue') === acc.name;
                return (
                  <button
                    key={acc.name}
                    type="button"
                    onClick={() => {
                      updateSetting('accentColor', acc.name);
                      document.documentElement.setAttribute('data-accent', acc.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? acc.color : 'var(--border-strong)'}`,
                      background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 500,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: acc.color,
                        display: 'inline-block'
                      }}
                    />
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Currency
            </label>
            <select
              value={settings?.currencyCode || 'INR'}
              onChange={(e) => {
                const selected = COMMON_CURRENCIES.find((c) => c.code === e.target.value);
                if (selected) {
                  db.settings.update('current_settings', {
                    currencyCode: selected.code,
                    currencySymbol: selected.symbol
                  });
                }
              }}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Backup Reminder Frequency
            </label>
            <select
              value={settings?.backupReminderDays || 3}
              onChange={(e) => updateSetting('backupReminderDays', parseInt(e.target.value, 10))}
            >
              <option value={1}>Every 1 day</option>
              <option value={3}>Every 3 days (Recommended)</option>
              <option value={7}>Every week</option>
              <option value={0}>Manual only</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Quiet Hours</label>
              <input
                type="checkbox"
                checked={settings?.quietHoursEnabled || false}
                onChange={(e) => updateSetting('quietHoursEnabled', e.target.checked)}
                style={{ width: '20px', height: '20px' }}
              />
            </div>

            {settings?.quietHoursEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From</span>
                  <input
                    type="time"
                    value={settings?.quietHoursStart || '22:00'}
                    onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Until</span>
                  <input
                    type="time"
                    value={settings?.quietHoursEnd || '07:00'}
                    onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Overview Metrics</label>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  Display summary of closed follow-ups, kept promises, and completed tasks.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings?.momentumEnabled || false}
                onChange={(e) => updateSetting('momentumEnabled', e.target.checked)}
                style={{ width: '20px', height: '20px', flexShrink: 0, marginLeft: '12px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Destructive Reset Section */}
      <div className="card" style={{ padding: '18px', marginBottom: '16px', border: '1px solid var(--danger-border)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Permanently erase all local application records from this device's IndexedDB. Export a backup first to avoid unrecoverable loss.
        </p>
        <button
          onClick={() => {
            setIsResetModalOpen(true);
            setResetConfirmationText('');
          }}
          className="btn btn-danger btn-sm"
        >
          Delete All Local Data
        </button>
      </div>

      {/* Activity History */}
      <div className="card" style={{ padding: '18px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <History size={18} color="var(--text-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Activity History</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {auditLogs.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recorded activities yet.</div>
          ) : (
            auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{log.summary}</span>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Encrypted Export Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPasswordModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>
              Encrypt Backup Package
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Your backup will be encrypted using browser-native <strong>AES-GCM 256-bit</strong> with <strong>PBKDF2</strong>. You will need this password to restore the file.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Set Password
              </label>
              <input
                type="password"
                placeholder="Enter a secure passphrase"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsPasswordModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => handleExportBackup(backupPassword)}
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={!backupPassword.trim()}
              >
                Export Encrypted .plife
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreFileSummary && (
        <div className="modal-overlay" onClick={() => setRestoreFileSummary(null)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Restore Data Preview
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Review the contents of this backup package before proceeding.
            </p>

            {restoreFileSummary.isEncrypted && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Backup Password (Required)
                </label>
                <input
                  type="password"
                  placeholder="Enter the passphrase used during export"
                  value={restorePasswordInput}
                  onChange={(e) => setRestorePasswordInput(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Created: {new Date(restoreFileSummary.exportDate).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Total Records: <strong>{restoreFileSummary.totalRecords}</strong> (Schema v{restoreFileSummary.schemaVersion})
                {restoreFileSummary.isEncrypted && ' • Encrypted'}
              </div>

              {!restoreFileSummary.isEncrypted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '12px', fontSize: '12px' }}>
                  <div>• Inbox: {restoreFileSummary.counts.inbox}</div>
                  <div>• Tasks: {restoreFileSummary.counts.tasks}</div>
                  <div>• Notes: {restoreFileSummary.counts.notes}</div>
                  <div>• Expenses: {restoreFileSummary.counts.expenses}</div>
                  <div>• Reminders: {restoreFileSummary.counts.reminders}</div>
                  <div>• Journal: {restoreFileSummary.counts.journalEntries}</div>
                  <div>• People: {restoreFileSummary.counts.people}</div>
                </div>
              )}
            </div>

            {/* Restore Mode Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Restore Strategy
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`btn btn-sm ${restoreMode === 'replace' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px' }}
                >
                  Replace All Data
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`btn btn-sm ${restoreMode === 'merge' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px' }}
                >
                  Merge With Current
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {restoreMode === 'replace'
                  ? 'Cleans existing local tables and restores backup as the sole state.'
                  : 'Merges backup items into existing data without deleting current records.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRestoreFileSummary(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={isRestoring}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={isRestoring || (restoreFileSummary.isEncrypted && !restorePasswordInput.trim())}
              >
                {isRestoring ? 'Restoring Data...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Data Confirmation Modal */}
      {isResetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsResetModalOpen(false)} role="dialog" aria-modal="true">
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px' }}>
              Confirm Erase All Data
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              This will permanently delete all tasks, notes, journal entries, financial records, and attachments from your local device.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsResetModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={executeFullReset}
                className="btn btn-danger"
                style={{ flex: 2 }}
                disabled={resetConfirmationText !== 'DELETE'}
              >
                Erase Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
