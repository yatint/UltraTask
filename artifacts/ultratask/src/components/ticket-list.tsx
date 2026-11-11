import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronRight, MessageSquare } from 'lucide-react';
import type { Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { closedStats, fmtDateTime, fmtDue, health, pendingDays } from '@/lib/time';
import { useTicketActions } from '@/lib/ops';
import { OverdueReminderButton } from './overdue-reminder';
import { Avatar, HEALTH_BORDER, HealthLabel, PriorityGlyph, StatusIcon, TagPill, TicketFlags } from './atoms';

export function primaryAction(t: Ticket, meId: number, isAdmin: boolean): { action: 'accept' | 'start' | 'done' | 'close'; label: string } | null {
  const own = t.assigneeId === meId || isAdmin;
  const creator = t.createdById === meId || isAdmin;
  if (t.status === 'open' && t.assigneeId === meId && t.createdById === meId) return { action: 'start', label: 'Start' };
  if (t.status === 'open' && own) return { action: 'accept', label: 'Accept' };
  if (t.status === 'accepted' && own) return { action: 'start', label: 'Start' };
  if (t.status === 'in_progress' && own) return t.createdById === meId && t.assigneeId === meId ? { action: 'close', label: 'Close' } : { action: 'done', label: 'Done' };
  if (t.status === 'done' && creator) return { action: 'close', label: 'Confirm' };
  return null;
}

export function composeOn(openTicket: (id: number) => void, id: number) {
  openTicket(id);
  setTimeout(() => window.dispatchEvent(new CustomEvent('ut:compose', { detail: id })), 380);
}

export function TicketRow({ t, selected, onSelect, perspective, checked, onCheck }: {
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

  const who = perspective === 'asker' ? owner : creator;
  const whoLabel = who?.id === me.id ? 'You' : who?.name ?? 'Unassigned';
  return (
    <div className="relative overflow-hidden" ref={ref}>
      {dragActive && <div className="pointer-events-none absolute inset-0 flex items-center justify-between bg-accent px-5 text-[13px] font-semibold md:hidden" aria-hidden>
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
        className={cn('group relative grid min-h-[64px] cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 border-t border-border/60 bg-card py-3 pl-4 pr-4 outline-none transition-colors first:border-t-0 focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:min-h-[56px] md:grid-cols-[52px_minmax(0,1fr)_150px_168px_92px] md:py-2.5 md:pl-5',
          selected ? 'bg-accent' : 'hover:bg-paper')}
      >
        <span aria-hidden className={cn('absolute inset-y-2 left-0 w-[3px] rounded-r-full', HEALTH_BORDER[h.key])} />
        <div className="flex items-center gap-2 self-start pt-0.5 md:self-center md:pt-0">
          {onCheck && (
            <label className="-m-2 flex h-11 w-9 cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={!!checked} onChange={(e) => onCheck(e.target.checked)}
                className="h-[18px] w-[18px] accent-[hsl(var(--primary))]" aria-label={`Select ${t.code}`} data-testid={`checkbox-ticket-${t.id}`} />
            </label>
          )}
          <StatusIcon status={t.status} className="h-4 w-4" />
          <PriorityGlyph p={t.priority} className="hidden md:inline-flex" />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="hidden shrink-0 font-code text-[12px] text-muted-foreground md:inline" data-testid={`text-code-${t.id}`}>{t.code}</span>
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground md:line-clamp-1 md:text-[14.5px]">{t.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="md:hidden"><HealthLabel t={t} compact /></span>
            <span className="tabular-nums md:hidden">{fmtDue(t.dueAt)}</span>
            <span className="font-code text-[12px] md:hidden">{t.code}</span>
            <span className="md:hidden" data-testid={`text-people-${t.id}`}>{perspective === 'asker' ? 'to' : 'from'} <span className="font-medium text-foreground/85">{whoLabel}</span></span>
            <TagPill id={t.projectTagId} />
            {cs ? (
              <span data-testid={`text-closed-${t.id}`}>{cs.took} · <span className={cn('font-medium', cs.late ? 'text-signal' : 'text-ok')}>{cs.timing}</span></span>
            ) : (
              <span className={cn(days >= 7 && 'font-semibold text-foreground')} data-testid={`text-pending-${t.id}`}>{days === 0 ? 'New today' : `Waiting ${days}d`}</span>
            )}
            {comments > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{comments}</span>}
            <TicketFlags t={t} />
            {!pa && perspective === 'asker' && <span className="md:hidden"><OverdueReminderButton t={t} variant="row" /></span>}
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-2 md:flex" title={perspective === 'asker' ? `Owner: ${owner?.name}` : `Asked by ${creator?.name}`}>
          <Avatar p={who} size={24} />
          <span className="truncate text-[13px] text-foreground/85">{whoLabel}</span>
        </div>
        <div className="hidden flex-col items-start gap-0.5 md:flex" title={`${fmtDateTime(t.dueAt)} IST`}>
          <HealthLabel t={t} compact />
          <span className="pl-[14px] text-[12px] tabular-nums text-muted-foreground">{fmtDue(t.dueAt)}</span>
        </div>
        <div className="hidden justify-end md:flex">
          {!pa && perspective === 'asker' && <OverdueReminderButton t={t} variant="row" className="px-2" />}
          {pa && (
            <button
              data-testid={`button-quick-${pa.action}-${t.id}`}
              onClick={(e) => { e.stopPropagation(); run(t, { action: pa.action }); }}
              className="h-8 rounded-lg bg-foreground px-3 text-[12.5px] font-semibold text-background opacity-0 transition-all hover:bg-primary focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 data-[sel=true]:opacity-100"
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
  if (!tickets.length && !children) return null;
  const dot = tone === 'signal' ? 'bg-signal' : tone === 'primary' ? 'bg-primary' : tone === 'amber' ? 'bg-amber' : tone === 'violet' ? 'bg-violet' : 'bg-muted-foreground/50';
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid={`group-${title.toLowerCase().replace(/\W+/g, '-')}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-paper md:px-5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
        <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground">{title}</span>
        <span className="rounded-md bg-muted px-1.5 font-code text-[12px] font-medium text-foreground/70">{tickets.length}</span>
        {hint && <span className="ml-2 hidden min-w-0 truncate text-[12.5px] text-muted-foreground lg:block">{hint}</span>}
        <ChevronRight className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden border-t border-border/70">
            <div className="hidden grid-cols-[52px_minmax(0,1fr)_150px_168px_92px] gap-x-3 bg-paper/70 py-1.5 pl-5 pr-4 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground md:grid" aria-hidden>
              <span /><span>Task</span><span>{perspective === 'asker' ? 'Owner' : 'Asked by'}</span><span>Deadline</span><span />
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

/** J/K navigation, Enter open, D done, C comment. */
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
      else if (k === 'd' && cur && ['accepted', 'in_progress'].includes(cur.status) && (cur.assigneeId === me.id || isAdmin)) ref.current.run(cur, { action: 'done' });
      else if (k === 'c' && cur) { e.preventDefault(); composeOn(ref.current.openTicket, cur.id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [me.id, isAdmin]);
  return [sel, setSel] as const;
}
