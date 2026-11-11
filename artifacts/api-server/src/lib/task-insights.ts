import type { Activity, Person, SnapshotCounts, SnapshotTicketGroups, TeamSnapshot, Ticket } from "@workspace/api-zod";

export const ACTIVE_STATUSES = new Set(["open", "accepted", "in_progress"]);
export const isOverdue = (t: Ticket, now = Date.now()) =>
  ACTIVE_STATUSES.has(t.status) && Number.isFinite(Date.parse(t.dueAt)) && Date.parse(t.dueAt) < now;

export const METRICS = [
  "totalAssigned", "open", "overdue", "completed", "early", "onTime", "late",
  "waitingForCheck", "cancelled", "declined", "unknownTiming",
] as const;

const completedAt = (t: Ticket) => Date.parse(t.doneAt || (t.assigneeId === t.createdById ? t.closedAt : "") || "");

function completionDeadline(t: Ticket, activities: Activity[]): number {
  const completionAt = completedAt(t);
  const history = activities.filter((a) => a.ticketId === t.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  // Both completion actions store the pre-action ticket, preserving the deadline
  // even if an admin changed it while work was awaiting confirmation.
  const event = history.filter((a) => a.action === (t.assigneeId === t.createdById ? "closed" : "marked_done")).at(-1);
  if (event?.fromValue?.startsWith("{")) {
    try {
      const due = Date.parse(JSON.parse(event.fromValue).dueAt);
      if (Number.isFinite(due)) return due;
    } catch { /* Legacy audit entries can contain a status rather than JSON. */ }
  }
  const changedLater = history.find((a) => a.action === "due_changed" && Date.parse(a.createdAt) > completionAt && a.fromValue);
  return Date.parse(changedLater?.fromValue || t.dueAt);
}

export function buildSnapshot(users: Person[], tickets: Ticket[], activities: Activity[], includeDemo = false, now = Date.now()): TeamSnapshot {
  const totals = Object.fromEntries(METRICS.map((k) => [k, 0])) as Record<typeof METRICS[number], number>;
  const historyByTicket = new Map<number, Activity[]>();
  for (const activity of activities) {
    const history = historyByTicket.get(activity.ticketId) || [];
    history.push(activity);
    historyByTicket.set(activity.ticketId, history);
  }
  const members = users.map((person) => {
    const groups = Object.fromEntries(METRICS.map((k) => [k, []])) as unknown as SnapshotTicketGroups;
    for (const t of tickets.filter((ticket) => ticket.assigneeId === person.id && (includeDemo || !ticket.isDemo))) {
      groups.totalAssigned.push(t.id);
      if (ACTIVE_STATUSES.has(t.status)) {
        groups.open.push(t.id);
        if (isOverdue(t, now)) groups.overdue.push(t.id);
      } else if (t.status === "done") groups.waitingForCheck.push(t.id);
      else if (t.status === "cancelled") groups.cancelled.push(t.id);
      else if (t.status === "declined") groups.declined.push(t.id);
      else if (t.status === "closed") {
        groups.completed.push(t.id);
        const finishedAt = completedAt(t);
        const dueAt = completionDeadline(t, historyByTicket.get(t.id) || []);
        const knownDates = Number.isFinite(finishedAt) && Number.isFinite(dueAt);
        const onTime = typeof t.wasOnTime === "boolean" ? t.wasOnTime : knownDates ? finishedAt <= dueAt : null;
        if (onTime === null) groups.unknownTiming.push(t.id);
        else if (onTime) {
          groups.onTime.push(t.id);
          if (knownDates && finishedAt < dueAt) groups.early.push(t.id);
        } else groups.late.push(t.id);
      }
    }
    const counts = Object.fromEntries(METRICS.map((k) => [k, groups[k].length])) as Omit<SnapshotCounts, "onTimeRate">;
    for (const metric of METRICS) totals[metric] += counts[metric];
    const known = counts.onTime + counts.late;
    return {
      personId: person.id, name: person.name, designation: person.designation, colour: person.colour,
      avatarUrl: person.avatarUrl, isActive: person.isActive, ticketIds: groups,
      counts: { ...counts, onTimeRate: known ? Math.round(counts.onTime / known * 100) : null },
    };
  });
  const known = totals.onTime + totals.late;
  return {
    generatedAt: new Date(now).toISOString(), includeDemo, members,
    totals: { ...totals, onTimeRate: known ? Math.round(totals.onTime / known * 100) : null },
  };
}
