import { format } from 'date-fns';

export function toLocalDateInputValue(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toLocalDateTimeInputValue(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/**
 * Converts a <input type="date" /> value (YYYY-MM-DD) into an ISO timestamp at 12:00 UTC.
 * This keeps the calendar date stable across most timezones.
 */
export function isoAtNoonUtcFromDateInput(dateValue: string) {
  const [y, m, d] = dateValue.split('-').map((v) => Number(v));
  if (!y || !m || !d) return new Date(dateValue).toISOString();
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

/**
 * Format a date string or Date to DD/MM/YYYY format.
 */
export function formatDateDMY(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Format a date string or Date to DD/MM/YYYY • hh:mm a format (12hr with AM/PM).
 */
export function formatDateTimeDMY(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy • hh:mm a');
}

/**
 * Format a date string or Date to DD/MM/YYYY format (date only).
 */
export function formatDateOnly(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Format a time string or Date to hh:mm a format (12hr with AM/PM).
 */
export function formatTime12hr(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'hh:mm a');
}

/**
 * Format a date string or Date to DD/MM/YYYY, hh:mm a format.
 */
export function formatDateTimeFull(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy, hh:mm a');
}
