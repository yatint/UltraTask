import type { Ticket } from '@workspace/api-client-react';

export const TZ = 'Asia/Kolkata';
const IST = 330 * 60000;
const DAY = 86400000;

export const istDay = (d: Date | string | number) => Math.floor((new Date(d).getTime() + IST) / DAY);
export const istHour = (d: Date | string | number) => new Date(new Date(d).getTime() + IST).getUTCHours();
export const weekdayOf = (day: number) => new Date(day * DAY).getUTCDay();
export const dueFromDay = (day: number, h = 18, m = 0) => new Date(day * DAY + (h * 60 + m) * 60000 - IST).toISOString();
export const dayFromInput = (v: string) => {
  const [y, m, d] = v.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
};
export const inputFromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o });
const dt = fmt({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
const dOnly = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const tOnly = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const wd = fmt({ weekday: 'short' });

export const fmtDateTime = (iso?: string | null) => (iso ? dt.format(new Date(iso)).replace(' am', ' AM').replace(' pm', ' PM') : '');
export const fmtTime = (iso: string) => tOnly.format(new Date(iso)).replace(' am', ' AM').replace(' pm', ' PM');
export const fmtDate = (iso: string) => dOnly.format(new Date(iso));

export function fmtDue(iso: string, now = Date.now()) {
  const diff = istDay(iso) - istDay(now);
  const t = fmtTime(iso);
  if (diff === 0) return `Today, ${t}`;
  if (diff === 1) return `Tomorrow, ${t}`;
  if (diff === -1) return `Yesterday, ${t}`;
  if (diff > 1 && diff < 7) return `${wd.format(new Date(iso))}, ${t}`;
  return fmtDateTime(iso);
}

export function fmtAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = istDay(now) - istDay(iso);
  if (d < 7) return `${d}d ago`;
  return fmtDate(iso);
}

export function nextWorking(day: number, working: number[], skip = 1) {
  const w = working.length ? working : [1, 2, 3, 4, 5, 6];
  let d = day;
  let n = 0;
  for (let i = 0; i < 30 && n < skip; i++) {
    d++;
    if (w.includes(weekdayOf(d))) n++;
  }
  return d;
}

export interface DueChip { key: string; label: string; hint: string; iso: string }

const isWork = (day: number, working: number[]) => (working.length ? working : [1, 2, 3, 4, 5, 6]).includes(weekdayOf(day));
/** the day itself if working, else the next working day */
export const rollWorking = (day: number, working: number[]) => (isWork(day, working) ? day : nextWorking(day, working, 1));
const short = (day: number) => dShort.format(new Date(day * DAY));

export function dueChips(working: number[], now = Date.now()): DueChip[] {
  const today = istDay(now);
  const chips: DueChip[] = [];
  if (!isWork(today, working)) {
    const d = rollWorking(today, working);
    chips.push({ key: 'today', label: 'Next working day', hint: `${short(d)}, 6:00 PM`, iso: dueFromDay(d) });
  } else if (istHour(now) >= 16) {
    const iso = new Date(now + 2 * 3600000).toISOString();
    chips.push({ key: 'today', label: 'Today +2h', hint: fmtTime(iso), iso });
  } else {
    chips.push({ key: 'today', label: 'Today', hint: '6:00 PM', iso: dueFromDay(today) });
  }
  const add = (key: string, label: string, offset: number) => {
    const d = rollWorking(today + offset, working);
    chips.push({ key, label, hint: short(d), iso: dueFromDay(d) });
  };
  add('tomorrow', 'Tomorrow', 1);
  add('n3', 'In 3 days', 3);
  add('w1', 'In 1 week', 7);
  return chips;
}

export const ACTIVE = ['open', 'accepted', 'in_progress'] as const;
export const isActive = (t: Ticket) => (ACTIVE as readonly string[]).includes(t.status);

export type HealthKey = 'overdue' | 'today' | 'soon' | 'on_track' | 'blocked' | 'awaiting' | 'closed' | 'ended';
export interface Health { key: HealthKey; label: string }

export const isOverdue = (t: Ticket, now = Date.now()) => isActive(t) && now > new Date(t.dueAt).getTime();

function timing(t: Ticket, now: number): Health {
  const due = new Date(t.dueAt).getTime();
  if (now > due) {
    const h = (now - due) / 3600000;
    if (h < 24) return { key: 'overdue', label: `Overdue ${Math.max(1, Math.floor(h))}h` };
    return { key: 'overdue', label: `Overdue ${Math.max(1, istDay(now) - istDay(due))}d` };
  }
  if (istDay(due) === istDay(now)) return { key: 'today', label: `Due today ${fmtTime(t.dueAt)}` };
  const h = (due - now) / 3600000;
  if (h <= 24) return { key: 'soon', label: `Due in ${Math.max(1, Math.round(h))}h` };
  return { key: 'on_track', label: `On track · ${istDay(due) - istDay(now)}d` };
}

export function health(t: Ticket, now = Date.now()): Health {
  if (t.status === 'done') return { key: 'awaiting', label: 'Waiting for check' };
  if (t.status === 'closed') return { key: 'closed', label: t.wasOnTime === false ? 'Closed late' : 'Closed on time' };
  if (t.status === 'declined') return { key: 'ended', label: 'Declined' };
  if (t.status === 'cancelled') return { key: 'ended', label: 'Cancelled' };
  const tm = timing(t, now);
  if (t.isBlocked) return { key: 'blocked', label: tm.key === 'overdue' ? `Blocked · ${tm.label.toLowerCase()}` : 'Blocked' };
  return tm;
}

export function closedStats(t: Ticket) {
  if (!t.closedAt) return null;
  const took = Math.max(0, istDay(t.closedAt) - istDay(t.createdAt));
  const doneAt = t.doneAt ?? t.closedAt;
  const lateDays = istDay(doneAt) - istDay(t.dueAt);
  const late = t.wasOnTime === false || new Date(doneAt) > new Date(t.dueAt);
  return { took: took === 0 ? 'Closed same day' : `Closed in ${took}d`, timing: late ? `Late by ${Math.max(1, lateDays)}d` : 'On time', late };
}

export function pendingDays(t: Ticket, now = Date.now()) {
  return Math.max(0, istDay(now) - istDay(t.createdAt));
}

export function pendingAge(t: Ticket, now = Date.now()) {
  const d = istDay(now) - istDay(t.createdAt);
  return d <= 0 ? 'today' : `${d}d`;
}

export function customDueIso(date: string, time: string) {
  const [h, m] = (time || '18:00').split(':').map(Number);
  return dueFromDay(dayFromInput(date), h, m);
}
