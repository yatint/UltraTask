import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import type { Person, Ticket } from "@workspace/api-zod";
import { canReadTask, canRespondToTask } from "./ticket-access";
import { fixturePerson, fixtureTicket } from "./task-test-fixtures";
import { ticketAction } from "./ticket-rules";
import { pool, insert, get } from "./store";
import { readableTicket } from "../middlewares/identity";

after(async () => { await pool.end(); });

test("unwatched personal work is private, including when team-wide visibility is enabled", () => {
  const owner = fixturePerson({ id: 1 });
  const admin = fixturePerson({ id: 3, role: "admin" });
  const other = fixturePerson({ id: 4 });
  const personal = fixtureTicket({ assigneeId: 1, createdById: 1 });
  for (const all of [true, false]) {
    assert.equal(canReadTask(owner, personal, all), true);
    assert.equal(canReadTask(admin, personal, all), false);
    assert.equal(canReadTask(other, personal, all), false);
  }
  assert.equal(canReadTask(admin, { ...personal, watcherIds: [4] }), true);
  assert.equal(canReadTask(other, { ...personal, watcherIds: [4] }), true);
  assert.equal(canReadTask(other, fixtureTicket()), false);
  assert.equal(canReadTask(other, fixtureTicket(), true), true);
});

test("only the actual owner can accept or decline someone else's ask", () => {
  const task = fixtureTicket();
  assert.equal(canRespondToTask(fixturePerson({ id: 1 }), task), true);
  assert.equal(canRespondToTask(fixturePerson({ id: 2 }), task), false);
  assert.equal(canRespondToTask(fixturePerson({ id: 3, role: "admin" }), task), false);
  assert.equal(canRespondToTask(fixturePerson({ id: 1, role: "admin" }), task), true);
  assert.equal(canRespondToTask(fixturePerson({ id: 1 }), { ...task, createdById: 1 }), false);
});

test("database transitions enforce owner responses, personal start-close and shared review", async () => {
  const q = await pool.connect();
  try {
    await q.query("BEGIN");
    const makePerson = (role: Person["role"]) => insert<Person>(q, "people", fixturePerson({ role }));
    const owner = await makePerson("member");
    const asker = await makePerson("member");
    const admin = await makePerson("admin");
    const makeTask = (self: boolean) => insert<Ticket>(q, "tickets", fixtureTicket({
      assigneeId: owner.id, createdById: self ? owner.id : asker.id,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    }), { assignee_id: owner.id, creator_id: self ? owner.id : asker.id, watcher_ids: [] });
    const personal = await makeTask(true);
    await assert.rejects(() => readableTicket(q, admin, personal.id), { status: 404 });
    assert.equal((await readableTicket(q, owner, personal.id)).id, personal.id);
    for (const action of ["accept", "decline"] as const) {
      await assert.rejects(() => ticketAction(q, owner, { ...personal }, { action, reason: "A test reason" }), { status: 403 });
    }
    await assert.rejects(() => ticketAction(q, owner, { ...personal }, {
      action: "request_extension", reason: "A test reason", proposedDueAt: new Date(Date.now() + 172800000).toISOString(),
    }), { status: 400 });
    let ownTask = await ticketAction(q, owner, personal, { action: "start" });
    assert.equal(ownTask.status, "in_progress");
    await assert.rejects(() => ticketAction(q, owner, { ...ownTask }, { action: "done" }), { status: 400 });
    ownTask = await ticketAction(q, owner, ownTask, { action: "close" });
    assert.equal(ownTask.status, "closed");
    assert.equal(ownTask.wasOnTime, true);
    const shared = await makeTask(false);
    for (const actor of [asker, admin]) for (const action of ["accept", "decline"] as const) {
      await assert.rejects(() => ticketAction(q, actor, { ...shared }, { action, reason: "A test reason" }), { status: 403 });
    }
    let task = await ticketAction(q, owner, shared, { action: "accept" });
    assert.equal(task.status, "accepted");
    task = await ticketAction(q, owner, task, { action: "start" });
    task = await ticketAction(q, owner, task, { action: "done" });
    assert.equal(task.status, "done");
    await assert.rejects(() => ticketAction(q, owner, { ...task }, { action: "close" }), { status: 403 });
    task = await ticketAction(q, asker, task, { action: "close" });
    assert.equal(task.status, "closed");
    assert.equal((await get<Ticket>(q, "tickets", task.id))?.status, "closed");
  } finally {
    await q.query("ROLLBACK");
    q.release();
  }
});
