import { useCallback } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { getGetTicketQueryKey, getGetWorkspaceQueryKey, useGetTicket, useGetWorkspace } from '@workspace/api-client-react';
import { WorkspaceProvider, useWs, type View } from '@/lib/workspace';
import { errMsg, errStatus } from '@/lib/ops';
import { Shell, EmptyState } from '@/components/shell';
import { Tour } from '@/components/tour';
import { TicketDetail, TicketDetailSkeleton } from '@/components/ticket-detail';
import { Button } from '@/components/ui/button';
import MyTasks from './my-tasks';
import Waiting from './waiting';
import Team from './team';
import Settings from './settings';
import Snapshot from './snapshot';
import NotFound from './not-found';
import { ErrorScreen, NoAccess, ShellSkeleton } from './states';

const noop = () => undefined;

export default function LiveArea() {
  const [loc, setLocation] = useLocation();
  const q = useGetWorkspace({
    query: {
      queryKey: getGetWorkspaceQueryKey(),
      refetchInterval: 30000,
      retry: (n, e) => ![401, 403, 404].includes(errStatus(e)) && n < 2,
    },
  });
  const go = useCallback((v: View) => setLocation(`/${v}`), [setLocation]);
  const openTicket = useCallback((id: number) => setLocation(`/tickets/${id}`), [setLocation]);

  if (q.isLoading) return <ShellSkeleton />;
  if (q.error) {
    if ([401, 403].includes(errStatus(q.error))) return <NoAccess />;
    return <ErrorScreen message={errMsg(q.error)} retry={() => q.refetch()} />;
  }
  if (!q.data) return <ShellSkeleton />;
  const seg = loc.split('/')[1] as View;
  const view: View | null = ['tasks', 'waiting', 'team', 'snapshot', 'settings'].includes(seg) ? seg : null;

  return (
    <WorkspaceProvider ws={q.data} isPreview={false} view={view} go={go} openTicket={openTicket} onBlocked={noop}>
      <Shell>
        <Switch>
          <Route path="/tasks" component={MyTasks} />
          <Route path="/waiting" component={Waiting} />
          <Route path="/team" component={Team} />
          <Route path="/snapshot" component={Snapshot} />
          <Route path="/settings" component={Settings} />
          <Route path="/tickets/:id" component={TicketPage} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
      <Tour />
    </WorkspaceProvider>
  );
}

function TicketPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { ticketById } = useWs();
  const q = useGetTicket(id, { query: { queryKey: getGetTicketQueryKey(id), enabled: Number.isFinite(id), refetchInterval: 30000, retry: (n, e) => errStatus(e) >= 500 && n < 2 } });
  const t = q.data ?? ticketById(id);
  return (
    <div>
      <Link href="/tasks" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      {t ? <TicketDetail t={t} /> : q.isLoading ? <TicketDetailSkeleton /> : (
        <div className="mx-auto max-w-[1100px]">
          <EmptyState art="search" title={errStatus(q.error) === 403 ? 'Not visible to you' : 'Ticket not found'} body={q.error ? errMsg(q.error) : 'It may have been removed, or the link is wrong.'} />
          {q.error && errStatus(q.error) >= 500 && <div className="mt-4 text-center"><Button onClick={() => q.refetch()} data-testid="button-retry-ticket">Retry</Button></div>}
        </div>
      )}
    </div>
  );
}
