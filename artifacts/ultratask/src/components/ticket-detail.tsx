import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Ban, BellRing, Check, Clock, FileText, Loader2, Lock, Paperclip, Pencil, Play, RotateCcw, Send, Share2, Unlock, X } from 'lucide-react';
import type { Attachment, Comment, Ticket, TicketActionAction, TicketUpdate } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { assetUrl, useWs } from '@/lib/workspace';
import { errMsg, useOps, useTicketActions, useUploader } from '@/lib/ops';
import { customDueIso, fmtAgo, fmtDateTime, fmtDue, inputFromDay, istDay, isActive } from '@/lib/time';
import { Avatar, Chip, HealthLabel, PriorityGlyph, STATUS_LABEL, StatusIcon, TagPill, TicketFlags } from './atoms';
import { DueField, PersonPicker, PriorityPicker, TagSelect } from './pickers';

type DlgCfg = { action: TicketActionAction; title: string; desc: string; min?: number; date?: boolean; person?: boolean; cta: string; extensionId?: number; danger?: boolean; proof?: boolean };
const EXT_CFG: DlgCfg = { action: 'request_extension', title: 'Ask for more time', desc: 'The asker will approve or decline. Be honest about why.', min: 5, date: true, cta: 'Send request' };

export function TicketDetail({ t }: { t: Ticket }) {
  const { ws, me, isAdmin, person, guard } = useWs();
  const { run, pending, variables } = useTicketActions();
  const [dlg, setDlg] = useState<DlgCfg | null>(null);
  const [editing, setEditing] = useState(false);

  const isAssignee = t.assigneeId === me.id;
  const isCreator = t.createdById === me.id;
  const own = isAssignee || isAdmin;
  const asker = isCreator || isAdmin;
  const self = isAssignee && isCreator;
  const isWatcher = t.watcherIds.includes(me.id);
  const extensions = ws.extensions.filter((e) => e.ticketId === t.id);
  const pendingExt = extensions.find((e) => e.status === 'pending');
  const cooldownMs = ws.settings.nudgeCooldownHours * 3600000;
  const nudgeLeft = t.lastNudgedAt ? new Date(t.lastNudgedAt).getTime() + cooldownMs - Date.now() : 0;

  const busy = (a: TicketActionAction) => pending && variables?.id === t.id && variables.data.action === a;
  type Btn = { a: TicketActionAction; label: string; icon: typeof Check; primary?: boolean; onClick?: () => void; disabled?: boolean; title?: string };
  const btns: Btn[] = [];
  if (t.status === 'open' && self) btns.push({ a: 'start', label: 'Start', icon: Play, primary: true });
  else if (t.status === 'open' && own) {
    btns.push({ a: 'accept', label: 'Accept', icon: Check, primary: true });
    if (isAssignee) btns.push({ a: 'accept', label: 'Accept, but I need more time', icon: Clock, onClick: () => run(t, { action: 'accept' }, () => setDlg(EXT_CFG)) });
    btns.push({ a: 'decline', label: 'Decline', icon: X, onClick: () => setDlg({ action: 'decline', title: 'Decline this ask', desc: 'Say why, so the asker can reassign or rethink it.', min: 5, cta: 'Decline' }) });
  }
  if (t.status === 'accepted' && own) btns.push({ a: 'start', label: 'Start', icon: Play, primary: true });
  if ((t.status === 'accepted' || t.status === 'in_progress') && own) {
    if (self && t.status === 'in_progress') btns.push({ a: 'close', label: 'Close', icon: Check, primary: true });
    else btns.push({ a: 'done', label: 'Mark done', icon: Check, primary: t.status === 'in_progress', onClick: () => setDlg({ action: 'done', title: 'Mark it done', desc: `${person(t.createdById)?.name ?? 'The asker'} will check and close it. Add proof if you have it — optional.`, proof: true, cta: 'Mark done' }) });
  }
  if (self && t.status === 'accepted') btns.push({ a: 'close', label: 'Close', icon: Check });
  if (t.status === 'done' && asker) {
    btns.push({ a: 'close', label: 'Confirm & close', icon: Check, primary: true });
    btns.push({ a: 'reopen', label: 'Not yet — reopen', icon: RotateCcw, onClick: () => setDlg({ action: 'reopen', title: 'Send it back', desc: 'What is still missing?', min: 5, cta: 'Reopen' }) });
  }
  if (t.status === 'closed' && isAdmin) btns.push({ a: 'reopen', label: 'Reopen', icon: RotateCcw, onClick: () => setDlg({ action: 'reopen', title: 'Reopen a closed ticket', desc: 'Admins only. The history keeps both outcomes.', min: 5, cta: 'Reopen' }) });
  if ((t.status === 'accepted' || t.status === 'in_progress') && (own || isCreator)) {
    if (t.isBlocked) btns.push({ a: 'unblock', label: 'Unblock', icon: Unlock });
    else btns.push({ a: 'block', label: 'Blocked', icon: Lock, onClick: () => setDlg({ action: 'block', title: 'What is it waiting on?', desc: 'Name the blocker and, if it is a person, who.', min: 5, person: true, cta: 'Mark blocked' }) });
  }
  if (isActive(t) && isAssignee && !pendingExt) btns.push({ a: 'request_extension', label: 'Ask for more time', icon: Clock, onClick: () => setDlg(EXT_CFG) });
  if (isActive(t) && !isAssignee && (isCreator || isWatcher || isAdmin)) btns.push({ a: 'nudge', label: nudgeLeft > 0 ? `Nudge in ${Math.ceil(nudgeLeft / 3600000)}h` : 'Nudge', icon: BellRing, disabled: nudgeLeft > 0, title: nudgeLeft > 0 ? `One nudge per ${ws.settings.nudgeCooldownHours}h` : 'Send a gentle reminder' });
  if ((isActive(t) || t.status === 'declined') && asker) btns.push({ a: 'cancel', label: 'Cancel ticket', icon: Ban, onClick: () => setDlg({ action: 'cancel', title: 'Cancel this ticket?', desc: 'It stays in history. Give a short reason.', min: 5, cta: 'Cancel ticket', danger: true }) });
  const participant = isAssignee || isCreator || isWatcher || isAdmin;
  const readOnly = !participant;
  if (readOnly) btns.length = 0;
  btns.push({ a: 'share_whatsapp', label: 'WhatsApp', icon: Share2 });

  const creator = person(t.createdById);
  const assignee = person(t.assigneeId);
  const blockedOn = person(t.blockedOnUserId);

  return (
    <div className="mx-auto w-full max-w-[1100px]" data-testid={`ticket-detail-${t.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span className="font-code text-foreground" data-testid="text-ticket-code">{t.code}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1.5"><StatusIcon status={t.status} />{STATUS_LABEL[t.status]}</span>
        <HealthLabel t={t} />
        <TicketFlags t={t} />
      </div>
      <h1 className="mt-3 text-balance text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]" data-testid="text-ticket-title">{t.title}</h1>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="ticket-actions">
        {btns.map((b) => (
          <Button key={b.a + b.label} size="sm" variant={b.primary ? 'default' : 'outline'} disabled={b.disabled || busy(b.a)} title={b.title}
            className={cn('gap-1.5 rounded-full transition-transform active:scale-[0.97]', !b.primary && 'bg-card', b.a === 'share_whatsapp' && 'ml-auto')}
            data-testid={`button-action-${b.a}`}
            onClick={() => (b.onClick ? (guard() && b.onClick()) : run(t, { action: b.a }))}>
            {busy(b.a) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <b.icon className="h-3.5 w-3.5" />}{b.label}
          </Button>
        ))}
        {!readOnly && asker && (isActive(t) || t.status === 'declined') && (
          <Button size="sm" variant="outline" className="gap-1.5 rounded-full bg-card" onClick={() => guard() && setEditing(true)} data-testid="button-edit-ticket"><Pencil className="h-3.5 w-3.5" />Edit</Button>
        )}
      </div>
      {readOnly && <p className="mt-3 text-xs text-muted-foreground" data-testid="text-read-only">You can read this ticket, but only its asker, owner, watchers and admins can act on it.</p>}

      {t.isBlocked && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-violet/25 bg-violet/5 p-3.5 text-sm" data-testid="banner-blocked">
          <Lock className="mt-0.5 h-4 w-4 text-violet" />
          <div><span className="font-medium">Blocked{blockedOn ? ` on ${blockedOn.name}` : ''}.</span> <span className="text-muted-foreground">{t.blockedReason}</span></div>
        </div>
      )}
      {pendingExt && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/5 p-4" data-testid={`extension-${pendingExt.id}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber" />
            <span className="font-medium">{person(pendingExt.requestedById)?.name} asks to move the date</span>
            <span className="text-muted-foreground">{fmtDateTime(pendingExt.currentDueAt)} → <span className="font-medium text-foreground">{fmtDateTime(pendingExt.proposedDueAt)}</span></span>
          </div>
          <p className="mt-1.5 pl-6 text-sm text-muted-foreground">"{pendingExt.reason}"</p>
          {asker && (
            <div className="mt-3 flex gap-2 pl-6">
              <Button size="sm" className="rounded-full" disabled={busy('approve_extension')} onClick={() => run(t, { action: 'approve_extension', extensionId: pendingExt.id })} data-testid="button-approve-extension">Approve new date</Button>
              <Button size="sm" variant="outline" className="rounded-full bg-card" onClick={() => guard() && setDlg({ action: 'decline_extension', title: 'Decline the extension', desc: 'The original date stands. Say why.', min: 5, cta: 'Decline', extensionId: pendingExt.id })} data-testid="button-decline-extension">Decline</Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-8">
          <section>
            <Label>Brief</Label>
            {t.description ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90" data-testid="text-description">{t.description}</p>
              : <p className="text-sm italic text-muted-foreground">No description. The title says it all.</p>}
            {t.attachments.length > 0 && <AttachmentList items={t.attachments} />}
          </section>
          <Timeline t={t} canComment={!readOnly} />
        </div>
        <aside className="space-y-1 self-start rounded-xl border border-border bg-card p-4 lg:sticky lg:top-20">
          <Prop k="Owner"><Avatar p={assignee} size={20} /><span data-testid="text-assignee">{assignee?.name}</span></Prop>
          <Prop k="Asked by"><Avatar p={creator} size={20} />{creator?.name}</Prop>
          <Prop k="Due"><span data-testid="text-due">{fmtDue(t.dueAt)}</span></Prop>
          {t.originalDueAt !== t.dueAt && <Prop k="Originally"><span className="text-muted-foreground line-through">{fmtDateTime(t.originalDueAt)}</span></Prop>}
          <Prop k="Priority"><PriorityGlyph p={t.priority} /><span className="capitalize">{t.priority}</span></Prop>
          <Prop k="Project">{t.projectTagId ? <TagPill id={t.projectTagId} /> : <span className="text-muted-foreground">None</span>}</Prop>
          <Prop k="Watchers">{t.watcherIds.length ? <span className="flex flex-wrap gap-1">{t.watcherIds.map((id) => <Avatar key={id} p={person(id)} size={20} />)}</span> : <span className="text-muted-foreground">None</span>}</Prop>
          <Prop k="Created">{fmtDateTime(t.createdAt)}</Prop>
          {t.doneAt && <Prop k="Done">{fmtDateTime(t.doneAt)}</Prop>}
          {t.closedAt && <Prop k="Closed">{fmtDateTime(t.closedAt)}{t.wasOnTime != null && <Chip>{t.wasOnTime ? 'on time' : 'late'}</Chip>}</Prop>}
          {t.isDemo && <div className="pt-2"><Chip className="stripes border-amber/30 text-amber">Sample ticket</Chip></div>}
        </aside>
      </div>

      <ActionDialog cfg={dlg} t={t} onClose={() => setDlg(null)} />
      {editing && <EditDialog t={t} onClose={() => setEditing(false)} />}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{children}</div>;
const Prop = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[84px_1fr] items-center gap-2 py-1.5 text-[13px]">
    <span className="text-muted-foreground">{k}</span><span className="flex min-w-0 items-center gap-1.5">{children}</span>
  </div>
);

function AttachmentList({ items }: { items: Attachment[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <a key={a.objectPath} href={assetUrl(a.objectPath)} target="_blank" rel="noreferrer" data-testid={`link-attachment-${a.name}`}
          className="group flex items-center gap-2 rounded-lg border border-border bg-paper p-1.5 pr-3 text-xs transition-colors hover:border-primary/40">
          {a.contentType.startsWith('image/') ? <img src={assetUrl(a.objectPath)} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded bg-muted"><FileText className="h-4 w-4" /></span>}
          <span className="max-w-[160px] truncate">{a.name}</span>
          <span className="text-muted-foreground">{(a.size / 1024 < 1024 ? `${Math.round(a.size / 1024)} KB` : `${(a.size / 1048576).toFixed(1)} MB`)}</span>
        </a>
      ))}
    </div>
  );
}

const ACT_TEXT: Record<string, string> = {
  created: 'created this', accept: 'accepted', accepted: 'accepted', start: 'started work', started: 'started work', done: 'marked it done', close: 'confirmed and closed', closed: 'confirmed and closed',
  reopen: 'reopened', reopened: 'reopened', decline: 'declined', declined: 'declined', cancel: 'cancelled', cancelled: 'cancelled', block: 'marked it blocked', blocked: 'marked it blocked',
  unblock: 'unblocked', unblocked: 'unblocked', nudge: 'nudged the owner', nudged: 'nudged the owner', share_whatsapp: 'shared it on WhatsApp', request_extension: 'asked for more time',
  approve_extension: 'approved the new date', decline_extension: 'declined the extension', undo: 'undid the last step', due_changed: 'moved the due date', reassigned: 'reassigned', edited: 'edited the details',
};

function Timeline({ t, canComment }: { t: Ticket; canComment: boolean }) {
  const { ws, person, me } = useWs();
  const [showHist, setShowHist] = useState(false);
  const { items, histCount, commentCount } = useMemo(() => {
    const cs = ws.comments.filter((c) => c.ticketId === t.id).map((c) => ({ kind: 'c' as const, at: c.createdAt, c }));
    const as = ws.activities.filter((a) => a.ticketId === t.id).map((a) => ({ kind: 'a' as const, at: a.createdAt, a }));
    return { items: [...cs, ...(showHist ? as : [])].sort((x, y) => +new Date(x.at) - +new Date(y.at)), histCount: as.length, commentCount: cs.length };
  }, [ws.comments, ws.activities, t.id, showHist]);
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <Label>Conversation · {commentCount}</Label>
        {histCount > 0 && (
          <button onClick={() => setShowHist((v) => !v)} className="-mt-3 ml-auto text-[12px] font-medium text-primary hover:underline" data-testid="button-toggle-history">
            {showHist ? 'Hide history' : `Show history (${histCount})`}
          </button>
        )}
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Updates go here, oldest first, newest at the bottom.</p>}
      <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-border">
        {items.map((it, i) => it.kind === 'a' ? (
          <motion.li key={`a${it.a.id}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="relative flex gap-3 py-1.5 pl-0 text-[13px]" data-testid={`activity-${it.a.id}`}>
            <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-background ring-1 ring-border"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" /></span>
            <div className="min-w-0 flex-1 text-muted-foreground">
              <span className="font-medium text-foreground">{person(it.a.actorId)?.name ?? 'UltraTask'}</span> {ACT_TEXT[it.a.action] ?? it.a.action.replace(/_/g, ' ')}
              {it.a.fromValue && it.a.toValue && <span> · <span className="line-through">{fmtMaybeDate(it.a.fromValue)}</span> → <span className="text-foreground">{fmtMaybeDate(it.a.toValue)}</span></span>}
              {it.a.note && <span className="block text-foreground/80">"{it.a.note}"</span>}
              <span className="ml-1.5 text-[11.5px]" title={fmtDateTime(it.a.createdAt)}>{fmtAgo(it.a.createdAt)}</span>
            </div>
          </motion.li>
        ) : <CommentItem key={`c${it.c.id}`} c={it.c} mine={it.c.authorId === me.id} />)}
      </ol>
      {canComment ? <Composer t={t} /> : <p className="mt-4 text-xs text-muted-foreground">Only the asker, owner, watchers and admins can comment here.</p>}
    </section>
  );
}

const fmtMaybeDate = (v: string) => (/^\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDateTime(v) : v);

function CommentItem({ c, mine }: { c: Comment; mine: boolean }) {
  const { person, guard } = useWs();
  const { editComment } = useOps();
  const [edit, setEdit] = useState(false);
  const [body, setBody] = useState(c.body);
  const editable = mine && Date.now() - new Date(c.createdAt).getTime() < 10 * 60000;
  const p = person(c.authorId);
  return (
    <li className="relative flex gap-3 py-2" data-testid={`comment-${c.id}`}>
      <span className="relative z-10"><Avatar p={p} size={22} ring /></span>
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground">{p?.name}</span>
          <span title={fmtDateTime(c.createdAt)}>{fmtAgo(c.createdAt)}</span>
          {c.editedAt && <span>· edited</span>}
          {editable && !edit && <button className="ml-auto hover:text-foreground" onClick={() => guard() && setEdit(true)} data-testid={`button-edit-comment-${c.id}`}>Edit</button>}
        </div>
        {edit ? (
          <div className="mt-2 space-y-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-paper p-2 text-sm" data-testid={`input-edit-comment-${c.id}`} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!body.trim() || editComment.isPending} onClick={() => editComment.mutate({ id: c.id, data: { body } }, { onSuccess: () => { setEdit(false); toast.success('Comment updated'); } })} data-testid={`button-save-comment-${c.id}`}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEdit(false); setBody(c.body); }}>Cancel</Button>
            </div>
          </div>
        ) : <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{c.body}</p>}
        {c.attachments.length > 0 && <AttachmentList items={c.attachments} />}
      </div>
    </li>
  );
}

function useParticipants(t: Ticket) {
  const { person, me } = useWs();
  return [...new Set([t.createdById, t.assigneeId, ...t.watcherIds])].map((id) => person(id)).filter((p): p is NonNullable<typeof p> => !!p && p.id !== me.id);
}

function Composer({ t }: { t: Ticket }) {
  const ticketId = t.id;
  const { me, guard, isPreview } = useWs();
  const { comment } = useOps();
  const upload = useUploader();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [up, setUp] = useState(false);
  const [mi, setMi] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const parts = useParticipants(t);
  const m = /(?:^|\s)@(\w*)$/.exec(body);
  const sugg = m ? parts.filter((p) => p.name.toLowerCase().includes(m[1].toLowerCase())).slice(0, 6) : [];
  useEffect(() => {
    const h = (e: Event) => { const id = (e as CustomEvent<number>).detail; if (id === ticketId || id == null) { ta.current?.focus(); ta.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    window.addEventListener('ut:compose', h);
    return () => window.removeEventListener('ut:compose', h);
  }, [ticketId]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || tg.closest('input,textarea,select,[contenteditable=true],[role=dialog]')) return;
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); ta.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const insert = (name: string) => { setBody((b) => b.replace(/@(\w*)$/, `@${name.split(' ')[0]} `)); setMi(0); ta.current?.focus(); };
  const send = () => {
    if (!guard() || (!body.trim() && !files.length)) return;
    comment.mutate({ id: ticketId, data: { body: body.trim(), attachments: files } }, { onSuccess: () => { setBody(''); setFiles([]); } });
  };
  return (
    <div className="mt-4 flex gap-3">
      <Avatar p={me} size={28} />
      <div className="relative flex-1 rounded-xl border border-border bg-card shadow-xs focus-within:border-primary/40">
        {sugg.length > 0 && (
          <div className="absolute bottom-full left-2 z-20 mb-1 w-60 overflow-hidden rounded-lg border border-border bg-popover shadow-lg" data-testid="list-mentions">
            <div className="px-3 pt-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">People on this ticket</div>
            {sugg.map((p, i) => (
              <button key={p.id} onMouseDown={(e) => { e.preventDefault(); insert(p.name); }} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === mi && 'bg-accent/60')} data-testid={`mention-${p.id}`}>
                <Avatar p={p} size={18} />{p.name}
              </button>
            ))}
          </div>
        )}
        <textarea ref={ta} value={body} onChange={(e) => { setBody(e.target.value); setMi(0); }} rows={2} placeholder={isPreview ? 'Sign in to comment' : 'Add an update — type @ to mention someone on this ticket'}
          onKeyDown={(e) => {
            if (sugg.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setMi((x) => (x + 1) % sugg.length); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setMi((x) => (x - 1 + sugg.length) % sugg.length); return; }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(sugg[mi].name); return; }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
          }} data-testid="input-comment"
          className="w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-muted-foreground/70" />
        {files.length > 0 && <div className="flex flex-wrap gap-1.5 px-3">{files.map((f, i) => <span key={f.objectPath} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">{f.name}<button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-3 w-3" /></button></span>)}</div>}
        <div className="flex items-center justify-between px-2 pb-2">
          <label className={cn('flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted', isPreview && 'pointer-events-none opacity-50')}>
            {up ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach
            <input type="file" multiple className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" data-testid="input-comment-file"
              onChange={async (e) => { const l = e.target.files; e.target.value = ''; if (!l?.length || !guard()) return; setUp(true); try { const a = await upload(Array.from(l)); setFiles((f) => [...f, ...a]); } catch (er) { toast.error(errMsg(er)); } finally { setUp(false); } }} />
          </label>
          <Button size="sm" className="gap-1.5 rounded-full" onClick={send} disabled={comment.isPending || up} data-testid="button-send-comment">
            {comment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionDialog({ cfg, t, onClose }: { cfg: DlgCfg | null; t: Ticket; onClose: () => void }) {
  const { run, pending } = useTicketActions();
  const { comment } = useOps();
  const upload = useUploader();
  const { guard } = useWs();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [up, setUp] = useState(false);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(inputFromDay(istDay(t.dueAt) + 2));
  const [time, setTime] = useState('18:00');
  const [who, setWho] = useState<number[]>([]);
  const min = cfg?.min ?? 0;
  const ok = reason.trim().length >= min;
  const submit = async () => {
    if (!cfg || !ok) return;
    if (cfg.proof) {
      if (reason.trim() || files.length) {
        try { await comment.mutateAsync({ id: t.id, data: { body: reason.trim() || 'Proof attached', attachments: files } }); }
        catch { return; }
      }
      run(t, { action: 'done' }, () => { setReason(''); setFiles([]); onClose(); });
      return;
    }
    run(t, {
      action: cfg.action, reason: reason.trim(),
      ...(cfg.date ? { proposedDueAt: customDueIso(date, time) } : {}),
      ...(cfg.person ? { blockedOnUserId: who[0] ?? null } : {}),
      ...(cfg.extensionId ? { extensionId: cfg.extensionId } : {}),
    }, () => { setReason(''); onClose(); });
  };
  return (
    <Dialog open={!!cfg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{cfg?.title}</DialogTitle>
          <DialogDescription>{cfg?.desc}</DialogDescription>
        </DialogHeader>
        {cfg?.date && (
          <div className="flex items-center gap-2">
            <input type="date" value={date} min={inputFromDay(istDay(Date.now()))} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-input bg-paper px-2 text-sm" data-testid="input-proposed-date" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-lg border border-input bg-paper px-2 text-sm" data-testid="input-proposed-time" />
            <span className="text-xs text-muted-foreground">IST</span>
          </div>
        )}
        {cfg?.person && <PersonPicker value={who} onChange={setWho} placeholder="Blocked on a person (optional)" testId="picker-blocked-on" />}
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} data-testid="input-reason" placeholder={cfg?.proof ? 'What was done? (optional — posted as a comment)' : 'Reason'}
          className="w-full rounded-lg border border-input bg-paper p-3 text-sm outline-none focus:border-primary/50" />
        {cfg?.proof && (
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
              {up ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach proof
              <input type="file" multiple className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" data-testid="input-proof-file"
                onChange={async (e) => { const l = e.target.files; e.target.value = ''; if (!l?.length || !guard()) return; setUp(true); try { const a = await upload(Array.from(l)); setFiles((f) => [...f, ...a]); } catch (er) { toast.error(errMsg(er)); } finally { setUp(false); } }} />
            </label>
            {files.map((f, i) => <span key={f.objectPath} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">{f.name}<button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-3 w-3" /></button></span>)}
          </div>
        )}
        <p className={cn('text-xs', ok ? 'text-muted-foreground' : 'text-amber')}>{min ? `At least ${min} characters · ${reason.trim().length}` : ''}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant={cfg?.danger ? 'destructive' : 'default'} disabled={!ok || pending || up || comment.isPending} onClick={submit} data-testid="button-confirm-action">
            {(pending || comment.isPending) && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{cfg?.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ t, onClose }: { t: Ticket; onClose: () => void }) {
  const { update } = useOps();
  const [title, setTitle] = useState(t.title);
  const [desc, setDesc] = useState(t.description);
  const [priority, setPriority] = useState<TicketUpdate['priority']>(t.priority);
  const [tag, setTag] = useState<number | null>(t.projectTagId ?? null);
  const [watchers, setWatchers] = useState<number[]>(t.watcherIds);
  const [assignee, setAssignee] = useState<number[]>([t.assigneeId]);
  const [due, setDue] = useState(t.dueAt);
  const [reason, setReason] = useState('');
  const sensitive = due !== t.dueAt || assignee[0] !== t.assigneeId;
  const ok = title.trim() && (!sensitive || reason.trim().length >= 5);
  const save = () => {
    const data: TicketUpdate = { title: title.trim(), description: desc, priority, projectTagId: tag, watcherIds: watchers };
    if (due !== t.dueAt) data.dueAt = due;
    if (assignee[0] !== t.assigneeId) data.assigneeId = assignee[0];
    if (sensitive) data.reason = reason.trim();
    update.mutate({ id: t.id, data }, { onSuccess: () => { toast.success(`${t.code} updated`); onClose(); } });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit {t.code}</DialogTitle>
          <DialogDescription>Changing the owner or due date needs a reason. Everyone sees it in the history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="w-full rounded-lg border border-input bg-paper px-3 py-2 text-base font-medium" data-testid="input-edit-title" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-paper p-3 text-sm" data-testid="input-edit-description" />
          <div className="grid gap-3 sm:grid-cols-2">
            <PersonPicker value={assignee} onChange={setAssignee} testId="picker-edit-assignee" />
            <TagSelect value={tag} onChange={setTag} />
          </div>
          <div className="text-xs text-muted-foreground">Due now: <span className="text-foreground">{fmtDateTime(due)}</span></div>
          <DueField value={due} onChange={setDue} />
          <PriorityPicker value={priority ?? 'normal'} onChange={setPriority} />
          <PersonPicker multiple value={watchers} onChange={setWatchers} placeholder="Watchers" testId="picker-edit-watchers" />
          {sensitive && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why the change? (5+ characters)" data-testid="input-edit-reason"
                className="w-full rounded-lg border border-amber/40 bg-amber/5 p-3 text-sm" />
            </motion.div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!ok || update.isPending} onClick={save} data-testid="button-save-ticket">{update.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4">
      <div className="h-4 w-48 animate-pulse rounded bg-foreground/[0.06]" />
      <div className="h-9 w-3/4 animate-pulse rounded bg-foreground/[0.06]" />
      <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-foreground/[0.06]" />)}</div>
      <div className="h-40 animate-pulse rounded-xl bg-foreground/[0.04]" />
    </div>
  );
}

