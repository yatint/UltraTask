import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CalendarDays, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { fmtDue, inputFromDay, istDay, nextWorking } from '@/lib/time';
import { Avatar, PriorityGlyph } from './atoms';
import { dueFromInputs, istInputParts, isValidDateInput } from '@/lib/due-input';

export function usePeopleOrdered() {
  const { ws, me } = useWs();
  return useMemo(() => {
    const act = ws.users.filter((u) => u.isActive);
    return [...act.filter((u) => u.id === me.id), ...act.filter((u) => u.id !== me.id).sort((a, b) => a.name.localeCompare(b.name))];
  }, [ws.users, me.id]);
}

export function PersonPicker({ value, onChange, placeholder = 'Assign to', multiple, testId = 'picker-person', compact }: {
  value: number[]; onChange: (ids: number[]) => void; placeholder?: string; multiple?: boolean; testId?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const people = usePeopleOrdered();
  const { me, person } = useWs();
  const sel = value.map((id) => person(id)).filter(Boolean);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId} className={cn('flex h-11 min-w-0 items-center gap-2 rounded-xl border border-input bg-paper px-2.5 text-left text-sm transition-colors hover:border-foreground/25', compact && 'h-8')}>
          {sel.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {sel.length === 1 && (<><Avatar p={sel[0]} size={20} /><span className="truncate">{sel[0]!.id === me.id ? 'Me' : sel[0]!.name}</span></>)}
          {sel.length > 1 && <span className="truncate">{sel.length} people</span>}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people" data-testid={`${testId}-search`} />
          <CommandList>
            <CommandEmpty>No one by that name.</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const on = value.includes(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.designation} ${p.id === me.id ? 'me' : ''}`}
                    onSelect={() => {
                      if (multiple) onChange(on ? value.filter((v) => v !== p.id) : [...value, p.id]);
                      else { onChange([p.id]); setOpen(false); }
                    }}
                    data-testid={`option-person-${p.id}`}
                    className="gap-2.5"
                  >
                    <Avatar p={p} size={22} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{p.name}{p.id === me.id && <span className="ml-1.5 text-xs text-primary">Me</span>}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{p.designation}</span>
                    </span>
                    {on && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const TIME_SHORTCUTS = [{ t: '10:00', l: '10 AM' }, { t: '13:00', l: '1 PM' }, { t: '18:00', l: '6 PM' }];

export function DueField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { ws } = useWs();
  const init = istInputParts(value);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time || '18:00');
  const [err, setErr] = useState('');
  const emitted = useRef(value);
  const uid = useId();

  // Rehydrate when the parent changes value (edit open, reset after create).
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    if (!value) { setDate(''); setTime('18:00'); setErr(''); return; }
    const p = istInputParts(value);
    setDate(p.date); setTime(p.time || '18:00'); setErr('');
  }, [value]);

  const commit = (d: string, t: string) => {
    setDate(d); setTime(t);
    const r = dueFromInputs(d, t);
    const next = r.ok ? r.iso : '';
    const e = r.ok ? '' : r.error;
    setErr(e);
    emitted.current = next;
    onChange(next);
  };

  const today = istDay(Date.now());
  const working = ws.settings.workingDays;
  const dayShortcuts = useMemo(() => {
    const nw = nextWorking(today, working, 1);
    const list = [{ k: 'today', l: 'Today', d: today }, { k: 'tomorrow', l: 'Tomorrow', d: today + 1 }];
    if (nw !== today + 1) list.push({ k: 'next-working', l: 'Next working day', d: nw });
    return list.map((x) => ({ ...x, v: inputFromDay(x.d) }));
  }, [today, working]);

  const inputCls = (bad: boolean) => cn('h-11 w-full min-w-0 rounded-xl border bg-paper px-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20', bad ? 'border-signal' : 'border-input');
  const chip = (on: boolean) => cn('min-h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors active:scale-[0.97]', on ? 'border-primary bg-accent text-accent-foreground' : 'border-input bg-paper text-muted-foreground hover:border-foreground/25 hover:text-foreground');

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <label htmlFor={`${uid}-d`} className="flex items-center gap-1 text-xs font-medium text-foreground"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Date <span className="font-normal text-muted-foreground">(IST)</span></label>
          <input id={`${uid}-d`} type="date" value={date} data-testid="input-due-date" min={inputFromDay(today)} required
            aria-invalid={!!err && !isValidDateInput(date)} onChange={(e) => commit(e.target.value, time)} className={inputCls(!!err && !isValidDateInput(date))} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-t`} className="flex items-center gap-1 text-xs font-medium text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Time <span className="font-normal text-muted-foreground">(IST)</span></label>
          <input id={`${uid}-t`} type="time" value={time} data-testid="input-due-time" step={60} required
            aria-invalid={!!err && isValidDateInput(date)} onChange={(e) => commit(date, e.target.value)} className={inputCls(!!err && isValidDateInput(date))} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date and time shortcuts">
        {dayShortcuts.map((s) => (
          <button type="button" key={s.k} data-testid={`chip-due-${s.k}`} className={chip(date === s.v)} onClick={() => commit(s.v, time)}>{s.l}</button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
        {TIME_SHORTCUTS.map((s) => (
          <button type="button" key={s.t} data-testid={`chip-time-${s.t.replace(':', '')}`} className={chip(time === s.t)} onClick={() => commit(date || inputFromDay(today), s.t)}>{s.l}</button>
        ))}
      </div>
      {err ? <p role="alert" className="text-xs text-signal" data-testid="text-due-error">{err}</p>
        : value ? <p className="text-xs text-muted-foreground" data-testid="text-due-preview">Due <span className="font-medium text-foreground">{fmtDue(value)}</span> IST</p>
        : <p className="text-xs text-muted-foreground">Pick a date and time. Every task needs a deadline.</p>}
    </div>
  );
}

const PRIS = ['low', 'normal', 'high', 'urgent'] as const;
export function PriorityPicker({ value, onChange }: { value: string; onChange: (p: (typeof PRIS)[number]) => void }) {
  return (
    <div role="radiogroup" aria-label="Priority" className="grid w-full grid-cols-2 gap-1 rounded-xl border border-input bg-paper p-1 min-[400px]:grid-cols-4">
      {PRIS.map((p) => (
        <button type="button" role="radio" aria-checked={value === p} key={p} data-testid={`button-priority-${p}`} onClick={() => onChange(p)}
          className={cn('flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium capitalize transition-colors', value === p ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
          <PriorityGlyph p={p} /> <span className="truncate">{p}</span>
        </button>
      ))}
    </div>
  );
}

export function TagSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { ws } = useWs();
  return (
    <select data-testid="select-tag" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="h-11 w-full rounded-xl border border-input bg-paper px-2.5 text-sm">
      <option value="">No project</option>
      {ws.tags.filter((t) => t.isActive || t.id === value).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
