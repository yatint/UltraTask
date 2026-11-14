/** Pure IST <-> ISO (UTC) helpers for deadline inputs. Independent of device timezone. */
export const IST_OFFSET_MS = 330 * 60000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateInput(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  return u.getUTCFullYear() === y && u.getUTCMonth() === m - 1 && u.getUTCDate() === d;
}
export const isValidTimeInput = (v: string) => TIME_RE.test(v);

/** ISO -> IST "YYYY-MM-DD" / "HH:MM"; empty strings for blank or malformed ISO. */
export function istInputParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { date: '', time: '' };
  const s = new Date(t + IST_OFFSET_MS).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

export type DueResult = { ok: true; iso: string } | { ok: false; error: string };

/** IST date+time inputs -> UTC ISO. Rejects blank, malformed, and non-future values. */
export function dueFromInputs(date: string, time: string, now = Date.now()): DueResult {
  if (!date) return { ok: false, error: 'Choose a date.' };
  if (!isValidDateInput(date)) return { ok: false, error: 'That date is not valid.' };
  if (!time) return { ok: false, error: 'Choose a time.' };
  if (!isValidTimeInput(time)) return { ok: false, error: 'Enter a valid time (HH:MM).' };
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS;
  if (ms <= now) return { ok: false, error: 'That time has already passed. Pick a future time.' };
  return { ok: true, iso: new Date(ms).toISOString() };
}

/** True only for a parseable ISO strictly in the future. */
export function isFutureIso(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > now;
}
