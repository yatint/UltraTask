import { useMemo, useState } from 'react';
import { Check, ChevronDown, CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { customDueIso, dueChips, fmtDue, inputFromDay, istDay } from '@/lib/time';
import { Avatar, PriorityGlyph } from './atoms';

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

export function DueField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { ws } = useWs();
  const chips = useMemo(() => dueChips(ws.settings.workingDays), [ws.settings.workingDays]);
  const [custom, setCustom] = useState(false);
  const [date, setDate] = useState(inputFromDay(istDay(Date.now()) + 1));
  const [time, setTime] = useState('18:00');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            type="button"
            key={c.key}
            data-testid={`chip-due-${c.key}`}
            onClick={() => { setCustom(false); onChange(c.iso); }}
            className={cn('group flex min-h-11 flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left transition-all active:scale-[0.97]',
              value === c.iso ? 'border-primary bg-accent text-accent-foreground shadow-sm' : 'border-input bg-paper hover:border-foreground/25')}
          >
            <span className="text-[12.5px] font-medium leading-tight">{c.label}</span>
            <span className="text-[12px] text-muted-foreground">{c.hint}</span>
          </button>
        ))}
        <button type="button" data-testid="chip-due-custom" onClick={() => setCustom((v) => !v)}
          className={cn('flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors', custom ? 'border-primary bg-accent' : 'border-dashed border-input hover:border-foreground/30')}>
          <CalendarDays className="h-3.5 w-3.5" /> Pick
        </button>
      </div>
      {custom && (
        <div className="flex items-center gap-2">
          <input type="date" value={date} data-testid="input-due-date" min={inputFromDay(istDay(Date.now()))}
            onChange={(e) => { setDate(e.target.value); if (e.target.value) onChange(customDueIso(e.target.value, time)); }}
            className="h-11 rounded-xl border border-input bg-paper px-2 text-sm" />
          <input type="time" value={time} data-testid="input-due-time"
            onChange={(e) => { setTime(e.target.value); if (date) onChange(customDueIso(date, e.target.value)); }}
            className="h-11 rounded-xl border border-input bg-paper px-2 text-sm" />
          <span className="text-xs text-muted-foreground">IST</span>
        </div>
      )}
      {value ? <p className="text-xs text-muted-foreground" data-testid="text-due-preview">Due <span className="font-medium text-foreground">{fmtDue(value)}</span> IST</p>
        : <p className="text-xs text-muted-foreground">No date chosen yet. Every ticket needs one.</p>}
    </div>
  );
}

const PRIS = ['low', 'normal', 'high', 'urgent'] as const;
export function PriorityPicker({ value, onChange }: { value: string; onChange: (p: (typeof PRIS)[number]) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-input bg-paper p-1">
      {PRIS.map((p) => (
        <button type="button" key={p} data-testid={`button-priority-${p}`} onClick={() => onChange(p)}
          className={cn('flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium capitalize transition-colors', value === p ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
          <PriorityGlyph p={p} /> {p}
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
