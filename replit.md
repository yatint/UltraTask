# UltraTask

Invitation-only internal task tracking for Ultramotiv's rehabilitation robotics team.

## Product and scope

- Build Phase 1 first; later-phase additions require the user's explicit approval.
- One company, one team, one owner and a required due date per task.
- The assignee marks work done; the creator or an admin confirms and closes it.
- Personal tasks skip acceptance and move from open to in progress to closed.
- Audit history is append-only. There is no comment deletion.
- The user explicitly approved overdue reminders and a lifetime Team snapshot.
  Other Phase 2 features remain deferred: digests, web push, escalations,
  CSV export and holidays.
- Reminder delivery is currently in-app only; the user dismissed the Resend
  connection. Never report email as sent without a connected delivery provider.
- System overdue alerts run once per task/deadline/owner per India calendar day.
  They check every minute while the server runs and catch up on workspace loads.
  Autoscale may sleep: do not promise continuous closed-app scheduling. Reliable
  email/background schedules need a durable scheduler or always-running worker.
- Snapshot uses all retained tasks, including old completions and inactive people.
  Assignments are attributed to current/final owner. Completed means confirmed
  closed, not awaiting check. Early is included in on-time; approval delays do not
  make timely work late. Sample tasks are excluded from real totals by default.
- Phase 3 is explicitly deferred until four weeks of real use.
- The uploaded UltraTask brief is the detailed requirements source.

## Run and operate

- API workflow: `artifacts/api-server: API Server`
- Web workflow: `artifacts/ultratask: web`
- `pnpm run typecheck` — workspace typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API contracts
- `pnpm --filter @workspace/db run push` — development schema only
- Use managed workflows, not manually launched dev servers.

## Stack and locations

- React, TypeScript, Tailwind, Wouter and React Query in `artifacts/ultratask`.
- Express API in `artifacts/api-server`.
- OpenAPI contract in `lib/api-spec/openapi.yaml`.
- PostgreSQL through `@workspace/db`; schema in `lib/db/src/schema`.
- Clerk manages verified sign-in, passwords, Google sign-in and invitation emails.
- App Storage holds private uploaded images/PDFs; PostgreSQL stores metadata only.
- Frontend theme in `artifacts/ultratask/src/index.css`.

## Identity and data access

- First founder account is preapproved by the verified email in the supplied brief.
  It is not an automatically authenticated account or a shared password.
- Founder creates the first account through `/sign-up`, verifies that email, and
  then uses Settings → Team & invites to add missing work emails and invite others.
- Never invent emails for the six seeded teammates whose emails were not supplied.
- Later users must have an active invitation record; first account linking checks
  the invitation's seven-day expiry. Existing linked accounts do not expire.
- Sign-in alone does not authorize company data. The server checks the local
  active person, role, ticket relationship and visibility setting.
- `/api/preview` generates independent public sample data with fictional names and
  no contact details, never live team data.
- API writes derive the current actor from Clerk, not request payloads.
- Task transitions and nudges lock the ticket row in a database transaction.
- Nudges have a four-hour per-ticket cooldown.
- Demo deletion preserves audit history and never reseeds deleted tickets.

## Time and files

- Store UTC instants, display Asia/Kolkata in 12-hour format.
- Pending age uses calendar-day boundaries in IST, not elapsed 24-hour periods.
- Date-only due dates use 6 PM IST; creation never preselects a due date.
- Uploads use authenticated presigned URLs, image/PDF allowlisting and 10 MB limits.
- Private downloads recheck current ticket access or profile-image visibility.
- Do not cache authenticated API responses or file contents in the service worker.

## Design direction

- Brand the product as **UltraTask by Ultramotiv**, using the supplied Ultramotiv
  logo at its original aspect ratio, not a recreated or stretched symbol.
- The user rejected the initial serif/editorial typography and basic visual design.
  Use readable sans-serif typography throughout; prioritize the task workspace over
  a large introductory banner, especially on mobile.
- User benchmarks: Apple animation, Duolingo onboarding, Linear UI, Pentagram type,
  Muji minimalism, Airbnb search, Aesop art direction, Notion dashboards,
  Stripe landing pages and Framer micro-interactions.
- Interpret these as references, not permission to add gamification or out-of-scope modules.
- Follow reduced-motion settings; sound is off by default.

## Authentication environments

Clerk development and production use separate account stores. A development login
does not establish a production login. Runtime initialization seeds the approved
founder email and team templates in the target database without copying Clerk IDs.
Publishing applies the managed database schema; do not add startup-time DDL.
