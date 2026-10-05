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
  OpenLoopRepository
} from '../src/repositories';
import { IntegrityService } from '../src/services/integrityService';
import { multiTabSync } from '../src/services/multiTabService';
import { safeJsonParse, sanitizeObject, isSafeUrl, isValidAttachmentMime } from '../src/services/securityService';
import { AttentionService } from '../src/services/attentionService';
import { LifeGraphService } from '../src/services/lifeGraphService';
import { eventBus } from '../src/services/eventBus';
import { notificationService } from '../src/services/notificationService';

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

  console.log('\n=====================================================');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
