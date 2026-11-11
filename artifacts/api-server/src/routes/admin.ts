import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import {
  UpdateSettingsBody, UpdateSettingsResponse, InviteMemberBody, InviteMemberResponse,
  UpdateMemberParams, UpdateMemberBody, UpdateMemberResponse, SaveTagBody, SaveTagResponse,
  type Person, type Settings, type Ticket, type Tag,
} from "@workspace/api-zod";
import { pool, transaction, get, list, insert, save, requireCondition } from "../lib/store";
import { adminOnly } from "../middlewares/identity";
import { activePerson, log, notify, persistTicket, nowISO } from "../lib/ticket-rules";

const router: IRouter = Router();
router.patch("/settings", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  adminOnly(p);
  const data = UpdateSettingsBody.parse(req.body);
  const settings = await transaction(async (q) => {
    const settings = (await get<Settings & { id: number }>(q, "settings", 1, true))!;
    Object.assign(settings, data);
    await save(q, "settings", settings);
    return settings;
  });
  res.json(UpdateSettingsResponse.parse(settings));
});
router.post("/members", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  adminOnly(p);
  const body = InviteMemberBody.parse(req.body);
  const email = body.email.toLowerCase().trim();
  const person = await transaction(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock(85914721)");
    const matching = await q.query("SELECT id FROM ut_people WHERE lower(email)=$1", [email]);
    const existingId = body.existingId ?? matching.rows[0]?.id;
    requireCondition(body.existingId === undefined || Boolean(await get<Person>(q, "people", body.existingId)), "Team member not found.", 404);
    const existing = existingId ? await get<Person>(q, "people", existingId, true) : undefined;
    requireCondition(!matching.rows.length || matching.rows[0].id === existingId, "This email already belongs to another team member.");
    if (existing) {
      const linked = await q.query("SELECT clerk_id FROM ut_people WHERE id=$1", [existing.id]);
      requireCondition(!linked.rows[0]?.clerk_id || existing.email === email, "An active sign-in email cannot be changed here.");
      if (existing.role === "admin" && existing.isActive && body.role !== "admin") {
        const others = await q.query("SELECT id FROM ut_people WHERE data->>'role'='admin' AND data->>'isActive'='true' AND id<>$1", [existing.id]);
        requireCondition(others.rowCount, "Keep at least one active admin.");
      }
    }
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email, expiresInDays: 7, ignoreExisting: true,
      redirectUrl: `${req.protocol}://${req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host")}/sign-up`,
      publicMetadata: { app: "UltraTask" },
    });
    requireCondition(invitation.id, "The invitation could not be sent.", 502);
    const data = {
      name: body.name.trim(), email, designation: body.designation, role: body.role,
      colour: existing?.colour || "#16857f", isActive: true,
      notifyEmailDigest: existing?.notifyEmailDigest ?? true, notifyPush: existing?.notifyPush ?? true,
      soundOn: existing?.soundOn ?? false, whatsappPhone: existing?.whatsappPhone || "",
      invitedAt: nowISO(),
    };
    if (existing) {
      const person = { ...existing, ...data };
      await save(q, "people", person, { email });
      if (!existing.isActive) {
        const identity = await q.query("SELECT clerk_id FROM ut_people WHERE id=$1", [existing.id]);
        if (identity.rows[0]?.clerk_id) await clerkClient.users.unbanUser(identity.rows[0].clerk_id);
      }
      return person;
    }
    return insert<Person>(q, "people", data, { email });
  });
  res.status(201).json(InviteMemberResponse.parse(person));
});
router.patch("/members/:id", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  const { id } = UpdateMemberParams.parse(req.params);
  const body = UpdateMemberBody.parse(req.body);
  requireCondition(p.id === id || p.role === "admin", "You can edit only your own profile.", 403);
  if (body.role !== undefined || body.isActive !== undefined || body.reassignToId !== undefined) adminOnly(p);
  const person = await transaction(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock(85914721)");
    const person = await get<Person>(q, "people", id, true);
    requireCondition(person, "Team member not found.", 404);
    if ((body.role === "member" || body.isActive === false) && person.role === "admin" && person.isActive) {
      const admins = await q.query("SELECT id FROM ut_people WHERE data->>'role'='admin' AND data->>'isActive'='true' AND id<>$1", [id]);
      requireCondition(admins.rowCount, "Keep at least one active admin.");
    }
    if (body.isActive === false) {
      const open = await list<Ticket>(q, "tickets", "assignee_id=$1 AND data->>'status' NOT IN ('closed','cancelled','declined')", [id]);
      if (open.length) {
        requireCondition(body.reassignToId && body.reassignToId !== id, `Reassign ${open.length} open tickets before deactivating this person.`);
        await activePerson(q, body.reassignToId);
        for (const t of open) {
          t.assigneeId = body.reassignToId; t.status = "open"; t.acceptedAt = null; t.startedAt = null; t.doneAt = null;
          t.isBlocked = false; t.blockedReason = ""; t.blockedOnUserId = null;
          await persistTicket(q, t);
          await log(q, t, p, "reassigned", id, body.reassignToId, "Previous assignee deactivated");
          await notify(q, t, [t.assigneeId, t.createdById], "reassigned", `${t.code} reassigned because ${person.name} was deactivated.`, p.id);
        }
      }
    }
    const { reassignToId: _reassignToId, ...patch } = body;
    if (patch.whatsappPhone) requireCondition(/^\+?[0-9]{7,15}$/.test(patch.whatsappPhone), "Use a phone number with country code.");
    if (patch.avatarUrl) {
      const objectPath = patch.avatarUrl.startsWith("/api/storage") ? patch.avatarUrl.slice("/api/storage".length) : patch.avatarUrl;
      requireCondition(objectPath.startsWith("/objects/uploads/"), "Upload your profile photo through the app.");
      const owned = await q.query("SELECT data FROM ut_uploads WHERE object_path=$1 AND owner_id=$2", [objectPath, p.id]);
      requireCondition(owned.rows[0]?.data.contentType?.startsWith("image/"), "Upload an image from your own account.");
      patch.avatarUrl = objectPath;
    }
    Object.assign(person, patch);
    await save(q, "people", person);
    if (body.isActive !== undefined) {
      const identity = await q.query("SELECT clerk_id FROM ut_people WHERE id=$1", [id]);
      if (identity.rows[0]?.clerk_id) {
        if (body.isActive) await clerkClient.users.unbanUser(identity.rows[0].clerk_id);
        else await clerkClient.users.banUser(identity.rows[0].clerk_id);
      }
    }
    return person;
  });
  res.json(UpdateMemberResponse.parse(person));
});
router.post("/tags", async (req, res): Promise<void> => {
  adminOnly(res.locals.person);
  const body = SaveTagBody.parse(req.body);
  requireCondition(/^#[0-9a-fA-F]{6}$/.test(body.colour), "Choose a valid hex colour.");
  const { id, ...data } = body;
  let tag: Tag;
  if (id) {
    tag = (await get<Tag>(pool, "tags", id))!;
    requireCondition(tag, "Project tag not found.", 404);
    Object.assign(tag, data);
    await save(pool, "tags", tag);
  } else {
    tag = await insert<Tag>(pool, "tags", { ...data, name: data.name.trim(), isActive: data.isActive ?? true });
  }
  res.json(SaveTagResponse.parse(tag));
});
router.delete("/demo", async (_req, res): Promise<void> => {
  const p: Person = res.locals.person;
  adminOnly(p);
  await transaction(async (q) => {
    const demos = await list<Ticket>(q, "tickets", "data->>'isDemo'='true'");
    // Keep audit history forever, including the fact that demo tickets were removed.
    for (const t of demos) await log(q, t, p, "demo_removed", t.code, null, "Admin removed demo ticket");
    const ids = demos.map((t) => t.id);
    await q.query("DELETE FROM ut_notifications WHERE ticket_id=ANY($1::int[])", [ids]);
    await q.query("DELETE FROM ut_tickets WHERE id=ANY($1::int[])", [ids]);
  });
  res.json({ success: true });
});
export default router;
