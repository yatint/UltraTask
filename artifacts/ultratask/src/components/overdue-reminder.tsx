import { toast } from 'sonner';
import { BellRing, Loader2 } from 'lucide-react';
import { useSendOverdueReminder, type Ticket } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { errMsg, useInvalidate } from '@/lib/ops';
import { isOverdue } from '@/lib/time';

/** Who may send a manual overdue reminder, and whether it is available right now. */
export function useReminderState(t: Ticket) {
  const { me, isAdmin, ws } = useWs();
  const role = t.createdById === me.id || t.watcherIds.includes(me.id) || isAdmin;
  const show = role && isOverdue(t);
  const hours = ws.settings.nudgeCooldownHours || 4;
  const left = t.lastNudgedAt ? new Date(t.lastNudgedAt).getTime() + hours * 3600000 - Date.now() : 0;
  const cooling = left > 0;
  const reason = t.isDemo ? 'Sample tickets cannot send reminders' : cooling ? `Next reminder in ${Math.ceil(left / 3600000)}h. One reminder or nudge per ${hours}h.` : null;
  return { show, cooling, left, hours, reason, demo: t.isDemo };
}

export function OverdueReminderButton({ t, variant = 'detail', className }: { t: Ticket; variant?: 'detail' | 'row'; className?: string }) {
  const { guard } = useWs();
  const inval = useInvalidate();
  const st = useReminderState(t);
  const send = useSendOverdueReminder({
    mutation: {
      onSuccess: () => { inval(t.id); toast.success(`In-app reminder sent · ${t.code}`, { description: 'Email not connected, so no email went out.' }); },
      onError: (e) => toast.error(errMsg(e)),
    },
  });
  if (!st.show) return null;
  const disabled = send.isPending || st.cooling || st.demo;
  const go = (e: React.MouseEvent) => { e.stopPropagation(); if (!guard('send reminders')) return; send.mutate({ id: t.id }); };
  const label = send.isPending ? 'Sending' : st.cooling ? `Remind in ${Math.ceil(st.left / 3600000)}h` : variant === 'row' ? 'Remind' : 'Send overdue reminder';

  if (variant === 'row') {
    return (
      <button onClick={go} disabled={disabled} title={st.reason ?? 'In-app reminder to the owner. Email not connected.'} data-testid={`button-remind-${t.id}`}
        className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-signal/30 bg-signal/[0.06] px-2.5 text-[12.5px] font-semibold text-signal transition-[transform,background-color] hover:bg-signal/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground sm:min-h-8', className)}>
        {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}{label}
      </button>
    );
  }
  return (
    <div className={cn('flex flex-col', className)}>
      <button onClick={go} disabled={disabled} title={st.reason ?? undefined} data-testid="button-action-overdue-reminder"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[14px] font-semibold text-white shadow-sm transition-transform hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
        {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}{label}
      </button>
    </div>
  );
}

/** One-line honest status under the action bar. */
export function ReminderNote({ t }: { t: Ticket }) {
  const st = useReminderState(t);
  if (!st.show) return null;
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground" data-testid="text-reminder-status">
      <span className="h-1.5 w-1.5 rounded-full dot-overdue" aria-hidden />
      {st.reason ?? 'Overdue. A reminder lands in the owner’s in-app inbox.'}
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-medium text-foreground/70" data-testid="text-email-status">Email: not connected</span>
    </p>
  );
}
