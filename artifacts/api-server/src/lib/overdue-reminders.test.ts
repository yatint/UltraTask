import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { Person, Settings, Ticket } from "@workspace/api-zod";
import { automaticReminderKey, deliverOverdueReminder } from "./overdue-reminders";
import { pool, get, insert, save } from "./store";
import { fixturePerson, fixtureTicket } from "./task-test-fixtures";

after(async () => { await pool.end(); });

test("automatic keys use IST days, owner and deadline", () => {
  const task = fixtureTicket();
  const beforeMidnight = Date.parse("2026-11-12T18:29:59Z");
  const afterMidnight = Date.parse("2026-11-12T18:30:00Z");
  assert.notEqual(automaticReminderKey(task, beforeMidnight), automaticReminderKey(task, afterMidnight));
  assert.notEqual(automaticReminderKey(task, beforeMidnight), automaticReminderKey({ ...task, assigneeId: 2 }, beforeMidnight));
  assert.notEqual(automaticReminderKey(task, beforeMidnight), automaticReminderKey({ ...task, dueAt: "2026-01-01T12:30:00Z" }, beforeMidnight));
});

test("real database reminder delivery is atomic, permissioned, deduplicated and honest about email", async () => {
  const q = await pool.connect();
  try {
    await q.query("BEGIN");
    const makePerson = async (role: Person["role"]) => {
      const email = `qa-reminder-${randomUUID()}@example.com`;
      return insert<Person>(q, "people", fixturePerson({ role, email }), { email });
    };
    const admin = await makePerson("admin");
    const owner = await makePerson("member");
    const other = await makePerson("member");
    const asker = await makePerson("member");
    const now = Date.now();
    const ticket = await insert<Ticket>(q, "tickets", fixtureTicket({
      assigneeId: owner.id, createdById: asker.id, dueAt: new Date(now - 86_400_000).toISOString(),
    }), { assignee_id: owner.id, creator_id: asker.id, watcher_ids: [] });
    const result = await deliverOverdueReminder(q, ticket, admin, now);
    assert.equal(result?.recipientId, owner.id);
    assert.equal(result?.inAppStatus, "sent");
    assert.equal(result?.emailStatus, "not_connected");
    assert.match(result!.message, /no email was sent/i);
    assert.equal((await get<Ticket>(q, "tickets", ticket.id))!.nudgeCount, 1);
    await assert.rejects(() => deliverOverdueReminder(q, ticket, admin, now + 1000), { status: 429 });
    await assert.rejects(() => deliverOverdueReminder(q, ticket, other, now), { status: 403 });
    for (const overrides of [{ status: "done" as const }, { dueAt: new Date(now + 86_400_000).toISOString() }, { isDemo: true }]) {
      await assert.rejects(() => deliverOverdueReminder(q, { ...ticket, ...overrides }, admin, now), { status: 400 });
    }
    const auto = await deliverOverdueReminder(q, ticket, null, now);
    assert.equal(auto?.inAppStatus, "sent");
    assert.equal(await deliverOverdueReminder(q, ticket, null, now), undefined);
    assert.equal(await deliverOverdueReminder(q, { ...ticket, status: "done" }, null, now), undefined);
    assert.equal(await deliverOverdueReminder(q, { ...ticket, isDemo: true }, null, now), undefined);
    assert.equal((await deliverOverdueReminder(q, ticket, null, now + 86_400_000))?.inAppStatus, "sent");
    const settings = (await get<Settings>(q, "settings", 1))!;
    ticket.watcherIds = [other.id];
    assert.equal((await deliverOverdueReminder(q, ticket, other, now + (settings.nudgeCooldownHours + 1) * 3_600_000))?.inAppStatus, "sent");
    const records = await q.query("SELECT data FROM ut_notifications WHERE ticket_id=$1 ORDER BY id", [ticket.id]);
    assert.equal(records.rowCount, 4);
    assert.equal(records.rows[0].data.type, "overdue_manual");
    assert.equal(records.rows[1].data.type, "overdue_system");
    assert.equal((await q.query("SELECT id FROM ut_overdue_reminders WHERE ticket_id=$1", [ticket.id])).rowCount, 4);
    assert.equal((await q.query("SELECT id FROM ut_activity WHERE ticket_id=$1 AND data->>'action' LIKE 'overdue_%'", [ticket.id])).rowCount, 4);
    owner.isActive = false;
    await save(q, "people", owner);
    assert.equal(await deliverOverdueReminder(q, ticket, null, now + 2 * 86_400_000), undefined);
    await assert.rejects(() => deliverOverdueReminder(q, ticket, admin, now + 2 * 86_400_000), { status: 400 });
  } finally {
    // No visible QA users, tasks or notifications survive this test.
    await q.query("ROLLBACK");
    q.release();
  }
});
