import { useEffect, useState } from 'react';
import type { Ticket, Workspace } from '@workspace/api-client-react';
import { dayFromInput, health, istDay } from './time';

export type SortKey = 'due' | 'created' | 'priority' | 'updated';
export interface Filters {
  q: string;
  assignees: number[];
  creators: number[];
  statuses: string[];
  tags: number[];
  priorities: string[];
  health: string[];
  createdFrom: string;
  createdTo: string;
  dueFrom: string;
  dueTo: string;
  sort: SortKey;
}
export const EMPTY: Filters = { q: '', assignees: [], creators: [], statuses: [], tags: [], priorities: [], health: [], createdFrom: '', createdTo: '', dueFrom: '', dueTo: '', sort: 'due' };

export const activeCount = (f: Filters) =>
  f.assignees.length + f.creators.length + f.statuses.length + f.tags.length + f.priorities.length + f.health.length +
  (f.createdFrom || f.createdTo ? 1 : 0) + (f.dueFrom || f.dueTo ? 1 : 0);

export function usePersistedFilters(userId: number, screen: string) {
  const key = `ut:filters:${userId}:${screen}`;
  const [f, setF] = useState<Filters>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...EMPTY, ...JSON.parse(raw), q: '' } : EMPTY;
    } catch {
      return EMPTY;
    }
  });
  useEffect(() => {
    const { q: _q, ...rest } = f;
    void _q;
    try { localStorage.setItem(key, JSON.stringify(rest)); } catch { /* quota */ }
  }, [f, key]);
  return [f, setF] as const;
}

const PRI = { urgent: 0, high: 1, normal: 2, low: 3 } as Record<string, number>;

export function applyFilters(list: Ticket[], f: Filters, ws: Workspace, now = Date.now()) {
  const q = f.q.trim().toLowerCase();
  const num = q.match(/^(?:[a-z]+-)?(\d+)$/);
  const commentsBy = new Map<number, string>();
  if (q && !num) for (const c of ws.comments) commentsBy.set(c.ticketId, (commentsBy.get(c.ticketId) ?? '') + ' ' + c.body.toLowerCase());
  const inRange = (iso: string, from: string, to: string) => {
    const d = istDay(iso);
    if (from && d < dayFromInput(from)) return false;
    if (to && d > dayFromInput(to)) return false;
    return true;
  };
  const out = list.filter((t) => {
    if (q) {
      if (num) {
        if (String(t.id) !== num[1] && !t.code.toLowerCase().endsWith(`-${num[1]}`) && !t.title.toLowerCase().includes(q)) return false;
      } else if (!(t.code.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || (commentsBy.get(t.id) ?? '').includes(q))) return false;
    }
    if (f.assignees.length && !f.assignees.includes(t.assigneeId)) return false;
    if (f.creators.length && !f.creators.includes(t.createdById)) return false;
    if (f.statuses.length && !f.statuses.includes(t.status)) return false;
    if (f.tags.length && !(t.projectTagId && f.tags.includes(t.projectTagId))) return false;
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
    if (f.health.length) {
      const h = health(t, now).key;
      const blocked = t.isBlocked && f.health.includes('blocked');
      if (!f.health.includes(h) && !blocked) return false;
    }
    if ((f.createdFrom || f.createdTo) && !inRange(t.createdAt, f.createdFrom, f.createdTo)) return false;
    if ((f.dueFrom || f.dueTo) && !inRange(t.dueAt, f.dueFrom, f.dueTo)) return false;
    return true;
  });
  const by: Record<SortKey, (a: Ticket, b: Ticket) => number> = {
    due: (a, b) => +new Date(a.dueAt) - +new Date(b.dueAt),
    created: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    updated: (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
    priority: (a, b) => PRI[a.priority] - PRI[b.priority] || +new Date(a.dueAt) - +new Date(b.dueAt),
  };
  return out.sort(by[f.sort]);
}
