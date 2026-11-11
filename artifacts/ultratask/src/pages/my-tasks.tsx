import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { applyFilters, activeCount, usePersistedFilters } from '@/lib/filters';
import { fmtDue, isActive, isOverdue, istDay } from '@/lib/time';
import { PageHeader, EmptyState } from '@/components/shell';
import { FilterBar } from '@/components/filter-bar';
import { QuickAdd } from '@/components/create-ticket';
import { TicketGroup, useListKeys } from '@/components/ticket-list';

type ChipKey = 'all' | 'overdue' | 'today' | 'not_accepted' | 'blocked';
const CHIPS: [ChipKey, string][] = [['overdue', 'Overdue'], ['today', 'Due today'], ['not_accepted', 'Not accepted'], ['blocked', 'Blocked'], ['all', 'All open']];

export default function MyTasks() {
  const { ws, me } = useWs();
  const [f, setF] = usePersistedFilters(me.id, 'tasks');
  const chipKey = `ut:chip:${me.id}:tasks`;
  const [chip, setChip] = useState<ChipKey>(() => (localStorage.getItem(chipKey) as ChipKey) || 'all');
  useEffect(() => { try { localStorage.setItem(chipKey, chip); } catch { /* quota */ } }, [chip, chipKey]);
  const now = Date.now();
  const today = istDay(now);

  const data = useMemo(() => {
    const mine = applyFilters(ws.tickets.filter((t) => t.assigneeId === me.id), f, ws, now);
    const open = mine.filter(isActive);
    const test: Record<ChipKey, (t: Ticket) => boolean> = {
      all: () => true,
      overdue: (t) => isOverdue(t, now),
      today: (t) => !isOverdue(t, now) && istDay(t.dueAt) === today,
      not_accepted: (t) => t.status === 'open',
      blocked: (t) => t.isBlocked,
    };
    const counts = Object.fromEntries(CHIPS.map(([k]) => [k, open.filter(test[k]).length])) as Record<ChipKey, number>;
    const pool = open.filter(test[chip]);
    const used = new Set<number>();
    const take = (fn: (t: Ticket) => boolean, sort?: (a: Ticket, b: Ticket) => number) => {
      const r = pool.filter((t) => !used.has(t.id) && fn(t));
      r.forEach((t) => used.add(t.id));
      return sort ? r.sort(sort) : r;
    };
    const overdue = take((t) => isOverdue(t, now), (a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const dueToday = take((t) => istDay(t.dueAt) === today);
    const notAccepted = take((t) => t.status === 'open');
    const week = take((t) => istDay(t.dueAt) - today <= 6);
    const later = take(() => true);
    const done = chip === 'all' ? mine.filter((t) => t.status === 'done' || (t.status === 'closed' && t.closedAt && today - istDay(t.closedAt) <= 7)) : [];
    const blocking = ws.tickets.filter((t) => t.blockedOnUserId === me.id && t.isBlocked && isActive(t));
    return { counts, overdue, dueToday, notAccepted, week, later, done, blocking };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, me.id, f, chip]);

  const ordered = [...data.blocking, ...data.overdue, ...data.dueToday, ...data.notAccepted, ...data.week, ...data.later, ...data.done];
  const [sel, setSel] = useListKeys(ordered);
  const next = [...data.dueToday, ...data.week, ...data.later].filter((t) => !isOverdue(t, now)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0];
  const g = (title: string, list: Ticket[], extra: Partial<Parameters<typeof TicketGroup>[0]> = {}) => (
    <TicketGroup title={title} tickets={list} perspective="owner" selectedId={sel} setSelected={setSel} {...extra} />
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="My tasks" sub={
        <span data-testid="text-summary">
          {data.counts.all} open{data.counts.overdue > 0 && <> · <span className="text-signal">{data.counts.overdue} overdue</span></>}{next && <> · next due {fmtDue(next.dueAt)}</>}
        </span>} />
      <div className="space-y-4">
        <QuickAdd defaultMe />
        <div className="scrollbar-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist">
          {CHIPS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={chip === k} onClick={() => setChip(k)} data-testid={`chip-count-${k}`}
              className={cn('relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                chip === k ? 'border-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
              {chip === k && <motion.span layoutId="count-chip" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative">{l}</span>
              <span className={cn('relative font-code text-[11px]', k === 'overdue' && data.counts.overdue > 0 && chip !== k && 'text-signal')}>{data.counts[k]}</span>
            </button>
          ))}
        </div>
        <FilterBar f={f} setF={setF} hide={['assignees']} />
        {data.blocking.length > 0 && g('You are blocking others', data.blocking, { tone: 'violet', hint: 'Someone marked their work as waiting on you', perspective: 'any' })}
        {ordered.length - data.blocking.length === 0 ? (
          activeCount(f) || f.q || chip !== 'all' ? <EmptyState art="search" title="Nothing here" body="Try another count chip, loosen a filter, or clear the search. Your choices are remembered." />
            : <EmptyState title="A clear desk" body="Nothing is assigned to you. When someone asks, it lands here with one date and one finish line." />
        ) : (
          <div className="space-y-4">
            {g('Overdue', data.overdue, { tone: 'signal', hint: 'Oldest first — finish, ask for time, or mark blocked' })}
            {g('Due today', data.dueToday, { tone: 'amber' })}
            {g('Not accepted', data.notAccepted, { hint: 'Accept or decline — the asker is waiting to hear' })}
            {g('This week', data.week)}
            {g('Later', data.later)}
            {g('Done', data.done, { defaultOpen: false, tone: 'primary', hint: 'Waiting for a check, and closed in the last 7 days' })}
          </div>
        )}
      </div>
    </div>
  );
}
