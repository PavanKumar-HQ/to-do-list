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
  Bell,
  Volume2,
  X,
  User,
  ChevronRight,
  ChevronLeft,
  Palette,
  Shield,
  Headphones,
  Info,
  Check,
  Edit2
} from 'lucide-react';
import { db, checkAndRepairDatabaseIntegrity, type IntegrityReport } from '../../db/db';
import {
  exportBackupToFile,
  validateAndPreviewBackup,
  restoreFromBackup
} from '../../services/backupService';
import { getStorageMetrics, formatBytes, type StorageEstimateResult } from '../../services/storageService';
import { requestNotificationPermission, dispatchTestNotification, playGentleChime } from '../../services/notificationService';
import { COMMON_CURRENCIES } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import { useToast } from '../common/ToastContext';
import { SettingsService, SettingsServiceError } from '../../services/settingsService';
import type { BackupPreviewSummary, BackupPayload, AppSettings } from '../../types';

type ActiveSettingsSection = 'overview' | 'appearance' | 'notifications' | 'backup' | 'privacy' | 'support' | 'about';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();

  const settings = useLiveQuery(async () => {
    return db.settings.get('current_settings');
  }, []);

  const auditLogs = useLiveQuery(async () => {
    return db.auditHistory.reverse().limit(25).toArray();
  }, []) || [];

  // Active section drill-down
  const [activeSection, setActiveSection] = useState<ActiveSettingsSection>('overview');

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

  // Notification Permission & Test State
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const handleRequestPerm = async () => {
    const res = await requestNotificationPermission();
    setNotificationPermission(res);
    if (res === 'granted') {
      showToast('Notification permission granted', { type: 'success' });
    } else if (res === 'denied') {
      showToast('Notifications blocked in browser settings', { type: 'warning' });
    }
  };

  const handleTestNotification = async () => {
    const res = await dispatchTestNotification();
    showToast(res.message, { type: res.success ? 'success' : 'info' });
  };

  // Display Name state
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [displayNameInitialized, setDisplayNameInitialized] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (settings?.displayName && !displayNameInitialized) {
      setDisplayNameInput(settings.displayName);
      setDisplayNameInitialized(true);
    }
  }, [settings?.displayName, displayNameInitialized]);

  const handleSaveDisplayName = async () => {
    setIsSavingName(true);
    try {
      await SettingsService.saveDisplayName(displayNameInput);
      setIsEditingName(false);
      showToast('Name updated successfully', { type: 'success' });
    } catch (err: any) {
      showToast(err instanceof SettingsServiceError ? err.userMessage : err.message, { type: 'error' });
    } finally {
      setIsSavingName(false);
    }
  };

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
        getStorageMetrics().then(setStorageData);
      } else {
        showToast(`Restore failed: ${res.error}`, { type: 'error' });
      }
    } catch (err: any) {
      showToast(`Restore exception: ${err?.message || 'Unknown error'}`, { type: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRunIntegrityScan = async (fix: boolean) => {
    setIsScanningIntegrity(true);
    try {
      const rep = await checkAndRepairDatabaseIntegrity(fix);
      setIntegrityReport(rep);
      if (rep.isHealthy) {
        showToast('Database integrity verified healthy! Zero orphaned records.', { type: 'success' });
      } else if (fix) {
        showToast(`Repaired ${rep.repairedCount} issues successfully.`, { type: 'success' });
      } else {
        showToast(`Found issues: ${rep.orphanedRelationships} orphaned relations. Click Repair to fix.`, { type: 'warning' });
      }
    } catch (err: any) {
      showToast(`Integrity check failed: ${err.message}`, { type: 'error' });
    } finally {
      setIsScanningIntegrity(false);
    }
  };

  const handleResetAllData = async () => {
    if (resetConfirmationText !== 'DELETE ALL DATA') {
      showToast('Please type DELETE ALL DATA to confirm.', { type: 'warning' });
      return;
    }

    await Promise.all([
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

  const currentTheme = settings?.theme || 'dark';
  const currentAccent = settings?.accentColor || '#14b8a6';
  const userName = settings?.displayName || 'Pavan';

  return (
    <div className="page-wrapper" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '90px' }}>
      {/* Header matching Image 3: < Settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeSection !== 'overview' && (
            <button
              onClick={() => setActiveSection('overview')}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', marginLeft: '-6px' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" />
            </button>
          )}
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {activeSection === 'overview' ? 'Settings' :
             activeSection === 'appearance' ? 'Appearance' :
             activeSection === 'notifications' ? 'Notifications' :
             activeSection === 'backup' ? 'Data & Backup' :
             activeSection === 'privacy' ? 'Privacy' :
             activeSection === 'support' ? 'Help & Support' : 'About'}
          </h2>
        </div>
      </div>

      {/* Profile Card matching Image 3 */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          borderRadius: '20px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <User size={28} color="var(--text-secondary)" />
        </div>

        <div style={{ flex: 1 }}>
          {isEditingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}
                autoFocus
              />
              <button
                onClick={handleSaveDisplayName}
                className="btn btn-sm btn-primary"
                disabled={isSavingName}
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {userName}
              </h3>
              <button
                onClick={() => setIsEditingName(true)}
                className="btn-ghost"
                style={{ padding: '2px', color: 'var(--text-tertiary)' }}
                title="Edit name"
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Personal Life OS
          </div>
        </div>
      </div>

      {/* 1. OVERVIEW: GROUPED LIST CARD MATCHING IMAGE 3 */}
      {activeSection === 'overview' && (
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '20px'
          }}
        >
          {/* Item 1: Appearance */}
          <div
            onClick={() => setActiveSection('appearance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(20, 184, 166, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)'
                }}
              >
                <Palette size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Appearance
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  {currentTheme === 'dark' ? 'Dark' : 'Light'} • Teal accent
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>

          {/* Item 2: Notifications */}
          <div
            onClick={() => setActiveSection('notifications')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8'
                }}
              >
                <Bell size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Notifications
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Reminders, payments, alerts
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>

          {/* Item 3: Data & Backup */}
          <div
            onClick={() => setActiveSection('backup')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(129, 140, 248, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}
              >
                <HardDrive size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Data & Backup
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Local • Auto backup
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>

          {/* Item 4: Privacy */}
          <div
            onClick={() => setActiveSection('privacy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981'
                }}
              >
                <Shield size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Privacy
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Local only
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>

          {/* Item 5: Help & Support */}
          <div
            onClick={() => setActiveSection('support')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b'
                }}
              >
                <Headphones size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Help & Support
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  FAQ • Feedback
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>

          {/* Item 6: About */}
          <div
            onClick={() => setActiveSection('about')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(168, 85, 247, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a855f7'
                }}
              >
                <Info size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  About
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Version 1.0.0
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>
        </div>
      )}

      {/* 2. SUBSECTION: APPEARANCE */}
      {activeSection === 'appearance' && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Theme & Display</h3>

          {/* Theme selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Color Theme
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => updateSetting('theme', 'dark')}
                className={`btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', gap: '8px' }}
              >
                <Moon size={16} />
                <span>Dark Mode</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('theme', 'light')}
                className={`btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', gap: '8px' }}
              >
                <Sun size={16} />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Accent Color Palette */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Accent Color
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { name: 'Teal', color: '#14b8a6' },
                { name: 'Sky', color: '#0ea5e9' },
                { name: 'Indigo', color: '#6366f1' },
                { name: 'Purple', color: '#a855f7' },
                { name: 'Rose', color: '#f43f5e' },
                { name: 'Emerald', color: '#10b981' }
              ].map((accent) => (
                <button
                  key={accent.color}
                  type="button"
                  onClick={() => updateSetting('accentColor', accent.color)}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: accent.color,
                    border: currentAccent === accent.color ? '3px solid #ffffff' : 'none',
                    boxShadow: currentAccent === accent.color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={accent.name}
                >
                  {currentAccent === accent.color && <Check size={16} color="#ffffff" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBSECTION: NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Browser & Audio Alerts</h3>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 10px',
                borderRadius: '12px',
                fontWeight: 600,
                background: notificationPermission === 'granted' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: notificationPermission === 'granted' ? 'var(--success)' : 'var(--warning)'
              }}
            >
              {notificationPermission === 'granted' ? 'Active' : 'Permission needed'}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
            Reminders and scheduled events notify you locally even when the tab is in the background. Audio tones ring on trigger.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {notificationPermission !== 'granted' && (
              <button onClick={handleRequestPerm} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                <Bell size={14} />
                <span>Enable Notifications</span>
              </button>
            )}
            <button onClick={handleTestNotification} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Bell size={14} />
              <span>Test System Alert</span>
            </button>
            <button
              onClick={() => {
                playGentleChime();
                showToast('Chime tested');
              }}
              className="btn btn-secondary btn-sm"
              style={{ gap: '6px' }}
            >
              <Volume2 size={14} />
              <span>Play Alarm Chime</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. SUBSECTION: DATA & BACKUP */}
      {activeSection === 'backup' && (
        <div>
          {/* Backup Action Card */}
          <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              {isBackupStale ? <ShieldAlert size={20} color="var(--warning)" /> : <ShieldCheck size={20} color="var(--success)" />}
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                {isBackupStale ? 'Backup Recommended' : 'Data Safe & Versioned'}
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
              Your database is 100% offline in IndexedDB. Export a standalone <strong>.plife</strong> backup file to your device or cloud folder for safekeeping.
            </p>

            <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Last backup: <strong>{settings?.lastBackupDate ? formatDisplayDate(settings.lastBackupDate.slice(0, 10)) : 'Never'}</strong></div>
              <div style={{ marginTop: '2px' }}>Unsaved modifications: <strong>{settings?.changesSinceBackup || 0} items</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => handleExportBackup()} className="btn btn-primary" style={{ flex: 1, minWidth: '140px', gap: '6px' }}>
                <Download size={16} />
                <span>Export Backup</span>
              </button>
              <button onClick={() => setIsPasswordModalOpen(true)} className="btn btn-secondary" style={{ flex: 1, minWidth: '140px', gap: '6px' }}>
                <Lock size={16} />
                <span>Encrypted Backup</span>
              </button>
              <label className="btn btn-secondary" style={{ flex: 1, minWidth: '140px', gap: '6px', cursor: 'pointer', margin: 0 }}>
                <Upload size={16} />
                <span>Restore Backup</span>
                <input type="file" accept=".plife,.json" onChange={handleFileInputChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Storage Breakdown */}
          {storageData && (
            <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Storage Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Tasks:</span> <strong>{storageData.tableCounts.tasks}</strong>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Expenses:</span> <strong>{storageData.tableCounts.expenses}</strong>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Notes:</span> <strong>{storageData.tableCounts.notes}</strong>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Journal:</span> <strong>{storageData.tableCounts.journal}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SUBSECTION: PRIVACY */}
      {activeSection === 'privacy' && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Local-First Privacy Architecture</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
            Life OS runs entirely inside your browser sandbox. No user data, analytics, tracking, or network telemetry leaves your device. All queries and relations are indexed inside IndexedDB.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Database Health & Diagnostics</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRunIntegrityScan(false)}
                className="btn btn-secondary btn-sm"
                disabled={isScanningIntegrity}
              >
                {isScanningIntegrity ? 'Scanning...' : 'Scan Database'}
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
              <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-surface)', borderRadius: '10px', fontSize: '12px' }}>
                <div>Status: <strong>{integrityReport.isHealthy ? 'Healthy' : 'Discrepancies found'}</strong></div>
                <div>Orphaned relationships: {integrityReport.orphanedRelationships}</div>
                <div>Broken attachment references: {integrityReport.brokenAttachmentRefs}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. SUBSECTION: HELP & SUPPORT */}
      {activeSection === 'support' && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Frequently Asked Questions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '3px' }}>
                How do I back up my data?
              </strong>
              Navigate to Settings &gt; Data &amp; Backup &gt; Export Backup. It creates an offline .plife file that you can save to iCloud, Google Drive, or local storage.
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '3px' }}>
                How do recurring reminders work?
              </strong>
              Recurring reminders compute next occurrences on the fly. Snoozing only updates the current occurrence's alarm without polluting the database with duplicate reminders.
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '3px' }}>
                Does Life OS work completely offline?
              </strong>
              Yes! Life OS is completely local-first. You can manage tasks, log expenses, schedule events, and view your calendar with zero internet connection.
            </div>
          </div>
        </div>
      )}

      {/* 7. SUBSECTION: ABOUT */}
      {activeSection === 'about' && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: 'var(--bg-surface-elevated)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Personal Life OS</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Version 1.0.0 (Production Build)
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
            Built for total cognitive clarity, private offline persistence, and seamless time &amp; financial tracking.
          </p>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
          >
            Reset All Application Data
          </button>
        </div>
      )}

      {/* Encrypted Backup Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPasswordModalOpen(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Export Encrypted Backup</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Set a passphrase to encrypt your backup file using AES-GCM.
            </p>
            <input
              type="password"
              placeholder="Passphrase"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              style={{ width: '100%', marginBottom: '14px', padding: '10px', borderRadius: '8px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsPasswordModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={() => handleExportBackup(backupPassword)} className="btn btn-primary" style={{ flex: 1 }} disabled={!backupPassword}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Preview Modal */}
      {restoreFileSummary && restorePayload && (
        <div className="modal-overlay" onClick={() => setRestoreFileSummary(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Restore Backup Preview</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Exported: {formatDisplayDate(restoreFileSummary.exportDate.slice(0, 10))} • {restoreFileSummary.totalRecords} records
            </div>

            {restorePayload.isEncrypted && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Backup Passphrase</label>
                <input
                  type="password"
                  placeholder="Enter decryption password"
                  value={restorePasswordInput}
                  onChange={(e) => setRestorePasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', marginTop: '4px' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setRestoreFileSummary(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={executeRestore} className="btn btn-primary" style={{ flex: 1 }} disabled={isRestoring}>
                {isRestoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Data Confirmation Modal */}
      {isResetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsResetModalOpen(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
              Erase All Data
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              This will permanently delete all tasks, notes, expenses, and settings stored in this browser. Type <strong>DELETE ALL DATA</strong> to proceed.
            </p>
            <input
              type="text"
              placeholder="DELETE ALL DATA"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              style={{ width: '100%', marginBottom: '14px', padding: '10px', borderRadius: '8px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsResetModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handleResetAllData}
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={resetConfirmationText !== 'DELETE ALL DATA'}
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
