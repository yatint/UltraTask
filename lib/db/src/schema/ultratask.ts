import { pgTable, serial, jsonb, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Small single-company document records. Every document is validated against
// the shared OpenAPI schema at the API boundary.
export const people = pgTable("ut_people", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  clerkId: text("clerk_id").unique(),
  data: jsonb("data").notNull(),
});
export const tickets = pgTable("ut_tickets", {
  id: serial("id").primaryKey(),
  assigneeId: integer("assignee_id").notNull().references(() => people.id),
  creatorId: integer("creator_id").notNull().references(() => people.id),
  watcherIds: integer("watcher_ids").array().notNull().default([]),
  data: jsonb("data").notNull(),
}, (t) => [index("ut_tickets_assignee").on(t.assigneeId), index("ut_tickets_creator").on(t.creatorId)]);
export const comments = pgTable("ut_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  data: jsonb("data").notNull(),
});
export const activities = pgTable("ut_activity", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  data: jsonb("data").notNull(),
});
export const extensions = pgTable("ut_extensions", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  data: jsonb("data").notNull(),
});
export const notifications = pgTable("ut_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => people.id),
  ticketId: integer("ticket_id").notNull(),
  data: jsonb("data").notNull(),
});
export const tags = pgTable("ut_tags", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
});
export const settings = pgTable("ut_settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
});
export const uploads = pgTable("ut_uploads", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => people.id),
  objectPath: text("object_path").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const overdueReminders = pgTable("ut_overdue_reminders", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  recipientId: integer("recipient_id").notNull().references(() => people.id),
  eventKey: text("event_key").notNull().unique(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ut_overdue_reminders_ticket").on(t.ticketId)]);
export const insertPersonSchema = createInsertSchema(people).omit({ id: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true });
