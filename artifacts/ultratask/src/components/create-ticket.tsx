import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CornerDownLeft, Paperclip, X, Loader2, Plus, Info } from 'lucide-react';
import type { Attachment, TicketInput } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWs } from '@/lib/workspace';
import { errMsg, errStatus, useOps, useTicketActions, useUploader } from '@/lib/ops';
import { isFutureIso } from '@/lib/due-input';
import { DueField, PersonPicker, PriorityPicker, TagSelect } from './pickers';

export const openNewTicket = () => window.dispatchEvent(new CustomEvent('ut:new'));

function useCreate() {
  const { create, act } = useOps();
  const { openTicket } = useWs();
  const { run } = useTicketActions();
  const [dup, setDup] = useState<{ msg: string; data: TicketInput; done: () => void } | null>(null);
  const submit = (data: TicketInput, done: () => void) => {
    create.mutate({ data }, {
      onSuccess: (t) => {
        done();
        toast.custom((tid) => (
          <div className="flex w-[min(92vw,420px)] flex-col gap-2 rounded-xl bg-foreground p-3.5 text-background shadow-lg" data-testid="toast-created">
            <div className="text-sm font-medium">{t.code} created</div>
            <div className="truncate text-xs text-background/70">{t.title}</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button className="min-h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground" data-testid="button-toast-share"
                onClick={() => { toast.dismiss(tid); run(t, { action: 'share_whatsapp' }); }}>Share on WhatsApp</button>
              <button className="min-h-9 rounded-lg bg-background/15 px-3 text-[13px]" data-testid="button-toast-open" onClick={() => { toast.dismiss(tid); openTicket(t.id); }}>Open</button>
              <button className="ml-auto min-h-9 rounded-lg bg-background/15 px-3 text-[13px]" data-testid="button-toast-undo"
                onClick={() => { toast.dismiss(tid); act.mutate({ id: t.id, data: { action: 'undo' } }, { onSuccess: () => toast('Creation undone. Ticket cancelled.') }); }}>Undo</button>
            </div>
          </div>
        ), { duration: 10000 });
      },
      onError: (e) => {
        if (errStatus(e) === 409) setDup({ msg: errMsg(e), data, done });
        else toast.error(errMsg(e));
      },
    });
  };
  const dialog = (
    <AlertDialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This looks like one that already exists</AlertDialogTitle>
          <AlertDialogDescription data-testid="text-duplicate">{dup?.msg}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-duplicate-cancel">Go back</AlertDialogCancel>
          <AlertDialogAction data-testid="button-duplicate-confirm" onClick={() => { if (dup) submit({ ...dup.data, allowDuplicate: true }, dup.done); setDup(null); }}>Create anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { submit, pending: create.isPending, dialog };
}

export function CreateTicketDialog() {
  const { guard } = useWs();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState<number[]>([]);
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TicketInput['priority']>('normal');
  const [tag, setTag] = useState<number | null>(null);
  const [watchers, setWatchers] = useState<number[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [another, setAnother] = useState(false);
  const [tried, setTried] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const uploadFiles = useUploader();
  const { submit, pending, dialog } = useCreate();

  useEffect(() => {
    const h = () => { if (guard('create tickets')) setOpen(true); };
    window.addEventListener('ut:new', h);
    return () => window.removeEventListener('ut:new', h);
  }, [guard]);

  const reset = (keepPeople: boolean) => {
    setTitle(''); setDesc(''); setFiles([]); setTried(false); setDue(''); setPriority('normal');
    if (!keepPeople) { setAssignee([]); setTag(null); setWatchers([]); }
  };

  const go = () => {
    if (pending || uploading) return;
    setTried(true);
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    if (!assignee[0] || !isFutureIso(due)) return;
    submit({ title: title.trim(), description: desc, assigneeId: assignee[0], dueAt: due, priority, projectTagId: tag, watcherIds: watchers, attachments: files }, () => {
      if (another) { reset(true); setTimeout(() => titleRef.current?.focus(), 30); }
      else { reset(false); setOpen(false); }
    });
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try { const a = await uploadFiles(Array.from(list)); setFiles((f) => [...f, ...a]); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setUploading(false); }
  };

  const missing = !tried ? '' : !title.trim() ? 'Add a title.' : !assignee[0] ? 'Choose an owner.' : !isFutureIso(due) ? 'Choose a valid future deadline.' : '';

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(92dvh,100%)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); go(); } }}>
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pt-5 text-left sm:px-6">
            <DialogTitle className="font-display text-2xl">New task</DialogTitle>
            <DialogDescription>One owner. One date. You confirm when it's done.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="space-y-2">
              <label htmlFor="new-task-title" className="block text-sm font-semibold text-foreground">Task title <span className="text-signal" aria-hidden="true">*</span></label>
              <input id="new-task-title" ref={titleRef} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} data-testid="input-title" aria-required="true" aria-invalid={tried && !title.trim()} aria-describedby="new-task-title-hint"
                placeholder="e.g. Kneesy Health Meeting" className={`h-12 w-full rounded-lg border bg-paper px-3 text-base font-medium outline-none transition-shadow placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 ${tried && !title.trim() ? 'border-signal' : 'border-input'}`} />
              <p id="new-task-title-hint" className="text-xs text-muted-foreground">A short name for the task. Add any extra details below.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="new-task-description" className="block text-sm font-semibold text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea id="new-task-description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} data-testid="input-description" placeholder="Add context, links, or what needs to be done"
                className="w-full resize-none rounded-lg border border-input bg-paper p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" req><PersonPicker value={assignee} onChange={setAssignee} testId="picker-assignee" /></Field>
              <Field label="Project"><TagSelect value={tag} onChange={setTag} /></Field>
            </div>
            <Field label="Due" req><DueField value={due} onChange={setDue} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priority"><PriorityPicker value={priority ?? 'normal'} onChange={setPriority} /></Field>
              <Field label="Watchers"><PersonPicker multiple value={watchers} onChange={setWatchers} placeholder="Keep others in the loop" testId="picker-watchers" /></Field>
            </div>
            <div className="space-y-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-primary/30 hover:border-foreground/30 hover:text-foreground">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {uploading ? 'Uploading' : 'Attach image or PDF (10 MB)'}
                <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="sr-only" data-testid="input-attachments" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
              </label>
              {files.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {files.map((f, i) => (
                    <li key={f.objectPath} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted py-1 pl-3 pr-1 text-sm" data-testid={`attachment-${i}`}>
                      <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
                      <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} data-testid={`button-remove-attachment-${i}`}><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex items-center">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox checked={another} onCheckedChange={(v) => setAnother(!!v)} data-testid="checkbox-create-another" aria-describedby="create-another-help" /> Create another
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="What does Create another do?" data-testid="button-create-another-info" className="ml-0.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <Info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" collisionPadding={16} className="w-[min(18rem,calc(100vw-2rem))] text-sm leading-relaxed" data-testid="popover-create-another">
                  <p id="create-another-help" className="font-semibold text-foreground">Create another</p>
                  <p className="mt-1 text-muted-foreground">After this task is created, the form stays open for the next one.</p>
                  <p className="mt-2"><span className="font-medium">Keeps:</span> owner, project and watchers.</p>
                  <p className="mt-1"><span className="font-medium">Clears:</span> title, description, deadline, priority and attachments.</p>
                  <p className="mt-2 text-muted-foreground">It does not copy the task you just made, and it does not mark anything complete.</p>
                </PopoverContent>
              </Popover>
            </div>
            {missing && <span role="alert" className="text-xs text-signal" data-testid="text-form-error">{missing}</span>}
            <Button className="ml-auto min-h-11 gap-2" onClick={go} disabled={pending || uploading} data-testid="button-create-ticket">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Create ticket
              <span className="hidden font-code text-[10px] opacity-70 sm:inline">Ctrl ↵</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}{req && <span className="ml-1 text-signal">*</span>}</div>
      {children}
    </div>
  );
}

export function QuickAdd({ defaultMe }: { defaultMe?: boolean }) {
  const { guard, me } = useWs();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<number[]>(defaultMe ? [me.id] : []);
  const [due, setDue] = useState('');
  const [focused, setFocused] = useState(false);
  const { submit, pending, dialog } = useCreate();
  const expanded = focused || !!title;
  const ready = !!title.trim() && !!assignee[0] && isFutureIso(due);
  const go = () => {
    if (!guard('create tickets') || !ready) { if (due && !isFutureIso(due)) toast.error('Choose a valid future deadline.'); return; }
    submit({ title: title.trim(), assigneeId: assignee[0], dueAt: due, priority: 'normal' }, () => { setTitle(''); setDue(''); });
  };
  return (
    <div className="rounded-2xl bg-card shadow-sm ring-1 ring-border transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/50" data-testid="quick-add">
      <div className="flex items-center gap-2 px-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="h-4 w-4" /></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setFocused(true)} onKeyDown={(e) => e.key === 'Enter' && go()}
          maxLength={120} placeholder="Add a task, then pick owner and deadline" data-testid="input-quick-title"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
        <button type="button" onClick={openNewTicket} className="hidden min-h-9 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:block" data-testid="button-full-form">Full form</button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-start">
              <div className="w-full sm:w-52"><PersonPicker value={assignee} onChange={setAssignee} testId="picker-quick-assignee" compact /></div>
              <div className="flex-1"><DueField value={due} onChange={setDue} /></div>
              <Button onClick={go} disabled={!ready || pending} className="h-11 gap-1.5 self-end rounded-xl px-5 font-semibold sm:self-start" data-testid="button-quick-create">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />} Add
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {dialog}
    </div>
  );
}
