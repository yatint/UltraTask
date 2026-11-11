import type { Person, Ticket, Settings, Activity, Extension, TicketAction, TicketUpdate, Attachment } from "@workspace/api-zod";
import { get, list, insert, save, requireCondition, type Store } from "./store";
import { involved, manages, works, isAdmin } from "../middlewares/identity";
import { ObjectStorageService } from "./objectStorage";
const storage = new ObjectStorageService();
export const nowISO = () => new Date().toISOString();
export function futureDate(value: string | undefined): string {
  const date = new Date(value || "");
  requireCondition(Number.isFinite(date.getTime()) && date.getTime() > Date.now(), "Choose a due date in the future.");
  return date.toISOString();
}
export function reasonRequired(reason?: string) {
  requireCondition(reason && reason.trim().length >= 5, "Please give a reason of at least 5 characters.");
  return reason.trim();
}
export async function activePerson(q: Store, id: number) {
  const p = await get<Person>(q, "people", id);
  requireCondition(p?.isActive, "Choose an active team member.");
  return p;
}
export async function validateAttachments(q: Store, p: Person, attachments: Attachment[]) {
  requireCondition(attachments.length <= 10, "Attach at most 10 files.");
  for (const a of attachments) {
    const rows = await q.query("SELECT data FROM ut_uploads WHERE object_path=$1 AND owner_id=$2", [a.objectPath, p.id]);
    const registered = rows.rows[0]?.data;
    requireCondition(registered && registered.name === a.name && registered.size === a.size && registered.contentType === a.contentType, "This attachment was not uploaded by you.");
    const file = await storage.getObjectEntityFile(a.objectPath);
    const [metadata] = await file.getMetadata();
    requireCondition(Number(metadata.size) === a.size && Number(metadata.size) <= 10485760 && metadata.contentType === a.contentType, "Attachment size or type does not match the uploaded file.");
  }
}
export async function log(q: Store, t: Ticket, p: Person | null, action: string, fromValue: unknown = null, toValue: unknown = null, note = "") {
  return insert<Activity>(q, "activity", {
    ticketId: t.id, actorId: p?.id ?? null, action,
    fromValue: fromValue == null ? null : String(fromValue),
    toValue: toValue == null ? null : String(toValue),
    note, createdAt: nowISO(),
  }, { ticket_id: t.id });
}
export async function notify(q: Store, t: Ticket, ids: number[], type: string, message: string, actorId?: number) {
  for (const userId of [...new Set(ids)]) {
    if (userId === actorId) continue;
    const recipient = await get<Person>(q, "people", userId);
    if (!recipient?.isActive) continue;
    await insert(q, "notifications", { ticketId: t.id, userId, type, message, isRead: false, createdAt: nowISO() }, {
      ticket_id: t.id, user_id: userId,
    });
  }
}
export async function persistTicket(q: Store, t: Ticket) {
  t.updatedAt = nowISO();
  await save(q, "tickets", t, { assignee_id: t.assigneeId, creator_id: t.createdById, watcher_ids: t.watcherIds });
}
export async function updateTicket(q: Store, p: Person, t: Ticket, input: TicketUpdate): Promise<Ticket> {
  requireCondition(manages(p, t), "Only the creator or an admin can edit this ticket.", 403);
  requireCondition(!["closed", "cancelled"].includes(t.status), "Reopen the ticket before editing it.");
  if (input.dueAt !== undefined) {
    const due = futureDate(input.dueAt);
    reasonRequired(input.reason);
    if (due !== t.dueAt) {
      await log(q, t, p, "due_changed", t.dueAt, due, input.reason);
      t.dueAt = due; t.rescheduleCount++;
    }
  }
  if (input.assigneeId !== undefined && input.assigneeId !== t.assigneeId) {
    reasonRequired(input.reason);
    await activePerson(q, input.assigneeId);
    await log(q, t, p, "reassigned", t.assigneeId, input.assigneeId, input.reason);
    t.assigneeId = input.assigneeId; t.status = "open";
    t.acceptedAt = null; t.startedAt = null; t.doneAt = null;
    t.isBlocked = false; t.blockedReason = ""; t.blockedOnUserId = null;
    // A prior assignee's extension request is no longer actionable.
    const pending = await list<Extension>(q, "extensions", "ticket_id=$1 AND data->>'status'='pending'", [t.id]);
    for (const e of pending) {
      e.status = "declined"; e.decidedById = p.id; e.decidedAt = nowISO(); e.decisionNote = "Ticket reassigned";
      await save(q, "extensions", e);
      await log(q, t, p, "extension_declined", "pending", "declined", "Ticket reassigned");
    }
  }
  if (input.watcherIds !== undefined) {
    for (const id of input.watcherIds) await activePerson(q, id);
    for (const id of input.watcherIds.filter((id) => !t.watcherIds.includes(id))) {
      await log(q, t, p, "watcher_added", null, id);
    }
  }
  if (input.projectTagId != null) requireCondition((await get<{ isActive: boolean }>(q, "tags", input.projectTagId))?.isActive, "Choose an active project tag.");
  for (const key of ["title", "description", "priority", "projectTagId", "watcherIds"] as const) {
    if (input[key] !== undefined && JSON.stringify(input[key]) !== JSON.stringify(t[key])) {
      if (key === "title") requireCondition(String(input[key]).trim(), "A title is required.");
      await log(q, t, p, key === "priority" ? "priority_changed" : "edited", JSON.stringify(t[key]), JSON.stringify(input[key]), key);
      Object.assign(t, { [key]: input[key] });
    }
  }
  await persistTicket(q, t);
  await notify(q, t, [t.assigneeId, t.createdById, ...t.watcherIds], "updated", `${p.name} updated ${t.code}: ${t.title}`, p.id);
  return t;
}
export async function ticketAction(q: Store, p: Person, t: Ticket, input: TicketAction): Promise<Ticket> {
  const { action, reason } = input;
  const before = { ...t };
  const assignee = works(p, t), manager = manages(p, t);
  const self = t.assigneeId === t.createdById;
  const requireAssignee = () => requireCondition(assignee, "Only the assignee or an admin can do this.", 403);
  const requireManager = () => requireCondition(manager, "Only the creator or an admin can do this.", 403);
  const openState = !["closed", "cancelled", "declined"].includes(t.status);
  let actionName: string = action;
  switch (action) {
    case "accept":
      requireAssignee(); requireCondition(t.status === "open", "Only open tickets can be accepted.");
      t.status = "accepted"; t.acceptedAt = nowISO(); actionName = "accepted"; break;
    case "start":
      requireAssignee(); requireCondition(t.status === "accepted" || (self && t.status === "open"), "Accept this ticket before starting.");
      t.status = "in_progress"; t.startedAt = nowISO(); actionName = "started"; break;
    case "done":
      requireAssignee(); requireCondition(["accepted", "in_progress"].includes(t.status), "Start or accept this ticket first.");
      requireCondition(!self, "Close your self-assigned ticket instead.");
      t.status = "done"; t.doneAt = nowISO(); t.isBlocked = false; t.blockedReason = ""; t.blockedOnUserId = null;
      actionName = "marked_done"; break;
    case "close":
      requireManager(); requireCondition(t.status === "done" || (self && t.status === "in_progress"), "Only completed work can be closed.");
      if (self) t.doneAt = nowISO();
      {
        let dueWhenDone = t.dueAt;
        if (!self) {
          const history = await list<Activity>(q, "activity", "ticket_id=$1 AND data->>'action'='marked_done'", [t.id]);
          const markedDone = history.at(-1);
          if (markedDone?.fromValue?.startsWith("{")) dueWhenDone = JSON.parse(markedDone.fromValue).dueAt || t.dueAt;
        }
        t.wasOnTime = new Date(t.doneAt!).getTime() <= new Date(dueWhenDone).getTime();
      }
      t.status = "closed"; t.closedAt = nowISO();
      t.isBlocked = false; actionName = "closed"; break;
    case "reopen":
      requireManager(); reasonRequired(reason);
      requireCondition(t.status === "done" || (isAdmin(p) && t.status === "closed"), "Only completed tickets can be reopened; closed tickets require an admin.");
      t.status = "in_progress"; t.reopenCount++; t.doneAt = null; t.closedAt = null; t.wasOnTime = null; actionName = "reopened"; break;
    case "decline":
      requireAssignee(); reasonRequired(reason); requireCondition(t.status === "open", "Only open tickets can be declined.");
      t.status = "declined"; t.declinedAt = nowISO(); actionName = "declined"; break;
    case "cancel":
      requireManager(); reasonRequired(reason); requireCondition(t.status !== "closed" && t.status !== "cancelled", "This ticket cannot be cancelled.");
      t.status = "cancelled"; t.cancelledAt = nowISO(); t.isBlocked = false; actionName = "cancelled"; break;
    case "block":
    case "unblock":
      requireCondition(assignee || manager, "Only the assignee, creator or an admin can change blocking.", 403);
      requireCondition(["accepted", "in_progress"].includes(t.status), "Blocking is available on accepted or in-progress work.");
      if (action === "block") {
        reasonRequired(reason);
        if (input.blockedOnUserId != null) {
          await activePerson(q, input.blockedOnUserId);
          // A person waiting on must be able to open the ticket without leaking all tickets.
          if (!t.watcherIds.includes(input.blockedOnUserId) && ![t.assigneeId, t.createdById].includes(input.blockedOnUserId)) {
            t.watcherIds.push(input.blockedOnUserId);
            await log(q, t, p, "watcher_added", null, input.blockedOnUserId, "Added as the person blocking this ticket");
          }
        }
        t.isBlocked = true; t.blockedReason = reason!; t.blockedOnUserId = input.blockedOnUserId ?? null;
        actionName = "blocked";
        if (t.blockedOnUserId) await notify(q, t, [t.blockedOnUserId], "blocked", `${p.name} is waiting on you for ${t.code}: ${reason}`, p.id);
      } else {
        requireCondition(t.isBlocked, "This ticket is not blocked.");
        t.isBlocked = false; t.blockedReason = ""; t.blockedOnUserId = null; actionName = "unblocked";
      }
      break;
    case "nudge": {
      requireCondition(manager || t.watcherIds.includes(p.id), "Only the creator, a watcher or an admin can nudge.", 403);
      requireCondition(openState && t.status !== "done", "This ticket is not awaiting work.");
      const settings = (await get<Settings>(q, "settings", 1))!;
      const cooldown = settings.nudgeCooldownHours * 3600000;
      requireCondition(!t.lastNudgedAt || Date.now() - new Date(t.lastNudgedAt).getTime() >= cooldown, "Already nudged. Wait 4 hours before nudging again.", 429);
      t.lastNudgedAt = nowISO(); t.nudgeCount++; actionName = "nudged";
      const overdue = Date.now() - new Date(t.dueAt).getTime();
      const health = overdue > 0 ? ` (Overdue ${overdue < 86400000 ? `${Math.max(1, Math.floor(overdue / 3600000))}h` : `${Math.floor((Date.now() + 19800000) / 86400000) - Math.floor((new Date(t.dueAt).getTime() + 19800000) / 86400000)}d`})` : "";
      await notify(q, t, [t.assigneeId], "nudge", `${p.name} nudged you on ${t.code}: ${t.title}${health}${reason ? ` — ${reason}` : ""}`, p.id);
      break;
    }
    case "share_whatsapp":
      requireCondition(involved(p, t), "Only ticket participants can share.", 403);
      actionName = "shared_whatsapp"; break;
    case "request_extension": {
      requireAssignee(); requireCondition(openState && t.status !== "done", "This ticket cannot request more time.");
      reasonRequired(reason);
      const proposedDueAt = futureDate(input.proposedDueAt);
      requireCondition(new Date(proposedDueAt) > new Date(t.dueAt), "Propose a date after the current due date.");
      const existing = await list<Extension>(q, "extensions", "ticket_id=$1 AND data->>'status'='pending'", [t.id]);
      requireCondition(!existing.length, "A time request is already pending.");
      await insert(q, "extensions", { ticketId: t.id, requestedById: p.id, currentDueAt: t.dueAt, proposedDueAt, reason, status: "pending", decisionNote: "" }, { ticket_id: t.id });
      actionName = "extension_requested";
      await notify(q, t, [t.createdById], actionName, `${p.name} asked for more time on ${t.code}: ${reason}`, p.id);
      break;
    }
    case "approve_extension":
    case "decline_extension": {
      requireManager();
      requireCondition(openState && t.status !== "done", "Time requests cannot be decided on finished tickets.");
      const pending = await list<Extension>(q, "extensions", "ticket_id=$1 AND data->>'status'='pending'", [t.id]);
      const extension = pending.find((e) => input.extensionId === undefined || e.id === input.extensionId);
      requireCondition(extension, "No pending time request.");
      if (action === "approve_extension") {
        requireCondition(t.dueAt === extension.currentDueAt, "The due date changed. Decline this request and ask for a new one.");
        futureDate(extension.proposedDueAt);
        extension.status = "approved";
        await log(q, t, p, "due_changed", t.dueAt, extension.proposedDueAt, extension.reason);
        t.dueAt = extension.proposedDueAt; t.rescheduleCount++; actionName = "extension_approved";
      } else {
        reasonRequired(reason); extension.status = "declined"; actionName = "extension_declined";
      }
      extension.decidedById = p.id; extension.decidedAt = nowISO(); extension.decisionNote = reason || "";
      await save(q, "extensions", extension);
      break;
    }
    case "undo": {
      const history = await list<Activity>(q, "activity", "ticket_id=$1", [t.id]);
      const last = history.at(-1);
      requireCondition(last && last.actorId === p.id && Date.now() - new Date(last.createdAt).getTime() <= 10000, "The 10-second undo window has ended.");
      requireCondition(["created", "marked_done", "closed"].includes(last.action), "This action cannot be undone.");
      if (last.action === "created") { requireManager(); t.status = "cancelled"; t.cancelledAt = nowISO(); }
      else {
        const prior = JSON.parse(last.fromValue || "{}");
        requireCondition(prior.status, "No previous state is available.");
        Object.assign(t, prior);
      }
      actionName = "undone"; break;
    }
  }
  await persistTicket(q, t);
  const onBehalf = isAdmin(p) && p.id !== t.assigneeId && ["accept", "start", "done", "decline"].includes(action) ? "Admin acted on behalf of assignee. " : "";
  const snapshot = ["marked_done", "closed"].includes(actionName) ? JSON.stringify(before) : before.status;
  await log(q, t, p, actionName, snapshot, t.status, `${onBehalf}${reason || ""}`);
  if (!["nudge", "share_whatsapp", "request_extension"].includes(action)) {
    await notify(q, t, [t.assigneeId, t.createdById, ...t.watcherIds], actionName, `${p.name}: ${t.code} ${actionName.replaceAll("_", " ")}${reason ? ` — ${reason}` : ""}`, p.id);
  }
  return t;
}
