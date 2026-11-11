import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { BellRing, Loader2, X } from 'lucide-react';
import { useActOnTicket } from '@workspace/api-client-react';
import { errMsg, useInvalidate } from '@/lib/ops';
import { useWs } from '@/lib/workspace';
import { applyFilters, activeCount, usePersistedFilters } from '@/lib/filters';
import { health, isActive, istDay } from '@/lib/time';
import { PageHeader, EmptyState } from '@/components/shell';
import { FilterBar } from '@/components/filter-bar';
import { QuickAdd } from '@/components/create-ticket';
import { TicketGroup, useListKeys } from '@/components/ticket-list';

export default function Waiting() {
  const { ws, me } = useWs();
  const [f, setF] = usePersistedFilters(me.id, 'waiting');
  const now = Date.now();
  const g = useMemo(() => {
    const pendingExt = new Set(ws.extensions.filter((e) => e.status === 'pending').map((e) => e.ticketId));
    const asked = applyFilters(ws.tickets.filter((t) => t.createdById === me.id && t.assigneeId !== me.id), f, ws, now);
    const watching = applyFilters(ws.tickets.filter((t) => t.watcherIds.includes(me.id) && t.createdById !== me.id && t.assigneeId !== me.id && (isActive(t) || t.status === 'done')), f, ws, now);
    const check = asked.filter((t) => t.status === 'done');
    const ext = asked.filter((t) => isActive(t) && pendingExt.has(t.id));
    const rest = asked.filter((t) => isActive(t) && !pendingExt.has(t.id));
    const overdue = rest.filter((t) => health(t, now).key === 'overdue');
    const notAccepted = rest.filter((t) => t.status === 'open' && health(t, now).key !== 'overdue');
    const motion = rest.filter((t) => t.status !== 'open' && health(t, now).key !== 'overdue');
    const declined = asked.filter((t) => t.status === 'declined');
    const closed = asked.filter((t) => t.status === 'closed' && t.closedAt && istDay(now) - istDay(t.closedAt) <= 7);
    return { check, ext, overdue, notAccepted, motion, declined, watching, closed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, me.id, f]);
  const ordered = [...g.check, ...g.ext, ...g.overdue, ...g.notAccepted, ...g.motion, ...g.declined, ...g.watching, ...g.closed];
  const [sel, setSel] = useListKeys(ordered);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const nudge = useActOnTicket();
  const inval = useInvalidate();
  const onCheck = (id: number, v: boolean) => setPicked((p) => { const n = new Set(p); if (v) n.add(id); else n.delete(id); return n; });
  const { guard } = useWs();
  const nudgeAll = async () => {
    if (!guard('nudge')) return;
    setBusy(true);
    const ids = [...picked];
    const fails: string[] = [];
    const failedIds: number[] = [];
    let ok = 0;
    for (const id of ids) {
      const t = ws.tickets.find((x) => x.id === id);
      try { await nudge.mutateAsync({ id, data: { action: 'nudge' } }); ok++; }
      catch (e) { fails.push(`${t?.code ?? id}: ${errMsg(e)}`); failedIds.push(id); }
    }
    setBusy(false);
    inval();
    if (ok) toast.success(`Nudged ${ok} of ${ids.length}`);
    if (fails.length) toast.error(`${fails.length} not nudged`, { description: fails.join('\n'), duration: 12000 });
    setPicked(new Set(failedIds));
  };
  const chk = { checked: picked, onCheck };
  const out = g.ext.length + g.overdue.length + g.notAccepted.length + g.motion.length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Waiting on" sub={
        <span data-testid="text-summary">{out} out with others{g.check.length > 0 && <> · <span className="text-primary">{g.check.length} ready for your check</span></>}{g.ext.length > 0 && <> · <span className="text-amber">{g.ext.length} asking for time</span></>}</span>} />
      <div className="space-y-3">
        <QuickAdd />
        <FilterBar f={f} setF={setF} hide={['creators']} />
        {ordered.length === 0 ? (
          activeCount(f) || f.q ? <EmptyState art="search" title="Nothing matches" body="Try another person, status or date range." />
            : <EmptyState title="Nobody owes you anything" body="Things you ask of others show up here, with a clear owner and date, until you confirm they're done." />
        ) : (
          <div className="space-y-3">
            <TicketGroup title="Ready for your check" hint="Confirm & close, or send back with a note" tickets={g.check} tone="primary" perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Extension requests" hint="Approve the new date or hold the line" tickets={g.ext} {...chk} tone="amber" perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Overdue" hint="Tick several to nudge them together — once every 4 hours each" tickets={g.overdue} {...chk} tone="signal" perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Not yet accepted" tickets={g.notAccepted} {...chk} perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="In motion" tickets={g.motion} {...chk} perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Declined — needs a new owner" tickets={g.declined} tone="signal" perspective="asker" selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Watching" tickets={g.watching} perspective="asker" defaultOpen={false} selectedId={sel} setSelected={setSel} />
            <TicketGroup title="Closed this week" tickets={g.closed} perspective="asker" defaultOpen={false} selectedId={sel} setSelected={setSel} />
          </div>
        )}
      </div>
      <AnimatePresence>
        {picked.size > 0 && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-[min(92vw,460px)] items-center gap-3 rounded-2xl bg-foreground py-2 pl-5 pr-2 text-background shadow-xl md:bottom-8" data-testid="bar-bulk">
            <span className="text-sm"><span className="font-code">{picked.size}</span> selected</span>
            <button onClick={() => setPicked(new Set())} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-background/15" aria-label="Clear selection" data-testid="button-clear-selection"><X className="h-4 w-4" /></button>
            <button onClick={nudgeAll} disabled={busy} className="ml-auto flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="button-nudge-all">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Nudge all
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
