/**
 * Datetime utilities ensuring consistent UTC parsing and local display across all browsers and locales.
 */

/**
 * Safely parse any ISO timestamp into a JavaScript Date object representing the exact point in time.
 * If the string lacks a timezone offset or 'Z' suffix, it is treated as UTC.
 */
export function parseUtcDate(timestampStr: string | null | undefined): Date {
  if (!timestampStr) return new Date();
  const s = String(timestampStr).trim();
  if (!s) return new Date();
  
  // If the string lacks an explicit timezone indicator ('Z', '+', or negative offset after date part)
  if (!s.endsWith('Z') && !s.includes('+') && !s.slice(10).includes('-')) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(s);
}

/**
 * Format a timestamp string into the user's local date and time string.
 */
export function formatDateTime(timestampStr: string | null | undefined): string {
  if (!timestampStr) return '';
  const d = parseUtcDate(timestampStr);
  return isNaN(d.getTime()) ? String(timestampStr) : d.toLocaleString();
}

/**
 * Format a timestamp string into the user's local time string (HH:mm:ss).
 */
export function formatTime(timestampStr: string | null | undefined): string {
  if (!timestampStr) return '';
  const d = parseUtcDate(timestampStr);
  return isNaN(d.getTime()) ? String(timestampStr) : d.toLocaleTimeString();
}

/**
 * Format transition delta seconds into human-readable duration units:
 * - < 1s: milliseconds (e.g. "600 ms")
 * - < 60s: seconds with 1 decimal (e.g. "1.5 s")
 * - < 3600s: minutes with 1 decimal (e.g. "3.2 min")
 * - < 86400s: hours with 1 decimal (e.g. "2.5 hr")
 * - >= 86400s: days with 1 decimal (e.g. "2.8 d")
 * Returns null if deltaSeconds is null, undefined, NaN, or negative (negative delta / clock skew).
 */
export function formatTransitionDelta(deltaSeconds: number | null | undefined): string | null {
  if (deltaSeconds === null || deltaSeconds === undefined) return null;
  if (typeof deltaSeconds !== 'number' || isNaN(deltaSeconds) || deltaSeconds < 0) return null;

  if (deltaSeconds < 1) {
    return `${Math.round(deltaSeconds * 1000)} ms`;
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds.toFixed(1)} s`;
  }
  if (deltaSeconds < 3600) {
    return `${(deltaSeconds / 60).toFixed(1)} min`;
  }
  if (deltaSeconds < 86400) {
    return `${(deltaSeconds / 3600).toFixed(1)} hr`;
  }
  return `${(deltaSeconds / 86400).toFixed(1)} d`;
}

