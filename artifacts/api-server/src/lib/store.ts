import { pool } from "@workspace/db";

const openConnection = () => pool.connect();
export type Connection = Awaited<ReturnType<typeof openConnection>>;
export type Store = Pick<Connection, "query">;
export const tables = {
  people: "ut_people", tickets: "ut_tickets", comments: "ut_comments",
  activity: "ut_activity", extensions: "ut_extensions", notifications: "ut_notifications",
  tags: "ut_tags", settings: "ut_settings", uploads: "ut_uploads",
} as const;
export type Table = keyof typeof tables;
export function unpack<T>(row: { id: number; data: unknown }): T {
  return { ...(row.data as object), id: row.id } as T;
}
export async function list<T>(q: Store, table: Table, where = "TRUE", values: unknown[] = []): Promise<T[]> {
  const result = await q.query(`SELECT id,data FROM ${tables[table]} WHERE ${where} ORDER BY id`, values);
  return result.rows.map((r) => unpack<T>(r));
}
export async function get<T>(q: Store, table: Table, id: number, lock = false): Promise<T | undefined> {
  const r = await q.query(`SELECT id,data FROM ${tables[table]} WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  return r.rows[0] ? unpack<T>(r.rows[0]) : undefined;
}
export async function insert<T>(q: Store, table: Table, data: object, columns: Record<string, unknown> = {}): Promise<T> {
  const names = Object.keys(columns);
  // Column names are supplied only by this module's trusted callers, never HTTP input.
  const r = await q.query(
    `INSERT INTO ${tables[table]} (data${names.length ? "," + names.join(",") : ""}) VALUES ($1${names.map((_, i) => `,$${i + 2}`).join("")}) RETURNING id,data`,
    [JSON.stringify(data), ...Object.values(columns)],
  );
  return unpack<T>(r.rows[0]);
}
export async function save(q: Store, table: Table, value: { id: number }, columns: Record<string, unknown> = {}) {
  const { id, ...data } = value;
  const names = Object.keys(columns);
  await q.query(`UPDATE ${tables[table]} SET data=$1${names.map((n, i) => `,${n}=$${i + 3}`).join("")} WHERE id=$2`, [
    JSON.stringify(data), id, ...Object.values(columns),
  ]);
}
export async function transaction<T>(fn: (q: Connection) => Promise<T>): Promise<T> {
  const q = await pool.connect();
  try {
    await q.query("BEGIN");
    const value = await fn(q);
    await q.query("COMMIT");
    return value;
  } catch (e) {
    await q.query("ROLLBACK");
    throw e;
  } finally { q.release(); }
}
export { pool };
export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: object) { super(message); }
}
export function requireCondition(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new HttpError(status, message);
}
