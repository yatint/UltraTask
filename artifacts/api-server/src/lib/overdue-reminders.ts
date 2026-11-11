import type { Notification, OverdueReminderResult, Person, Settings, Ticket } from "@workspace/api-zod";
import { get, insert, list, requireCondition, transaction, type Store } from "./store";
import { log, persistTicket } from "./ticket-rules";
import { manages } from "../middlewares/identity";
import { isOverdue } from "./task-insights";
import { logger } from "./logger";

/** One automatic reminder per task/deadline/owner per India calendar day. */
export function automaticReminderKey(t: Ticket, now: number): string {
  const day = Math.floor((now + 19_800_000) / 86_400_000);
  return `system:${t.id}:${t.assigneeId}:${new Date(t.dueAt).toISOString()}:${day}`;
}

export async function deliverOverdueReminder(
  q: Store, t: Ticket, actor: Person | null, now = Date.now(),
): Promise<OverdueReminderResult | undefined> {
  const automatic = actor === null;
  if (automatic && (!isOverdue(t, now) || t.isDemo)) return;
  if (actor) {
    requireCondition(manages(actor, t) || t.watcherIds.includes(actor.id), "Only the requester, an admin or a watcher can send this reminder.", 403);
    requireCondition(isOverdue(t, now), "Only unfinished, overdue tasks can receive an overdue reminder.");
    requireCondition(!t.isDemo, "Sample tasks do not send reminders.");
    const settings = (await get<Settings>(q, "settings", 1))!;
    const hours = settings.nudgeCooldownHours;
    requireCondition(!t.lastNudgedAt || now - Date.parse(t.lastNudgedAt) >= hours * 3_600_000, `A reminder was already sent. Wait ${hours} hours between manual reminders and nudges.`, 429);
  }
  const recipient = await get<Person>(q, "people", t.assigneeId);
  if (!recipient?.isActive) {
    if (automatic) return;
    requireCondition(false, "This task's owner is inactive. Reassign the task before sending a reminder.");
  }
  const sentAt = new Date(now).toISOString();
  const kind = automatic ? "system" : "manual";
  const key = automatic ? automaticReminderKey(t, now) : `manual:${t.id}:${sentAt}`;
  // The unique key is a database constraint, not a process-local cache. Claims,
  // notification, audit and manual cooldown commit together or not at all.
  const claim = await q.query(
    "INSERT INTO ut_overdue_reminders (ticket_id,recipient_id,event_key,kind,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_key) DO NOTHING RETURNING id",
    [t.id, t.assigneeId, key, kind, sentAt],
  );
  if (!claim.rowCount) return;
  const due = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(t.dueAt));
  const message = `${automatic ? "System overdue reminder" : `${actor!.name} sent an overdue reminder`}: ${t.code} — ${t.title}. Due ${due} IST. Please update the task or request more time.`;
  // Intentionally include self-assigned tasks. A system alert has no actor, and
  // manually reminding yourself must not falsely report delivery to nobody.
  const notification = await insert<Notification>(q, "notifications", {
    ticketId: t.id, userId: recipient.id, type: `overdue_${kind}`, message, isRead: false, createdAt: sentAt,
  }, { ticket_id: t.id, user_id: recipient.id });
  if (actor) {
    t.lastNudgedAt = sentAt;
    t.nudgeCount++;
    await persistTicket(q, t);
  }
  await log(q, t, actor, `overdue_${kind}`, null, recipient.id, "In-app reminder delivered. Email not connected.");
  return {
    ticketId: t.id, recipientId: recipient.id, notificationId: notification.id, sentAt,
    inAppStatus: "sent", emailStatus: "not_connected",
    message: "In-app reminder sent. Email is not connected; no email was sent.",
  };
}

let pendingSweep: Promise<void> | undefined;
let lastSuccessfulSweep = 0;

export function sweepOverdueReminders(force = false): Promise<void> {
  if (pendingSweep) return pendingSweep;
  if (!force && Date.now() - lastSuccessfulSweep < 30_000) return Promise.resolve();
  pendingSweep = transaction(async (q) => {
    // Multiple running replicas can check safely. A later request also catches up
    // after an Autoscale instance sleeps; no claim of always-on delivery.
    await q.query("SELECT pg_advisory_xact_lock(85914722)");
    const settings = (await get<Settings>(q, "settings", 1))!;
    if (settings.automaticOverdueReminders === false) return;
    const candidates = await list<Ticket>(q, "tickets",
      "data->>'status'=ANY($1::text[]) AND COALESCE((data->>'isDemo')::boolean,false)=false AND (data->>'dueAt')::timestamptz < NOW()",
      [["open", "accepted", "in_progress"]]);
    for (const candidate of candidates) {
      const ticket = await get<Ticket>(q, "tickets", candidate.id, true);
      if (ticket) await deliverOverdueReminder(q, ticket, null);
    }
  }).then(() => { lastSuccessfulSweep = Date.now(); }).finally(() => { pendingSweep = undefined; });
  return pendingSweep;
}

export function startOverdueReminderLoop() {
  const check = () => void sweepOverdueReminders().catch((err) => logger.error({ err }, "Automatic overdue reminder check failed"));
  check();
  const timer = setInterval(check, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
