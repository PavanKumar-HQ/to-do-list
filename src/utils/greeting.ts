import { useState, useEffect, useCallback } from 'react';

/**
 * Returns a time-aware greeting based on device local time:
 * - 05:00–11:59: "Good morning, {name}"
 * - 12:00–16:59: "Good afternoon, {name}"
 * - 17:00–04:59: "Good evening, {name}"
 */
export function getTimeAwareGreeting(name?: string, date: Date = new Date()): string {
  const hours = date.getHours();
  let prefix = 'Good evening';

  if (hours >= 0 && hours < 12) {
    prefix = 'Good morning';
  } else if (hours >= 12 && hours < 17) {
    prefix = 'Good afternoon';
  } else {
    prefix = 'Good evening';
  }

  const cleanName = name?.trim();
  return cleanName ? `${prefix}, ${cleanName}` : prefix;
}

/**
 * Returns a calm, subtle date format: e.g. "Sunday, 5 October"
 * (Without giant year or distracting clutter).
 */
export function getSubtleDateString(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  } catch {
    // Fallback format
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }
}

/**
 * Hook to provide reactive greeting and subtle date that updates only when needed:
 * - On component mount
 * - When app becomes visible after backgrounding (visibilitychange)
 * - When window receives focus
 * - When local date or timezone changes (e.g. crossing midnight)
 *
 * NO polling timer is used.
 */
export function useTimeAwareGreeting(displayName?: string) {
  const computeState = useCallback(() => {
    const now = new Date();
    return {
      greeting: getTimeAwareGreeting(displayName, now),
      subtleDate: getSubtleDateString(now),
      dayKey: `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`
    };
  }, [displayName]);

  const [state, setState] = useState(computeState);

  useEffect(() => {
    setState(computeState());

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        setState(computeState());
      }
    };

    // Calculate duration until the next greeting boundary (5:00, 12:00, 17:00) or midnight
    const now = new Date();
    const currentHour = now.getHours();
    let nextBoundaryHour = 24; // midnight
    if (currentHour < 12) nextBoundaryHour = 12;
    else if (currentHour < 17) nextBoundaryHour = 17;

    const nextBoundaryDate = new Date(now);
    nextBoundaryDate.setHours(nextBoundaryHour, 0, 1, 0); // 1 sec after boundary
    const msUntilNext = Math.max(1000, nextBoundaryDate.getTime() - now.getTime());

    // Single one-shot timeout for the next boundary (not a polling loop)
    const timer = setTimeout(() => {
      setState(computeState());
    }, msUntilNext);

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [computeState]);

  return state;
}
