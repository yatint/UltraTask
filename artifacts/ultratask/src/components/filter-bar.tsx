import { useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, X, ArrowDownUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { EMPTY, activeCount, type Filters, type SortKey } from '@/lib/filters';
import { Avatar, Kbd, PriorityGlyph, STATUS_LABEL, StatusIcon } from './atoms';

const HEALTH_OPTS = [
  ['overdue', 'Overdue'], ['today', 'Due today'], ['soon', 'Due within 24h'], ['on_track', 'On track'], ['awaiting', 'Awaiting check'], ['blocked', 'Blocked'], ['closed', 'Closed'],
] as const;

export function FilterBar({ f, setF, hide = [] }: { f: Filters; setF: (f: Filters) => void; hide?: ('assignees' | 'creators')[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const { ws } = useWs();
  const n = activeCount(f);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (e.key === '/' && !tg.closest('input,textarea,select,[contenteditable=true]')) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const toggle = <K extends 'assignees' | 'creators' | 'statuses' | 'tags' | 'priorities' | 'health'>(k: K, v: Filters[K][number]) => {
    const arr = f[k] as (string | number)[];
    setF({ ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
  };
  const people = ws.users.filter((u) => u.isActive);

  return (
    <div className="flex items-center gap-2" data-testid="filter-bar">
      <div className="group flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-card pl-3.5 pr-1.5 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-primary/50">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input ref={ref} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} data-testid="input-search"
          placeholder="Filter this list" aria-label="Filter this list by code, title, notes or comments" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
        {f.q ? <button onClick={() => setF({ ...f, q: '' })} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button> : <span className="hidden sm:block"><Kbd>/</Kbd></span>}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button data-testid="button-filters" className={cn('flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[14px] font-medium transition-all active:scale-[0.97] sm:px-4', n ? 'bg-foreground text-background' : 'bg-card ring-1 ring-border hover:ring-foreground/30')}>
            <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{n > 0 && <span className="font-code text-xs">{n}</span>}<span className="sr-only">Filters</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[70dvh] w-[min(92vw,440px)] overflow-y-auto rounded-2xl p-0">
          <div className="space-y-5 p-5">
            {!hide.includes('assignees') && (
              <Sec title="Owner">{people.map((p) => <Pill key={p.id} on={f.assignees.includes(p.id)} onClick={() => toggle('assignees', p.id)} id={`assignee-${p.id}`}><Avatar p={p} size={16} />{p.name.split(' ')[0]}</Pill>)}</Sec>
            )}
            {!hide.includes('creators') && (
              <Sec title="Asked by">{people.map((p) => <Pill key={p.id} on={f.creators.includes(p.id)} onClick={() => toggle('creators', p.id)} id={`creator-${p.id}`}><Avatar p={p} size={16} />{p.name.split(' ')[0]}</Pill>)}</Sec>
            )}
            <Sec title="Status">{Object.keys(STATUS_LABEL).map((s) => <Pill key={s} on={f.statuses.includes(s)} onClick={() => toggle('statuses', s)} id={`status-${s}`}><StatusIcon status={s} />{STATUS_LABEL[s]}</Pill>)}</Sec>
            <Sec title="Health">{HEALTH_OPTS.map(([k, l]) => <Pill key={k} on={f.health.includes(k)} onClick={() => toggle('health', k)} id={`health-${k}`}>{l}</Pill>)}</Sec>
            <Sec title="Priority">{['urgent', 'high', 'normal', 'low'].map((p) => <Pill key={p} on={f.priorities.includes(p)} onClick={() => toggle('priorities', p)} id={`priority-${p}`}><PriorityGlyph p={p} /><span className="capitalize">{p}</span></Pill>)}</Sec>
            {ws.tags.length > 0 && <Sec title="Project">{ws.tags.map((t) => <Pill key={t.id} on={f.tags.includes(t.id)} onClick={() => toggle('tags', t.id)} id={`tag-${t.id}`}><span className="h-2 w-2 rotate-45 rounded-[2px]" style={{ background: t.colour }} />{t.name}</Pill>)}</Sec>}
            <div className="grid grid-cols-2 gap-4">
              <Range title="Created (IST)" from={f.createdFrom} to={f.createdTo} set={(a, b) => setF({ ...f, createdFrom: a, createdTo: b })} id="created" />
              <Range title="Due (IST)" from={f.dueFrom} to={f.dueTo} set={(a, b) => setF({ ...f, dueFrom: a, dueTo: b })} id="due" />
            </div>
          </div>
          <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-popover px-5 py-3">
            <button className="min-h-10 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent" onClick={() => setF({ ...EMPTY, q: f.q, sort: f.sort })} data-testid="button-clear-filters">Clear all</button>
            <span className="text-xs text-muted-foreground">Remembered for this screen</span>
          </div>
        </PopoverContent>
      </Popover>
      <label className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-card pl-3 pr-1 text-[14px] font-medium ring-1 ring-border"><span className="sr-only">Sort</span>
        <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as SortKey })} className="h-full max-w-[7.5rem] bg-transparent pr-1 outline-none sm:max-w-none" data-testid="select-sort">
          <option value="due">Due soonest</option>
          <option value="priority">Priority</option>
          <option value="created">Newest</option>
          <option value="updated">Recently updated</option>
        </select>
      </label>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
function Pill({ on, onClick, children, id }: { on: boolean; onClick: () => void; children: React.ReactNode; id: string }) {
  return (
    <button onClick={onClick} data-testid={`filter-${id}`} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all active:scale-95', on ? 'bg-foreground text-background' : 'bg-muted/70 text-foreground hover:bg-muted')}>
      {children}
    </button>
  );
}
function Range({ title, from, to, set, id }: { title: string; from: string; to: string; set: (a: string, b: string) => void; id: string }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-foreground">{title}</div>
      <div className="space-y-1.5">
        <input type="date" value={from} onChange={(e) => set(e.target.value, to)} data-testid={`input-${id}-from`} className="h-10 w-full rounded-lg border border-input bg-paper px-2 text-[13px]" />
        <input type="date" value={to} onChange={(e) => set(from, e.target.value)} data-testid={`input-${id}-to`} className="h-10 w-full rounded-lg border border-input bg-paper px-2 text-[13px]" />
      </div>
    </div>
  );
}
