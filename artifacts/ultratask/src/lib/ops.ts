import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getGetTicketQueryKey,
  getGetWorkspaceQueryKey,
  useActOnTicket,
  useAddComment,
  useCreateTicket,
  useDeleteDemo,
  useEditComment,
  useInviteMember,
  useReadNotifications,
  useRequestUploadUrl,
  useSaveTag,
  useUpdateMember,
  useUpdateSettings,
  useUpdateTicket,
  type Attachment,
  type Ticket,
  type TicketActionAction,
  type TicketAction,
} from '@workspace/api-client-react';
import { useWs } from './workspace';
import { fmtDateTime } from './time';
import { celebrate } from './reward';

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object') {
    const d = (e as { data?: unknown }).data;
    if (d && typeof d === 'object') {
      const r = d as Record<string, unknown>;
      for (const k of ['error', 'message', 'detail']) if (typeof r[k] === 'string') return r[k] as string;
    }
    if (typeof d === 'string' && d.trim()) return d;
    if ('message' in e && typeof (e as Error).message === 'string') return (e as Error).message;
  }
  return 'Something went wrong. Try again.';
}
export const errStatus = (e: unknown) => (e && typeof e === 'object' && 'status' in e ? Number((e as { status: number }).status) : 0);

export function useInvalidate() {
  const qc = useQueryClient();
  return (id?: number) => {
    qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
    qc.invalidateQueries({ queryKey: ['/api/snapshot'] });
    if (id) qc.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
  };
}

const onError = (e: unknown) => toast.error(errMsg(e));

export function useOps() {
  const inval = useInvalidate();
  const ok = { onSuccess: (t: Ticket) => inval(t.id), onError };
  return {
    inval,
    act: useActOnTicket({ mutation: ok }),
    update: useUpdateTicket({ mutation: ok }),
    create: useCreateTicket({ mutation: { onSuccess: (t) => inval(t.id) } }),
    comment: useAddComment({ mutation: { onSuccess: (c) => inval(c.ticketId), onError } }),
    editComment: useEditComment({ mutation: { onSuccess: (c) => inval(c.ticketId), onError } }),
    readNotifs: useReadNotifications({ mutation: { onSuccess: () => inval() } }),
    settings: useUpdateSettings({ mutation: { onSuccess: () => inval(), onError } }),
    invite: useInviteMember({ mutation: { onSuccess: () => inval(), onError } }),
    member: useUpdateMember({ mutation: { onSuccess: () => inval(), onError } }),
    tag: useSaveTag({ mutation: { onSuccess: () => inval(), onError } }),
    deleteDemo: useDeleteDemo({ mutation: { onSuccess: () => inval(), onError } }),
    upload: useRequestUploadUrl(),
  };
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] as const;
type Allowed = (typeof ALLOWED)[number];

export function useUploader() {
  const upload = useRequestUploadUrl();
  return async (files: File[]): Promise<Attachment[]> => {
    const out: Attachment[] = [];
    for (const f of files) {
      if (!(ALLOWED as readonly string[]).includes(f.type)) throw new Error(`${f.name}: only images (PNG, JPG, WEBP, GIF) and PDF are allowed.`);
      if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`);
      if (f.size < 1) throw new Error(`${f.name} is empty.`);
      let res;
      try {
        res = await upload.mutateAsync({ data: { name: f.name, size: f.size, contentType: f.type as Allowed } });
      } catch (e) {
        throw new Error(`Could not prepare upload for ${f.name}: ${errMsg(e)}`);
      }
      const put = await fetch(res.uploadURL, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } }).catch(() => null);
      if (!put || !put.ok) throw new Error(`Upload of ${f.name} failed${put ? ` (${put.status})` : ' (network)'}.`);
      out.push({ name: f.name, objectPath: res.objectPath, size: f.size, contentType: f.type });
    }
    return out;
  };
}

const VERB: Partial<Record<TicketActionAction, string>> = {
  accept: 'Accepted', start: 'Started', done: 'Marked done', close: 'Confirmed and closed', reopen: 'Reopened',
  decline: 'Declined', cancel: 'Cancelled', block: 'Marked blocked', unblock: 'Unblocked', nudge: 'Nudge sent',
  request_extension: 'Extension requested', approve_extension: 'Extension approved', decline_extension: 'Extension declined', undo: 'Undone',
};

export function whatsappText(t: Ticket, from?: string, owner?: string) {
  const link = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/tickets/${t.id}`;
  return `${t.code}: ${t.title}\nFrom: ${from ?? 'UltraTask'}\nOwner: ${owner ?? 'Unassigned'}\nDue: ${fmtDateTime(t.dueAt)} IST\nOpen: ${link}`;
}

/** Ticket actions with preview guard, undo, whatsapp and close reward. */
export function useTicketActions() {
  const { act } = useOps();
  const { guard, person, me } = useWs();
  const run = (t: Ticket, data: TicketAction, after?: (nt: Ticket) => void) => {
    if (!guard()) return;
    let win: Window | null = null;
    if (data.action === 'share_whatsapp') win = window.open('', '_blank');
    act.mutate(
      { id: t.id, data },
      {
        onSuccess: (nt) => {
          after?.(nt);
          if (data.action === 'share_whatsapp') {
            const a = person(nt.assigneeId);
            const text = whatsappText(nt, person(nt.createdById)?.name, a?.name);
            const phone = (a?.whatsappPhone ?? '').replace(/\D/g, '');
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
            if (win) win.location.href = url;
            else window.open(url, '_blank');
            toast.success('Logged on the ticket. WhatsApp opened.');
            return;
          }
          if (data.action === 'close') celebrate(me.soundOn);
          const undoable = data.action === 'done' || data.action === 'close';
          toast.success(`${VERB[data.action] ?? 'Updated'} · ${nt.code}`, undoable ? {
            duration: 10000,
            action: { label: 'Undo', onClick: () => act.mutate({ id: nt.id, data: { action: 'undo' } }, { onSuccess: () => toast('Reverted') }) },
          } : undefined);
        },
        onError: () => win?.close(),
      },
    );
  };
  return { run, pending: act.isPending, variables: act.variables };
}
