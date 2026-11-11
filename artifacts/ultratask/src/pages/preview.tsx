import { useCallback, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getGetPreviewQueryKey, useGetPreview } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { WorkspaceProvider, useWs, type View } from '@/lib/workspace';
import { errMsg } from '@/lib/ops';
import { Shell, SignInPrompt } from '@/components/shell';
import { TicketDetail } from '@/components/ticket-detail';
import MyTasks from './my-tasks';
import Waiting from './waiting';
import Team from './team';
import { ErrorScreen, ShellSkeleton } from './states';

export default function PreviewApp() {
  const q = useGetPreview({ query: { queryKey: getGetPreviewQueryKey() } });
  const [view, setView] = useState<View>('tasks');
  const [ticket, setTicket] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<{ what?: string } | null>(null);
  const go = useCallback((v: View) => { if (v === 'settings') setPrompt({ what: 'manage settings' }); else { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, []);
  const onBlocked = useCallback((what?: string) => setPrompt({ what }), []);

  if (q.isLoading) return <ShellSkeleton />;
  if (q.error || !q.data) return <ErrorScreen message={q.error ? errMsg(q.error) : 'No sample workspace available.'} retry={() => q.refetch()} />;

  return (
    <WorkspaceProvider ws={q.data} isPreview view={view} go={go} openTicket={setTicket} onBlocked={onBlocked}>
      <Shell>
        <Intro />
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {view === 'tasks' && <MyTasks />}
          {view === 'waiting' && <Waiting />}
          {view === 'team' && <Team />}
        </motion.div>
      </Shell>
      <TicketSheet id={ticket} onClose={() => setTicket(null)} />
      <SignInPrompt open={!!prompt} onOpenChange={(o) => !o && setPrompt(null)} what={prompt?.what} />
    </WorkspaceProvider>
  );
}

function Intro() {
  const { me, go } = useWs();
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      className="relative mx-auto mb-10 max-w-[1100px] overflow-hidden rounded-2xl bg-sidebar px-6 py-8 text-sidebar-accent-foreground md:px-10 md:py-10" data-testid="section-intro">
      <svg className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 opacity-[0.13]" viewBox="0 0 64 64" aria-hidden>
        <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="none" stroke="#2FB3BE" strokeWidth="0.6" />
        <path d="M32 11 50 21.5v21L32 53 14 42.5v-21Z" fill="none" stroke="#2FB3BE" strokeWidth="0.6" />
        <path d="M32 19 43 25.5v13L32 45 21 38.5v-13Z" fill="none" stroke="#2FB3BE" strokeWidth="0.6" />
      </svg>
      <div className="relative max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/60">Ultramotiv · Pune · UltraTask</div>
        <h2 className="mt-3 font-display text-[38px] leading-[1.02] md:text-[56px]">
          Every ask gets <em className="text-sidebar-primary">one owner</em>, one date, and a person who says it's done.
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-sidebar-foreground/80">
          This is the real interface with sample tickets from a robotics bench. You're seeing it as {me.name.split(' ')[0]}. Click around — open tickets, switch to Waiting on, check the team board.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/sign-in" className="group inline-flex items-center gap-2 rounded-full bg-sidebar-primary px-5 py-2.5 text-sm font-medium text-sidebar-primary-foreground transition-transform active:scale-[0.97]" data-testid="link-intro-sign-in">
            Sign in with your invite <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button onClick={() => go('waiting')} className="rounded-full border border-sidebar-foreground/25 px-5 py-2.5 text-sm transition-colors hover:bg-sidebar-accent" data-testid="button-intro-waiting">See Waiting on</button>
        </div>
      </div>
    </motion.section>
  );
}

function TicketSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { ticketById } = useWs();
  const t = id ? ticketById(id) : undefined;
  return (
    <Sheet open={!!t} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-background p-6 sm:max-w-[820px] md:p-8">
        <SheetTitle className="sr-only">{t?.title ?? 'Ticket'}</SheetTitle>
        {t && <TicketDetail t={t} />}
      </SheetContent>
    </Sheet>
  );
}
