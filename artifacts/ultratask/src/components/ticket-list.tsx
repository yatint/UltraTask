import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronRight, MessageSquare } from 'lucide-react';
import type { Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { closedStats, fmtDateTime, fmtDue, health, pendingDays } from '@/lib/time';
import { useTicketActions } from '@/lib/ops';
import { OverdueReminderButton } from './overdue-reminder';
import { Avatar, HEALTH_BORDER, HealthLabel, TagPill, TicketFlags } from './atoms';

export type Caps = { self: boolean; accept: boolean; decline: boolean; start: boolean; done: boolean; close: boolean; reopen: boolean };
/** Mirrors server rules. Self task = assignee is the asker, regardless of viewer. */
export function ticketCaps(t: Ticket, meId: number, isAdmin: boolean): Caps {
  const self = t.assigneeId === t.createdById;
  const owner = t.assigneeId === meId || isAdmin;
  const asker = t.createdById === meId || isAdmin;
  const actualOwner = t.assigneeId === meId && !self;
  return {
    self,
    accept: t.status === 'open' && actualOwner,
    decline: t.status === 'open' && actualOwner,
    start: owner && (t.status === 'accepted' || (t.status === 'open' && self)),
    done: owner && !self && (t.status === 'accepted' || t.status === 'in_progress'),
    close: (self && owner && t.status === 'in_progress') || (t.status === 'done' && asker),
    reopen: (t.status === 'done' && asker) || (t.status === 'closed' && isAdmin),
  };
}

export function primaryAction(t: Ticket, meId: number, isAdmin: boolean): { action: 'accept' | 'start' | 'done' | 'close'; label: string } | null {
  const c = ticketCaps(t, meId, isAdmin);
  if (c.accept) return { action: 'accept', label: 'Accept' };
  if (c.start) return { action: 'start', label: 'Start' };
  if (c.done && t.status === 'in_progress') return { action: 'done', label: 'Done' };
  if (c.close) return { action: 'close', label: t.status === 'done' ? 'Confirm' : 'Close' };
  return null;
}

export function composeOn(openTicket: (id: number) => void, id: number) {
  openTicket(id);
  setTimeout(() => window.dispatchEvent(new CustomEvent('ut:compose', { detail: id })), 380);
}

// Leading track: 0 (no checkbox) or 20px (checkbox). Rows stack below 850px of available width.
const ROW_COLS = 'grid-cols-[0px_minmax(0,1fr)] @min-[850px]/task-row:grid-cols-[0px_minmax(0,1fr)_minmax(0,140px)_minmax(0,140px)_150px_92px]';
const ROW_COLS_CHECK = 'grid-cols-[20px_minmax(0,1fr)] @min-[850px]/task-row:grid-cols-[20px_minmax(0,1fr)_minmax(0,140px)_minmax(0,140px)_150px_92px]';
const HEAD_COLS = 'grid-cols-[0px_minmax(0,1fr)_minmax(0,140px)_minmax(0,140px)_150px_92px]';
const HEAD_COLS_CHECK = 'grid-cols-[20px_minmax(0,1fr)_minmax(0,140px)_minmax(0,140px)_150px_92px]';

export function TicketRow({ t, selected, onSelect, checked, onCheck }: {
  t: Ticket; selected?: boolean; onSelect?: () => void; perspective: 'owner' | 'asker' | 'any'; checked?: boolean; onCheck?: (v: boolean) => void;
}) {
  const { person, openTicket, me, isAdmin, ws } = useWs();
  const { run } = useTicketActions();
  const reduce = useReducedMotion();
  const [dragActive, setDragActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const owner = person(t.assigneeId);
  const creator = person(t.createdById);
  const comments = ws.comments.filter((c) => c.ticketId === t.id).length;
  const pa = primaryAction(t, me.id, isAdmin);
  const h = health(t);
  const days = pendingDays(t);
  const cs = closedStats(t);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragActive(false);
    if (info.offset.x > 90 && pa) run(t, { action: pa.action });
    else if (info.offset.x < -90) composeOn(openTicket, t.id);
  };

  const label = (p: typeof owner) => (p?.id === me.id ? 'You' : p?.name ?? 'Unassigned');
  const ownerLabel = label(owner);
  const creatorLabel = label(creator);
  return (
    <div className="@container/task-row relative overflow-hidden" ref={ref}>
      {dragActive && <div className="pointer-events-none absolute inset-0 flex items-center justify-between bg-accent px-5 text-[13px] font-semibold @min-[850px]/task-row:hidden" aria-hidden>
        <span className="text-primary">{pa?.label ?? ''}</span><span className="text-muted-foreground">Comment</span>
      </div>}
      <motion.div
        layout={!reduce}
        drag={reduce ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragStart={() => setDragActive(true)}
        onDragEnd={onDragEnd}
        onClick={() => { onSelect?.(); openTicket(t.id); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onSelect?.(); openTicket(t.id); } }}
        tabIndex={0}
        role="button"
        aria-label={`${t.code} ${t.title}`}
        data-testid={`row-ticket-${t.id}`}
        className={cn(onCheck ? ROW_COLS_CHECK : ROW_COLS, 'group relative grid min-h-[64px] cursor-pointer items-center gap-x-3 border-t border-border/60 bg-card py-3 pl-4 pr-4 outline-none transition-colors first:border-t-0 focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @min-[850px]/task-row:min-h-[56px] @min-[850px]/task-row:py-2.5 @min-[850px]/task-row:pl-5',
          selected ? 'bg-accent' : 'hover:bg-paper')}
      >
        <span aria-hidden className={cn('absolute inset-y-2 left-0 w-[3px] rounded-r-full', HEALTH_BORDER[h.key])} />
        <div className="flex items-center self-start pt-0.5 @min-[850px]/task-row:self-center @min-[850px]/task-row:pt-0">
          {onCheck && (
            <label className="-my-2 flex h-11 w-5 cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={!!checked} onChange={(e) => onCheck(e.target.checked)}
                className="h-[18px] w-[18px] accent-[hsl(var(--primary))]" aria-label={`Select ${t.code}`} data-testid={`checkbox-ticket-${t.id}`} />
            </label>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="hidden shrink-0 font-code text-[12px] text-muted-foreground @min-[850px]/task-row:inline" data-testid={`text-code-${t.id}`}>{t.code}</span>
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground @min-[850px]/task-row:line-clamp-1 @min-[850px]/task-row:text-[14.5px]">{t.title}</span>
          </div>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12.5px] @min-[850px]/task-row:hidden" data-testid={`text-people-${t.id}`}>
            <dt className="text-muted-foreground">Asked by</dt><dd className="truncate font-medium text-foreground/85">{creatorLabel}</dd>
            <dt className="text-muted-foreground">Owner</dt><dd className="truncate font-medium text-foreground/85">{ownerLabel}</dd>
            <dt className="text-muted-foreground">Deadline</dt><dd className="tabular-nums text-foreground/85">{fmtDue(t.dueAt)}</dd>
          </dl>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="@min-[850px]/task-row:hidden"><HealthLabel t={t} compact /></span>
            <span className="font-code text-[12px] @min-[850px]/task-row:hidden">{t.code}</span>
            <TagPill id={t.projectTagId} />
            {cs ? (
              <span data-testid={`text-closed-${t.id}`}>{cs.took} · <span className={cn('font-medium', cs.late ? 'text-signal' : 'text-ok')}>{cs.timing}</span></span>
            ) : (
              <span className={cn(days >= 7 && 'font-semibold text-foreground')} data-testid={`text-pending-${t.id}`}>{days === 0 ? 'New today' : `Waiting ${days}d`}</span>
            )}
            {comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{comments}</span>}
            <TicketFlags t={t} />
            <span className="@min-[850px]/task-row:hidden"><OverdueReminderButton t={t} variant="row" /></span>
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-2 @min-[850px]/task-row:flex" title={`Asked by ${creator?.name ?? ''}`} data-testid={`text-asker-${t.id}`}>
          <Avatar p={creator} size={22} />
          <span className="truncate text-[13px] text-foreground/85">{creatorLabel}</span>
        </div>
        <div className="hidden min-w-0 items-center gap-2 @min-[850px]/task-row:flex" title={`Owner: ${owner?.name ?? ''}`} data-testid={`text-owner-${t.id}`}>
          <Avatar p={owner} size={22} />
          <span className="truncate text-[13px] font-medium text-foreground">{ownerLabel}</span>
        </div>
        <div className="hidden flex-col items-start gap-0.5 @min-[850px]/task-row:flex" title={`${fmtDateTime(t.dueAt)} IST`}>
          <HealthLabel t={t} compact />
          <span className="pl-[14px] text-[12px] tabular-nums text-muted-foreground">{fmtDue(t.dueAt)}</span>
        </div>
        <div className="hidden flex-col items-end justify-center gap-1 @min-[850px]/task-row:flex">
          <OverdueReminderButton t={t} variant="row" className="whitespace-nowrap px-2" />
          {pa && (
            <button
              data-testid={`button-quick-${pa.action}-${t.id}`}
              onClick={(e) => { e.stopPropagation(); run(t, { action: pa.action }); }}
              className="h-8 rounded-lg bg-foreground px-3 text-[12.5px] font-semibold text-background opacity-0 transition-[opacity,background-color] hover:bg-primary focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 data-[sel=true]:opacity-100"
              data-sel={selected}
            >{pa.label}</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function TicketGroup({ title, hint, tickets, children, selectedId, setSelected, perspective, defaultOpen = true, tone, checked, onCheck }: {
  title: string; hint?: string; tickets: Ticket[]; children?: ReactNode; selectedId?: number | null; setSelected?: (id: number) => void;
  perspective: 'owner' | 'asker' | 'any'; defaultOpen?: boolean; tone?: 'signal' | 'primary' | 'amber' | 'violet';
  checked?: Set<number>; onCheck?: (id: number, v: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  if (!tickets.length && !children) return null;
  const dot = tone === 'signal' ? 'bg-signal' : tone === 'primary' ? 'bg-primary' : tone === 'amber' ? 'bg-amber' : tone === 'violet' ? 'bg-violet' : 'bg-muted-foreground/50';
  return (
    <section className="@container/task-list overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid={`group-${title.toLowerCase().replace(/\W+/g, '-')}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-paper @min-[640px]/task-list:px-5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
        <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground">{title}</span>
        <span className="rounded-md bg-muted px-1.5 font-code text-[12px] font-medium text-foreground/70">{tickets.length}</span>
        {hint && <span className="ml-2 hidden min-w-0 truncate text-[12.5px] text-muted-foreground lg:block">{hint}</span>}
        <ChevronRight className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden border-t border-border/70">
            <div className={cn('hidden gap-x-3 bg-paper/70 py-1.5 pl-5 pr-4 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground @min-[850px]/task-list:grid', onCheck ? HEAD_COLS_CHECK : HEAD_COLS)} aria-hidden>
              <span /><span>Task</span><span>Asked by</span><span>Owner</span><span>Deadline</span><span />
            </div>
            {children}
            {tickets.map((t) => <TicketRow key={t.id} t={t} perspective={perspective} selected={selectedId === t.id} onSelect={() => setSelected?.(t.id)}
              checked={checked?.has(t.id)} onCheck={onCheck ? (v) => onCheck(t.id, v) : undefined} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** J/K navigation, Enter open, D done (or close own self-task in progress), C comment. */
export function useListKeys(ordered: Ticket[]) {
  const [sel, setSel] = useState<number | null>(null);
  const { openTicket, me, isAdmin } = useWs();
  const { run } = useTicketActions();
  const ref = useRef({ ordered, sel, run, openTicket });
  ref.current = { ordered, sel, run, openTicket };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || tg.closest('input,textarea,select,[contenteditable=true],[role=dialog]')) return;
      const { ordered: list, sel: s } = ref.current;
      if (!list.length) return;
      const idx = list.findIndex((t) => t.id === s);
      const cur = idx >= 0 ? list[idx] : undefined;
      const k = e.key.toLowerCase();
      if (k === 'j') { setSel(list[Math.min(list.length - 1, idx + 1)].id); e.preventDefault(); }
      else if (k === 'k') { setSel(list[Math.max(0, idx < 0 ? 0 : idx - 1)].id); e.preventDefault(); }
      else if (k === 'enter' && cur) ref.current.openTicket(cur.id);
      else if (k === 'd' && cur) { const c = ticketCaps(cur, me.id, isAdmin); if (c.done) ref.current.run(cur, { action: 'done' }); else if (c.close && c.self) ref.current.run(cur, { action: 'close' }); }
      else if (k === 'c' && cur) { e.preventDefault(); composeOn(ref.current.openTicket, cur.id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [me.id, isAdmin]);
  return [sel, setSel] as const;
}
