import type { Person, Ticket } from "@workspace/api-zod";

export function fixturePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1, name: "Test person", email: "", designation: "Test", role: "member",
    colour: "#16857f", isActive: true, notifyEmailDigest: false, notifyPush: false, soundOn: false,
    ...overrides,
  };
}

export function fixtureTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1, code: "TEST-1", title: "Test task", description: "", assigneeId: 1, createdById: 2,
    watcherIds: [], status: "open", priority: "normal", dueAt: "2026-01-02T12:30:00.000Z",
    originalDueAt: "2026-01-02T12:30:00.000Z", createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z", rescheduleCount: 0, nudgeCount: 0,
    reopenCount: 0, isBlocked: false, blockedReason: "", attachments: [], isDemo: false,
    ...overrides,
  };
}
