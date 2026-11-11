import type { Person, Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { assetUrl, useWs } from '@/lib/workspace';
import { fmtDateTime, health, type HealthKey } from '@/lib/time';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Actual Ultramotiv mark, cropped from the source logo pixels (square, contain). */
export function HexMark({ className }: { className?: string }) {
  return <img src={`${BASE}/ultratask-mark.png`} alt="" aria-hidden className={cn('object-contain', className)} />;
}

/**
 * UltraTask product name + real Ultramotiv endorsement.
 * stack: full original lockup (658x186) at >=200px wide so the white letters are ~11px tall.
 * inline: original wordmark pixels only (cropped, 13:1), letters 12px tall. Always on a dark surface.
 */
export function Brand({ variant = 'stack', className }: { variant?: 'stack' | 'inline'; className?: string }) {
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-2.5 rounded-xl bg-sidebar px-3 py-2 leading-none', className)} data-testid="brand">
        <span className="brand-word text-[17px] text-sidebar-accent-foreground">Ultra<span className="text-sidebar-primary">Task</span></span>
        <span className="text-[12px] font-medium text-sidebar-foreground/80">by</span>
        <img src={`${BASE}/ultramotiv-wordmark.png`} alt="Ultramotiv" width={156} height={12} style={{ height: 12, width: 'auto' }} className="object-contain" />
      </span>
    );
  }
  return (
    <span className={cn('inline-flex flex-col gap-2 leading-none', className)} data-testid="brand">
      <span className="brand-word text-[28px] text-sidebar-accent-foreground">Ultra<span className="text-sidebar-primary">Task</span></span>
      <span className="inline-flex items-center gap-2.5">
        <span className="text-[12px] font-medium text-sidebar-foreground/80">by</span>
        <img src={`${BASE}/ultramotiv-logo.png`} alt="Ultramotiv" width={180} height={51} style={{ width: 180, height: 'auto' }} className="object-contain" />
      </span>
    </span>
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
  overdue: 'text-signal', today: 'text-amber', soon: 'text-amber', on_track: 'text-ok', blocked: 'text-violet', awaiting: 'text-check', closed: 'text-muted-foreground', ended: 'text-muted-foreground',
};
export const HEALTH_BORDER: Record<HealthKey, string> = {
  overdue: 'bg-signal', today: 'bg-amber', soon: 'bg-amber/60', on_track: 'bg-ok', blocked: 'bg-violet', awaiting: 'bg-check', closed: 'bg-muted-foreground/30', ended: 'bg-muted-foreground/20',
};
export function HealthLabel({ t, compact }: { t: Ticket; compact?: boolean }) {
  const h = health(t);
  return (
    <span data-testid={`health-${t.id}`} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold', HEALTH_STYLE[h.key])}>
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', HEALTH_BORDER[h.key])} />
      {compact ? h.label.replace('On track · ', '') : h.label}
    </span>
  );
}

export function Chip({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-medium text-foreground/70', className)}>{children}</span>;
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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-foreground/75">
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
