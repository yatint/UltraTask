import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader2, Mail, Plus, Smartphone, Apple, Trash2, Upload } from 'lucide-react';
import type { Person, Tag } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useWs } from '@/lib/workspace';
import { errMsg, useOps, useUploader } from '@/lib/ops';
import { fmtAgo, isActive } from '@/lib/time';
import { PageHeader } from '@/components/shell';
import { Avatar, Chip } from '@/components/atoms';
import { PersonPicker } from '@/components/pickers';

type Tab = 'profile' | 'team' | 'projects' | 'workspace' | 'app' | 'data';

export default function Settings() {
  const { isAdmin } = useWs();
  const tabs: [Tab, string][] = [['profile', 'Profile'], ['team', 'Team & invites'], ['projects', 'Project tags'], ['workspace', 'Workspace'], ['app', 'Install app'], ...(isAdmin ? [['data', 'Sample data'] as [Tab, string]] : [])];
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader title="Settings" sub="Your profile, the team, and how the workspace keeps time." />
      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        <nav className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} data-testid={`tab-settings-${k}`} className={cn('relative whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors', tab === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {tab === k && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-lg bg-card shadow-xs ring-1 ring-border" />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </nav>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'profile' && <Profile />}
          {tab === 'team' && <TeamSettings />}
          {tab === 'projects' && <Projects />}
          {tab === 'workspace' && <><WorkspaceSettings /><Reminders /></>}
          {tab === 'app' && <InstallApp />}
          {tab === 'data' && <DemoData />}
        </motion.div>
      </div>
    </div>
  );
}

const Card = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-xs md:p-6">
    <h2 className="text-[15px] font-semibold">{title}</h2>
    {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
    <div className="mt-5">{children}</div>
  </section>
);
const Row = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="grid gap-1.5 py-2 sm:grid-cols-[170px_1fr] sm:items-center">
    <span className="text-sm text-muted-foreground">{label}{hint && <span className="block text-[11px]">{hint}</span>}</span>
    {children}
  </label>
);
const inputCls = 'h-9 w-full rounded-lg border border-input bg-paper px-3 text-sm outline-none focus:border-primary/50';

function Profile() {
  const { me, guard } = useWs();
  const { member } = useOps();
  const upload = useUploader();
  const [name, setName] = useState(me.name);
  const [designation, setDesignation] = useState(me.designation);
  const [phone, setPhone] = useState(me.whatsappPhone ?? '');
  const [up, setUp] = useState(false);
  const patch = (data: Parameters<typeof member.mutate>[0]['data'], msg = 'Saved') => guard() && member.mutate({ id: me.id, data }, { onSuccess: () => toast.success(msg) });
  return (
    <>
      <Card title="You" desc="How teammates see you on tickets.">
        <div className="mb-4 flex items-center gap-4">
          <Avatar p={me} size={56} />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-foreground/30">
            {up ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Change photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="input-avatar"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f || !guard()) return; setUp(true); try { const [a] = await upload([f]); patch({ avatarUrl: a.objectPath }, 'Photo updated'); } catch (er) { toast.error(errMsg(er)); } finally { setUp(false); } }} />
          </label>
        </div>
        <Row label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" /></Row>
        <Row label="Designation"><input className={inputCls} value={designation} onChange={(e) => setDesignation(e.target.value)} data-testid="input-profile-designation" /></Row>
        <Row label="WhatsApp number" hint="With country code"><input className={inputCls} value={phone} placeholder="+91 98xxx xxxxx" onChange={(e) => setPhone(e.target.value)} data-testid="input-profile-phone" /></Row>
        <Row label="Email"><span className="text-sm">{me.email || <span className="text-muted-foreground">Not set</span>}</span></Row>
        <div className="mt-4 flex justify-end"><Button disabled={member.isPending || !name.trim()} onClick={() => patch({ name: name.trim(), designation, whatsappPhone: phone })} data-testid="button-save-profile">{member.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save profile</Button></div>
      </Card>
      <Card title="Signals" desc="Quiet by default.">
        <Toggle label="Sound on close" hint="A small chime when you confirm a ticket" on={me.soundOn} set={(v) => patch({ soundOn: v })} id="sound" />
        <Toggle label="Daily email digest" hint="Arrives once Phase 2 reminders are live" on={me.notifyEmailDigest} set={(v) => patch({ notifyEmailDigest: v })} id="digest" />
        <Toggle label="Push notifications" hint="Preference saved now; delivery comes in Phase 2" on={me.notifyPush} set={(v) => patch({ notifyPush: v })} id="push" />
        <div className="mt-3 border-t border-border pt-3">
          <button className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => { localStorage.removeItem(`ut:tour:${me.id}`); window.dispatchEvent(new CustomEvent('ut:tour')); }} data-testid="button-replay-tour">Replay the welcome tour</button>
        </div>
      </Card>
    </>
  );
}

function Toggle({ label, hint, on, set, id }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div><div className="text-sm">{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
      <Switch checked={on} onCheckedChange={set} data-testid={`switch-${id}`} />
    </div>
  );
}

function TeamSettings() {
  const { ws, isAdmin, me, guard } = useWs();
  const { member } = useOps();
  const [invite, setInvite] = useState<Partial<Person> | null>(null);
  const [deact, setDeact] = useState<Person | null>(null);
  const users = [...ws.users].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  return (
    <Card title="Team" desc={isAdmin ? 'Invitations are emailed and expire after seven days. Only invited emails can sign in.' : 'Everyone on the workspace.'}>
      {isAdmin && <div className="mb-4 flex justify-end"><Button className="gap-1.5 rounded-full" onClick={() => guard() && setInvite({})} data-testid="button-invite"><Plus className="h-4 w-4" />Invite teammate</Button></div>}
      <div className="divide-y divide-border">
        {users.map((u) => {
          const expired = u.invitedAt && Date.now() - new Date(u.invitedAt).getTime() > 7 * 86400000;
          return (
            <div key={u.id} className={cn('flex flex-wrap items-center gap-3 py-3', !u.isActive && 'opacity-55')} data-testid={`row-member-${u.id}`}>
              <Avatar p={u} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">{u.name}{u.id === me.id && <Chip>You</Chip>}{!u.isActive && <Chip>Inactive</Chip>}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.designation}{u.email ? ` · ${u.email}` : ' · no email yet'}
                  {u.invitedAt && <> · {expired ? <span className="text-signal">invite expired</span> : `invited ${fmtAgo(u.invitedAt)}`}</>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {(!u.email || expired) && <Button size="sm" variant="outline" className="gap-1 rounded-full bg-card" onClick={() => guard() && setInvite({ ...u })} data-testid={`button-invite-existing-${u.id}`}><Mail className="h-3.5 w-3.5" />{u.email ? 'Resend' : 'Add email & invite'}</Button>}
                  <select value={u.role} disabled={u.id === me.id} onChange={(e) => guard() && member.mutate({ id: u.id, data: { role: e.target.value as 'admin' | 'member' } }, { onSuccess: () => toast.success(`${u.name} is now ${e.target.value}`) })}
                    className="h-8 rounded-md border border-input bg-paper px-2 text-xs" data-testid={`select-role-${u.id}`}>
                    <option value="member">Member</option><option value="admin">Admin</option>
                  </select>
                  {u.id !== me.id && <Switch checked={u.isActive} data-testid={`switch-active-${u.id}`} onCheckedChange={(v) => { if (!guard()) return; if (v) member.mutate({ id: u.id, data: { isActive: true } }, { onSuccess: () => toast.success(`${u.name} reactivated`) }); else setDeact(u); }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {invite && <InviteDialog seed={invite} onClose={() => setInvite(null)} />}
      {deact && <DeactivateDialog p={deact} onClose={() => setDeact(null)} />}
    </Card>
  );
}

function InviteDialog({ seed, onClose }: { seed: Partial<Person>; onClose: () => void }) {
  const { invite } = useOps();
  const [name, setName] = useState(seed.name ?? '');
  const [email, setEmail] = useState(seed.email ?? '');
  const [designation, setDesignation] = useState(seed.designation ?? '');
  const [role, setRole] = useState<'admin' | 'member'>(seed.role ?? 'member');
  const ok = name.trim() && /^\S+@\S+\.\S+$/.test(email);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{seed.id ? `Invite ${seed.name}` : 'Invite a teammate'}</DialogTitle>
          <DialogDescription>They'll get an email with a link valid for seven days.{seed.id ? ' Their existing tickets stay attached to them.' : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-invite-name" />
          <input className={inputCls} type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-invite-email" />
          <input className={inputCls} placeholder="Designation (e.g. Firmware engineer)" value={designation} onChange={(e) => setDesignation(e.target.value)} data-testid="input-invite-designation" />
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} data-testid="select-invite-role"><option value="member">Member</option><option value="admin">Admin</option></select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!ok || invite.isPending} data-testid="button-send-invite"
            onClick={() => invite.mutate({ data: { name: name.trim(), email: email.trim(), designation, role, ...(seed.id ? { existingId: seed.id } : {}) } }, { onSuccess: () => { toast.success(`Invite emailed to ${email.trim()}`); onClose(); } })}>
            {invite.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({ p, onClose }: { p: Person; onClose: () => void }) {
  const { ws } = useWs();
  const { member } = useOps();
  const [to, setTo] = useState<number[]>([]);
  const open = ws.tickets.filter((t) => t.assigneeId === p.id && (isActive(t) || t.status === 'done')).length;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Deactivate {p.name}</DialogTitle>
          <DialogDescription>{open ? `${open} open ticket${open > 1 ? 's' : ''} need a new owner first. Nothing gets orphaned.` : 'They have no open tickets. Pick who would inherit any that appear.'}</DialogDescription>
        </DialogHeader>
        <PersonPicker value={to} onChange={(v) => setTo(v.filter((x) => x !== p.id))} placeholder="Reassign their work to" testId="picker-reassign" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!to[0] || to[0] === p.id || member.isPending} data-testid="button-confirm-deactivate"
            onClick={() => member.mutate({ id: p.id, data: { isActive: false, reassignToId: to[0] } }, { onSuccess: () => { toast.success(`${p.name} deactivated`); onClose(); } })}>
            {member.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Reassign & deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SWATCHES = ['#1C8A96', '#D9572B', '#C98A12', '#3E5C76', '#7A5C9E', '#4B8B5E', '#B4466A', '#5E6B73'];

function Projects() {
  const { ws, guard, isAdmin } = useWs();
  const { tag } = useOps();
  const [name, setName] = useState('');
  const [colour, setColour] = useState(SWATCHES[0]);
  const save = (t: Partial<Tag> & { name: string; colour: string }, msg: string) => guard() && tag.mutate({ data: t }, { onSuccess: () => toast.success(msg) });
  return (
    <Card title="Project tags" desc="One tag per ticket, so filters and the team board stay honest.">
      {isAdmin && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <input className={cn(inputCls, 'max-w-xs')} placeholder="e.g. Gait Trainer v3" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="input-tag-name" />
          <div className="flex gap-1">{SWATCHES.map((c) => <button key={c} onClick={() => setColour(c)} aria-label={c} className={cn('h-6 w-6 rotate-45 rounded-[5px] transition-transform', colour === c && 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card')} style={{ background: c }} />)}</div>
          <Button size="sm" className="rounded-full" disabled={!name.trim() || tag.isPending} onClick={() => { save({ name: name.trim(), colour, isActive: true }, 'Tag added'); setName(''); }} data-testid="button-add-tag">Add tag</Button>
        </div>
      )}
      <div className="divide-y divide-border">
        {ws.tags.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tags yet.</p>}
        {ws.tags.map((t) => <TagRow key={t.id} t={t} editable={isAdmin} save={save} />)}
      </div>
    </Card>
  );
}

function TagRow({ t, editable, save }: { t: Tag; editable: boolean; save: (t: Partial<Tag> & { name: string; colour: string }, m: string) => void }) {
  const [name, setName] = useState(t.name);
  const count = useWs().ws.tickets.filter((x) => x.projectTagId === t.id).length;
  return (
    <div className={cn('flex items-center gap-3 py-2.5', !t.isActive && 'opacity-55')} data-testid={`row-tag-${t.id}`}>
      <span className="h-3 w-3 rotate-45 rounded-[3px]" style={{ background: t.colour }} />
      {editable ? <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== t.name && save({ id: t.id, name: name.trim(), colour: t.colour, isActive: t.isActive }, 'Tag renamed')}
        className="h-8 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-input focus:border-input focus:bg-paper" data-testid={`input-tag-${t.id}`} /> : <span className="flex-1 text-sm">{t.name}</span>}
      <span className="font-code text-xs text-muted-foreground">{count}</span>
      {!t.isActive && <Chip>Archived</Chip>}
      {editable && <Button size="sm" variant="ghost" onClick={() => save({ id: t.id, name: t.name, colour: t.colour, isActive: !t.isActive }, t.isActive ? 'Tag archived' : 'Tag restored')} data-testid={`button-archive-tag-${t.id}`}>{t.isActive ? 'Archive' : 'Restore'}</Button>}
    </div>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WorkspaceSettings() {
  const { ws, isAdmin, guard } = useWs();
  const { settings } = useOps();
  const s = ws.settings;
  const [company, setCompany] = useState(s.companyName);
  const [prefix, setPrefix] = useState(s.ticketPrefix);
  const [days, setDays] = useState<number[]>(s.workingDays);
  const [all, setAll] = useState(s.membersSeeAllTickets);
  const prefixOk = /^[A-Z]{1,6}$/.test(prefix);
  return (
    <Card title="Workspace" desc={isAdmin ? 'Applies to everyone. Due-date shortcuts skip non-working days.' : 'Only admins can change these.'}>
      <fieldset disabled={!isAdmin} className="space-y-1">
        <Row label="Company name"><input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} data-testid="input-company" /></Row>
        <Row label="Ticket prefix" hint="1–6 capital letters"><input className={cn(inputCls, 'max-w-[140px] font-code uppercase', !prefixOk && 'border-signal')} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} data-testid="input-prefix" /></Row>
        <Row label="Working days">
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button type="button" key={d} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())} data-testid={`toggle-day-${i}`}
                className={cn('h-9 w-11 rounded-lg border text-xs font-medium transition-all active:scale-95', days.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-paper text-muted-foreground')}>{d}</button>
            ))}
          </div>
        </Row>
        <div className="flex items-center justify-between gap-4 py-3">
          <div><div className="text-sm">Members see all tickets</div><div className="text-xs text-muted-foreground">Off: members see tickets they own, asked, or watch.</div></div>
          <Switch checked={all} onCheckedChange={setAll} data-testid="switch-see-all" />
        </div>
      </fieldset>
      {isAdmin && <div className="mt-3 flex justify-end">
        <Button disabled={!prefixOk || !days.length || settings.isPending} data-testid="button-save-settings"
          onClick={() => guard() && settings.mutate({ data: { companyName: company, ticketPrefix: prefix, workingDays: days, membersSeeAllTickets: all } }, { onSuccess: () => toast.success('Workspace saved') })}>
          {settings.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save workspace
        </Button>
      </div>}
    </Card>
  );
}

function Reminders() {
  const { ws, isAdmin, guard } = useWs();
  const { settings } = useOps();
  const on = ws.settings.automaticOverdueReminders !== false;
  const set = (v: boolean) => {
    if (!guard('change reminders')) return;
    settings.mutate({ data: { automaticOverdueReminders: v } }, { onSuccess: () => toast.success(v ? 'Automatic in-app overdue reminders on' : 'Automatic overdue reminders off') });
  };
  return (
    <Card title="Overdue reminders" desc="How owners hear about work that slipped past its deadline.">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-paper p-4 ring-1 ring-border">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Automatic in-app reminders</div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Once per overdue task, owner and deadline each day (IST). Active, real tasks only; sample tickets are skipped.</p>
        </div>
        <Switch checked={on} disabled={!isAdmin || settings.isPending} onCheckedChange={set} aria-label="Automatic in-app overdue reminders" data-testid="switch-auto-reminders" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-border">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Email reminders</div>
          <p className="mt-1 text-[13px] text-muted-foreground">No email provider is connected, so no reminder emails are sent.</p>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[12px] font-semibold text-foreground/70" data-testid="status-email-reminders">Not connected</span>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
        The server checks every minute while it is running, and again whenever someone loads the workspace, so missed days catch up when the app reopens.
        A new in-app reminder appears at the next check. Delivery while the app is fully stopped needs always-on or scheduled hosting.
        {!isAdmin && ' Only admins can change this.'}
      </p>
    </Card>
  );
}

function InstallApp() {
  return (
    <Card title="Put UltraTask on your home screen" desc="It opens full-screen like an app — no store needed.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" />Android · Chrome</div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Open this site in Chrome.</li><li>Tap the three-dot menu, top right.</li><li>Choose <span className="text-foreground">Install app</span> or <span className="text-foreground">Add to Home screen</span>.</li><li>Confirm. Find UltraTask in your app drawer.</li>
          </ol>
        </div>
        <div className="rounded-xl border border-border bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Apple className="h-4 w-4 text-primary" />iPhone · Safari</div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Open this site in Safari.</li><li>Tap the Share button at the bottom.</li><li>Scroll and tap <span className="text-foreground">Add to Home Screen</span>.</li><li>Tap Add. Sign in once; it stays signed in.</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}

function DemoData() {
  const { ws, guard } = useWs();
  const { deleteDemo } = useOps();
  const [open, setOpen] = useState(false);
  const n = ws.tickets.filter((t) => t.isDemo).length;
  return (
    <Card title="Sample data" desc="The workspace started with example tickets so the screens weren't empty. Remove them when the team is ready.">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-signal/20 bg-signal/5 p-4">
        <div className="text-sm"><span className="font-code">{n}</span> sample ticket{n === 1 ? '' : 's'} in this workspace</div>
        <Button variant="destructive" className="gap-1.5" disabled={!n || deleteDemo.isPending} onClick={() => guard() && setOpen(true)} data-testid="button-delete-demo">
          {deleteDemo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete sample data
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {n} sample tickets?</AlertDialogTitle>
            <AlertDialogDescription>Their comments and history go with them. Real tickets are untouched. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-demo"
              onClick={() => deleteDemo.mutate(undefined, { onSuccess: () => toast.success('Sample data removed') })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
