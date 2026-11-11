import { Router, type IRouter } from "express";
import { Readable } from "node:stream";
import { RequestUploadUrlBody, RequestUploadUrlResponse, type Person, type Ticket, type Comment, type Settings } from "@workspace/api-zod";
import { pool, insert, list, get, requireCondition } from "../lib/store";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  const body = RequestUploadUrlBody.parse(req.body);
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  await insert(pool, "uploads", body, { owner_id: p.id, object_path: objectPath });
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
});
router.get("/storage/objects/{*path}", async (req, res): Promise<void> => {
  const p: Person = res.locals.person;
  const path = req.params.path;
  const objectPath = `/objects/${Array.isArray(path) ? path.join("/") : path}`;
  const registered = await pool.query("SELECT owner_id,data FROM ut_uploads WHERE object_path=$1", [objectPath]);
  const upload = registered.rows[0];
  requireCondition(upload, "File not found.", 404);
  let allowed = upload.owner_id === p.id || p.role === "admin";
  if (!allowed) {
    const settings = (await get<Settings>(pool, "settings", 1))!;
    const tickets = await list<Ticket>(pool, "tickets", settings.membersSeeAllTickets ? "TRUE" : "(assignee_id=$1 OR creator_id=$1 OR $1=ANY(watcher_ids))", settings.membersSeeAllTickets ? [] : [p.id]);
    const ids = tickets.map((t) => t.id);
    const comments = await list<Comment>(pool, "comments", "ticket_id=ANY($1::int[])", [ids]);
    allowed = [...tickets, ...comments].some((t) => t.attachments.some((a) => a.objectPath === objectPath));
    if (!allowed) {
      const photos = await pool.query("SELECT id FROM ut_people WHERE data->>'avatarUrl'=$1", [objectPath]);
      allowed = photos.rows.length > 0;
    }
  }
  requireCondition(allowed, "File not found.", 404);
  const file = await storage.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  requireCondition(Number(metadata.size) <= 10485760 && metadata.contentType === upload.data.contentType, "This file is not a valid attachment.");
  const response = await storage.downloadObject(file, 0);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "private, no-store");
  const name = String(upload.data.name).replace(/[^\w.\- ]/g, "_");
  res.set("Content-Disposition", `inline; filename="${name}"`);
  if (response.body) Readable.fromWeb(response.body as never).pipe(res);
  else res.end();
});
export default router;
