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

/**
 * The one date format every picker in the app displays and accepts.
 * Set as the default valueFormat for DateInput / DatePickerInput in
 * config/themes.js — don't pass a different valueFormat on a picker.
 */
export const DATE_FORMAT = 'DD/MM/YYYY';

/**
 * Parses typed text as day-month-year: "05/03/2026", "5-3-2026",
 * "05.03.2026", "05032026" or "5/3/26". Returns "YYYY-MM-DD" (what Mantine
 * v8 date inputs hold) or null. Mantine's own parser needs dayjs's
 * customParseFormat plugin and otherwise falls back to new Date(), which
 * reads "05/03/2026" as 3 May.
 */
export const parseDateInput = (text) => {
  const s = String(text || '').trim();
  let m = s.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})$/);
  if (!m) m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return localDateStr(date);
};
