import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Search } from 'lucide-react';
import {
  getGetPreviewSnapshotQueryKey,
  getGetSnapshotQueryKey,
  useGetPreviewSnapshot,
  useGetSnapshot,
  type Person,
  type SnapshotCounts,
  type SnapshotMember,
  type SnapshotTicketGroups,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { errMsg } from '@/lib/ops';
import { fmtDateTime, fmtDue } from '@/lib/time';
import { PageHeader, EmptyState } from '@/components/shell';
import { Avatar, HealthLabel, Skel, STATUS_LABEL, StatusIcon } from '@/components/atoms';

type MKey = keyof SnapshotTicketGroups;
interface Metric { k: MKey; label: string; def: string; tone?: string }

const BANDS: { title: string; metrics: Metric[] }[] = [
  {
    title: 'Right now',
    metrics: [
      { k: 'totalAssigned', label: 'Assigned', def: 'Every retained task where this person is the current owner. A reassigned task counts once, for its final owner.' },
      { k: 'open', label: 'Open', def: 'Still active: open, accepted or in progress. Includes the overdue ones.' },
      { k: 'overdue', label: 'Overdue', def: 'Active and past its deadline right now, blocked tasks included. Already counted inside Open.', tone: 'text-signal' },
      { k: 'waitingForCheck', label: 'Awaiting check', def: 'Marked done by the owner, not yet confirmed by the asker. Not counted as completed, and never overdue.', tone: 'text-check' },
    ],
  },
  {
    title: 'Finished',
    metrics: [
      { k: 'completed', label: 'Completed', def: 'Confirmed and closed by the person who asked.' },
      { k: 'onTime', label: 'On time', def: 'Completed by the deadline. Early completions are included here.', tone: 'text-ok' },
      { k: 'early', label: 'Early', def: 'Completed strictly before the deadline. Also counted in On time.' },
      { k: 'late', label: 'Late', def: 'Completed after the deadline.', tone: 'text-signal' },
      { k: 'unknownTiming', label: 'Timing unknown', def: 'Completed, but without the history to judge timing. Left out of the on-time rate.' },
    ],
  },
  {
    title: 'Ended without finishing',
    metrics: [
      { k: 'cancelled', label: 'Cancelled', def: 'Called off by the asker or an admin.' },
      { k: 'declined', label: 'Declined', def: 'Turned down by the owner.' },
    ],
  },
];
const ALL = BANDS.flatMap((b) => b.metrics);

function rateText(c: SnapshotCounts) {
  const p = c.onTimeRate;
  const timed = c.onTime + c.late;
  if (p == null || timed === 0) return 'No timed completions yet';
  return `${p.toFixed(1)}% on time · ${c.onTime} of ${timed} timed`;
}

interface Drill { title: string; metric: Metric; ids: number[] }

export default function Snapshot() {
  const { isAdmin, isPreview } = useWs();
  const [includeDemo, setIncludeDemo] = useState(false);
  const params = { includeDemo };
  const live = useGetSnapshot(params, { query: { enabled: !isPreview && isAdmin, queryKey: getGetSnapshotQueryKey(params), refetchInterval: 60000 } });
  const prev = useGetPreviewSnapshot({ query: { enabled: isPreview, queryKey: getGetPreviewSnapshotQueryKey() } });
  const q = isPreview ? prev : live;
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<Drill | null>(null);

  const members = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = (q.data?.members ?? []).filter((m) => !s || m.name.toLowerCase().includes(s) || m.designation.toLowerCase().includes(s));
    return [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [q.data, search]);

  if (!isAdmin && !isPreview) {
    return <div className="mx-auto max-w-[1100px]"><PageHeader title="Snapshot" /><EmptyState title="Admins only" body="The lifetime snapshot covers everyone's record. Ask an admin if you need it." /></div>;
  }

  const allIds = (k: MKey) => Array.from(new Set((q.data?.members ?? []).flatMap((m) => m.ticketIds[k])));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Snapshot"
        sub={<span data-testid="text-snapshot-sub">Lifetime record for every person, across all retained tasks, old closed ones included.{q.data && <> Updated {fmtDateTime(q.data.generatedAt)} IST.</>}</span>}
        right={!isPreview ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-card px-3.5 ring-1 ring-border">
            <span className="text-[13px] font-medium">Include sample tasks</span>
            <Switch checked={includeDemo} onCheckedChange={setIncludeDemo} data-testid="switch-include-demo" />
          </label>
        ) : <span className="rounded-lg bg-amber/10 px-3 py-2 text-[13px] font-medium text-amber" data-testid="text-sample-snapshot">Fictional sample team</span>} />

      <Definitions />

      {q.isLoading ? <SnapshotSkeleton /> : q.error ? (
        <div className="rounded-2xl border border-signal/25 bg-signal/[0.04] p-6 text-center" data-testid="snapshot-error">
          <p className="font-semibold">Could not load the snapshot</p>
          <p className="mt-1 text-sm text-muted-foreground">{errMsg(q.error)}</p>
          <Button className="mt-4 h-11 gap-2 rounded-xl" onClick={() => q.refetch()} data-testid="button-retry-snapshot"><RefreshCw className="h-4 w-4" />Try again</Button>
        </div>
      ) : !q.data || q.data.members.length === 0 ? (
        <EmptyState title="No history yet" body={includeDemo ? 'Nobody has been assigned a task yet.' : 'No real tasks have been assigned yet. Turn on sample tasks to see how this reads.'} />
      ) : (
        <>
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-sidebar p-4 text-sidebar-accent-foreground shadow-md md:p-5" data-testid="snapshot-totals">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[15px] font-bold">Whole team</h2>
              <span className="text-[13px] text-sidebar-foreground/80" data-testid="text-team-rate">{rateText(q.data.totals)}</span>
              {q.data.includeDemo && <span className="rounded-md bg-amber/20 px-1.5 py-0.5 text-[11.5px] font-semibold text-[hsl(34_88%_70%)]">Includes sample tasks</span>}
            </div>
            <Bands counts={q.data.totals} dark onPick={(m) => setDrill({ title: 'Whole team', metric: m, ids: allIds(m.k) })} idPrefix="total" />
          </motion.section>

          <div className="mb-3 mt-8 flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-bold">People <span className="font-code text-[13px] font-medium text-muted-foreground">{members.length}</span></h2>
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person or role" aria-label="Find a person"
                className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[14px] outline-none transition-colors focus:border-primary" data-testid="input-snapshot-search" />
            </div>
          </div>
          {members.length === 0 ? <EmptyState art="search" title="Nobody by that name" body="Try a first name or a designation." /> : (
            <div className="space-y-3">
              {members.map((m, i) => <MemberCard key={m.personId} m={m} i={i} onPick={(metric) => setDrill({ title: m.name, metric, ids: m.ticketIds[metric.k] })} />)}
            </div>
          )}
          <p className="mt-6 text-center text-[12.5px] text-muted-foreground">Listed alphabetically. This is a record, not a ranking.</p>
        </>
      )}
      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function Bands({ counts, onPick, dark, idPrefix }: { counts: SnapshotCounts; onPick: (m: Metric) => void; dark?: boolean; idPrefix: string }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[4fr_5fr_2fr]">
      {BANDS.map((b) => (
        <div key={b.title} className="min-w-0">
          <div className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em]', dark ? 'text-sidebar-foreground/60' : 'text-muted-foreground')}>{b.title}</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-wrap">
            {b.metrics.map((m) => {
              const n = counts[m.k];
              return (
                <button key={m.k} disabled={n === 0} onClick={() => onPick(m)} title={m.def} data-testid={`metric-${idPrefix}-${m.k}`}
                  className={cn('group min-w-0 rounded-xl px-2.5 py-2 text-left transition-[background-color,transform] active:scale-[0.97] disabled:cursor-default disabled:active:scale-100 lg:min-w-[76px] lg:flex-1',
                    dark ? 'bg-sidebar-accent/70 hover:bg-sidebar-accent disabled:opacity-55' : 'bg-paper ring-1 ring-border/70 hover:bg-accent/60 disabled:opacity-50 disabled:hover:bg-paper')}>
                  <div className={cn('font-code text-[19px] font-semibold leading-none tabular-nums', n > 0 && m.tone, dark && n > 0 && m.tone === 'text-signal' && 'text-[hsl(10_80%_68%)]', dark && n > 0 && m.tone === 'text-ok' && 'text-[hsl(150_45%_60%)]', dark && m.tone === 'text-check' && n > 0 && 'text-[hsl(212_75%_70%)]')}>{n}</div>
                  <div className={cn('mt-1 truncate text-[12px]', dark ? 'text-sidebar-foreground/80' : 'text-muted-foreground')}>{m.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberCard({ m, i, onPick }: { m: SnapshotMember; i: number; onPick: (metric: Metric) => void }) {
  const { person } = useWs();
  const p = person(m.personId) ?? ({ id: m.personId, name: m.name, colour: m.colour, avatarUrl: m.avatarUrl } as Person);
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
      className={cn('rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border md:p-5', !m.isActive && 'bg-paper')} data-testid={`snapshot-member-${m.personId}`}>
      <header className="flex flex-wrap items-center gap-3">
        <span className={cn(!m.isActive && 'opacity-60 grayscale')}><Avatar p={p} size={36} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-bold tracking-[-0.01em]">{m.name}</span>
            {!m.isActive && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">Inactive</span>}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">{m.designation || 'No designation'}</div>
        </div>
        <div className="w-full text-[13px] text-muted-foreground sm:w-auto sm:text-right" data-testid={`text-rate-${m.personId}`}>{rateText(m.counts)}</div>
      </header>
      {m.counts.totalAssigned === 0
        ? <p className="mt-3 text-sm text-muted-foreground">No retained tasks assigned to this person.</p>
        : <Bands counts={m.counts} onPick={onPick} idPrefix={String(m.personId)} />}
    </motion.section>
  );
}

function Definitions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 rounded-2xl bg-card ring-1 ring-border">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[14px] font-semibold md:px-5" data-testid="button-definitions">
        What each number means
        <span className="hidden text-[12.5px] font-normal text-muted-foreground sm:inline">Open includes overdue. Early is part of On time.</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-x-6 gap-y-3 border-t border-border/70 px-4 py-4 text-[13px] sm:grid-cols-2 md:px-5" data-testid="list-definitions">
          {ALL.map((m) => <div key={m.k}><dt className="font-semibold">{m.label}</dt><dd className="text-muted-foreground">{m.def}</dd></div>)}
          <div><dt className="font-semibold">On-time rate</dt><dd className="text-muted-foreground">On time divided by on time plus late. Unknown timing is left out.</dd></div>
        </motion.dl>
      )}
    </div>
  );
}

function DrillDialog({ drill, onClose }: { drill: Drill | null; onClose: () => void }) {
  const { ticketById, person, openTicket } = useWs();
  const tickets = (drill?.ids ?? []).map((id) => ticketById(id)).filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => +new Date(b.dueAt) - +new Date(a.dueAt));
  const hidden = (drill?.ids.length ?? 0) - tickets.length;
  return (
    <Dialog open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <DialogTitle className="font-display text-xl">{drill?.metric.label} <span className="font-code text-base text-muted-foreground">{drill?.ids.length}</span></DialogTitle>
          <DialogDescription>{drill?.title}. {drill?.metric.def}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => { onClose(); openTicket(t.id); }} className="flex w-full items-start gap-3 border-b border-border/60 px-5 py-3 text-left transition-colors hover:bg-paper" data-testid={`drill-ticket-${t.id}`}>
              <StatusIcon status={t.status} className="mt-0.5 h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2"><span className="shrink-0 font-code text-[12px] text-muted-foreground">{t.code}</span><span className="truncate text-[14px] font-semibold">{t.title}</span></span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
                  <HealthLabel t={t} compact />
                  <span>{STATUS_LABEL[t.status]}</span>
                  <span>Due {fmtDue(t.dueAt)}</span>
                  <span>from {person(t.createdById)?.name ?? 'someone'}</span>
                </span>
              </span>
            </button>
          ))}
          {hidden > 0 && <p className="px-5 py-4 text-[13px] text-muted-foreground">{hidden} {hidden === 1 ? 'task is' : 'tasks are'} counted but not visible in this workspace view.</p>}
          {drill && drill.ids.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No tasks here.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-3" data-testid="snapshot-loading">
      <Skel className="h-40 w-full rounded-2xl" />
      {[0, 1, 2].map((i) => <Skel key={i} className="h-36 w-full rounded-2xl" />)}
    </div>
  );
}
