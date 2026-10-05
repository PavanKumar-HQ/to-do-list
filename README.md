# Personal Life OS — Private, Local-First Operating System

A high-performance, private, 100% local-first personal productivity and life management operating system. Built with React 19, TypeScript, Vite, Dexie.js (IndexedDB), and Apple-inspired Liquid Glass aesthetics.

Zero cloud dependence. Zero external telemetry. All data stays encrypted and stored directly in your browser's persistent storage.

---

## Architecture & Core Modules

```text
                               PERSONAL LIFE OS
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
       CAPTURE & SCHEDULE                              MEMORY & CONTEXT
              │                                               │
   ┌──────────┼──────────┐                         ┌──────────┼──────────┐
   │          │          │                         │          │          │
 Tasks    Calendar   Reminders                   People    Journal    Notes & Ideas
              │          │                         │
            Events     Alarms                  Follow-ups
```

### 1. Home & Daily Context Engine
- **Schedule-Aware Intelligent Status**: Dynamically analyzes today's schedule (imminent meetings, tasks, reminders, and deadlines) to provide contextual guidance rather than generic text.
- **Side-by-Side Date Card**: Displays the current month, numeric day, and full weekday name (`Monday`, `Tuesday`, etc.) alongside real-time schedule insights.
- **Attention Radar**: Highlights open loops, imminent deadlines, and high-priority commitments.

### 2. Interactive Calendar & Upcoming Radar
- **Multi-View Modes**: Switch effortlessly between Month Grid, Color-Coded Week View, and Hour-by-Hour Day View.
- **Direct Event Scheduling**: Click any day cell or the **"+ New Event"** / **"+ Add Event"** action buttons to schedule events for the selected date.
- **Event Detail & Edit Modal**: Clicking on any event card displays all filled data (Title, Date, Time, Location, Notes/Agenda, Category badge, and Reminder Schedule) with full inline editing and deletion.
- **Upcoming Radar Card**: Displays the next imminent event with 1-click reminders toggle, schedule customizer, detail inspection, and direct deletion.
- **Drag-and-Drop Rescheduling**: Fluidly drag events or tasks onto any day on the calendar to update schedules instantly with zero lag.

### 3. High-Fidelity Audio & Alarm Engine (`soundService.ts`)
- **Universal Audio Registry**: Tracks all active `HTMLAudioElement` and `AudioContext` instances in global registries.
- **Leak-Proof Snooze & Termination**: Calling `stopAlarmRinging()` immediately pauses all audio elements, resets playback positions, clears recurring interval timers, and closes all Web Audio synthesis contexts.
- **Multiple Alarm Tones**:
  - **Digital Alarm**: Classic high-frequency triple-pulse square wave.
  - **Gentle Chime**: Harmonic sine chime (D5 -> A5).
  - **Radar Pulse**: Pitch-dropping resonant sine sweep.
  - **Marimba**: Acoustic tri-tone melodic arpeggio.
  - **Custom Device Audio**: Upload and store any audio file directly from your local device into persistent local storage.

### 4. Reliable Notification Engine (`notificationService.ts`)
- **Event-Driven Scheduling**: Automatically calculates the exact timestamp of the earliest due reminder and schedules precise timeouts without battery-draining 1-second polling loops.
- **Heartbeat & Resumption**: 15-second sanity heartbeat and `visibilitychange` listeners ensure alarms never stall when switching tabs or waking up devices.
- **Snooze Reliability**: Snoozing for 10 minutes updates the reminder's `snoozedUntil` state, prevents immediate re-triggering during the snooze window, and guarantees ringing when the 10 minutes elapse.
- **Clean Notification UI**: 100% icons-only design (Lucide icons); zero emoji clutter.
- **Bottom-Anchored Toasts**: All operational toasts ("Added", "Moved to trash", "Snoozed") smoothly slide in at the bottom of the viewport.

### 5. Tactile Clock & Time Setter (`ClockTimeSetter.tsx`)
- **Direct Typing Support**: Users can type the exact hour (1–12) and minute (0–59) directly into numeric inputs.
- **Tactile Stepper Controls**: Rapid `ChevronUp` and `ChevronDown` steppers for quick minute and hour adjustments.
- **Quick Preset Chips**: Fast one-tap presets for `+15m`, `+30m`, `+1h`, `Morning (9 AM)`, `Noon (12 PM)`, and `Evening (6 PM)`.
- **AM / PM Selector**: One-tap toggle with active visual accent feedback.

### 6. Universal Quick Capture (`QuickAddModal.tsx`)
- **Context-Aware Dynamic Forms**: Automatically switches form fields, validation, and layout based on the active entity:
  - **Tasks**: Title, due date, time, priority, notes.
  - **Reminders**: Alarm title, compulsory alarm date, clock time setter with custom sound preview, recurrence.
  - **Events**: Event title, date, start time, location link, category palette, automated 1-day before and 2-hour recurring reminders.
  - **Expenses**: Amount in ₹, category tags, payment methods (UPI, cash, card, bank), merchant notes.
  - **Notes & Ideas**: Note title, rich textarea, and idea conversion.
  - **Follow-ups & People**: Target contact and follow-up deadlines.
- **Entity-Specific Duplicate Validation**: Checks the relevant database collection to warn users without blocking accidental duplicates.

### 7. Tasks, Checklists & Habits
- **Crisp Custom Checkboxes**: Includes CSS checkmarks (`::after`) so checked items are clearly marked without rendering blank solid squares.
- **Subtasks & Breakdown**: Collapsible task checklists with progress counters (`X of Y completed`).
- **Recurrence Support**: Daily, weekly, monthly, and custom recurrence cycles with automatic next-occurrence generation.

### 8. Memory Graph & Life Context (`LifeGraphService.ts`)
- **360-Degree Context**: Cross-links tasks, notes, expenses, follow-ups, and calendar events to people and reasons.
- **Why Does This Exist?**: Captures origin reasons and next actions for every record.

---

## Data Schema & Storage Architecture

The application persists all data locally in IndexedDB using Dexie.js (Database: `KansoLifeOS`, Schema Version: 4).

| Store Name | Primary Key | Indexed Fields | Purpose |
| :--- | :--- | :--- | :--- |
| `tasks` | `id` | `status, priority, dueDate, category, deletedAt, personId` | Actionable todo items |
| `reminders` | `id` | `date, time, status, recurrence, deletedAt, linkedId` | Time-sensitive alarms and notification triggers |
| `events` | `id` | `date, startTime, category, deletedAt, personId` | Scheduled calendar items & appointments |
| `expenses` | `id` | `date, category, paymentMethod, deletedAt, personId` | Financial tracking & monthly metrics |
| `notes` | `id` | `type, folderId, isPinned, deletedAt, personId` | Notes, checklists, and captured ideas |
| `people` | `id` | `name, relationship, lastContactDate, deletedAt` | Personal network & CRM |
| `followups` | `id` | `personId, dueDate, status, deletedAt` | Waiting-on and follow-up tracking |
| `openLoops` | `id` | `status, dueDate, deletedAt` | Incomplete commitments and open loops |
| `goals` | `id` | `status, targetDate, deletedAt` | High-level goals and routine habits |
| `settings` | `key` | — | User preferences, quiet hours, theme, and tone settings |
| `auditLogs` | `id` | `timestamp, action, entityType, entityId` | Full audit trail of modifications |

For detailed property-by-property documentation, see [SCHEMA_DOCUMENTATION.md](file:///Users/pavankumars/Downloads/to%20do%20list/SCHEMA_DOCUMENTATION.md).

---

## Local Development & Production Build

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
The application will be running locally at `http://localhost:5173/`.

### Run Test Suite
```bash
npx tsx test/test-suite.ts
```
Executes all 121 comprehensive end-to-end integration and database unit tests.

### Build for Production
```bash
npm run build
```
Creates an optimized, tree-shaken production bundle in the `dist/` directory ready for deployment on any static host, CDN, or local offline PWA server.

---

## Privacy & Security Guarantees
1. **Local-First**: All IndexedDB tables are strictly client-side. No remote database or analytics server receives your data.
2. **Encrypted Export & Backup**: Supports automated single-file JSON backup and recovery directly through the Settings screen.
3. **Soft-Delete with Trash Recovery**: Any deleted item is moved to Trash (`deletedAt`) with a 30-day recovery window before permanent purging.
