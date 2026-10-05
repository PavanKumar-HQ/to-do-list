import type { EntityType } from '../types';
import { getTodayDateString } from './dates';

export interface ParsedQuickCapture {
  detectedType: EntityType;
  title: string;
  notes?: string;
  amountMinor?: number;
  category?: string;
  dueDate?: string;
  dueTime?: string;
}

export function parseNaturalQuickInput(rawText: string): ParsedQuickCapture {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Detect Expense (e.g. "₹450 food lunch", "$25 coffee", "500 rs groceries")
  const moneyMatch = text.match(/(?:[₹$€£]|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i) || text.match(/^([\d,]+(?:\.\d+)?)\s*(?:[₹$€£]|rs\.?|inr)/i);
  if (moneyMatch) {
    const rawVal = moneyMatch[1].replace(/,/g, '');
    const amountMinor = Math.round(parseFloat(rawVal) * 100);
    // Find remainder of text
    const cleanNotes = text.replace(moneyMatch[0], '').trim();
    // Guess category from words
    let cat = 'Other';
    if (/food|lunch|dinner|breakfast|snack|coffee|tea|cafe|restaurant|burger|pizza/i.test(cleanNotes)) cat = 'Food';
    else if (/cab|uber|ola|auto|metro|train|bus|fuel|petrol|diesel|flight/i.test(cleanNotes)) cat = 'Transport';
    else if (/bill|recharge|wifi|electricity|water|rent|maintenance/i.test(cleanNotes)) cat = 'Bills';
    else if (/shop|amazon|flipkart|cloth|shoes|groceries/i.test(cleanNotes)) cat = 'Shopping';
    else if (/movie|netflix|spotify|game|entertainment/i.test(cleanNotes)) cat = 'Entertainment';

    return {
      detectedType: 'expense',
      title: cleanNotes || 'Quick Expense',
      notes: cleanNotes,
      amountMinor,
      category: cat,
      dueDate: getTodayDateString()
    };
  }

  // 2. Detect "Idea: "
  if (lower.startsWith('idea:') || lower.startsWith('idea ')) {
    return {
      detectedType: 'idea',
      title: text.replace(/^idea:?\s*/i, '').trim()
    };
  }

  // 3. Detect "Don't forget" / "Remember"
  if (lower.startsWith("don't forget") || lower.startsWith('dont forget') || lower.startsWith('remember')) {
    return {
      detectedType: 'dont_forget',
      title: text.replace(/^(?:don't forget|dont forget|remember)\s*(?:to\s*)?/i, '').trim()
    };
  }

  // 4. Detect Followup / "Follow up with" / "Waiting for"
  if (lower.startsWith('follow up with') || lower.startsWith('waiting for')) {
    return {
      detectedType: 'followup',
      title: text
    };
  }

  // 5. Detect Event (e.g. "Meeting with", "Workshop on", "Party", "Appointment")
  if (/meeting|appointment|interview|workshop|flight|webinar/i.test(lower)) {
    return {
      detectedType: 'event',
      title: text
    };
  }

  // 6. Detect Reminder keywords
  if (lower.startsWith('remind me to') || lower.startsWith('reminder:')) {
    return {
      detectedType: 'reminder',
      title: text.replace(/^(?:remind me to|reminder:)\s*/i, '').trim()
    };
  }

  // Default to Task
  return {
    detectedType: 'task',
    title: text
  };
}
