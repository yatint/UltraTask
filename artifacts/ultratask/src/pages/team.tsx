import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Ticket, TicketActionAction } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useTicketActions } from '@/lib/ops';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { applyFilters, usePersistedFilters } from '@/lib/filters';
import { fmtDue, isActive, isOverdue, istDay } from '@/lib/time';
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
  const overdue = active.filter((t) => isOverdue(t, now)).length;
  const awaiting = ws.tickets.filter((t) => t.status === 'done').length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Team" sub={<span data-testid="text-summary">{active.length} open across {ws.users.filter((u) => u.isActive).length} people · <span className="text-signal">{overdue} overdue</span> · {awaiting} awaiting a check</span>}
        right={
          <div className="relative inline-flex rounded-xl bg-card p-1 ring-1 ring-border">
            {(['people', 'kanban'] as const).map((m) => (
              <button key={m} onClick={() => setM(m)} className={cn('relative min-h-10 rounded-lg px-4 text-[14px] font-medium capitalize transition-colors', mode === m ? 'text-background' : 'text-muted-foreground hover:text-foreground')} data-testid={`toggle-${m}`}>
                {mode === m && <motion.span layoutId="team-mode" className="absolute inset-0 rounded-lg bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
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
    return { u, ts, over: ts.filter((t) => isOverdue(t, now)).length, act: ts.filter(isActive).length, na: ts.filter((t) => t.status === 'open').length, blk: ts.filter((t) => isActive(t) && t.isBlocked).length, chk: ts.filter((t) => t.status === 'done').length };
  }).sort((a, b) => b.over - a.over || b.act - a.act);
  const max = Math.max(1, ...people.map((p) => p.act));
  if (!list.length) return <EmptyState art="search" title="Nothing matches" body="Clear a filter to see the board again." />;
  return (
    <div className="space-y-3">
      {people.map(({ u, ts, over, act, na, blk, chk }, i) => (
        <motion.section key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border" data-testid={`card-person-${u.id}`}>
          <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-4 md:px-5">
            <Avatar p={u} size={34} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold tracking-[-0.01em]">{u.name}</div>
              <div className="truncate text-[13px] text-muted-foreground">{u.designation}</div>
            </div>
            <div className="grid w-full grid-cols-5 gap-x-2 sm:ml-auto sm:flex sm:w-auto sm:gap-x-5">
              <Stat n={act} l="open" /><Stat n={over} l="overdue" tone={over ? 'text-signal' : ''} /><Stat n={na} l="not accepted" /><Stat n={blk} l="blocked" tone={blk ? 'text-violet' : ''} /><Stat n={chk} l="to check" tone={chk ? 'text-check' : ''} />
            </div>
          </header>
          <div className="h-1 bg-muted"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: act / max }} style={{ originX: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className={cn('h-full', over ? 'bg-signal/70' : 'bg-primary/60')} /></div>
          {ts.length === 0 ? <p className="px-5 py-5 text-sm text-muted-foreground">Nothing on their plate.</p>
            : ts.slice(0, 6).map((t) => <TicketRow key={t.id} t={t} perspective="owner" selected={sel === t.id} onSelect={() => setSel(t.id)} />)}
          {ts.length > 6 && <div className="border-t border-border/60 px-5 py-2.5 text-[13px] text-muted-foreground">+{ts.length - 6} more for this person. Filter by owner to see them all.</div>}
        </motion.section>
      ))}
    </div>
  );
}

const Stat = ({ n, l, tone }: { n: number; l: string; tone?: string }) => (
  <div className="min-w-[56px]"><div className={cn('font-code text-[18px] font-semibold leading-none tabular-nums', tone)}>{n}</div><div className="mt-1 text-[12px] text-muted-foreground">{l}</div></div>
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

const SHORT: Record<Col, string> = { open: 'Open', accepted: 'Accepted', in_progress: 'Doing', done: 'Done', closed: 'Closed' };

function KCard({ t, dense }: { t: Ticket; dense?: boolean }) {
  const { openTicket, person } = useWs();
  return (
    <button draggable onDragStart={(e) => { e.dataTransfer.setData('text/ticket', String(t.id)); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => openTicket(t.id)}
      className={cn('block w-full min-w-0 cursor-grab rounded-xl bg-card text-left shadow-xs ring-1 ring-border transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing', dense ? 'p-3' : 'p-3.5')} data-testid={`card-ticket-${t.id}`}>
      <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground"><PriorityGlyph p={t.priority} /><span className="truncate font-code">{t.code}</span><span className="ml-auto shrink-0"><Avatar p={person(t.assigneeId)} size={20} /></span></div>
      <div className={cn('mt-1.5 break-words font-semibold leading-snug', dense ? 'line-clamp-3 text-[13.5px]' : 'line-clamp-2 text-[14.5px]')}>{t.title}</div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><HealthLabel t={t} compact /><TagPill id={t.projectTagId} />{!dense && <TicketFlags t={t} />}</div>
      <div className="mt-1.5 truncate text-[12px] text-muted-foreground" title={`from ${person(t.createdById)?.name ?? ''}`}>Due {fmtDue(t.dueAt)}{!dense && <> · from {person(t.createdById)?.name}</>}</div>
    </button>
  );
}

function Kanban({ list }: { list: Ticket[] }) {
  const { openTicket, guard } = useWs();
  const { run } = useTicketActions();
  const [over, setOver] = useState<Col | null>(null);
  const [tab, setTab] = useState<Col>('open');
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
  const dz = (c: Col) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(c); },
    onDragLeave: () => setOver((o) => (o === c ? null : o)),
    onDrop: (e: React.DragEvent) => drop(c, e),
  });
  const by = (c: Col) => list.filter((t) => t.status === c);
  const empty = <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-6 text-[13px] text-muted-foreground">Drop here</div>;
  const tabTs = by(tab);
  return (
    <>
      <div className="hidden gap-2.5 xl:grid xl:grid-cols-5" data-testid="kanban-wide">
        {COLS.map((c) => {
          const ts = by(c);
          return (
            <section key={c} {...dz(c)} className={cn('min-w-0 rounded-2xl bg-muted/60 p-2 ring-2 ring-transparent transition-colors', over === c && 'bg-accent/70 ring-primary/40')} data-testid={`column-${c}`}>
              <div className="flex min-w-0 items-center gap-2 px-1.5 py-1.5">
                <StatusIcon status={c} /><span className="truncate text-[13px] font-semibold">{STATUS_LABEL[c]}{c === 'closed' && <span className="font-normal text-muted-foreground"> · 7d</span>}</span>
                <span className="ml-auto rounded-md bg-card px-1.5 font-code text-[12px] font-medium">{ts.length}</span>
              </div>
              <div className="mt-1 space-y-2">{ts.map((t) => <KCard key={t.id} t={t} dense />)}{ts.length === 0 && empty}</div>
            </section>
          );
        })}
      </div>
      <div className="xl:hidden" data-testid="kanban-narrow">
        <div role="tablist" aria-label="Status" className="grid grid-cols-5 gap-1 rounded-2xl bg-muted/70 p-1">
          {COLS.map((c) => {
            const n = by(c).length;
            const on = tab === c;
            return (
              <button key={c} id={`kanban-status-${c}`} role="tab" aria-selected={on} aria-controls={`kanban-panel-${c}`} tabIndex={on ? 0 : -1} {...dz(c)} onClick={() => setTab(c)} data-testid={`tab-column-${c}`}
                onKeyDown={(e) => {
                  const index = COLS.indexOf(c);
                  const next = e.key === 'ArrowRight' ? (index + 1) % COLS.length : e.key === 'ArrowLeft' ? (index + COLS.length - 1) % COLS.length : e.key === 'Home' ? 0 : e.key === 'End' ? COLS.length - 1 : null;
                  if (next === null) return;
                  e.preventDefault();
                  setTab(COLS[next]);
                  document.getElementById(`kanban-status-${COLS[next]}`)?.focus();
                }}
                className={cn('relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11.5px] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:text-[13px]',
                  on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground', over === c && 'ring-2 ring-primary/50')}>
                {on && <motion.span layoutId="kanban-tab" className="absolute inset-0 rounded-xl bg-card shadow-xs ring-1 ring-border" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="relative flex min-w-0 items-center gap-1.5"><StatusIcon status={c} className="hidden sm:block" /><span className="truncate">{SHORT[c]}</span></span>
                <span className="relative font-code text-[11.5px] font-medium tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">{STATUS_LABEL[tab]}{tab === 'closed' && ' in the last 7 days'}. Drag a card onto a tab to move it, or open it for every action.</p>
        <motion.div key={tab} id={`kanban-panel-${tab}`} role="tabpanel" aria-labelledby={`kanban-status-${tab}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} {...dz(tab)} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" data-testid={`column-${tab}`}>
          {tabTs.map((t) => <KCard key={t.id} t={t} />)}
          {tabTs.length === 0 && <div className="sm:col-span-2 lg:col-span-3">{empty}</div>}
        </motion.div>
      </div>
    </>
  );
}
