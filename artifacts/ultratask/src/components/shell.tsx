import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Ticket } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useClerk } from '@clerk/react';
import { Bell, Inbox, Hourglass, LayoutGrid, Settings2, Plus, LogOut, LogIn, Keyboard, Eye, Search, Gauge } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWs, type View } from '@/lib/workspace';
import { useOps } from '@/lib/ops';
import { fmtAgo, isActive } from '@/lib/time';
import { Avatar, Brand, HexMark, Kbd, STATUS_LABEL } from './atoms';
import { CreateTicketDialog, openNewTicket } from './create-ticket';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function useCounts() {
  const { ws, me } = useWs();
  const mine = ws.tickets.filter((t) => t.assigneeId === me.id && isActive(t)).length;
  const waiting = ws.tickets.filter((t) => t.createdById === me.id && t.assigneeId !== me.id && (isActive(t) || t.status === 'done')).length;
  return { mine, waiting };
}

const NAV: { v: View; label: string; short: string; icon: typeof Inbox; href: string; admin?: boolean }[] = [
  { v: 'tasks', label: 'My tasks', short: 'Tasks', icon: Inbox, href: '/tasks' },
  { v: 'waiting', label: 'Waiting on', short: 'Waiting', icon: Hourglass, href: '/waiting' },
  { v: 'team', label: 'Team', short: 'Team', icon: LayoutGrid, href: '/team', admin: true },
  { v: 'snapshot', label: 'Snapshot', short: 'Snapshot', icon: Gauge, href: '/snapshot', admin: true },
  { v: 'settings', label: 'Settings', short: 'Settings', icon: Settings2, href: '/settings' },
];

function NavItem({ item, active, count, onDark }: { item: (typeof NAV)[number]; active: boolean; count?: number; onDark?: boolean }) {
  const { isPreview, go } = useWs();
  const inner = (
    <>
      {active && <motion.span layoutId={onDark ? 'nav-pill' : 'nav-pill-m'} className={cn('absolute inset-0 rounded-lg', onDark ? 'bg-sidebar-accent' : 'bg-accent')} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <item.icon className="relative h-4 w-4" />
      <span className="relative">{item.label}</span>
      {count ? <span className="relative ml-auto rounded-md bg-sidebar-primary/15 px-1.5 font-code text-[12px] text-sidebar-primary">{count}</span> : null}
    </>
  );
  const cls = cn('relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors',
    onDark ? (active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:text-sidebar-accent-foreground') : '');
  if (isPreview) return <button onClick={() => go(item.v)} className={cn(cls, 'w-full text-left')} data-testid={`nav-${item.v}`}>{inner}</button>;
  return <Link href={item.href} className={cls} data-testid={`nav-${item.v}`}>{inner}</Link>;
}

export function Shell({ children }: { children: ReactNode }) {
  const { view, isAdmin, isPreview, me, ws, go } = useWs();
  const counts = useCounts();
  const { signOut } = useClerk();
  const [keys, setKeys] = useState(false);
  const items = NAV.filter((n) => !n.admin || isAdmin || isPreview);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || tg.closest('input,textarea,select,[contenteditable=true],[role=dialog]')) return;
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openNewTicket(); }
      if (e.key === '?') setKeys(true);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="grain flex min-h-[100dvh] bg-background">
      <aside className="sticky top-0 hidden h-[100dvh] w-[256px] shrink-0 flex-col bg-sidebar px-3 pb-3 pt-5 text-sidebar-foreground md:flex">
        <div className="px-2">
          <Brand className="w-full" />
        </div>
        <button onClick={openNewTicket} data-testid="button-new-ticket"
          className="mt-7 flex min-h-11 items-center gap-2 rounded-xl bg-sidebar-primary px-3 py-2 text-[14px] font-semibold text-sidebar-primary-foreground transition-transform hover:brightness-110 active:scale-[0.98]">
          <Plus className="h-4 w-4" /> New ticket <span className="ml-auto rounded border border-sidebar-primary-foreground/25 px-1 font-code text-[10px]">N</span>
        </button>
        <nav className="mt-5 space-y-0.5">
          {items.map((n) => <NavItem key={n.v} item={n} onDark active={view === n.v} count={n.v === 'tasks' ? counts.mine : n.v === 'waiting' ? counts.waiting : undefined} />)}
        </nav>
        <div className="mt-auto space-y-2">
          <button onClick={() => setKeys(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-sidebar-foreground/60 hover:text-sidebar-accent-foreground" data-testid="button-shortcuts">
            <Keyboard className="h-3.5 w-3.5" /> Shortcuts <span className="ml-auto font-code">?</span>
          </button>
          <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent/60 p-2.5">
            <Avatar p={me} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-sidebar-accent-foreground" data-testid="text-current-user">{me.name}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">{isPreview ? 'Sample viewer' : `${me.designation} · ${me.role}`}</div>
            </div>
            {isPreview
              ? <Link href="/sign-in" className="flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar hover:text-white" aria-label="Sign in" data-testid="link-sidebar-sign-in"><LogIn className="h-4 w-4" /></Link>
              : <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar hover:text-white" aria-label="Sign out" data-testid="button-sign-out"><LogOut className="h-4 w-4" /></button>}
          </div>
          <div className="px-2 text-[10.5px] text-sidebar-foreground/40">{ws.settings.companyName} · Pune · IST</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center bg-sidebar py-1 md:hidden"><Brand variant="inline" className="py-1.5" /></div>
        {isPreview && <PreviewBanner />}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md md:px-8">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <Notifications />
            <button onClick={openNewTicket} aria-label="New ticket" title="New ticket" data-testid="button-fab-new"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95 md:hidden">
              <Plus className="h-5 w-5" />
            </button>
            {!isPreview && <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-ring md:hidden" aria-label="Account menu" data-testid="button-mobile-account">
                  <Avatar p={me} size={28} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <div className="border-b border-border px-2 py-2.5 text-sm font-semibold">{me.name}</div>
                <button onClick={() => go('settings')} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent"><Settings2 className="h-4 w-4" />Settings</button>
                <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent" data-testid="button-mobile-sign-out"><LogOut className="h-4 w-4" />Sign out</button>
              </PopoverContent>
            </Popover>}
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-8">{children}</main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 backdrop-blur-md md:hidden">
        <div className="grid gap-0.5 px-1.5 pt-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((n) => <MobileTab key={n.v} item={n} active={view === n.v} />)}
        </div>
      </nav>

      <CreateTicketDialog />
      <ShortcutSheet open={keys} onOpenChange={setKeys} />
      <CloseReward />
    </div>
  );
}

function MobileTab({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const { isPreview, go } = useWs();
  const cls = cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground');
  const inner = (<><item.icon className="h-5 w-5" /><span className="max-w-full truncate">{item.short}</span></>);
  return isPreview ? <button className={cls} onClick={() => go(item.v)} data-testid={`tab-${item.v}`}>{inner}</button> : <Link href={item.href} className={cls} data-testid={`tab-${item.v}`}>{inner}</Link>;
}

function PreviewBanner() {
  const { me } = useWs();
  return (
    <div className="relative z-40 flex items-center gap-3 border-b border-amber/25 bg-[hsl(40_70%_94%)] px-4 py-1.5 text-[13px] md:px-8" data-testid="banner-preview">
      <Eye className="h-4 w-4 shrink-0 text-amber" />
      <span className="min-w-0 text-foreground/85"><b className="font-semibold">Sample workspace, read-only.</b><span className="hidden sm:inline"> Viewing as {me.name.split(' ')[0]}. Every ask has one owner, one deadline, and is closed only by the person who asked.</span></span>
      <Link href="/sign-in" className="ml-auto inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-foreground px-3.5 font-semibold text-background transition-transform active:scale-95" data-testid="link-banner-sign-in">Sign in</Link>
    </div>
  );
}

function sourceLabel(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes('overdue') || t.includes('reminder')) return /auto|system/.test(t) ? 'System · overdue' : 'Manual · overdue reminder';
  if (t.includes('nudge')) return 'Nudge';
  return null;
}

function Notifications() {
  const { ws, isPreview, openTicket, guard } = useWs();
  const { readNotifs } = useOps();
  const unread = ws.notifications.filter((n) => !n.isRead).length;
  const list = [...ws.notifications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications" data-testid="button-notifications">
          <Bell className="h-[18px] w-[18px]" />
          <AnimatePresence>{unread > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-code text-[9.5px] text-white" data-testid="badge-unread">{unread}</motion.span>}</AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Inbox</span>
          {unread > 0 && (
            <button onClick={() => { if (!isPreview) readNotifs.mutate(); else guard('mark notifications read'); }} disabled={readNotifs.isPending}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50" data-testid="button-mark-all-read">Mark all read ({unread})</button>
          )}
        </div>
        <div className="max-h-[60dvh] overflow-y-auto">
          {list.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Quiet. Nothing needs you right now.</div>}
          {list.map((n) => (
            <button key={n.id} onClick={() => openTicket(n.ticketId)} className="flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-paper" data-testid={`notification-${n.id}`}>
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[13px] leading-snug', n.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{n.message}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{sourceLabel(n.type) && <span className="rounded bg-muted px-1 py-px font-medium text-foreground/70" data-testid={`notification-source-${n.id}`}>{sourceLabel(n.type)}</span>}{fmtAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch() {
  const { ws, openTicket, person } = useWs();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out: { t: Ticket; hit: string }[] = [];
    for (const t of ws.tickets) {
      if (t.code.toLowerCase().includes(s) || t.title.toLowerCase().includes(s)) { out.push({ t, hit: '' }); continue; }
      if (t.description?.toLowerCase().includes(s)) { out.push({ t, hit: t.description }); continue; }
      const c = ws.comments.find((c) => c.ticketId === t.id && c.body.toLowerCase().includes(s));
      if (c) out.push({ t, hit: `${person(c.authorId)?.name ?? 'Someone'}: ${c.body}` });
    }
    return out.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ws]);
  const pick = (id: number) => { openTicket(id); setOpen(false); setQ(''); ref.current?.blur(); };
  return (
    <div className="relative min-w-0 flex-1 md:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input ref={ref} value={q} placeholder="Search" aria-label="Search tickets and comments" data-testid="input-global-search"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setI(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
          else if (e.key === 'Enter' && results[i]) pick(results[i].t.id);
          else if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
        }}
        className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[14px] shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary md:pr-12" />
      <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-code text-[10.5px] text-muted-foreground md:block">Ctrl K</span>
      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-11 z-50 max-h-[60dvh] overflow-y-auto rounded-xl border border-border bg-popover shadow-xl" data-testid="list-search-results">
            {results.length === 0 ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">No ticket or comment mentions "{q.trim()}".</div>
              : results.map(({ t, hit }, k) => (
                <button key={t.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t.id)} onMouseEnter={() => setI(k)}
                  className={cn('flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-2.5 text-left last:border-0', k === i && 'bg-accent/60')} data-testid={`search-result-${t.id}`}>
                  <span className="flex items-center gap-2 text-[13px]"><span className="font-code text-[11px] text-muted-foreground">{t.code}</span><span className="truncate font-medium">{t.title}</span><span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{STATUS_LABEL[t.status]}</span></span>
                  {hit && <span className="truncate text-[12px] text-muted-foreground">{hit}</span>}
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortcutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rows = [['N', 'New ticket'], ['/', 'Filter this list'], ['Ctrl K', 'Search everything'], ['J / K', 'Move down / up'], ['Enter', 'Open ticket'], ['D', 'Mark selected done'], ['C', 'Comment on selected'], ['?', 'This sheet']];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display text-xl">Keys</DialogTitle><DialogDescription>Your hands can stay on the keyboard.</DialogDescription></DialogHeader>
        <div className="divide-y divide-border">{rows.map(([k, l]) => <div key={k} className="flex items-center justify-between py-2 text-sm"><span>{l}</span><span className="flex gap-1">{k.split(' / ').map((x) => <Kbd key={x}>{x}</Kbd>)}</span></div>)}</div>
        <p className="text-xs text-muted-foreground">On phones: swipe a row right for its main action, left to comment.</p>
      </DialogContent>
    </Dialog>
  );
}

function CloseReward() {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const h = () => setN((x) => x + 1);
    window.addEventListener('ut:celebrate', h);
    return () => window.removeEventListener('ut:celebrate', h);
  }, []);
  useEffect(() => { if (!n) return; const id = setTimeout(() => setN(0), 1300); return () => clearTimeout(id); }, [n]);
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div key={n} className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary shadow-xl">
            <svg viewBox="0 0 48 48" className="h-12 w-12">
              <motion.path d="M12 25 l8 8 l16 -18" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }} />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SignInPrompt({ open, onOpenChange, what }: { open: boolean; onOpenChange: (o: boolean) => void; what?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex justify-center pt-2"><HexMark className="h-12 w-12" /></div>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="font-display text-2xl">This one's for the team</DialogTitle>
          <DialogDescription>The sample workspace is read-only. Sign in with your Ultramotiv invite to {what ?? 'act on tickets'} for real.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button asChild className="h-11 rounded-xl" data-testid="button-prompt-sign-in"><Link href="/sign-in">Sign in</Link></Button>
          <Button variant="ghost" className="h-11 rounded-xl" onClick={() => onOpenChange(false)} data-testid="button-prompt-keep">Keep exploring</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">No invite yet? Ask your admin.</p>
      </DialogContent>
    </Dialog>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-4">
      <div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }} className="font-display text-[26px] leading-tight md:text-[30px]" data-testid="text-page-title">{title}</motion.h1>
        {sub && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="mt-2 text-sm text-muted-foreground">{sub}</motion.p>}
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function EmptyState({ title, body, art = 'calm' }: { title: string; body: string; art?: 'calm' | 'search' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-paper/60 px-6 py-14 text-center" data-testid="empty-state">
      <svg viewBox="0 0 120 60" className="mb-5 h-14 w-28 text-primary">
        {art === 'calm' ? (<><path d="M5 45 Q 30 20 60 40 T 115 30" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5" /><circle cx="92" cy="18" r="8" fill="hsl(var(--amber))" opacity=".75" /><path d="M5 52 H115" stroke="hsl(var(--border))" strokeWidth="1.5" /></>)
          : (<><circle cx="52" cy="28" r="16" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m64 40 14 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M5 56 H115" stroke="hsl(var(--border))" strokeWidth="1.5" /></>)}
      </svg>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </motion.div>
  );
}
