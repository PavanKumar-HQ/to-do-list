# Personal Life OS — Database Schema & Data Integrity Master Documentation

## Architectural Overview
The Personal Life OS uses **IndexedDB** as its primary persistent local database via Dexie.js. It operates with a strict layered architecture:
```text
UI Layer (React Views, Modals)
  ↓
Application Services (Integrity, Security, Multi-Tab Sync, Backup, Voice, Notifications)
  ↓
Repositories / Data Access Layer (TaskRepository, ExpenseRepository, RelationshipRepository, etc.)
  ↓
Runtime Validation (Types, Ranges, Size Limits, Prototype Pollution Defense, MIME Rules)
  ↓
IndexedDB (Dexie Store: "PersonalLifeOS_DB")
```

---

## 1. Universal Lifecycle Model
Every primary entity implements the following lifecycle fields where appropriate:
* `id` (string, immutable UUID generated via cryptographically secure `crypto.randomUUID()`)
* `createdAt` (ISO 8601 UTC string)
* `updatedAt` (ISO 8601 UTC string)
* `deletedAt` (ISO 8601 UTC string, populated when entity is soft-deleted to Trash)
* `archivedAt` (ISO 8601 UTC string, populated when entity is archived out of active views)
* `completedAt` (ISO 8601 UTC string, populated when entity is marked completed)

---

## 2. Dexie Stores & Indexes Definition

### Current Database Name: `PersonalLifeOS_DB`
Current Schema Version: `4`

| Store Name | Primary Key | Indexed Fields | Description |
| :--- | :--- | :--- | :--- |
| `inbox` | `id` | `id, isProcessed, createdAt, deletedAt` | Raw quick captures waiting for processing |
| `relationships`| `id` | `id, sourceId, sourceType, targetId, targetType, createdAt` | First-class many-to-many graph relationships |
| `commitments` | `id` | `id, personId, promisedDate, status, createdAt, deletedAt` | Promises and commitments made to other people |
| `decisions` | `id` | `id, reviewDate, status, createdAt, deletedAt` | Personal reasoning, alternatives, and review triggers |
| `openLoops` | `id` | `id, loopType, sourceEntityId, waitingOnPersonId, status, createdAt, deletedAt` | Unresolved intentions and waiting items |
| `dependencies` | `id` | `id, blockerId, blockedId, createdAt` | Execution blocker relationships |
| `futureMessages` | `id` | `id, openDate, isOpened, createdAt, deletedAt` | Temporal messages to future self |
| `reviewSessions` | `id` | `id, reviewType, completedAt` | Life review audit history and reflections |
| `lifeContexts` | `id` | `id, name, isArchived, createdAt` | High-level life dimensions and domains |
| `tasks` | `id` | `id, status, priority, category, dueDate, recurrence, linkedPersonId, createdAt, completedAt, deletedAt` | Tasks, checklists, recurrence series, consequence |
| `reminders` | `id` | `id, date, status, recurrence, linkedType, linkedId, createdAt, deletedAt` | Local-time reminders and ringing alarm triggers |
| `notes` | `id` | `id, category, isPinned, createdAt, archivedAt, deletedAt` | Notes, checklists, rich text contents, temporal triggers |
| `ideas` | `id` | `id, category, status, isPinned, createdAt, deletedAt` | Raw ideas with lifecycle states |
| `dontForget` | `id` | `id, triggerDate, priority, isPinned, isDismissed, createdAt, deletedAt` | Floating sticky reminders and critical items |
| `people` | `id` | `id, name, createdAt, deletedAt` | Personal contacts, relationships, CRM |
| `followups` | `id` | `id, personId, dueDate, status, createdAt, deletedAt` | Contact follow-up interactions |
| `events` | `id` | `id, date, personId, createdAt, deletedAt` | Calendar schedule, pre-event briefs |
| `lists` | `id` | `id, category, isPinned, createdAt, deletedAt` | Custom user-defined checklist containers |
| `goals` | `id` | `id, status, deadline, createdAt, deletedAt` | Measurable milestones and long-term goals |
| `routines` | `id` | `id, frequency, createdAt, deletedAt` | Morning, evening, and daily habit routines |
| `journalEntries`| `id` | `id, date, mood, createdAt, deletedAt` | Daily reflection log keyed canonically by date |
| `expenses` | `id` | `id, date, category, paymentMethod, isBusiness, recurringExpenseId, goalId, createdAt, deletedAt` | Monetary outflows in integer minor units |
| `income` | `id` | `id, date, category, isRecurring, createdAt, deletedAt` | Monetary inflows in integer minor units |
| `budgets` | `id` | `id, month, category` | Monthly budget allocations (minor units) |
| `creditCards` | `id` | `id, cardName, createdAt, deletedAt` | Credit card balances, billing and due dates |
| `recurringExpenses`| `id` | `id, frequency, nextDueDate, isActive, createdAt, deletedAt` | Subscriptions and recurring bills |
| `savingsGoals` | `id` | `id, deadline, createdAt, deletedAt` | Target savings goals (minor units) |
| `attachments` | `id` | `id, name, mimeType, createdAt, deletedAt` | Safe Base64 binary assets with ref counting |
| `voiceNotes` | `id` | `id, linkedType, linkedId, createdAt, deletedAt` | Audio recordings and metadata |
| `templates` | `id` | `id, type, createdAt` | Built-in checklists and routine templates |
| `settings` | `id` | `id` | Preferences, reminderTone, and backup metadata |
| `auditHistory` | `id` | `id, action, entityType, entityId, timestamp` | Lightweight audit log of write actions |

---

## 3. Entity Schemas & Validation Rules

### 3.1 Tasks (`tasks`)
* `id`: UUID string.
* `title`: string (1..500 characters, non-empty).
* `description`: optional string (max 50,000 characters).
* `status`: enum `'inbox' | 'todo' | 'in_progress' | 'waiting' | 'completed' | 'archived'`.
* `priority`: enum `'low' | 'medium' | 'high'`.
* `category`: optional string.
* `dueDate`: optional string (format `YYYY-MM-DD`).
* `dueTime`: optional string (format `HH:mm`).
* `reminderAt`: optional ISO timestamp.
* `recurrence`: enum `'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'`.
* `subtasks`: array of `{ id: string, title: string, completed: boolean }`.
* `tags`: array of trimmed strings.
* `linkedPersonId`: optional foreign key to `people.id`.
* `linkedEventId`: optional foreign key to `events.id`.
* `linkedNoteId`: optional foreign key to `notes.id`.
* `attachmentIds`: array of foreign keys to `attachments.id`.
* `completedAt`: ISO timestamp (required when status === 'completed').
* `deletedAt`: ISO timestamp (when in Trash).

### 3.2 Expenses (`expenses`)
* `id`: UUID string.
* `amountMinor`: integer >= 0 (paise/cents). Floating-point values strictly disallowed.
* `currency`: string (e.g. `'INR'`).
* `date`: string (format `YYYY-MM-DD`).
* `category`: non-empty string.
* `paymentMethod`: enum `'upi' | 'cash' | 'card' | 'bank' | 'other'`.
* `isBusiness`: boolean.
* `notes`: optional string (max 50,000 characters).
* `receiptAttachmentId`: optional foreign key to `attachments.id`.
* `goalId`: optional foreign key to `goals.id`.

### 3.3 Relationships (`relationships`)
* `id`: UUID string.
* `sourceId`: UUID string.
* `sourceType`: `EntityType`.
* `targetId`: UUID string.
* `targetType`: `EntityType`.
* `relationshipLabel`: optional string.
* `createdAt`: ISO timestamp.
* **Integrity Constraint**: Both source and target records must exist prior to insertion.

---

## 4. Referential Integrity Policies
1. **Person Deletion**: Deleting a person safely unlinks references across tasks, expenses, and notes, but **never** deletes the linked tasks or financial records.
2. **Event Deletion**: Deleting an event preserves associated tasks and expenses.
3. **Attachment Deletion**: An attachment is only purged physically when its reference count across tasks, notes, journal entries, and expenses reaches 0.
4. **Note to Task Conversion**: Conversion creates the task and links the relationship atomically without destroying the original note.
5. **Recurring Task Generation**: Uses deterministic series and occurrence identity (`title + dueDate`) to ensure idempotency.

---

## 5. Security & Data Protection Controls
1. **Prototype Pollution Defense**: `safeJsonParse` and `sanitizeObject` strip `__proto__`, `constructor`, and `prototype` keys during ingestion.
2. **HTML / Script Injection**: Free-text fields are escaped; no `eval` or dynamic code evaluation is permitted.
3. **MIME Whitelist**: File attachments are restricted to verified safe image, audio, PDF, and text types. Scriptable types (`svg`, `html`, `js`) are rejected.
4. **Input Size Bounds**: Titles max 500 chars, notes max 500,000 chars, attachments max 25MB, backups max 100MB / 200,000 records.
5. **Encrypted Backups**: Optional PBKDF2 (100,000 iterations) + AES-GCM 256-bit encryption with random salt and IV.
6. **Integrity Checksums**: Canonical JSON serialization (sorted keys) with SHA-256 digests.

---

## 6. Migration History
* **Schema Version 1**: Initial release covering tasks, reminders, notes, ideas, dont_forget, people, followups, events, lists, goals, routines, journal, expenses, income, budgets, creditCards, recurringExpenses, savingsGoals, attachments, voiceNotes, templates, settings, and auditHistory.
* **Schema Version 2**: Added first-class `inbox` store for universal capture and `relationships` store for structured cross-entity graph edges.
* **Schema Version 3**: Added `commitments` (promises to people), `decisions` (reasoning engine), `openLoops` (unresolved thoughts/waiting), and `dependencies` (blocker graph).
* **Schema Version 4**: Added `futureMessages` (time capsules), `reviewSessions` (weekly/monthly guided reviews), and `lifeContexts` (360-degree life dimensions).
