// Multi-Tab Concurrency & Sync Service (Section 44-46)
// Uses BroadcastChannel where available to synchronize state between multiple open tabs/PWA instances.
// Protects against lost updates and stale writes.

import type { EntityType } from '../types';

export type SyncAction = 'create' | 'update' | 'delete' | 'archive' | 'restore' | 'database_restored';

export interface SyncMessage {
  type: 'ENTITY_MUTATED' | 'DATABASE_RESTORED';
  entityType?: EntityType;
  entityId?: string;
  action?: SyncAction;
  updatedAt?: string;
  sourceTabId: string;
  timestamp: string;
}

export type SyncListener = (message: SyncMessage) => void;

class MultiTabSyncService {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    this.tabId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'tab_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('personal_life_os_sync_v1');
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncoming(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or restricted in this environment:', err);
      }
    }
  }

  public getTabId(): string {
    return this.tabId;
  }

  public broadcastMutation(entityType: EntityType, entityId: string, action: SyncAction, updatedAt?: string) {
    const message: SyncMessage = {
      type: 'ENTITY_MUTATED',
      entityType,
      entityId,
      action,
      updatedAt: updatedAt || new Date().toISOString(),
      sourceTabId: this.tabId,
      timestamp: new Date().toISOString()
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to broadcast mutation across tabs:', err);
      }
    }
  }

  public broadcastDatabaseRestored() {
    const message: SyncMessage = {
      type: 'DATABASE_RESTORED',
      sourceTabId: this.tabId,
      timestamp: new Date().toISOString()
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to broadcast restore event:', err);
      }
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleIncoming(message: SyncMessage) {
    if (!message || message.sourceTabId === this.tabId) return;
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (err) {
        console.error('Error in multi-tab sync listener:', err);
      }
    }
  }

  // Lost Update Protection check (Section 46)
  public checkLostUpdate(loadedUpdatedAt?: string, currentRecordUpdatedAt?: string): { hasConflict: boolean; reason?: string } {
    if (!loadedUpdatedAt || !currentRecordUpdatedAt) {
      return { hasConflict: false };
    }
    if (loadedUpdatedAt !== currentRecordUpdatedAt) {
      return {
        hasConflict: true,
        reason: 'This item was modified in another tab or session. Review latest changes before saving.'
      };
    }
    return { hasConflict: false };
  }
}

export const multiTabSync = new MultiTabSyncService();
