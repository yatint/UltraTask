import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { Ticket, TicketActionAction } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useTicketActions } from '@/lib/ops';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { applyFilters, usePersistedFilters } from '@/lib/filters';
import { fmtDue, health, isActive, istDay } from '@/lib/time';
import { PageHeader, EmptyState } from '@/components/shell';
import { FilterBar } from '@/components/filter-bar';
import { Avatar, HealthLabel, PriorityGlyph, STATUS_LABEL, StatusIcon, TagPill, TicketFlags } from '@/components/atoms';
import { TicketRow, useListKeys } from '@/components/ticket-list';

const COLS = ['open', 'accepted', 'in_progress', 'done', 'closed'] as const;

export default function Team() {
  const { ws, me, isAdmin, isPreview } = useWs();
  const [f, setF] = usePersistedFilters(me.id, 'team');
  const [mode, setMode] = useState<'people' | 'kanban'>(() => (localStorage.getItem(`ut:team-mode:${me.id}`) as 'people' | 'kanban') || 'people');
  const setM = (m: 'people' | 'kanban') => { setMode(m); localStorage.setItem(`ut:team-mode:${me.id}`, m); };
  const now = Date.now();
  const list = useMemo(() => applyFilters(ws.tickets.filter((t) => t.status !== 'closed' || (t.closedAt && istDay(now) - istDay(t.closedAt) <= 7)), f, ws, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws, f]);
  const [sel, setSel] = useListKeys(list);

  if (!isAdmin && !isPreview) {
    return <div className="mx-auto max-w-[1100px]"><PageHeader title="Team" /><EmptyState title="Admins only" body="The team board shows everyone's load. Ask an admin if you need it." /></div>;
  }
  const active = ws.tickets.filter(isActive);
  const overdue = active.filter((t) => health(t, now).key === 'overdue').length;
  const awaiting = ws.tickets.filter((t) => t.status === 'done').length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Team" sub={<span data-testid="text-summary">{active.length} open across {ws.users.filter((u) => u.isActive).length} people · <span className="text-signal">{overdue} overdue</span> · {awaiting} awaiting a check</span>}
        right={
          <div className="relative inline-flex rounded-full border border-border bg-card p-1 shadow-xs">
            {(['people', 'kanban'] as const).map((m) => (
              <button key={m} onClick={() => setM(m)} className={cn('relative rounded-full px-4 py-1.5 text-[13px] capitalize transition-colors', mode === m ? 'text-background' : 'text-muted-foreground hover:text-foreground')} data-testid={`toggle-${m}`}>
                {mode === m && <motion.span layoutId="team-mode" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="relative">{m === 'people' ? 'By person' : 'Kanban'}</span>
              </button>
            ))}
          </div>
        } />
      <div className="mb-5"><FilterBar f={f} setF={setF} /></div>
      {mode === 'people' ? <People list={list} sel={sel} setSel={setSel} /> : <Kanban list={list} />}
    </div>
  );
}

function People({ list, sel, setSel }: { list: Ticket[]; sel: number | null; setSel: (id: number) => void }) {
  const { ws } = useWs();
  const now = Date.now();
  const people = ws.users.filter((u) => u.isActive).map((u) => {
    const ts = list.filter((t) => t.assigneeId === u.id && t.status !== 'closed');
    return { u, ts, over: ts.filter((t) => health(t, now).key === 'overdue').length, act: ts.filter(isActive).length, na: ts.filter((t) => t.status === 'open').length, blk: ts.filter((t) => isActive(t) && t.isBlocked).length, chk: ts.filter((t) => t.status === 'done').length };
  }).sort((a, b) => b.over - a.over || b.act - a.act);
  const max = Math.max(1, ...people.map((p) => p.act));
  if (!list.length) return <EmptyState art="search" title="Nothing matches" body="Clear a filter to see the board again." />;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {people.map(({ u, ts, over, act, na, blk, chk }, i) => (
        <motion.section key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" data-testid={`card-person-${u.id}`}>
          <header className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
            <Avatar p={u} size={34} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{u.name}</div>
              <div className="truncate text-[12px] text-muted-foreground">{u.designation}</div>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-x-4 gap-y-1 text-right sm:flex sm:items-center">
              <Stat n={act} l="open" /><Stat n={over} l="overdue" tone={over ? 'text-signal' : ''} /><Stat n={na} l="not accepted" /><Stat n={blk} l="blocked" tone={blk ? 'text-violet' : ''} /><Stat n={chk} l="to check" tone={chk ? 'text-check' : ''} />
            </div>
          </header>
          <div className="h-1 bg-muted"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: act / max }} style={{ originX: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className={cn('h-full', over ? 'bg-signal/70' : 'bg-primary/60')} /></div>
          {ts.length === 0 ? <p className="px-5 py-5 text-sm text-muted-foreground">Nothing on their plate.</p>
            : ts.slice(0, 6).map((t) => <TicketRow key={t.id} t={t} perspective="owner" selected={sel === t.id} onSelect={() => setSel(t.id)} />)}
          {ts.length > 6 && <div className="px-5 py-2 text-xs text-muted-foreground">+{ts.length - 6} more</div>}
        </motion.section>
      ))}
    </div>
  );
}

const Stat = ({ n, l, tone }: { n: number; l: string; tone?: string }) => (
  <div><div className={cn('font-code text-[15px] tabular-nums', tone)}>{n}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div></div>
);

type Col = (typeof COLS)[number];
function moveAction(from: Ticket['status'], to: Col): TicketActionAction | 'reopen' | null {
  if (from === to) return null;
  if (from === 'open' && to === 'accepted') return 'accept';
  if (from === 'accepted' && to === 'in_progress') return 'start';
  if ((from === 'accepted' || from === 'in_progress') && to === 'done') return 'done';
  if (from === 'done' && to === 'closed') return 'close';
  if ((from === 'done' || from === 'closed') && (to === 'in_progress' || to === 'accepted')) return 'reopen';
  return null;
}

function Kanban({ list }: { list: Ticket[] }) {
  const { openTicket, person, guard } = useWs();
  const { run } = useTicketActions();
  const [over, setOver] = useState<Col | null>(null);
  const drop = (c: Col, e: React.DragEvent) => {
    e.preventDefault(); setOver(null);
    const t = list.find((x) => x.id === Number(e.dataTransfer.getData('text/ticket')));
    if (!t) return;
    const a = moveAction(t.status, c);
    if (!a) { if (t.status !== c) toast.error(`${t.code} can't move from ${STATUS_LABEL[t.status]} to ${STATUS_LABEL[c]} directly.`); return; }
    if (!guard('move tickets')) return;
    if (a === 'reopen') { toast('Reopening needs a reason — do it from the ticket.'); openTicket(t.id); return; }
    run(t, { action: a });
  };
  return (
    <div className="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      {COLS.map((c) => {
        const ts = list.filter((t) => t.status === c);
        return (
          <section key={c} onDragOver={(e) => { e.preventDefault(); setOver(c); }} onDragLeave={() => setOver((o) => (o === c ? null : o))} onDrop={(e) => drop(c, e)}
            className={cn('w-[290px] shrink-0 snap-start rounded-xl bg-muted/60 p-2 ring-2 ring-transparent transition-colors', over === c && 'bg-accent/70 ring-primary/40')} data-testid={`column-${c}`}>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <StatusIcon status={c} /><span className="text-[13px] font-semibold">{STATUS_LABEL[c]}{c === 'closed' && <span className="font-normal text-muted-foreground"> · 7d</span>}</span>
              <span className="ml-auto font-code text-[11px] text-muted-foreground">{ts.length}</span>
            </div>
            <div className="mt-1 space-y-2">
              {ts.map((t) => (
                <button key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/ticket', String(t.id)); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => openTicket(t.id)}
                  className="block w-full cursor-grab rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing" data-testid={`card-ticket-${t.id}`}>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><PriorityGlyph p={t.priority} /><span className="font-code">{t.code}</span><span className="ml-auto"><Avatar p={person(t.assigneeId)} size={20} /></span></div>
                  <div className="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug">{t.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><HealthLabel t={t} compact /><TagPill id={t.projectTagId} /><TicketFlags t={t} /></div>
                  <div className="mt-2 text-[11px] text-muted-foreground">Due {fmtDue(t.dueAt)} · from {person(t.createdById)?.name}</div>
                </button>
              ))}
              {ts.length === 0 && <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground"><Lock className="h-3 w-3 opacity-0" />Drop here</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
