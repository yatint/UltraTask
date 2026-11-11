import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
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
