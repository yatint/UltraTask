import type { Person, Ticket } from "@workspace/api-zod";

/** Personal work becomes shared only when the owner adds a watcher. */
export function isPrivateTask(t: Ticket) {
  return t.assigneeId === t.createdById && t.watcherIds.length === 0;
}

export function canReadTask(p: Person, t: Ticket, membersSeeAll = false) {
  if (isPrivateTask(t)) return p.id === t.assigneeId;
  return p.role === "admin" || membersSeeAll ||
    p.id === t.assigneeId || p.id === t.createdById || t.watcherIds.includes(p.id);
}

export function canRespondToTask(p: Person, t: Ticket) {
  return p.id === t.assigneeId && t.assigneeId !== t.createdById;
}
