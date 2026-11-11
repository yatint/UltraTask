import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildSnapshot, isOverdue } from "./task-insights";
import { fixturePerson, fixtureTicket } from "./task-test-fixtures";
import type { Activity } from "@workspace/api-zod";

const NOW = Date.parse("2026-11-12T12:00:00Z");

test("overdue includes blocked work but never done, closed, cancelled or declined", () => {
  assert.equal(isOverdue(fixtureTicket({ isBlocked: true }), NOW), true);
  for (const status of ["done", "closed", "cancelled", "declined"] as const) {
    assert.equal(isOverdue(fixtureTicket({ status }), NOW), false);
  }
  assert.equal(isOverdue(fixtureTicket({ dueAt: new Date(NOW).toISOString() }), NOW), false);
  assert.equal(isOverdue(fixtureTicket({ dueAt: "invalid" }), NOW), false);
});

test("lifetime counts include old completions and inactive owners, excluding samples by default", () => {
  const people = [fixturePerson(), fixturePerson({ id: 2, isActive: false })];
  const tickets = [
    fixtureTicket({ id: 1, status: "closed", doneAt: "2026-01-01T10:00:00Z", closedAt: "2026-01-04T10:00:00Z", wasOnTime: true }),
    fixtureTicket({ id: 2, assigneeId: 2, status: "closed", doneAt: "2026-01-03T10:00:00Z", wasOnTime: false }),
    fixtureTicket({ id: 3, isDemo: true }),
    fixtureTicket({ id: 4, isBlocked: true }),
    fixtureTicket({ id: 5, status: "done", doneAt: "2026-01-01T10:00:00Z" }),
    fixtureTicket({ id: 6, status: "cancelled" }),
    fixtureTicket({ id: 7, status: "declined" }),
  ];
  const snapshot = buildSnapshot(people, tickets, [], false, NOW);
  assert.equal(snapshot.members.length, 2);
  assert.equal(snapshot.totals.totalAssigned, 6);
  assert.equal(snapshot.totals.completed, 2);
  assert.equal(snapshot.totals.early, 1);
  assert.equal(snapshot.totals.onTime, 1);
  assert.equal(snapshot.totals.late, 1);
  assert.equal(snapshot.totals.open, 1);
  assert.equal(snapshot.totals.overdue, 1);
  assert.equal(snapshot.totals.waitingForCheck, 1);
  assert.equal(snapshot.totals.cancelled, 1);
  assert.equal(snapshot.totals.declined, 1);
  assert.equal(snapshot.totals.onTimeRate, 50);
  assert.deepEqual(snapshot.members[1].ticketIds.late, [2]);
  assert.equal(buildSnapshot(people, tickets, [], true, NOW).totals.totalAssigned, 7);
});

test("completion uses the deadline at marked done, not a later edit or confirmation time", () => {
  const ticket = fixtureTicket({
    status: "closed", dueAt: "2026-02-01T12:30:00Z", doneAt: "2026-01-03T10:00:00Z",
    closedAt: "2026-02-02T00:00:00Z",
  });
  const history: Activity[] = [{
    id: 1, ticketId: ticket.id, action: "marked_done", note: "", createdAt: ticket.doneAt!,
    fromValue: JSON.stringify({ dueAt: "2026-01-02T12:30:00Z" }),
  }];
  const snapshot = buildSnapshot([fixturePerson()], [ticket], history, false, NOW);
  assert.equal(snapshot.totals.late, 1);
  assert.equal(snapshot.totals.onTime, 0);
});

test("exact-deadline completion is on time but not early; unknown dates never invent a rate", () => {
  const snapshot = buildSnapshot([fixturePerson()], [
    fixtureTicket({ id: 1, status: "closed", doneAt: "2026-01-02T12:30:00.000Z" }),
    fixtureTicket({ id: 2, status: "closed", closedAt: "2026-02-01T12:00:00Z" }),
  ], [], false, NOW);
  assert.equal(snapshot.totals.onTime, 1);
  assert.equal(snapshot.totals.early, 0);
  assert.equal(snapshot.totals.unknownTiming, 1);
  assert.equal(snapshot.totals.onTimeRate, 100);
  const empty = buildSnapshot([fixturePerson()], [], [], false, NOW);
  assert.equal(empty.totals.onTimeRate, null);
  assert.equal(empty.members[0].counts.onTimeRate, null);
});

test("reopening removes the old completion and attribution uses the current/final owner", () => {
  const snapshot = buildSnapshot([fixturePerson(), fixturePerson({ id: 2 })], [
    fixtureTicket({ status: "in_progress", assigneeId: 2, reopenCount: 1, wasOnTime: null }),
  ], [], false, NOW);
  assert.equal(snapshot.members[0].counts.totalAssigned, 0);
  assert.equal(snapshot.members[1].counts.totalAssigned, 1);
  assert.equal(snapshot.totals.completed, 0);
  assert.equal(snapshot.totals.overdue, 1);
});
