// Internal Application Event Bus & Real-Time Invalidation System (Section 29, 30, 31, 84)
// Provides pub-sub event dispatching and synchronizes with BroadcastChannel across open tabs.

import type { EntityType } from '../types';
import { multiTabSync, type SyncMessage } from './multiTabService';

export type AppEventType =
  | 'TASK_MUTATED'
  | 'REMINDER_MUTATED'
  | 'REMINDER_DUE'
  | 'MISSED_REMINDERS'
  | 'NOTE_MUTATED'
  | 'EXPENSE_MUTATED'
  | 'EVENT_MUTATED'
  | 'PERSON_MUTATED'
  | 'COMMITMENT_MUTATED'
  | 'OPEN_LOOP_MUTATED'
  | 'GOAL_MUTATED'
  | 'BACKUP_COMPLETED'
  | 'DATABASE_RESTORED'
  | 'APP_RESUMED'
  | 'ACCENT_CHANGED';

export interface AppEventPayload {
  type: AppEventType;
  action?: 'create' | 'update' | 'delete' | 'complete' | 'snooze' | 'restore';
  entityId?: string;
  data?: any;
  timestamp: string;
  sourceTabId?: string;
}

export type EventCallback = (event: AppEventPayload) => void;

class AppEventBus {
  private listeners: Map<AppEventType, Set<EventCallback>> = new Map();

  constructor() {
    // Listen to multi-tab sync and translate to local eventBus events
    multiTabSync.subscribe((msg: SyncMessage) => {
      this.handleRemoteMessage(msg);
    });

    // Listen for Page Visibility API (Section 27, 74)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.emit('APP_RESUMED', {
            type: 'APP_RESUMED',
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  }

  public subscribe(eventType: AppEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  public on(eventType: AppEventType, callback: EventCallback): () => void {
    return this.subscribe(eventType, callback);
  }

  public off(eventType: AppEventType, callback: EventCallback): void {
    this.listeners.get(eventType)?.delete(callback);
  }


  public emit(eventType: AppEventType, payload?: Partial<AppEventPayload>) {
    const fullPayload: AppEventPayload = {
      type: eventType,
      timestamp: new Date().toISOString(),
      sourceTabId: multiTabSync.getTabId(),
      ...payload
    };

    const cbs = this.listeners.get(eventType);
    if (cbs) {
      cbs.forEach((cb) => {
        try {
          cb(fullPayload);
        } catch (err) {
          console.error(`Error in EventBus listener for ${eventType}:`, err);
        }
      });
    }
  }

  private handleRemoteMessage(msg: SyncMessage) {
    if (msg.type === 'DATABASE_RESTORED') {
      this.emit('DATABASE_RESTORED', {
        type: 'DATABASE_RESTORED',
        timestamp: msg.timestamp,
        sourceTabId: msg.sourceTabId
      });
      return;
    }

    if (msg.type === 'ENTITY_MUTATED' && msg.entityType) {
      const eventTypeMap: Partial<Record<EntityType, AppEventType | null>> = {
        task: 'TASK_MUTATED',
        reminder: 'REMINDER_MUTATED',
        note: 'NOTE_MUTATED',
        expense: 'EXPENSE_MUTATED',
        event: 'EVENT_MUTATED',
        person: 'PERSON_MUTATED',
        commitment: 'COMMITMENT_MUTATED',
        open_loop: 'OPEN_LOOP_MUTATED',
        goal: 'GOAL_MUTATED',
        inbox: 'TASK_MUTATED',
        idea: 'NOTE_MUTATED',
        dont_forget: 'TASK_MUTATED',
        followup: 'PERSON_MUTATED',
        list: null,
        routine: null,
        journal: null,
        income: 'EXPENSE_MUTATED',
        budget: 'EXPENSE_MUTATED',
        credit_card: 'EXPENSE_MUTATED',
        recurring_expense: 'EXPENSE_MUTATED',
        savings_goal: 'EXPENSE_MUTATED',
        attachment: null,
        voice_note: null,
        decision: 'OPEN_LOOP_MUTATED'
      };

      const mapped = eventTypeMap[msg.entityType];
      if (mapped) {
        this.emit(mapped, {
          type: mapped,
          action: msg.action as any,
          entityId: msg.entityId,
          timestamp: msg.timestamp,
          sourceTabId: msg.sourceTabId
        });
      }
    }
  }
}

export const eventBus = new AppEventBus();
