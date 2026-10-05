# Kanso Life OS — Private, Local-First Personal Operating System

<div align="center">

![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white&style=for-the-badge)
![Dexie.js](https://img.shields.io/badge/IndexedDB-Dexie.js%20v4-8B5CF6?logo=database&logoColor=white&style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Offline%20First-5A0FC8?logo=pwa&logoColor=white&style=for-the-badge)
![Lucide Icons](https://img.shields.io/badge/Lucide-Vector%20Icons-F56565?logo=feather&logoColor=white&style=for-the-badge)
![Web Audio](https://img.shields.io/badge/Web%20Audio-Synthesizer%20%26%20Alarms-10B981?logo=audio&logoColor=white&style=for-the-badge)
![Web Push](https://img.shields.io/badge/Web%20Push-Actions%20%26%20Vibration-0284C7?logo=bell&logoColor=white&style=for-the-badge)
![Tests](https://img.shields.io/badge/Tests-121%20Passed-success?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local--First-14B8A6?logo=shield&logoColor=white&style=for-the-badge)

<p align="center">
  <b>A private, zero-telemetry, local-first operating system designed for human focus and life mastery.</b><br>
  Built with React 19, TypeScript, Dexie.js (IndexedDB), Web Audio synthesis, and Liquid Glass aesthetics.
</p>

</div>

---

## 🌟 Core Philosophy

1. **100% Local-First & Private**: Zero external telemetry, zero tracking, zero mandatory cloud accounts. All data lives securely inside your device's IndexedDB database.
2. **Deterministic Reliability**: Alarms and reminders never drop notifications or flood duplicate instances. Snooze is persistent and idempotent.
3. **Restrained, Cohesive Aesthetics**: Inspired by Apple Liquid Glass and Scandinavian minimalism—rich dark and light themes, subtle blurred glass bars (`backdrop-filter`), and 100% vector iconography.
4. **Relational Context Graph**: Every task, note, expense, commitment, and calendar event connects to goals, contacts, and origin reasons.

---

## 🏗️ Architecture & Modules

```text
                                  KANSO LIFE OS
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         │                              │                              │
  DAILY RADAR & CAPTURE        PLANNING & EXECUTION            FINANCE & INSIGHTS
         │                              │                              │
  ┌──────┴──────┐              ┌────────┼────────┐             ┌───────┴───────┐
  │             │              │        │        │             │               │
Today      Quick Add        Tasks    Calendar  Goals        Expenses        Budgets
Context    (9 Modals)         │         │        │             │               │
  │             │          Checklists Events  Routines       Income      Credit Cards
Schedule    Natural            │        │
Insights    Language       Subtasks  Reminders
```

---

## 🚀 Key Features

### 1. Daily Focus & Home Radar (`HomeView.tsx`)
- **Schedule-Aware Intelligent Context**: Dynamically analyzes today's calendar, overdue tasks, pending reminders, and finances to display personalized contextual guidance.
- **Side-by-Side Date Card**: Displays month, numeric day, full weekday name (`Monday`, `Tuesday`, etc.) alongside real-time schedule insights without wasting horizontal space.
- **Attention Radar**: Highlights open loops, imminent commitments, and items needing urgent action.
- **Sticky Frosted Header**: Liquid glass navigation bar pinned at `top: 0` with `backdrop-filter: blur`, smoothly floating above content as you scroll.

### 2. Universal Quick Capture (`QuickAddModal.tsx`)
- **Adaptive Progressive Forms**: 9 tailored forms for **Task**, **Reminder**, **Event**, **Expense**, **Income**, **Note**, **Idea**, **Person**, and **Follow-up**.
- **Tactile Clock & Time Setter**: Direct numeric keyboard typing for hour and minute, arrow-key stepping, chevrons, AM/PM toggle, and quick interval chips (`+15m`, `+30m`, `+1h`, `Morning 9 AM`).
- **Goal Linking**: Associate any task directly to an active goal, persisting the link in `db.relationships` and displaying a `Target` badge on the task card.
- **Natural Language Parsing**: Type `"Buy groceries tomorrow at 5pm"` or `"Coffee 150 upi"` for automatic field population.
- **Duplicate Prevention**: Non-blocking duplicate warnings for identical tasks or reminders.

### 3. Smart Calendar & Event Management (`CalendarView.tsx`)
- **Multi-View Modes**: Switch between Month Grid, Color-Coded Week View, and Hour-by-Hour Day View.
- **Direct Event Scheduling**: Click any day cell or header action button to create events with time, location, notes, and category tags.
- **Event Inspection Modal**: Inspect and edit event details with real-time updates and direct deletion.
- **Upcoming Radar & Purged Reminders**: Automatically clears old duplicate alarms (`purgeFloodedReminders()`) and provides 1-click reminder toggles.
- **Agenda Actions**: Mark reminders complete or dismiss them directly from the calendar agenda.

### 4. High-Fidelity Audio & Alarm Engine (`soundService.ts`)
- **Universal Audio Registry**: Tracks all active `HTMLAudioElement` and `AudioContext` instances in global registries.
- **Leak-Proof Snooze & Stop**: Calling `stopAlarmRinging()` immediately pauses all audio elements, resets playback positions, clears recurring interval timers, and closes all Web Audio synthesis contexts.
- **Multiple Alarm Tones**:
  - **Digital Alarm**: High-frequency triple-pulse square wave.
  - **Gentle Chime**: Harmonic sine chime (D5 -> A5).
  - **Radar Pulse**: Pitch-dropping resonant sine sweep.
  - **Marimba**: Acoustic tri-tone melodic arpeggio.
  - **Custom Device Audio**: Upload and store any audio file directly from your local device into persistent local storage.

### 5. Resilient Checklist & Lists Engine (`ListsView.tsx`)
- **Custom Checklists & Templates**: Create custom lists or instantiate from pre-built templates (e.g. *Monthly Finance Review*, *Travel Packing*).
- **Fast Item Addition**: Form-wrapped inputs support pressing `Enter` or clicking `Add` on any desktop or mobile keyboard.
- **Defensive Data Handling**: Safe array fallbacks prevent UI crashes even on legacy or partially corrupted records.
- **Interactive Checkboxes**: Custom CSS checkmarks with real-time completion counter (`X of Y completed`).

### 6. Daily Journal & Vector Mood Tracking (`JournalView.tsx`)
- **Private Reflections**: Record reflections, title headlines, and day logs tied to any calendar date.
- **Vector Mood Indicators**: Replaced cartoon emojis with clean Lucide vector icons:
  - **Great**: `Laugh`
  - **Good**: `Smile`
  - **Neutral**: `Meh`
  - **Tough**: `Frown`
  - **Exhausted**: `ZapOff`
- **Day Activity Context**: Non-invasive summary of actual completed tasks and recorded expenses for the selected day.

### 7. Money & Financial Discipline (`MoneyView.tsx`)
- **Minor-Unit Precision**: Stored in minor currency units (paise/cents) to prevent floating-point rounding errors.
- **Expense & Income Tracking**: Category breakdowns, merchant notes, and payment methods (UPI, Card, Cash, Bank).
- **Monthly Budgets**: Budget limits per category with visual progress bars and overspending warnings.

### 8. Mobile PWA & Push Notifications (`sw.js`)
- **Android & Desktop**: Native Web Notifications through the Service Worker with device vibration patterns (`[200, 100, 200, 100, 200]`) and notification shade action buttons (**Complete** and **Snooze 10m**).
- **iOS Safari PWA**: Full support for iOS 16.4+ Web Push when installed via **Share -> Add to Home Screen**.
- **Background Push Event Listener**: Handles push messages in the background even when browser tabs are closed.

---

## 🗄️ Database Schema (IndexedDB v4)

Persisted client-side using Dexie.js (`PersonalLifeOS_DB`, Schema Version 4).

| Store Name | Primary Key | Key Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `tasks` | `id` | `status, priority, dueDate, category, goalId, deletedAt` | Actionable todo items and subtasks |
| `reminders` | `id` | `date, time, status, recurrence, deletedAt, linkedId` | Time-sensitive alarms and notification triggers |
| `events` | `id` | `date, startTime, category, deletedAt, personId` | Scheduled calendar items & appointments |
| `expenses` | `id` | `date, category, paymentMethod, deletedAt` | Financial tracking in minor currency units |
| `income` | `id` | `date, category, source, deletedAt` | Recorded income sources and recurring deposits |
| `budgets` | `id` | `month, category` | Monthly category spending caps |
| `notes` | `id` | `tags, isPinned, deletedAt` | Notes, ideas, and rich markdown text |
| `people` | `id` | `name, relationship, lastContactDate, deletedAt` | Personal network & CRM |
| `lists` | `id` | `category, isPinned, deletedAt` | Interactive checklists and item hierarchies |
| `goals` | `id` | `status, deadline, deletedAt` | Goals, target amounts, and milestones |
| `openLoops` | `id` | `status, loopType, consequence, deletedAt` | Open loops, commitments, and waiting-ons |
| `relationships` | `id` | `sourceId, targetId, sourceType, targetType` | 360-degree knowledge graph linking entities |
| `settings` | `key` | — | User preferences, quiet hours, theme, and tone settings |
| `auditLogs` | `id` | `timestamp, action, entityType, entityId` | Full audit trail of modifications |

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `c` or `+` | Open Quick Add Modal |
| `Cmd+K` / `Ctrl+K` or `/` | Open Global Search |
| `Escape` | Dismiss any open modal or bottom sheet |
| `ArrowUp` / `ArrowDown` | Step time hour/minute in ClockTimeSetter |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### 1. Clone & Install
```bash
git clone https://github.com/PavanKumar-HQ/to-do-list.git
cd to-do-list
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 3. Run Automated Tests
```bash
npx tsx test/test-suite.ts
```
Executes all **121 automated tests** covering database schemas, API layer, sound synthesis, notification timeouts, date arithmetic, natural language parser, and multi-tab synchronization.

### 4. Build for Production
```bash
npm run build
```
Generates a tree-shaken, minified, production-ready PWA bundle in `dist/`.

---

## 🔒 Privacy & Data Sovereignty

- **Zero Cloud Leakage**: No server-side tracking, analytics, or telemetry scripts are bundled.
- **Complete Export & Import**: Export your entire life database to a clean, unencrypted or password-encrypted JSON file at any time via **Settings -> Data & Backup**.
- **Soft Delete with Trash Retention**: Deleted items move to Trash (`deletedAt`) with a 30-day safety net before permanent removal.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
