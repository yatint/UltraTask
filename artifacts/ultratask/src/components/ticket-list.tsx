import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronRight, MessageSquare } from 'lucide-react';
import type { Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { closedStats, fmtDateTime, fmtDue, health, pendingDays } from '@/lib/time';
import { useTicketActions } from '@/lib/ops';
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
    if (info.offset.x > 90 && pa) run(t, { action: pa.action });
    else if (info.offset.x < -90) composeOn(openTicket, t.id);
  };

  return (
    <div className="relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 flex items-center justify-between px-5 text-xs font-medium md:hidden" aria-hidden>
        <span className="text-primary">{pa?.label ?? ''}</span><span className="text-muted-foreground">Comment</span>
      </div>
      <motion.div
        layout={!reduce}
        drag={reduce ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={onDragEnd}
        onClick={() => { onSelect?.(); openTicket(t.id); }}
        data-testid={`row-ticket-${t.id}`}
        className={cn('group relative grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-3 border-b border-border/70 bg-card py-2.5 pl-5 pr-4 transition-colors md:grid-cols-[auto_auto_1fr_auto_auto_auto] md:pr-5',
          selected ? 'bg-accent/60' : 'hover:bg-paper')}
      >
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', HEALTH_BORDER[h.key])} />
        {selected && <motion.span layoutId="row-sel" className="absolute inset-y-0 left-[3px] w-[2px] bg-foreground/60" />}
        <div className="flex items-center gap-2">
          {onCheck && (
            <input type="checkbox" checked={!!checked} onClick={(e) => e.stopPropagation()} onChange={(e) => onCheck(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]" aria-label={`Select ${t.code}`} data-testid={`checkbox-ticket-${t.id}`} />
          )}
          <PriorityGlyph p={t.priority} /><StatusIcon status={t.status} />
        </div>
        <span className="hidden font-code text-[11.5px] text-muted-foreground md:block" data-testid={`text-code-${t.id}`}>{t.code}</span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <span className="line-clamp-2 text-[14px] font-medium tracking-[-0.005em] md:line-clamp-1">{t.title}</span>
            {comments > 0 && <span className="mt-0.5 hidden items-center gap-0.5 text-[11px] text-muted-foreground sm:inline-flex"><MessageSquare className="h-3 w-3" />{comments}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
            <span className="font-code md:hidden">{t.code}</span>
            <span data-testid={`text-people-${t.id}`}>{perspective === 'asker' ? <>to <span className="text-foreground/80">{owner?.id === me.id ? 'you' : owner?.name}</span></> : <>from <span className="text-foreground/80">{creator?.id === me.id ? 'you' : creator?.name}</span></>}</span>
            <span className="md:hidden">· {fmtDue(t.dueAt)}</span>
            <TagPill id={t.projectTagId} />
            {cs ? (
              <span data-testid={`text-closed-${t.id}`}>{cs.took} · <span className={cn(cs.late ? 'text-signal' : 'text-ok')}>{cs.timing}</span></span>
            ) : (
              <span className={cn(days >= 7 && 'font-semibold text-foreground')} data-testid={`text-pending-${t.id}`}>{days === 0 ? 'New today' : `Pending ${days}d`}</span>
            )}
            <TicketFlags t={t} />
          </div>
        </div>
        <HealthLabel t={t} compact />
        <span className="hidden w-36 text-right text-[12px] tabular-nums text-muted-foreground md:block" title={`${fmtDateTime(t.dueAt)} IST`}>{fmtDue(t.dueAt)}</span>
        <div className="hidden items-center gap-2 md:flex">
          {pa && (
            <button
              data-testid={`button-quick-${pa.action}-${t.id}`}
              onClick={(e) => { e.stopPropagation(); run(t, { action: pa.action }); }}
              className="rounded-md border border-border bg-paper px-2 py-0.5 text-[11.5px] font-medium opacity-0 transition-all hover:border-primary hover:text-primary group-hover:opacity-100 data-[sel=true]:opacity-100"
              data-sel={selected}
            >{pa.label}</button>
          )}
          <span title={perspective === 'asker' ? `Owner: ${owner?.name}` : `Asked by ${creator?.name}`}><Avatar p={perspective === 'asker' ? owner : creator} size={22} /></span>
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
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" data-testid={`group-${title.toLowerCase().replace(/\W+/g, '-')}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 border-b border-border/70 bg-paper/60 px-4 py-2 text-left md:px-5">
        <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <span className={cn('text-[12.5px] font-semibold', tone === 'signal' && 'text-signal', tone === 'primary' && 'text-primary', tone === 'amber' && 'text-amber', tone === 'violet' && 'text-violet')}>{title}</span>
        <span className="font-code text-[11px] text-muted-foreground">{tickets.length}</span>
        {hint && <span className="ml-auto hidden truncate text-[11.5px] text-muted-foreground sm:block">{hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
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
