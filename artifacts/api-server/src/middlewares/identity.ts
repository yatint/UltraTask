import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import type { Person, Settings, Ticket } from "@workspace/api-zod";
import { pool, unpack, HttpError, requireCondition, type Store, get } from "../lib/store";

export const requirePerson: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to continue." }); return; }
  const found = await pool.query("SELECT id,data FROM ut_people WHERE clerk_id=$1", [userId]);
  let person = found.rows[0] ? unpack<Person>(found.rows[0]) : undefined;
  if (!person) {
    const account = await clerkClient.users.getUser(userId);
    const email = account.emailAddresses.find((e) =>
      e.id === account.primaryEmailAddressId && e.verification?.status === "verified"
    )?.emailAddress.toLowerCase();
    requireCondition(email, "Verify your work email before continuing.", 403);
    const invited = await pool.query("SELECT id,data FROM ut_people WHERE lower(email)=$1", [email]);
    person = invited.rows[0] ? unpack<Person>(invited.rows[0]) : undefined;
    requireCondition(person, "Ask your admin for an invite.", 403);
    requireCondition(person.isActive, "Your account has been deactivated. Contact your admin.", 403);
    const founderSetup = person.email === "ceo@ultramotiv.com" && person.role === "admin" && !person.invitedAt;
    requireCondition(founderSetup || (person.invitedAt && Date.now() - new Date(person.invitedAt).getTime() <= 7 * 86400000),
      "Your invitation has expired. Ask your admin to resend it.", 403);
    const linked = await pool.query("UPDATE ut_people SET clerk_id=$1 WHERE id=$2 AND (clerk_id IS NULL OR clerk_id=$1) RETURNING id", [userId, person.id]);
    requireCondition(linked.rowCount, "This invitation belongs to another account.", 403);
  }
  requireCondition(person.isActive, "Your account has been deactivated. Contact your admin.", 403);
  res.locals.person = person;
  next();
};
export function isAdmin(p: Person) { return p.role === "admin"; }
export function involved(p: Person, t: Ticket) {
  return isAdmin(p) || t.assigneeId === p.id || t.createdById === p.id || t.watcherIds.includes(p.id);
}
export function manages(p: Person, t: Ticket) { return isAdmin(p) || t.createdById === p.id; }
export function works(p: Person, t: Ticket) { return isAdmin(p) || t.assigneeId === p.id; }
export function adminOnly(p: Person) { requireCondition(isAdmin(p), "Admin access required.", 403); }
export async function readableTicket(q: Store, p: Person, id: number, lock = false) {
  const t = await get<Ticket>(q, "tickets", id, lock);
  if (!t) throw new HttpError(404, "Ticket not found.");
  const settings = await get<Settings>(q, "settings", 1);
  requireCondition(involved(p, t) || settings?.membersSeeAllTickets, "Ticket not found.", 404);
  return t;
}
const attempts = new Map<string, { count: number; until: number }>();
export const limitWrites: RequestHandler = (req, res, next) => {
  if (req.method === "GET") { next(); return; }
  const origin = req.get("origin");
  if (origin) {
    const expected = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
    requireCondition(new URL(origin).host === expected, "Cross-site requests are not allowed.", 403);
  }
  const key = `${res.locals.person?.id || req.ip}:${req.path}`;
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.until < now) { entry = { count: 0, until: now + 60000 }; attempts.set(key, entry); }
  if (attempts.size > 10000) for (const [k, value] of attempts) if (value.until < now) attempts.delete(k);
  if (++entry.count > 50) { res.status(429).json({ error: "Too many requests. Try again in a minute." }); return; }
  next();
};
