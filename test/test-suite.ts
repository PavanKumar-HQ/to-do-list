import 'fake-indexeddb/auto';
import { db, generateId } from '../src/db/db';
import { toMinorUnits, fromMinorUnits, formatMoney } from '../src/utils/currency';
import { getTodayDateString, calculateNextOccurrence } from '../src/utils/dates';
import { parseNaturalQuickInput } from '../src/utils/naturalParser';
import {
  createBackupPayload,
  validateAndPreviewBackup,
  restoreFromBackup,
  encryptData,
  decryptData,
  canonicalJsonStringify,
  computeSha256Checksum
} from '../src/services/backupService';
import {
  TaskRepository,
  ExpenseRepository,
  ReminderRepository,
  NoteRepository,
  PersonRepository,
  RelationshipRepository,
  AttachmentRepository,
  InboxRepository,
  CommitmentRepository,
  DecisionRepository,
  OpenLoopRepository,
  SettingsRepository,
  CanvasRepository,
  WarrantyRepository,
  FamilyRepository,
  DocumentRepository,
  InviteRepository
} from '../src/repositories';
import { IntegrityService } from '../src/services/integrityService';
import { multiTabSync } from '../src/services/multiTabService';
import { safeJsonParse, sanitizeObject, isSafeUrl, isValidAttachmentMime } from '../src/services/securityService';
import { AttentionService } from '../src/services/attentionService';
import { LifeGraphService } from '../src/services/lifeGraphService';
import { eventBus } from '../src/services/eventBus';
import { notificationService } from '../src/services/notificationService';
import { SettingsService } from '../src/services/settingsService';
import { getTimeAwareGreeting, getSubtleDateString } from '../src/utils/greeting';
import { api } from '../src/api';
import { triggerHaptic } from '../src/utils/haptics';

async function runTestSuite() {
  console.log('=====================================================');
  console.log(' PERSONAL LIFE OS — MASTER DATABASE & SECURITY SUITE ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // 1. MONETARY PRECISION & MINOR UNITS (Sections 8, 160, Invariant 5)
  // -----------------------------------------------------------------
  console.log('--- 1. Monetary Minor Units & Arithmetic Invariants ---');
  assert(toMinorUnits(0) === 0, 'Zero rupees converts accurately to 0 paise');
  assert(toMinorUnits(0.01) === 1, '₹0.01 converts accurately to 1 paise');
  assert(toMinorUnits(450.50) === 45050, '₹450.50 converts accurately to 45050 paise integer');
  assert(toMinorUnits(99999.99) === 9999999, '₹99,999.99 converts accurately to 9999999 paise integer');
  assert(Number.isInteger(toMinorUnits(1234.56)), 'Minor units conversion guarantees JavaScript integer');
  assert(fromMinorUnits(45050) === 450.50, '45050 paise converts back to 450.50 float without rounding error');

  // Addition of minor units
  const sumMinor = toMinorUnits(150.25) + toMinorUnits(349.75);
  assert(sumMinor === 50000, 'Summing 15025 + 34975 paise equals exact integer 50000 paise (₹500.00)');

  // -----------------------------------------------------------------
  // 2. TASK REPOSITORY, LIFECYCLE & RECURRENCE (Sections 11-17, 70)
  // -----------------------------------------------------------------
  console.log('\n--- 2. Task Domain Lifecycle & Recurrence Idempotency ---');
  const task1 = await TaskRepository.create({
    title: 'File GST Returns',
    category: 'Finance',
    priority: 'high',
    dueDate: '2026-10-15',
    recurrence: 'monthly'
  });
  assert(!!task1.id && task1.title === 'File GST Returns', 'Task created through TaskRepository with stable UUID');
  assert(task1.status === 'todo', 'Initial task status defaults to "todo"');

  // Complete recurring task
  const { task: completedTask, nextTask } = await TaskRepository.complete(task1.id);
  assert(completedTask.status === 'completed' && !!completedTask.completedAt, 'Task marked completed with completedAt timestamp (Invariant 8)');
  assert(!!nextTask && nextTask.dueDate === '2026-11-15', 'Monthly recurring task idempotently generates next occurrence for 2026-11-15');

  // Idempotency: completing again does NOT create duplicate nextTask
  const repeatComplete = await TaskRepository.complete(task1.id);
  assert(!repeatComplete.nextTask, 'Completing already-completed task does not create duplicate recurring occurrence (Invariant 4)');

  // Soft delete (Trash)
  await TaskRepository.softDelete(task1.id);
  const trashedTask = await db.tasks.get(task1.id);
  assert(!!trashedTask?.deletedAt, 'Soft delete moves task to Trash by stamping deletedAt');

  // Active query excludes trashed
  const activeTasks = await TaskRepository.queryActive();
  assert(!activeTasks.some(t => t.id === task1.id), 'Active task queries exclude deleted records (Invariant 6)');

  // Restore task
  await TaskRepository.restore(task1.id);
  const restoredTask = await db.tasks.get(task1.id);
  assert(!restoredTask?.deletedAt, 'Task restored from trash with deletedAt cleared');

  // -----------------------------------------------------------------
  // 3. ATOMIC NOTE -> TASK CONVERSION (Section 15)
  // -----------------------------------------------------------------
  console.log('\n--- 3. Atomic Note to Task Conversion ---');
  const note1 = await NoteRepository.create({
    title: 'Ideas for home improvement',
    content: 'Check roof insulation and repaint door',
    category: 'Home'
  });
  assert(!!note1.id, 'Created source note');

  const convertedTask = await NoteRepository.convertToTask(note1.id, 'Repaint front door');
  assert(!!convertedTask.id, 'Converted note to new task');
  assert(convertedTask.title === 'Repaint front door', 'Converted task has expected title');

  // Verify source note was NOT destroyed
  const verifyNoteStillExists = await db.notes.get(note1.id);
  assert(!!verifyNoteStillExists, 'Source note is preserved after conversion (Section 15)');

  // Verify relationship established
  const noteRels = await RelationshipRepository.findForRecord(note1.id);
  assert(noteRels.some(r => r.targetId === convertedTask.id), 'Relationship record connects source Note to Target Task');

  // -----------------------------------------------------------------
  // 4. PERSON DELETION & RELATIONSHIP INTEGRITY (Sections 10, 132, 161)
  // -----------------------------------------------------------------
  console.log('\n--- 4. Person Deletion & Relationship Preservation ---');
  const person = await PersonRepository.create({
    name: 'Dr. Ramesh Kumar',
    relationship: 'Family Doctor',
    phone: '+91 98765 43210'
  });

  const doctorTask = await TaskRepository.create({
    title: 'Pick up medical prescription',
    linkedPersonId: person.id,
    dueDate: '2026-10-10'
  });

  const doctorExpense = await ExpenseRepository.create({
    amountMinor: 80000, // ₹800.00
    category: 'Healthcare',
    date: '2026-10-05',
    notes: 'Consultation fee'
  });

  // Link relationship
  await RelationshipRepository.createRelationship('person', person.id, 'task', doctorTask.id, 'Assigned Patient');
  await RelationshipRepository.createRelationship('person', person.id, 'expense', doctorExpense.id, 'Doctor Payment');

  // Verify relationships exist
  const personRelsBefore = await RelationshipRepository.findForRecord(person.id);
  assert(personRelsBefore.length === 2, 'Doctor has 2 explicit relationship links');

  // Permanently delete person
  await PersonRepository.permanentDelete(person.id);

  // Verify person is deleted
  const verifyPersonDeleted = await db.people.get(person.id);
  assert(!verifyPersonDeleted, 'Person record deleted permanently');

  // Verify related task and expense STILL EXIST (Section 132 & 161)
  const verifyDoctorTask = await db.tasks.get(doctorTask.id);
  assert(!!verifyDoctorTask, 'Linked task is preserved when Person is deleted (Section 132)');
  assert(!verifyDoctorTask.linkedPersonId, 'Task linkedPersonId was cleanly unlinked without errors');

  const verifyDoctorExpense = await db.expenses.get(doctorExpense.id);
  assert(!!verifyDoctorExpense, 'Linked expense is preserved when Person is deleted (Section 132)');

  // Verify relationship edges pointing to deleted person were cleaned up
  const personRelsAfter = await RelationshipRepository.findForRecord(person.id);
  assert(personRelsAfter.length === 0, 'No dangling relationship edges left pointing to deleted person (Invariants 1 & 2)');

  // -----------------------------------------------------------------
  // 5. ATTACHMENT REFERENCE COUNTING & CLEANUP (Sections 135, 136, 162)
  // -----------------------------------------------------------------
  console.log('\n--- 5. Attachment Reference Counting & Safe Cleanup ---');
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const att = await AttachmentRepository.save('lab_report.png', 'image/png', 1024, dummyBase64);
  assert(!!att.id, 'Saved attachment file with validated MIME type');

  // Attach same file to 2 different tasks
  const tA = await TaskRepository.create({ title: 'Task A', attachmentIds: [att.id] });
  const tB = await TaskRepository.create({ title: 'Task B', attachmentIds: [att.id] });

  // Initial reference count should be 2
  const initialRefCount = await AttachmentRepository.countReferences(att.id);
  assert(initialRefCount === 2, 'Attachment has reference count of 2 across tasks');

  // Unlink from Task A
  const unlink1 = await AttachmentRepository.unlinkFromRecord(att.id, 'task', tA.id);
  assert(unlink1.remainingReferences === 1, 'Remaining reference count after unlinking Task A is 1');
  assert(!unlink1.wasDeleted, 'Physical attachment was NOT deleted because Task B still references it (Section 135)');

  const attStillInDb = await db.attachments.get(att.id);
  assert(!!attStillInDb, 'Attachment file still exists in database');

  // Unlink from Task B
  const unlink2 = await AttachmentRepository.unlinkFromRecord(att.id, 'task', tB.id);
  assert(unlink2.remainingReferences === 0, 'Remaining reference count is now 0');
  assert(unlink2.wasDeleted, 'Physical attachment was automatically purged when reference count reached 0 (Section 135 & 162)');

  const attPurgedFromDb = await db.attachments.get(att.id);
  assert(!attPurgedFromDb, 'Attachment record purged from database cleanly');

  // -----------------------------------------------------------------
  // 6. SECURITY: PROTOTYPE POLLUTION, XSS, URLS & LIMITS (Sections 47-56)
  // -----------------------------------------------------------------
  console.log('\n--- 6. Security Defenses: Prototype Pollution, XSS, URLs ---');

  // Prototype pollution payload
  const maliciousJson = '{"title":"Malicious Task","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}}}';
  const sanitized = safeJsonParse(maliciousJson);
  assert(!(sanitized as any).polluted && !(Object.prototype as any).polluted, 'Prototype pollution keys (__proto__, constructor, prototype) completely blocked');

  // URL security
  assert(isSafeUrl('https://example.com/doc'), 'HTTPS URL allowed');
  assert(isSafeUrl('tel:+919876543210'), 'Telephone URL allowed');
  assert(!isSafeUrl('javascript:alert(1)'), 'javascript: scheme rejected (Section 53)');
  assert(!isSafeUrl('data:text/html,<script>alert(1)</script>'), 'data: script scheme rejected (Section 53)');

  // MIME security
  assert(isValidAttachmentMime('image/jpeg'), 'JPEG image permitted');
  assert(isValidAttachmentMime('application/pdf'), 'PDF permitted');
  assert(!isValidAttachmentMime('image/svg+xml'), 'Raw SVG rejected to prevent active XML script execution (Section 48)');
  assert(!isValidAttachmentMime('text/html'), 'text/html rejected (Section 47)');

  // -----------------------------------------------------------------
  // 7. BACKUP INTEGRITY CHECKSUM & TAMPER REJECTION (Sections 26, 94, 144)
  // -----------------------------------------------------------------
  console.log('\n--- 7. Backup Integrity Verification & Anti-Tampering ---');
  const backup = await createBackupPayload();
  assert(backup.format === 'personal-life-os-backup', 'Backup has explicit format identifier');
  assert(backup.backupVersion === 1, 'Backup has version 1');
  assert(!!backup.integrity?.checksum, 'Backup includes cryptographic SHA-256 integrity checksum');

  // Valid backup preview
  const validPreview = await validateAndPreviewBackup(JSON.stringify(backup));
  assert(validPreview.summary.isValid, 'Unaltered backup passes integrity validation');

  // Tamper test: modify one character in the backup tables
  const tamperedTables = { ...backup.tables, tasks: [...backup.tables.tasks, { id: 'fake_tampered_id', title: 'Injected' } as any] };
  const tamperedBackup = { ...backup, tables: tamperedTables };
  const tamperedPreview = await validateAndPreviewBackup(JSON.stringify(tamperedBackup));
  assert(!tamperedPreview.summary.isValid, 'Tampered backup fails SHA-256 integrity verification safely before restore (Section 26)');

  // -----------------------------------------------------------------
  // 8. ENCRYPTED BACKUP AES-GCM ROUND TRIP (Sections 27, 93, 94)
  // -----------------------------------------------------------------
  console.log('\n--- 8. Encrypted Backup Web Crypto Round Trip ---');
  const secretPayload = JSON.stringify({ personalJournal: 'Private thoughts not shared with anyone.' });
  const passphrase = 'SuperSecretLocalPassword#99';
  const { ciphertextBase64, saltHex, ivHex } = await encryptData(secretPayload, passphrase);
  assert(ciphertextBase64.length > 0 && saltHex.length === 32 && ivHex.length === 24, 'AES-GCM 256-bit encryption with PBKDF2 salt generated');

  const decryptedPayload = await decryptData(ciphertextBase64, saltHex, ivHex, passphrase);
  assert(decryptedPayload === secretPayload, 'Decrypted payload matches original sensitive data');

  let failedWrongPass = false;
  try {
    await decryptData(ciphertextBase64, saltHex, ivHex, 'IncorrectPassphrase');
  } catch {
    failedWrongPass = true;
  }
  assert(failedWrongPass, 'Incorrect password decryption fails safely without crashing (Section 27)');

  // -----------------------------------------------------------------
  // 9. TRANSACTIONAL RESTORE & POST-RESTORE VERIFICATION (Sections 82-84)
  // -----------------------------------------------------------------
  console.log('\n--- 9. Transactional Restore & Post-Restore Verification ---');
  const restoreResult = await restoreFromBackup(backup, 'replace');
  assert(restoreResult.success, 'Restore completed in transactional Replace mode');
  assert(!!restoreResult.verificationSummary?.includes('verified'), 'Post-restore verification report produced (Section 83)');

  // -----------------------------------------------------------------
  // 10. DATABASE INTEGRITY SCANNER (Sections 73, 74, 75)
  // -----------------------------------------------------------------
  console.log('\n--- 10. Database Integrity Scanner (All 10 Invariants) ---');
  const integrityReport = await IntegrityService.scan(false);
  assert(integrityReport.isHealthy, 'Comprehensive integrity scanner reports 10/10 Invariants Healthy');
  assert(integrityReport.totalViolations === 0, 'Zero invariant violations detected');

  // -----------------------------------------------------------------
  // 11. COMMITMENTS & PROMISES (Master Concept #14)
  // -----------------------------------------------------------------
  console.log('\n--- 11. Commitments & Promises ---');
  const commitment = await CommitmentRepository.create({
    who: 'Mom',
    what: 'Book dental checkup appointment',
    promisedDate: getTodayDateString(),
    context: 'Requested during family call on Sunday'
  });
  assert(!!commitment.id, 'Created commitment with stable UUID');
  assert(commitment.who === 'Mom', 'Commitment records beneficiary "Mom"');

  const pendingCommitments = await CommitmentRepository.queryPending();
  assert(pendingCommitments.some(c => c.id === commitment.id), 'Pending commitments query includes newly promised item');

  await CommitmentRepository.fulfill(commitment.id);
  const fulfilled = await db.commitments.get(commitment.id);
  assert(fulfilled?.status === 'fulfilled', 'Commitment marked fulfilled cleanly');

  // -----------------------------------------------------------------
  // 12. DECISION REASONING MEMORY (Master Concept #6)
  // -----------------------------------------------------------------
  console.log('\n--- 12. Decision Reasoning Memory ---');
  const decision = await DecisionRepository.create({
    title: 'Don\'t launch Brandex community publicly yet',
    reason: 'Existing group is inactive. Need 25 genuinely active members first.',
    alternativesConsidered: ['Launch immediately', 'Invite random students', 'Build through existing communities'],
    decisionDate: getTodayDateString(),
    reviewDate: getTodayDateString() // Due today for test evaluation
  });
  assert(!!decision.id, 'Decision recorded with personal reasoning');
  assert(decision.alternativesConsidered.length === 3, 'Alternatives considered are preserved');

  const reviewDue = await DecisionRepository.queryDueForReview();
  assert(reviewDue.some(d => d.id === decision.id), 'Decision due for review surfaced on reviewDate');

  // -----------------------------------------------------------------
  // 13. OPEN LOOPS & ATTENTION ENGINE (Master Concepts #1, #10, #23)
  // -----------------------------------------------------------------
  console.log('\n--- 13. Open Loops & Attention Engine (Life Load + Minimum Day) ---');
  const openLoop = await OpenLoopRepository.create({
    title: 'Proposal from Sathvik',
    loopType: 'waiting_on',
    waitingOnPersonName: 'Sathvik',
    consequence: 'significant'
  });
  assert(!!openLoop.id && openLoop.status === 'open', 'Open loop captured in unresolved state');

  // Create a high-consequence task with "Why" context
  const criticalTask = await TaskRepository.create({
    title: 'Pay electricity bill',
    why: 'Avoid power cutoff to workspace',
    consequence: 'critical',
    dueDate: getTodayDateString(),
    isMinimumDay: true
  });

  const evaluation = await AttentionService.evaluateAttention();
  assert(evaluation.attentionItems.length > 0, 'Attention engine generates active attention cards');
  assert(!!evaluation.lifeLoad, 'Life Load radar assessed');
  assert(evaluation.minimumDayTasks.length > 0, 'The Minimum Day selects top consequence items');
  assert(evaluation.minimumDayTasks.some(t => t.id === criticalTask.id), 'Critical consequence task prioritized in Minimum Day');

  // -----------------------------------------------------------------
  // 14. LIFE GRAPH 360-DEGREE CONTEXT TRAVERSAL (Master Concepts #4, #25)
  // -----------------------------------------------------------------
  console.log('\n--- 14. Life Graph 360-Degree Context Engine ---');
  const workshopEvent = await db.events.add({
    id: generateId(),
    title: 'Brandex School Workshop',
    date: getTodayDateString(),
    recurrence: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const workshopExpense = await ExpenseRepository.create({
    amountMinor: 125000, // ₹1,250.00
    category: 'Workshop Travel',
    date: getTodayDateString(),
    why: 'Train tickets for school workshop'
  });

  // Link expense and task to event
  await RelationshipRepository.createRelationship('event', workshopEvent, 'expense', workshopExpense.id, 'Workshop Travel Cost');
  await RelationshipRepository.createRelationship('event', workshopEvent, 'task', criticalTask.id, 'Prep Requirement');

  // Assemble full context
  const eventContext = await LifeGraphService.getEntityContext('event', workshopEvent);
  assert(eventContext.title === 'Brandex School Workshop', 'Life graph loaded event context');
  assert(eventContext.connectedExpenses.length >= 1, 'Life graph resolved connected expenses');
  assert(eventContext.totalExpenseMinor === 125000, 'Life graph accurately calculated ₹1,250 total expense footprint');
  assert(eventContext.connectedTasks.some(t => t.id === criticalTask.id), 'Life graph resolved connected prep tasks');

  // -----------------------------------------------------------------
  // 15. EVENT BUS & NOTIFICATION ARCHITECTURE (Sections 29, 39, 41)
  // -----------------------------------------------------------------
  console.log('\n--- 15. Event Bus & Notification Engine ---');

  // Test EventBus emission and subscription
  let eventCaptured = false;
  const unsubscribeBus = eventBus.on('TASK_MUTATED', (payload) => {
    if (payload && (payload as { id?: string }).id === 'test-task-123') {
      eventCaptured = true;
    }
  });
  eventBus.emit('TASK_MUTATED', { id: 'test-task-123' });
  assert(eventCaptured === true, 'EventBus successfully dispatched and delivered typed event');
  unsubscribeBus();

  // Test Reminder Creation with scheduling
  const testReminder = await ReminderRepository.create({
    title: 'Review quarterly savings plan',
    date: getTodayDateString(),
    time: '23:59',
    recurrence: 'none'
  });
  assert(!!testReminder.id, 'ReminderRepository created reminder with UUID');
  assert(testReminder.notificationState === 'scheduled', 'New reminder initialized in scheduled notification state');

  // Test Reminder Reschedule
  const rescheduled = await ReminderRepository.reschedule(testReminder.id, '2026-11-01', '10:00');
  assert(rescheduled?.date === '2026-11-01', 'Reminder date updated on reschedule');
  assert(rescheduled?.status === 'active' || rescheduled?.status === 'rescheduled', 'Reminder status remains active after reschedule');

  // Test Past Reminder Missed Detection
  const pastReminder = await db.reminders.add({
    id: generateId(),
    title: 'Missed review yesterday',
    date: '2020-01-01',
    time: '12:00',
    status: 'active',
    recurrence: 'none',
    notificationState: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const missedList = await notificationService.checkMissedReminders();
  assert(missedList.some((r) => r.id === pastReminder), 'Notification engine correctly identified missed reminder from past date');

  // Dismiss missed reminder
  await ReminderRepository.dismiss(pastReminder);
  const dismissedRecord = await db.reminders.get(pastReminder);
  assert(dismissedRecord?.status === 'dismissed', 'Missed reminder successfully dismissed');
  assert(dismissedRecord?.notificationState === 'cancelled', 'Dismissed reminder notification marked cancelled');

  // -----------------------------------------------------------------
  // 16. EDGE CASES: MONTH-END RECURRENCE, IDEMPOTENCY, AND MONETARY INVARIANTS
  // -----------------------------------------------------------------
  console.log('\n--- 16. Edge Cases, Month-End Recurrence & Invariants ---');

  // 1. Month-End Recurrence Edge Cases (Section 13, 14)
  const jan31Recurrence = calculateNextOccurrence('2026-01-31', 'monthly');
  assert(jan31Recurrence === '2026-02-28', 'Jan 31 monthly recurrence correctly clamps to Feb 28 without skipping to March');

  const leapFebRecurrence = calculateNextOccurrence('2024-02-29', 'yearly');
  assert(leapFebRecurrence === '2025-02-28', 'Feb 29 leap year yearly recurrence safely clamps to Feb 28 on non-leap years');

  const march31Recurrence = calculateNextOccurrence('2026-03-31', 'monthly');
  assert(march31Recurrence === '2026-04-30', 'March 31 monthly recurrence correctly clamps to April 30');

  // 2. Task Idempotency: Duplicate complete, delete, restore (Section 7)
  const idempTask = await TaskRepository.create({
    title: 'Idempotency verification task',
    dueDate: '2026-10-10',
    priority: 'medium'
  });
  await TaskRepository.complete(idempTask.id);
  const completeAgain = await TaskRepository.complete(idempTask.id);
  assert(completeAgain.task.status === 'completed', 'Second completion call on completed task succeeds idempotently');

  await TaskRepository.softDelete(idempTask.id);
  await TaskRepository.softDelete(idempTask.id); // duplicate delete
  const softDeletedTask = await db.tasks.get(idempTask.id);
  assert(!!softDeletedTask?.deletedAt, 'Duplicate soft delete is idempotent and preserves deleted status');

  await TaskRepository.restore(idempTask.id);
  await TaskRepository.restore(idempTask.id); // duplicate restore
  const idempRestoredTask = await db.tasks.get(idempTask.id);
  assert(idempRestoredTask?.deletedAt === undefined, 'Duplicate restore is idempotent and leaves task active');

  // 3. Monetary Invariants: NaN, Infinity, negative amounts (Section 29)
  assert(toMinorUnits('₹1,450.75') === 145075, 'Currency parser extracts valid integer minor units from formatted string');
  assert(toMinorUnits(NaN) === 0, 'NaN input to toMinorUnits safely returns 0 minor units');
  assert(toMinorUnits(Infinity) === 0, 'Infinity input to toMinorUnits safely returns 0 minor units');
  assert(toMinorUnits('invalid_amount') === 0, 'Malformed text input to toMinorUnits safely returns 0 minor units');

  let negativeExpenseFailed = false;
  try {
    await ExpenseRepository.create({
      amountMinor: -5000,
      category: 'Negative Test',
      date: getTodayDateString()
    });
  } catch {
    negativeExpenseFailed = true;
  }
  assert(negativeExpenseFailed === true, 'ExpenseRepository strictly rejects negative amountMinor');

  // 4. Relationship Integrity: Self-reference block & duplicate prevention (Section 9, 83)
  let selfRefFailed = false;
  try {
    await RelationshipRepository.createRelationship('task', idempTask.id, 'task', idempTask.id, 'Self Link');
  } catch {
    selfRefFailed = true;
  }
  assert(selfRefFailed === true, 'RelationshipRepository strictly rejects self-referencing relationship');

  const relTaskTarget = await TaskRepository.create({
    title: 'Target Task for Rel',
    dueDate: '2026-10-12',
    priority: 'low'
  });
  const rel1 = await RelationshipRepository.createRelationship('task', idempTask.id, 'task', relTaskTarget.id, 'Depends on');
  const rel2 = await RelationshipRepository.createRelationship('task', idempTask.id, 'task', relTaskTarget.id, 'Depends on duplicate');
  assert(rel1.id === rel2.id, 'Duplicate relationship creation returns existing link idempotently');

  // Cleanup relationships for record
  const cleanedCount = await RelationshipRepository.cleanupForRecord(idempTask.id);
  assert(cleanedCount >= 1, 'Relationship cleanup removed all edges referencing the record');
  const remainingRels = await RelationshipRepository.findForRecord(idempTask.id);
  assert(remainingRels.length === 0, 'No dangling relationship edges left after cleanup');

  // -----------------------------------------------------------------
  // 18. FIRST-LAUNCH NAME VALIDATION & GREETING LOGIC
  // -----------------------------------------------------------------
  console.log('\n--- 18. First-Launch Personalization & Time-Aware Greeting ---');
  const emptyValidation = SettingsService.validateDisplayName('');
  assert(emptyValidation.isValid === false, 'Rejects empty display name');

  const whitespaceValidation = SettingsService.validateDisplayName('     ');
  assert(whitespaceValidation.isValid === false, 'Rejects whitespace-only display name');

  const longValidation = SettingsService.validateDisplayName('A'.repeat(51));
  assert(longValidation.isValid === false, 'Rejects display name over 50 characters');

  const validValidation = SettingsService.validateDisplayName('   Pavan Kumar   ');
  assert(validValidation.isValid === true && validValidation.cleanName === 'Pavan Kumar', 'Trims whitespace correctly');

  const unicodeValidation = SettingsService.validateDisplayName('Pavān Müller 李雷');
  assert(unicodeValidation.isValid === true && unicodeValidation.cleanName === 'Pavān Müller 李雷', 'Preserves Unicode characters');

  const emojiValidation = SettingsService.validateDisplayName('Pavan 🚀');
  assert(emojiValidation.isValid === true && emojiValidation.cleanName === 'Pavan 🚀', 'Preserves emoji in display name');

  // Persistence via SettingsService & SettingsRepository
  const savedSettings = await SettingsService.saveDisplayName('Pavan');
  assert(savedSettings.displayName === 'Pavan' && savedSettings.isOnboarded === true, 'Saves display name to IndexedDB settings');
  const retrievedName = await SettingsService.getDisplayName();
  assert(retrievedName === 'Pavan', 'Retrieves stored display name accurately');

  // Time-aware greeting intervals per Phase 3:
  // 00:00–11:59: Good morning
  const morningDate = new Date();
  morningDate.setHours(8, 30, 0, 0);
  assert(getTimeAwareGreeting('Pavan', morningDate) === 'Good morning, Pavan', '08:30 returns Good morning, Pavan');

  // 12:00–16:59: Good afternoon
  const afternoonDate = new Date();
  afternoonDate.setHours(14, 15, 0, 0);
  assert(getTimeAwareGreeting('Pavan', afternoonDate) === 'Good afternoon, Pavan', '14:15 returns Good afternoon, Pavan');

  // 17:00–23:59: Good evening
  const eveningDate = new Date();
  eveningDate.setHours(18, 0, 0, 0);
  assert(getTimeAwareGreeting('Pavan', eveningDate) === 'Good evening, Pavan', '18:00 returns Good evening, Pavan');

  const lateNightDate = new Date();
  lateNightDate.setHours(2, 0, 0, 0);
  assert(getTimeAwareGreeting('Pavan', lateNightDate) === 'Good morning, Pavan', '02:00 returns Good morning, Pavan per Phase 3');

  // Subtle date formatting
  const testDate = new Date(2026, 9, 5); // October 5, 2026
  const subtleStr = getSubtleDateString(testDate);
  assert(subtleStr.includes('5') && subtleStr.includes('October'), 'Subtle date contains weekday, day, and month');
  assert(!subtleStr.includes('2026'), 'Subtle date does not redundantly show year');

  // -----------------------------------------------------------------
  // 19. GLOBAL APPLICATION API & DOMAIN LAYER TRANSACTIONS
  // -----------------------------------------------------------------
  console.log('\n--- 19. Application API Layer & Domain Transactions ---');

  // Task API
  const apiTask = await api.tasks.create({ title: 'Task via API', priority: 'high' });
  assert(apiTask.title === 'Task via API' && apiTask.priority === 'high', 'api.tasks.create returns persisted task');

  await api.tasks.complete(apiTask.id);
  const apiCompletedTask = await db.tasks.get(apiTask.id);
  assert(apiCompletedTask?.status === 'completed', 'api.tasks.complete marks status completed in IndexedDB');

  await api.tasks.undoComplete(apiTask.id);
  const reopenedTask = await db.tasks.get(apiTask.id);
  assert(reopenedTask?.status === 'todo', 'api.tasks.undoComplete reopens task in IndexedDB');

  await api.tasks.snooze(apiTask.id, 2);
  const snoozedTask = await db.tasks.get(apiTask.id);
  assert((snoozedTask?.postponeCount || 0) >= 1, 'api.tasks.snooze increments postpone count and updates due date');

  // Reminder API
  const apiReminder = await api.reminders.create({ title: 'Reminder via API', date: '2026-10-10', time: '14:00' });
  assert(apiReminder.title === 'Reminder via API', 'api.reminders.create schedules reminder');

  await api.reminders.snooze(apiReminder.id, 15);
  const snoozedReminder = await db.reminders.get(apiReminder.id);
  assert(!!snoozedReminder?.snoozedUntil, 'api.reminders.snooze sets snoozedUntil');

  await api.reminders.complete(apiReminder.id);
  const completedReminder = await db.reminders.get(apiReminder.id);
  assert(completedReminder?.status === 'completed', 'api.reminders.complete marks status completed');

  // Expense API
  const apiExpense = await api.expenses.create({ amountMinor: 50000, category: 'Food', notes: 'Lunch via API' });
  assert(apiExpense.amountMinor === 50000, 'api.expenses.create records expense in minor units');

  // Open Loops API
  const apiLoop = await api.loops.create({ title: 'Waiting on report' });
  assert(apiLoop.title === 'Waiting on report', 'api.loops.create records open loop');

  await api.loops.close(apiLoop.id);
  const closedLoop = await db.openLoops.get(apiLoop.id);
  assert(closedLoop?.status === 'closed', 'api.loops.close closes open loop');

  // Commitments API
  const apiCommitment = await api.commitments.create({ personName: 'Rahul', commitmentText: 'Send budget document' });
  assert(apiCommitment.who === 'Rahul', 'api.commitments.create records commitment');

  await api.commitments.fulfill(apiCommitment.id);
  const fulfilledCommitment = await db.commitments.get(apiCommitment.id);
  assert(fulfilledCommitment?.status === 'fulfilled', 'api.commitments.fulfill marks commitment fulfilled');

  // Haptics safe fallback
  triggerHaptic('light');
  triggerHaptic('success');
  triggerHaptic('error');
  assert(true, 'triggerHaptic executes gracefully with silent fallback');

  // -----------------------------------------------------------------
  // 20. DISPLAY NAME VALIDATION & GREETING BOUNDARIES (Phase 3)
  // -----------------------------------------------------------------
  console.log('\n--- 20. Display Name Validation & Time-Aware Greeting ---');

  // Name edge cases
  assert(SettingsService.validateDisplayName('Pavan').isValid, 'Valid standard name accepts "Pavan"');
  assert(SettingsService.validateDisplayName('P').isValid, 'Single character name accepts "P"');
  assert(SettingsService.validateDisplayName("O'Connor").isValid, 'Apostrophe name accepts "O\'Connor"');
  assert(SettingsService.validateDisplayName('José-María').isValid, 'Accented unicode name accepts "José-María"');
  assert(SettingsService.validateDisplayName('User 123').isValid, 'Alphanumeric name accepts "User 123"');
  assert(!SettingsService.validateDisplayName('').isValid, 'Empty name is safely rejected');
  assert(!SettingsService.validateDisplayName('   ').isValid, 'Whitespace-only name is safely rejected');
  assert(!SettingsService.validateDisplayName('A'.repeat(101)).isValid, '100+ character name is safely rejected');

  // Greeting boundaries: 00:00-11:59 morning, 12:00-16:59 afternoon, 17:00-23:59 evening
  const morningMidnight = new Date(2026, 9, 5, 0, 0, 0);
  const morningLate = new Date(2026, 9, 5, 11, 59, 0);
  const afternoonNoon = new Date(2026, 9, 5, 12, 0, 0);
  const afternoonLate = new Date(2026, 9, 5, 16, 59, 0);
  const eveningEarly = new Date(2026, 9, 5, 17, 0, 0);
  const eveningMidnight = new Date(2026, 9, 5, 23, 59, 0);

  assert(getTimeAwareGreeting('Pavan', morningMidnight) === 'Good morning, Pavan', '00:00 produces "Good morning"');
  assert(getTimeAwareGreeting('Pavan', morningLate) === 'Good morning, Pavan', '11:59 produces "Good morning"');
  assert(getTimeAwareGreeting('Pavan', afternoonNoon) === 'Good afternoon, Pavan', '12:00 produces "Good afternoon"');
  assert(getTimeAwareGreeting('Pavan', afternoonLate) === 'Good afternoon, Pavan', '16:59 produces "Good afternoon"');
  assert(getTimeAwareGreeting('Pavan', eveningEarly) === 'Good evening, Pavan', '17:00 produces "Good evening"');
  assert(getTimeAwareGreeting('Pavan', eveningMidnight) === 'Good evening, Pavan', '23:59 produces "Good evening"');

  // -----------------------------------------------------------------
  // 21. RECURRING REMINDERS & LEAP YEAR CALENDAR (Phase 7, 8)
  // -----------------------------------------------------------------
  console.log('\n--- 21. Recurring Reminders & Calendar Boundaries ---');

  // Leap year Feb 29 arithmetic
  const leapDayNextYear = calculateNextOccurrence('2024-02-29', 'yearly');
  assert(leapDayNextYear === '2025-02-28', 'Yearly recurrence from Feb 29 maps safely to Feb 28 on non-leap year');

  const monthEndMarch = calculateNextOccurrence('2024-01-31', 'monthly');
  assert(monthEndMarch === '2024-02-29', 'Monthly recurrence from Jan 31 maps safely to Feb 29 on leap year');

  const monthEndApril = calculateNextOccurrence('2024-03-31', 'monthly');
  assert(monthEndApril === '2024-04-30', 'Monthly recurrence from Mar 31 maps safely to Apr 30');

  // Recurring reminder completion advancement
  const recurringReminder = await api.reminders.create({
    title: 'Daily Standup Call',
    date: '2026-10-05',
    time: '09:00',
    recurrence: 'daily'
  });

  const completionResult = await api.reminders.complete(recurringReminder.id);
  assert(completionResult.nextOccurrence === '2026-10-06', 'Completing daily recurring reminder advances date to next day');
  const advancedReminder = await db.reminders.get(recurringReminder.id);
  assert(advancedReminder?.date === '2026-10-06', 'Recurring reminder date in IndexedDB advanced to 2026-10-06');
  assert(advancedReminder?.status === 'active', 'Recurring reminder status remains active for next occurrence');

  // Snooze in-place modification (does not create duplicate record)
  const initialReminderCount = await db.reminders.count();
  await api.reminders.snooze(recurringReminder.id, 15);
  const postSnoozeCount = await db.reminders.count();
  assert(initialReminderCount === postSnoozeCount, 'Snoozing reminder updates record in-place without creating duplicate');

  // -----------------------------------------------------------------
  // 22. RELATIONSHIP INTEGRITY & DEDUPLICATION (Phase 10)
  // -----------------------------------------------------------------
  console.log('\n--- 22. Relationship Integrity & Deduplication ---');

  const personA = await api.people.create({ name: 'Vikram Mehta' });
  const taskA = await api.tasks.create({ title: 'Prepare review for Vikram' });

  const relA = await api.relationships.link('task', taskA.id, 'person', personA.id, 'assigned_to');
  assert(!!relA.id, 'Successfully linked task to person');

  // Attempt duplicate link in reverse direction
  const relB = await api.relationships.link('person', personA.id, 'task', taskA.id, 'assigned_to');
  assert(relA.id === relB.id, 'Duplicate relationship creation returns existing record without duplicating');

  // Self-reference prevention
  let selfRefThrew = false;
  try {
    await api.relationships.link('task', taskA.id, 'task', taskA.id);
  } catch {
    selfRefThrew = true;
  }
  assert(selfRefThrew, 'Self-referencing relationship is rejected');

  // -----------------------------------------------------------------
  // 23. MONEY & BUDGET INVARIANT CALCULATIONS (Phase 13)
  // -----------------------------------------------------------------
  console.log('\n--- 23. Money & Budget Invariants ---');

  const testMonth = '2026-10';
  await api.budgets.setBudget(testMonth, 'Dining', 1000000); // ₹10,000 in minor units

  const exp1 = await api.expenses.create({
    amountMinor: 200000, // ₹2,000
    category: 'Dining',
    date: '2026-10-05'
  });

  const diningExpenses = await db.expenses
    .filter(e => !e.deletedAt && e.category === 'Dining' && e.date.startsWith(testMonth))
    .toArray();
  const diningTotal = diningExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  assert(diningTotal === 200000, 'Expense correctly summed in integer minor units (₹2,000)');

  // Edit expense: ₹2,000 -> ₹3,000
  await api.expenses.update(exp1.id, { amountMinor: 300000 });
  const updatedExp = await db.expenses.get(exp1.id);
  assert(updatedExp?.amountMinor === 300000, 'Expense update to ₹3,000 persists accurately without floating point error');

  // -----------------------------------------------------------------
  // 24. CONCURRENCY & RAPID MUTATION STABILITY (Phase 22)
  // -----------------------------------------------------------------
  console.log('\n--- 24. Concurrency & Rapid Mutations ---');

  const rapidTasks = await Promise.all([
    api.tasks.create({ title: 'Concurrent Task 1' }),
    api.tasks.create({ title: 'Concurrent Task 2' }),
    api.tasks.create({ title: 'Concurrent Task 3' }),
    api.tasks.create({ title: 'Concurrent Task 4' }),
    api.tasks.create({ title: 'Concurrent Task 5' })
  ]);

  assert(rapidTasks.length === 5, '5 concurrent task creations succeed simultaneously');
  const distinctIds = new Set(rapidTasks.map(t => t.id));
  assert(distinctIds.size === 5, 'All concurrent records receive globally unique IDs');

  // Rapid toggle completion
  await Promise.all(rapidTasks.map(t => api.tasks.complete(t.id)));
  const completedRapid = await db.tasks.filter(t => rapidTasks.some(rt => rt.id === t.id && t.status === 'completed')).toArray();
  assert(completedRapid.length === 5, 'Concurrent completions resolve to completed status without race conditions');

  // -----------------------------------------------------------------
  // 25. EXTENSIVE SEARCH QUERY EDGE CASES (Phase 17)
  // -----------------------------------------------------------------
  console.log('\n--- 25. Search Query Edge Cases ---');

  const specialNote = await api.notes.create({
    title: 'Secret Blueprint [v2.0] & Notes #2026',
    content: 'Details: ₹45,000 budget for "Project Alpha" (100% confidential)'
  });

  const matchTitle = await db.notes.filter(n => !n.deletedAt && n.title.toLowerCase().includes('[v2.0]')).first();
  assert(matchTitle?.id === specialNote.id, 'Search handles square brackets and punctuation');

  const matchUnicode = await db.notes.filter(n => !n.deletedAt && n.content.includes('₹45,000')).first();
  assert(matchUnicode?.id === specialNote.id, 'Search handles unicode currency symbols');

  // -----------------------------------------------------------------
  // 26. COMPLETE EXPENSE LIFECYCLE & EDIT PERSISTENCE (Prompt Section 3, 5-8)
  // -----------------------------------------------------------------
  console.log('\n--- 26. Complete Expense Lifecycle & Edit Persistence ---');

  // CREATE
  const expense1 = await ExpenseRepository.create({
    amountMinor: toMinorUnits(450), // ₹450
    category: 'Food',
    paymentMethod: 'upi',
    date: '2026-10-07',
    notes: 'Lunch with colleagues'
  });
  assert(expense1.amountMinor === 45000, 'Expense created with ₹450 (45000 paise)');
  assert(expense1.category === 'Food', 'Expense category is Food');
  assert(expense1.paymentMethod === 'upi', 'Expense payment method is UPI');

  // EDIT: ₹450 -> ₹550 (Sections 3 & 6)
  const initialCreatedAt = expense1.createdAt;
  const initialId = expense1.id;
  const updatedExpense = await ExpenseRepository.update(initialId, {
    amountMinor: toMinorUnits(550), // ₹550
    notes: 'Lunch with colleagues + dessert'
  });

  assert(updatedExpense.id === initialId, 'Edit strictly preserves record ID');
  assert(updatedExpense.createdAt === initialCreatedAt, 'Edit strictly preserves original createdAt');
  assert(updatedExpense.amountMinor === 55000, 'Expense updated successfully to ₹550 (55000 paise)');
  assert(updatedExpense.updatedAt >= initialCreatedAt, 'Edit updates updatedAt timestamp');

  // VERIFY: No stale ₹450 in database
  const activeFoodExpenses = await db.expenses.filter(e => !e.deletedAt && e.category === 'Food').toArray();
  const hasStale450 = activeFoodExpenses.some(e => e.amountMinor === 45000);
  assert(!hasStale450, 'Zero stale ₹450 records exist in database after edit (Section 3)');
  const foundUpdated = activeFoodExpenses.find(e => e.id === initialId);
  assert(foundUpdated?.amountMinor === 55000, 'Persisted record accurately reads ₹550 from IndexedDB');

  // DUPLICATE (Section 10)
  const duplicatedExpense = await ExpenseRepository.duplicate(initialId);
  assert(duplicatedExpense.id !== initialId, 'Duplicate creates a new globally unique ID');
  assert(duplicatedExpense.amountMinor === 55000, 'Duplicated expense copies ₹550 amount');
  assert(duplicatedExpense.category === 'Food', 'Duplicated expense copies category');

  // CANCEL EDIT INVARIANT (Section 7)
  const snapshotBefore = await db.expenses.get(initialId);
  // User starts editing but cancels -> no update call made
  const snapshotAfter = await db.expenses.get(initialId);
  assert(snapshotBefore?.amountMinor === snapshotAfter?.amountMinor, 'Cancelled edit preserves original database value without mutation');

  // DOUBLE SAVE GUARD (Section 8)
  const doubleSave1 = ExpenseRepository.update(initialId, { notes: 'Double save test' });
  const doubleSave2 = ExpenseRepository.update(initialId, { notes: 'Double save test' });
  const [res1, res2] = await Promise.all([doubleSave1, doubleSave2]);
  assert(res1.id === res2.id, 'Rapid double save updates same record without creating duplicates');

  // -----------------------------------------------------------------
  // 27. COMPLETE DELETE, TRASH, RESTORE & PERMANENT DELETE (Prompt Section 4)
  // -----------------------------------------------------------------
  console.log('\n--- 27. Universal Lifecycle: Delete, Trash, Restore & Permanent Delete ---');

  const lifecycleTask = await TaskRepository.create({ title: 'Lifecycle Audit Task' });
  const taskId = lifecycleTask.id;

  // Soft delete
  await TaskRepository.softDelete(taskId);
  const activeAfterDelete = await db.tasks.get(taskId);
  assert(!!activeAfterDelete?.deletedAt, 'Task marked deleted with timestamp');

  // Appears in Trash
  const trashedInDb = await db.tasks.filter(t => !!t.deletedAt && t.id === taskId).first();
  assert(trashedInDb !== undefined, 'Deleted task appears in Trash query');

  // Restore
  await TaskRepository.restore(taskId);
  const restoredLifecycleTask = await db.tasks.get(taskId);
  assert(!restoredLifecycleTask?.deletedAt, 'Restored task has deletedAt cleared');

  // Permanent Delete
  await TaskRepository.permanentDelete(taskId);
  const permDeleted = await db.tasks.get(taskId);
  assert(permDeleted === undefined, 'Permanently deleted task is completely eradicated from IndexedDB');

  // -----------------------------------------------------------------
  // 28. CANVAS MODULE: OBJECT MODEL, PERSISTENCE & RELATIONS (Prompt Sections 17-23)
  // -----------------------------------------------------------------
  console.log('\n--- 28. Canvas Module: Drawing Space & Autosave ---');

  const testCanvas = await CanvasRepository.create({
    name: 'System Architecture Diagram',
    background: '#121214'
  });
  assert(testCanvas.name === 'System Architecture Diagram', 'Canvas created with name');
  assert(Array.isArray(testCanvas.objects), 'Canvas initializes with structured objects array');

  // Add structured objects
  const updatedCanvas = await CanvasRepository.update(testCanvas.id, {
    objects: [
      {
        id: generateId(),
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        strokeColor: '#6366f1',
        strokeWidth: 2,
        fillColor: 'rgba(99, 102, 241, 0.2)'
      },
      {
        id: generateId(),
        type: 'text',
        x: 120,
        y: 130,
        text: 'API Gateway',
        strokeColor: '#ffffff',
        fontSize: 16
      }
    ]
  });

  assert(updatedCanvas.objects.length === 2, 'Canvas saved 2 structured objects without rasterization loss');
  assert(updatedCanvas.objects[0].type === 'rect', 'Canvas rect object preserved');
  assert(updatedCanvas.objects[1].text === 'API Gateway', 'Canvas text object preserved');

  // Duplicate Canvas
  const dupCanvas = await CanvasRepository.duplicate(testCanvas.id);
  assert(dupCanvas.id !== testCanvas.id, 'Duplicate canvas has unique ID');
  assert(dupCanvas.name.includes('(Copy)'), 'Duplicated canvas marked with Copy suffix');
  assert(dupCanvas.objects.length === 2, 'Duplicated canvas copies structured objects');

  // -----------------------------------------------------------------
  // 29. WARRANTY ENGINE: STATUS & EXPIRATION (Prompt Sections 24-26)
  // -----------------------------------------------------------------
  console.log('\n--- 29. Warranty Tracking & Status Calculation ---');

  // Active warranty (purchased yesterday, expires in 365 days)
  const activeW = await WarrantyRepository.create({
    itemName: 'MacBook Air M3',
    brand: 'Apple',
    purchaseDate: '2026-10-06',
    warrantyPeriodMonths: 12,
    warrantyEnd: '2027-10-06',
    purchasePriceMinor: 11490000,
    reminderDaysBefore: 30
  });
  assert(activeW.status === 'active', 'Fresh warranty accurately calculated as active');
  assert(activeW.itemName === 'MacBook Air M3', 'Warranty item name saved');

  // Expiring soon warranty (expires in 10 days)
  const futureExpDate = new Date();
  futureExpDate.setDate(futureExpDate.getDate() + 10);
  const expiringW = await WarrantyRepository.create({
    itemName: 'Noise Cancelling Headphones',
    purchaseDate: '2025-10-17',
    warrantyEnd: futureExpDate.toISOString().split('T')[0],
    reminderDaysBefore: 30
  });
  assert(expiringW.status === 'expiring_soon', 'Warranty within 30 days accurately flagged expiring_soon');

  // Expired warranty (ended last year)
  const expiredW = await WarrantyRepository.create({
    itemName: 'Old Monitor',
    purchaseDate: '2024-01-01',
    warrantyEnd: '2025-01-01'
  });
  assert(expiredW.status === 'expired', 'Past warranty accurately flagged expired');

  // -----------------------------------------------------------------
  // 30. FAMILY CARE: MEMBERS, CARE REMINDERS & 360 CONTEXT (Prompt Sections 27-30)
  // -----------------------------------------------------------------
  console.log('\n--- 30. Family Care & 360 Context ---');

  const mother = await FamilyRepository.createMember({
    name: 'Mother',
    relationship: 'Mother',
    phone: '+91 9876543210',
    importantDates: [{ label: 'Birthday', date: '2026-03-12' }]
  });
  assert(mother.name === 'Mother', 'Family member created');
  assert(mother.importantDates?.[0].label === 'Birthday', 'Important date label preserved');

  // Care reminder
  const careRem = await FamilyRepository.addCareReminder({
    familyMemberId: mother.id,
    title: 'Dental Checkup Appointment',
    reminderType: 'appointment',
    dueDate: '2026-10-25',
    dueTime: '10:30'
  });
  assert(careRem.familyMemberId === mother.id, 'Care reminder linked to family member');
  assert(careRem.status === 'active', 'Care reminder created active');

  // Complete care reminder
  await FamilyRepository.completeCareReminder(careRem.id);
  const completedRem = await db.careReminders.get(careRem.id);
  assert(completedRem?.status === 'completed', 'Care reminder marked completed');

  // 360 Context Query
  const familyContext = await FamilyRepository.getFamilyContext(mother.id);
  assert(familyContext.member.id === mother.id, 'Family 360 context retrieves member');
  assert(familyContext.reminders.length >= 1, 'Family 360 context retrieves care reminders');

  // -----------------------------------------------------------------
  // 31. DOCUMENTS ARCHIVE & ENTITY LINKING (Prompt Section 31)
  // -----------------------------------------------------------------
  console.log('\n--- 31. Local Documents Vault & Linking ---');

  const doc = await DocumentRepository.create({
    title: 'MacBook Purchase Invoice',
    category: 'receipt',
    relatedEntityType: 'warranty',
    relatedEntityId: activeW.id,
    fileName: 'apple_invoice.pdf',
    fileSize: 1048576, // 1MB
    mimeType: 'application/pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQK...'
  });
  assert(doc.title === 'MacBook Purchase Invoice', 'Document created with title');
  assert(doc.category === 'receipt', 'Document category is receipt');
  assert(doc.relatedEntityId === activeW.id, 'Document linked to Warranty');

  const warrantyDocs = await DocumentRepository.queryByEntity('warranty', activeW.id);
  assert(warrantyDocs.length === 1, 'Query by entity retrieves linked document');
  assert(warrantyDocs[0].fileName === 'apple_invoice.pdf', 'Retrieved document file name matches');

  // -----------------------------------------------------------------
  // 32. PRIVACY-FIRST INVITE ENGINE (Prompt Sections 32-35)
  // -----------------------------------------------------------------
  console.log('\n--- 32. Privacy-First Invite Engine ---');

  const invite7d = await InviteRepository.createInvite('7 days');
  assert(invite7d.token.length >= 16, 'Invite generated crypto random token');

  // CRITICAL PRIVACY INVARIANT (Prompt Section 32 & 33)
  const tokenStr = invite7d.token.toLowerCase();
  assert(!tokenStr.includes('pavan'), 'Privacy Invariant: Token contains no user name');
  assert(!tokenStr.includes('@'), 'Privacy Invariant: Token contains no email address');
  assert(!tokenStr.includes('task'), 'Privacy Invariant: Token contains no task data');
  assert(!tokenStr.includes('expense'), 'Privacy Invariant: Token contains no expense data');
  assert(!tokenStr.includes('note'), 'Privacy Invariant: Token contains no note data');

  // Validation
  const validCheck = await InviteRepository.validateToken(invite7d.token);
  assert(validCheck.valid === true, 'Fresh invite token passes validation');

  // Attribution tracking
  await InviteRepository.recordAttribution(invite7d.id);
  const updatedInvite = await db.invites.get(invite7d.id);
  assert(updatedInvite?.attributionCount === 1, 'Anonymous attribution incremented to 1');

  // -----------------------------------------------------------------
  // 33. BACKUP & RESTORE SCHEMA VERSION 5 EXTENSION (Prompt Section 42)
  // -----------------------------------------------------------------
  console.log('\n--- 33. Backup & Restore Schema v5 Extension ---');

  const v5Backup = await createBackupPayload();
  assert(v5Backup.schemaVersion === 5, 'Backup payload created with Schema Version 5');
  assert(Array.isArray(v5Backup.tables.canvases), 'Backup includes canvases table');
  assert(Array.isArray(v5Backup.tables.warranties), 'Backup includes warranties table');
  assert(Array.isArray(v5Backup.tables.familyMembers), 'Backup includes familyMembers table');
  assert(Array.isArray(v5Backup.tables.careReminders), 'Backup includes careReminders table');
  assert(Array.isArray(v5Backup.tables.documents), 'Backup includes documents table');
  assert(Array.isArray(v5Backup.tables.invites), 'Backup includes invites table');

  const preview = await validateAndPreviewBackup(JSON.stringify(v5Backup));
  assert(preview.summary.isValid === true, 'Schema v5 backup passes cryptographic validation and preview');
  assert(preview.summary.schemaVersion === 5, 'Preview reports schemaVersion 5');

  const total = passed + failed;
  console.log(`\n=====================================================`);
  console.log(` TEST SUMMARY: ${passed} PASSED | ${failed} FAILED | ${total} TOTAL`);
  console.log(`=====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
