import type { Person, Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { assetUrl, useWs } from '@/lib/workspace';
import { fmtDateTime, health, type HealthKey } from '@/lib/time';

export function HexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="hx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2FB3BE" />
          <stop offset="1" stopColor="#13707A" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="url(#hx)" />
      <path d="M19 21h18l-10 14h12" fill="none" stroke="#F4F1EA" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M41 21v13a8 8 0 0 1-8 8h-6" fill="none" stroke="#F4F1EA" strokeWidth="5" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

export function Avatar({ p, size = 24, ring }: { p?: Person; size?: number; ring?: boolean }) {
  const initials = (p?.name ?? '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      title={p?.name}
      data-testid={p ? `avatar-${p.id}` : undefined}
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white select-none', ring && 'ring-2 ring-card')}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38), background: p?.colour || 'hsl(193 15% 50%)' }}
    >
      {p?.avatarUrl ? <img src={assetUrl(p.avatarUrl)} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

export function AvatarStack({ ids, max = 3 }: { ids: number[]; max?: number }) {
  const { person } = useWs();
  return (
    <span className="flex -space-x-1.5">
      {ids.slice(0, max).map((id) => <Avatar key={id} p={person(id)} size={20} ring />)}
      {ids.length > max && <span className="ml-2 text-[11px] text-muted-foreground">+{ids.length - max}</span>}
    </span>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open', accepted: 'Accepted', in_progress: 'In progress', done: 'Done', closed: 'Closed', declined: 'Declined', cancelled: 'Cancelled',
};

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const c = 'hsl(var(--primary))';
  const m = 'hsl(var(--muted-foreground))';
  return (
    <svg viewBox="0 0 16 16" className={cn('h-3.5 w-3.5 shrink-0', className)} aria-label={STATUS_LABEL[status]}>
      {status === 'open' && <circle cx="8" cy="8" r="6" fill="none" stroke={m} strokeWidth="1.6" strokeDasharray="2.4 2.2" />}
      {status === 'accepted' && <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.6" />}
      {status === 'in_progress' && (<><circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.6" /><path d="M8 4a4 4 0 0 1 0 8Z" fill={c} /></>)}
      {status === 'done' && (<><circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.6" /><path d="m5.3 8.2 1.8 1.8 3.6-3.8" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></>)}
      {status === 'closed' && (<><circle cx="8" cy="8" r="7" fill={c} /><path d="m5 8.2 2 2 4-4.2" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.7" strokeLinecap="round" /></>)}
      {status === 'declined' && (<><circle cx="8" cy="8" r="6" fill="none" stroke={m} strokeWidth="1.6" /><path d="m6 6 4 4m0-4-4 4" stroke={m} strokeWidth="1.5" strokeLinecap="round" /></>)}
      {status === 'cancelled' && (<><circle cx="8" cy="8" r="6" fill="none" stroke={m} strokeWidth="1.6" /><path d="M4.5 11.5 11.5 4.5" stroke={m} strokeWidth="1.5" /></>)}
    </svg>
  );
}

export function PriorityGlyph({ p, className }: { p: string; className?: string }) {
  if (p === 'urgent')
    return (
      <span title="Urgent" className={cn('inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-signal text-[9px] font-bold text-white', className)}>!</span>
    );
  const n = p === 'high' ? 3 : p === 'normal' ? 2 : 1;
  return (
    <svg viewBox="0 0 14 14" className={cn('h-3.5 w-3.5', className)} aria-label={`${p} priority`}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1 + i * 4.5} y={9 - i * 3.5} width="3" height={4 + i * 3.5} rx="0.8" fill={i < n ? 'hsl(var(--foreground) / 0.75)' : 'hsl(var(--foreground) / 0.15)'} />
      ))}
    </svg>
  );
}

const HEALTH_STYLE: Record<HealthKey, string> = {
  overdue: 'text-signal bg-signal/8 ring-signal/25',
  today: 'text-amber bg-amber/10 ring-amber/25',
  soon: 'text-amber bg-transparent ring-amber/25',
  on_track: 'text-ok bg-ok/5 ring-ok/25',
  blocked: 'text-violet bg-violet/8 ring-violet/25',
  awaiting: 'text-check bg-check/8 ring-check/25',
  closed: 'text-muted-foreground bg-muted ring-transparent',
  ended: 'text-muted-foreground bg-muted ring-transparent',
};
export const HEALTH_BORDER: Record<HealthKey, string> = {
  overdue: 'bg-signal', today: 'bg-amber', soon: 'bg-amber/60', on_track: 'bg-ok', blocked: 'bg-violet', awaiting: 'bg-check', closed: 'bg-muted-foreground/30', ended: 'bg-muted-foreground/20',
};
const HEALTH_GLYPH: Record<HealthKey, string> = { overdue: '▲', today: '◆', soon: '◇', on_track: '○', blocked: '■', awaiting: '◐', closed: '●', ended: '–' };

export function HealthLabel({ t, compact }: { t: Ticket; compact?: boolean }) {
  const h = health(t);
  return (
    <span data-testid={`health-${t.id}`} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', HEALTH_STYLE[h.key])}>
      <span aria-hidden className="text-[8px]">{HEALTH_GLYPH[h.key]}</span>
      {compact ? h.label.replace('On track · ', '') : h.label}
    </span>
  );
}

export function Chip({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-paper px-1.5 py-px text-[10.5px] font-medium text-muted-foreground', className)}>{children}</span>;
}

export function TicketFlags({ t }: { t: Ticket }) {
  return (
    <>
            {t.rescheduleCount > 0 && <Chip title={`Originally due ${fmtDateTime(t.originalDueAt)} IST`}>Rescheduled {t.rescheduleCount}×</Chip>}
      {t.nudgeCount > 0 && <Chip title="Nudges received">Nudged {t.nudgeCount}×</Chip>}
      {t.reopenCount > 0 && <Chip title="Reopened">Reopened {t.reopenCount}×</Chip>}
    </>
  );
}

export function TagPill({ id }: { id?: number | null }) {
  const { tags } = useWs();
  const tag = id ? tags.get(id) : undefined;
  if (!tag) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">
      <span className="h-2 w-2 rotate-45 rounded-[2px]" style={{ background: tag.colour }} />
      {tag.name}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-paper px-1 font-code text-[10px] text-muted-foreground">{children}</kbd>;
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-foreground/[0.06]', className)} />;
}
