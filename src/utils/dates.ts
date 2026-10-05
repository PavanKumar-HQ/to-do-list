import type { RecurrenceType } from '../types';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getCurrentTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: year !== new Date().getFullYear() ? 'numeric' : undefined
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getRelativeDateLabel(dateStr?: string, timeStr?: string): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dateStr) {
    return { label: '', isOverdue: false, isToday: false };
  }

  const todayStr = getTodayDateString();
  const timeSuffix = timeStr ? ` at ${timeStr}` : '';

  if (dateStr === todayStr) {
    return { label: `Today${timeSuffix}`, isOverdue: false, isToday: true };
  }

  const today = new Date(todayStr);
  const target = new Date(dateStr);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { label: `Tomorrow${timeSuffix}`, isOverdue: false, isToday: false };
  }
  if (diffDays === -1) {
    return { label: `Yesterday${timeSuffix}`, isOverdue: true, isToday: false };
  }
  if (diffDays < -1) {
    return {
      label: `${Math.abs(diffDays)}d overdue${timeSuffix}`,
      isOverdue: true,
      isToday: false
    };
  }
  if (diffDays > 1 && diffDays <= 7) {
    const weekday = target.toLocaleDateString(undefined, { weekday: 'short' });
    return { label: `${weekday}${timeSuffix}`, isOverdue: false, isToday: false };
  }

  return {
    label: `${formatDisplayDate(dateStr)}${timeSuffix}`,
    isOverdue: diffDays < 0,
    isToday: false
  };
}

// Calculate the next occurrence date for recurring items with safe month-end & leap-year handling
export function calculateNextOccurrence(baseDateStr: string, recurrence: RecurrenceType): string {
  if (recurrence === 'none' || recurrence === 'custom') return baseDateStr;

  const parts = baseDateStr.split('-');
  if (parts.length !== 3) return baseDateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-11
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return baseDateStr;

  switch (recurrence) {
    case 'daily': {
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    case 'weekly': {
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    case 'monthly': {
      const totalMonths = year * 12 + month + 1;
      const nextYear = Math.floor(totalMonths / 12);
      const nextMonth = totalMonths % 12; // 0-11
      const maxDaysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
      const nextDay = Math.min(day, maxDaysInNextMonth);
      return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    }
    case 'yearly': {
      const nextYear = year + 1;
      const maxDaysInNextMonth = new Date(nextYear, month + 1, 0).getDate();
      const nextDay = Math.min(day, maxDaysInNextMonth);
      return `${nextYear}-${String(month + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    }
    default:
      return baseDateStr;
  }
}

