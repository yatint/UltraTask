import { Router, type IRouter } from "express";
import {
  GetPreviewResponse, GetWorkspaceResponse, GetTicketParams, GetTicketResponse,
  CreateTicketBody, CreateTicketResponse, UpdateTicketParams, UpdateTicketBody,
  UpdateTicketResponse, ActOnTicketParams, ActOnTicketBody, ActOnTicketResponse,
  AddCommentParams, AddCommentBody, AddCommentResponse, EditCommentParams, EditCommentBody, EditCommentResponse,
  GetSnapshotQueryParams, GetSnapshotResponse, GetPreviewSnapshotResponse,
  SendOverdueReminderParams, SendOverdueReminderResponse,
  type Person, type Ticket, type Comment, type Settings, type Notification,
} from "@workspace/api-zod";
import { pool, get, list, insert, save, transaction, requireCondition, HttpError } from "../lib/store";
import { publicPreview } from "../lib/seed";
import { requirePerson, limitWrites, readableTicket, involved, adminOnly } from "../middlewares/identity";
import { activePerson, futureDate, log, notify, persistTicket, ticketAction, updateTicket, validateAttachments, nowISO } from "../lib/ticket-rules";
import { buildSnapshot } from "../lib/task-insights";
import { canReadTask } from "../lib/ticket-access";
import { deliverOverdueReminder, sweepOverdueReminders } from "../lib/overdue-reminders";

const router: IRouter = Router();
router.get("/preview", (_req, res) => {
  res.set("Cache-Control", "no-store").json(GetPreviewResponse.parse(publicPreview()));
});
router.get("/preview/snapshot", (_req, res) => {
  const ws = publicPreview();
  res.set("Cache-Control", "no-store").json(GetPreviewSnapshotResponse.parse(
    buildSnapshot(ws.users, ws.tickets, ws.activities, true),
  ));
});
router.use(requirePerson, limitWrites);
router.get("/snapshot", async (req, res): Promise<void> => {
  adminOnly(res.locals.person);
  requireCondition(req.query.includeDemo === undefined || ["true", "false"].includes(String(req.query.includeDemo)), "Choose whether to include sample tasks.");
  const { includeDemo } = GetSnapshotQueryParams.parse({ includeDemo: req.query.includeDemo === "true" });
  const [users, tickets, activities] = await Promise.all([
    list<Person>(pool, "people"), list<Ticket>(pool, "tickets"),
    list<import("@workspace/api-zod").Activity>(pool, "activity"),
  ]);
  const visible = tickets.filter((t) => canReadTask(res.locals.person, t));
  res.set("Cache-Control", "no-store").json(GetSnapshotResponse.parse(buildSnapshot(users, visible, activities, includeDemo)));
});
router.get("/workspace", async (_req, res): Promise<void> => {
  await sweepOverdueReminders();
  const p: Person = res.locals.person;
  const settings = (await get<Settings>(pool, "settings", 1))!;
  const candidates = await list<Ticket>(pool, "tickets",
    p.role === "admin" || settings.membersSeeAllTickets ? "TRUE" : "(assignee_id=$1 OR creator_id=$1 OR $1=ANY(watcher_ids))",
    p.role === "admin" || settings.membersSeeAllTickets ? [] : [p.id]);
  const tickets = candidates.filter((t) => canReadTask(p, t, settings.membersSeeAllTickets));
  const ids = tickets.map((t) => t.id);
  const [users, tags, comments, activities, extensions, notifications] = await Promise.all([
    list<Person>(pool, "people"), list(pool, "tags"),
    list(pool, "comments", "ticket_id=ANY($1::int[])", [ids]),
    list(pool, "activity", "ticket_id=ANY($1::int[])", [ids]),
    list(pool, "extensions", "ticket_id=ANY($1::int[])", [ids]),
    list<Notification>(pool, "notifications", "user_id=$1 AND ticket_id=ANY($2::int[])", [p.id, ids]),
  ]);
  // Directory is available for assignment; private contact details/preferences
  // are only returned for self or admins.
  const directory = users.map((u) => p.role === "admin" || p.id === u.id ? u : {
    ...u, whatsappPhone: "", notifyEmailDigest: false, notifyPush: false, soundOn: false,
  });
  res.set("Cache-Control", "no-store").json(GetWorkspaceResponse.parse({
    currentUser: p, users: directory, tickets, tags, comments, activities, extensions,
    notifications: notifications.reverse().slice(0, 30), settings, isPreview: false,
  }));
});
router.get("/tickets/:id", async (req, res): Promise<void> => {
  const { id } = GetTicketParams.parse(req.params);
  res.json(GetTicketResponse.parse(await readableTicket(pool, res.locals.person, id)));
});
router.post("/tickets", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  const data = CreateTicketBody.parse(req.body);
  const ticket = await transaction(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock($1)", [p.id]);
    const title = data.title.trim();
    requireCondition(title, "A title is required.");
    await activePerson(q, data.assigneeId);
    const dueAt = futureDate(data.dueAt);
    for (const id of data.watcherIds || []) await activePerson(q, id);
    if (data.projectTagId != null) requireCondition((await get<{ isActive: boolean }>(q, "tags", data.projectTagId))?.isActive, "Choose an active project.");
    await validateAttachments(q, p, data.attachments || []);
    if (!data.allowDuplicate) {
      const recent = await list<Ticket>(q, "tickets", "creator_id=$1 AND assignee_id=$2 AND (data->>'createdAt')::timestamptz > NOW()-INTERVAL '7 days' AND data->>'status' NOT IN ('closed','cancelled','declined')", [p.id, data.assigneeId]);
      const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
      const a = words(title);
      const similar = recent.find((t) => {
        const b = words(t.title);
        const intersection = [...a].filter((w) => b.has(w)).length;
        return intersection / Math.max(a.size, b.size, 1) >= 0.75;
      });
      if (similar) throw new HttpError(409, `${similar.code} looks similar. Create anyway?`, { similarTicketId: similar.id });
    }
    const settings = (await get<Settings>(q, "settings", 1))!;
    const value = {
      title, description: data.description || "", assigneeId: data.assigneeId, createdById: p.id,
      watcherIds: [...new Set(data.watcherIds || [])], projectTagId: data.projectTagId ?? null,
      priority: data.priority || "normal", status: "open", dueAt, originalDueAt: dueAt,
      createdAt: nowISO(), updatedAt: nowISO(), rescheduleCount: 0, nudgeCount: 0, reopenCount: 0,
      isBlocked: false, blockedReason: "", blockedOnUserId: null, attachments: data.attachments || [], isDemo: false,
    };
    const t = await insert<Ticket>(q, "tickets", value, { assignee_id: data.assigneeId, creator_id: p.id, watcher_ids: value.watcherIds });
    t.code = `${settings.ticketPrefix}-${String(t.id).padStart(4, "0")}`;
    await persistTicket(q, t);
    await log(q, t, p, "created", null, t.status);
    await notify(q, t, [t.assigneeId, ...t.watcherIds], "assigned", `${p.name} assigned ${t.code}: ${t.title} to you.`, p.id);
    return t;
  });
  res.status(201).json(CreateTicketResponse.parse(ticket));
});
router.patch("/tickets/:id", async (req, res): Promise<void> => {
  const { id } = UpdateTicketParams.parse(req.params);
  const body = UpdateTicketBody.parse(req.body);
  const t = await transaction(async (q) => updateTicket(q, res.locals.person, await readableTicket(q, res.locals.person, id, true), body));
  res.json(UpdateTicketResponse.parse(t));
});
router.post("/tickets/:id/actions", async (req, res): Promise<void> => {
  const { id } = ActOnTicketParams.parse(req.params);
  const body = ActOnTicketBody.parse(req.body);
  const t = await transaction(async (q) => ticketAction(q, res.locals.person, await readableTicket(q, res.locals.person, id, true), body));
  res.json(ActOnTicketResponse.parse(t));
});
router.post("/tickets/:id/overdue-reminder", async (req, res): Promise<void> => {
  const { id } = SendOverdueReminderParams.parse(req.params);
  const result = await transaction(async (q) => deliverOverdueReminder(q,
    await readableTicket(q, res.locals.person, id, true), res.locals.person));
  requireCondition(result, "This overdue reminder was already delivered.", 429);
  res.json(SendOverdueReminderResponse.parse(result));
});
router.post("/tickets/:id/comments", async (req, res): Promise<void> => {
  const { id } = AddCommentParams.parse(req.params);
  const body = AddCommentBody.parse(req.body);
  requireCondition(body.body.trim() || body.attachments?.length, "Write a comment or attach a file.");
  const p: Person = res.locals.person;
  const comment = await transaction(async (q) => {
    const t = await readableTicket(q, p, id, true);
    requireCondition(involved(p, t), "Only ticket participants can comment.", 403);
    await validateAttachments(q, p, body.attachments || []);
    const c = await insert<Comment>(q, "comments", { ticketId: id, authorId: p.id, body: body.body, attachments: body.attachments || [], createdAt: nowISO() }, { ticket_id: id });
    await log(q, t, p, "commented", null, c.id, body.body);
    await persistTicket(q, t);
    await notify(q, t, [t.assigneeId, t.createdById, ...t.watcherIds], "comment", `${p.name} commented on ${t.code}: ${body.body.slice(0, 150)}`, p.id);
    return c;
  });
  res.status(201).json(AddCommentResponse.parse(comment));
});
router.patch("/comments/:id", async (req, res): Promise<void> => {
  const { id } = EditCommentParams.parse(req.params);
  const body = EditCommentBody.parse(req.body);
  requireCondition(body.body.trim() || body.attachments?.length, "Write a comment or attach a file.");
  const p: Person = res.locals.person;
  const comment = await transaction(async (q) => {
    const c = await get<Comment>(q, "comments", id, true);
    requireCondition(c, "Comment not found.", 404);
    requireCondition(c.authorId === p.id && Date.now() - new Date(c.createdAt).getTime() < 600000, "You can edit your own comment for 10 minutes only.", 403);
    const t = await readableTicket(q, p, c.ticketId, true);
    requireCondition(involved(p, t), "You no longer have permission to comment.", 403);
    await validateAttachments(q, p, (body.attachments || []).filter((a) => !c.attachments.some((old) => old.objectPath === a.objectPath)));
    await log(q, t, p, "edited", c.body, body.body, `Comment ${id} edited`);
    c.body = body.body; c.editedAt = nowISO(); c.attachments = body.attachments ?? c.attachments;
    await save(q, "comments", c);
    return c;
  });
  res.json(EditCommentResponse.parse(comment));
});
router.post("/notifications/read", async (_req, res): Promise<void> => {
  await pool.query("UPDATE ut_notifications SET data=jsonb_set(data,'{isRead}','true'::jsonb) WHERE user_id=$1", [res.locals.person.id]);
  res.json({ success: true });
});
export default router;
