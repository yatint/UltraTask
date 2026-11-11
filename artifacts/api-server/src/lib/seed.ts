import type { Person, Ticket, Workspace, Settings, Tag, Activity, Extension, Comment, Notification } from "@workspace/api-zod";
import { transaction, insert } from "./store";

export const initialSettings: Settings = {
  companyName: "Ultramotiv", ticketPrefix: "UM", workingDays: [1, 2, 3, 4, 5, 6],
  membersSeeAllTickets: false, nudgeCooldownHours: 4,
};
const names = [
  ["Ninad Saraf", "Founder and CEO", "#12847e"],
  ["Ashutosh Babras", "Tech Lead", "#647ac6"],
  ["Archana Makhija", "Clinical Associate", "#b98263"],
  ["Sneha Dole", "Operations", "#bb7a9b"],
  ["Pratiksha Gangane", "Accounts Executive", "#bd9b4c"],
  ["Akanksha Patil", "Regulatory Affairs Specialist", "#8c78b2"],
  ["Soham Ghadi", "Social Media Intern", "#5f9a80"],
];
export function samplePeople(): Person[] {
  return names.map(([name, designation, colour], i) => ({
    id: i + 1, name, designation, colour, email: i === 0 ? "ceo@ultramotiv.com" : "",
    role: i === 0 ? "admin" : "member", isActive: true,
    notifyEmailDigest: true, notifyPush: true, soundOn: false, whatsappPhone: "",
  }));
}
export function sampleTags(): Tag[] {
  return ["MAURIS", "Kneesy", "Regulatory and QMS", "Accounts", "Marketing", "Operations", "General"].map((name, i) => ({
    id: i + 1, name, colour: ["#16857f", "#648bc2", "#9273b6", "#b79848", "#ca7a96", "#60978a", "#82949e"][i], isActive: true,
  }));
}
export function previewWorkspace(): Workspace {
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 86400000).toISOString();
  const due = (days: number) => {
    const day = new Date(now + 19800000 + days * 86400000).toISOString().slice(0, 10);
    return new Date(`${day}T18:00:00+05:30`).toISOString();
  };
  const items: [string, number, number, number, Ticket["status"], number, Ticket["priority"]][] = [
    ["Get 3 quotations for ESD table", 4, 1, 2, "accepted", 6, "normal"],
    ["Approve October vendor payments", 1, 5, 0, "open", 4, "high"],
    ["Update risk file for ISO 13485", 6, 1, -5, "in_progress", 3, "urgent"],
    ["Fix motor driver firmware bug", 2, 1, -1, "done", 1, "high"],
    ["Patient trial schedule for MAURIS", 3, 1, 1, "in_progress", 1, "high"],
    ["3 reels for product launch", 7, 1, 1, "open", 5, "normal"],
    ["Renew company insurance", 1, 1, 7, "open", 6, "normal"],
    ["Share MAURIS spec sheet with distributor", 2, 4, 2, "accepted", 1, "normal"],
    ["Finalize Kneesy assembly checklist", 2, 1, -2, "closed", 2, "normal"],
    ["Review clinical trial consent forms", 3, 1, -4, "closed", 3, "normal"],
    ["Review MAURIS product brochure", 1, 7, -2, "in_progress", 5, "high"],
    ["Confirm supplier purchase order", 1, 4, -1, "accepted", 6, "normal"],
    ["Review Kneesy enclosure drawings", 1, 2, 2, "in_progress", 2, "normal"],
    ["Update distributor pricing sheet", 5, 1, 3, "declined", 4, "normal"],
    ["Book old venue for launch", 4, 1, 4, "cancelled", 6, "low"],
  ];
  const tickets: Ticket[] = items.map(([title, assigneeId, createdById, days, status, projectTagId, priority], i) => ({
    id: i + 1, code: `UM-${String(i + 1).padStart(4, "0")}`, title, assigneeId, createdById, status,
    projectTagId, priority, description: [
      "Collect three comparable quotations, including delivery timelines and warranty details. Share your recommendation for approval.",
      "Review outstanding vendor invoices and confirm payments for October.",
      "Update the risk management file with the latest review findings before the upcoming quality audit.",
      "Resolve the motor driver issue identified during MAURIS validation. Attach the test results for review.",
      "Coordinate the upcoming hospital trial dates and confirm patient availability.",
    ][i] || "Please coordinate with the team and share an update here when ready.",
    dueAt: due(days), originalDueAt: due(i === 2 ? -8 : days),
    createdAt: ago(i === 5 ? 1.25 : Math.max(2, 8 - days)), updatedAt: ago(i % 3),
    watcherIds: [], rescheduleCount: i === 2 ? 1 : 0, nudgeCount: i === 2 ? 2 : 0, reopenCount: 0,
    lastNudgedAt: i === 2 ? ago(1) : null,
    isBlocked: i === 4, blockedReason: i === 4 ? "Need hospital confirmation" : "",
    blockedOnUserId: i === 4 ? 1 : null, acceptedAt: status !== "open" ? ago(2) : null,
    doneAt: ["done", "closed"].includes(status) ? ago(i === 9 ? 2 : 3) : null,
    closedAt: status === "closed" ? ago(1) : null, wasOnTime: status === "closed" ? i === 8 : null,
    attachments: [], isDemo: true,
  }));
  const activities: Activity[] = tickets.map((t, i) => ({
    id: i + 1, ticketId: t.id, actorId: t.createdById, action: "created",
    note: "Created ticket", fromValue: null, toValue: t.status, createdAt: t.createdAt,
  }));
  const extensions: Extension[] = [{
    id: 1, ticketId: 8, requestedById: 2, currentDueAt: due(2), proposedDueAt: due(5),
    reason: "Waiting for the updated specification from the vendor.", status: "pending", decisionNote: "",
  }];
  const comments: Comment[] = [{
    id: 1, ticketId: 4, authorId: 2, body: "Firmware fix is ready. Bench testing passed; please review the changes.", createdAt: ago(0.2), attachments: [],
  }];
  const notifications: Notification[] = [
    { id: 1, userId: 1, ticketId: 4, type: "done", message: "Ashutosh marked Fix motor driver firmware bug done. Ready for your check.", isRead: false, createdAt: ago(0.2) },
    { id: 2, userId: 1, ticketId: 2, type: "assigned", message: "Pratiksha assigned Approve October vendor payments to you.", isRead: false, createdAt: ago(0.4) },
    { id: 3, userId: 1, ticketId: 5, type: "blocked", message: "Archana is waiting on you: Need hospital confirmation.", isRead: false, createdAt: ago(0.7) },
  ];
  return { currentUser: samplePeople()[0], users: samplePeople(), tickets, tags: sampleTags(), comments, activities, extensions, notifications, settings: initialSettings, isPreview: true };
}
export function publicPreview(): Workspace {
  const sample = previewWorkspace();
  const fictional = ["Alex Morgan", "Jamie Patel", "Maya Rao", "Sam Mehta", "Priya Shah", "Riya Desai", "Dev Kapoor"];
  const replacements = sample.users.map((person, i) => ({
    from: person.name.split(" ")[0], to: fictional[i].split(" ")[0],
  }));
  sample.users = sample.users.map((person, i) => ({ ...person, name: fictional[i], email: "", whatsappPhone: "" }));
  sample.currentUser = sample.users[0];
  sample.notifications = sample.notifications.map((n) => ({
    ...n, message: replacements.reduce((message, r) => message.replaceAll(r.from, r.to), n.message),
  }));
  return sample;
}
export async function seedWorkspace(): Promise<void> {
  await transaction(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock(85914720)");
    const existing = await q.query("SELECT id FROM ut_settings WHERE id=1");
    if (existing.rowCount) return;
    const sample = previewWorkspace();
    for (const p of sample.users) {
      const { id, ...data } = p;
      await insert(q, "people", data, { id, email: p.email || null });
    }
    for (const tag of sample.tags) {
      const { id, ...data } = tag;
      await insert(q, "tags", data, { id });
    }
    for (const t of sample.tickets) {
      const { id, ...data } = t;
      await insert(q, "tickets", data, { id, creator_id: t.createdById, assignee_id: t.assigneeId, watcher_ids: t.watcherIds });
    }
    for (const [key, items] of [["comments", sample.comments], ["activity", sample.activities], ["extensions", sample.extensions]] as const) {
      for (const item of items) {
        const { id, ...data } = item;
        await insert(q, key, data, { id, ticket_id: item.ticketId });
      }
    }
    for (const n of sample.notifications) {
      const { id, ...data } = n;
      await insert(q, "notifications", data, { id, user_id: n.userId, ticket_id: n.ticketId });
    }
    await q.query("INSERT INTO ut_settings(id,data) VALUES(1,$1)", [JSON.stringify(initialSettings)]);
    for (const table of ["ut_people", "ut_tags", "ut_tickets", "ut_comments", "ut_activity", "ut_extensions", "ut_notifications"]) {
      await q.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT max(id) FROM ${table}),1))`);
    }
  });
}
