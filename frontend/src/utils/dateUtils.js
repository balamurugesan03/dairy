/**
 * Returns the date as "YYYY-MM-DD" in LOCAL timezone (not UTC).
 * Use this instead of date.toISOString().slice(0, 10) everywhere dates are
 * sent to the backend — IST is UTC+5:30, so toISOString() at midnight IST
 * gives the previous day in UTC, causing all dates to be saved one day behind.
 */
export const localDateStr = (d) => {
  const date = d instanceof Date ? d : d ? new Date(d) : new Date();
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
