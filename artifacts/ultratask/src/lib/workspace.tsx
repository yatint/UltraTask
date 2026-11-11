import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Person, Tag, Ticket, Workspace } from '@workspace/api-client-react';

export type View = 'tasks' | 'waiting' | 'team' | 'snapshot' | 'settings';

interface Ctx {
  ws: Workspace;
  me: Person;
  isPreview: boolean;
  isAdmin: boolean;
  people: Map<number, Person>;
  tags: Map<number, Tag>;
  view: View | null;
  go: (v: View) => void;
  openTicket: (id: number) => void;
  /** returns true if allowed; in preview, prompts sign-in and returns false */
  guard: (what?: string) => boolean;
  person: (id?: number | null) => Person | undefined;
  ticketById: (id: number) => Ticket | undefined;
}

const WsCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider(props: {
  ws: Workspace;
  isPreview: boolean;
  view: View | null;
  go: (v: View) => void;
  openTicket: (id: number) => void;
  onBlocked: (what?: string) => void;
  children: ReactNode;
}) {
  const { ws, isPreview, view, go, openTicket, onBlocked } = props;
  const value = useMemo<Ctx>(() => {
    const people = new Map(ws.users.map((u) => [u.id, u]));
    const tags = new Map(ws.tags.map((t) => [t.id, t]));
    const tix = new Map(ws.tickets.map((t) => [t.id, t]));
    return {
      ws,
      me: ws.currentUser,
      isPreview,
      isAdmin: ws.currentUser.role === 'admin',
      people,
      tags,
      view,
      go,
      openTicket,
      guard: (what) => {
        if (isPreview) {
          onBlocked(what);
          return false;
        }
        return true;
      },
      person: (id) => (id == null ? undefined : people.get(id)),
      ticketById: (id) => tix.get(id),
    };
  }, [ws, isPreview, view, go, openTicket, onBlocked]);
  return <WsCtx.Provider value={value}>{props.children}</WsCtx.Provider>;
}

export function useWs() {
  const c = useContext(WsCtx);
  if (!c) throw new Error('useWs outside provider');
  return c;
}

export const assetUrl = (p?: string) => (!p ? '' : /^(https?:|data:|blob:)/.test(p) ? p : `/api/storage${p.startsWith('/') ? '' : '/'}${p}`);
