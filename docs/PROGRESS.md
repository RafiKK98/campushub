# Progress

## Milestone 0 — Repository and project skeleton

Status: Complete

- [x] Inspected the local directory and confirmed the GitHub repository was empty.
- [x] Installed and activated Node.js 26.13.1 with pnpm.
- [x] Created the frontend and backend TypeScript packages.
- [x] Added ESLint, Prettier, type-check, build, and format scripts.
- [x] Added environment examples, Git ignore rules, and Node version pinning.
- [x] Added the application shell, Vite `/api` proxy, and `GET /api/health`.
- [x] Added initial README and progress documentation.
- [x] Initialized Git on `main`, configured `origin`, and prepared the initial commit.

## Milestone 1 — Database and backend foundation

Status: Complete

- [x] Pinned Prisma CLI, Prisma Client, and the PostgreSQL adapter to `7.10.1`.
- [x] Confirmed Prisma `7.10.1` generates `prisma7.config.ts`; no duplicate Prisma config was created.
- [x] Added all Section 5 models, enums, relations, indexes, unique constraints, and foreign-key behavior.
- [x] Created and applied the initial migration using the direct Neon connection.
- [x] Added a reusable Prisma client using `@prisma/adapter-pg` and the pooled runtime URL.
- [x] Added centralized Zod environment validation, structured logging, error handling, and request validation helpers.
- [x] Added an idempotent seed script with fictional users, courses, enrollments, assignments, submissions, and announcements.
- [x] Added a database readiness endpoint at `GET /api/ready`.
- [x] Documented database commands and updated environment placeholders.

### Verification

- `prisma validate`: passed.
- `prisma generate`: passed with Prisma `7.10.1` and `prisma-client`.
- `prisma generate` with `DIRECT_URL` absent: passed; migration commands then failed clearly with `Connection url is empty` instead of using another database.
- Runtime connectivity: `SELECT 1` through `@prisma/adapter-pg` succeeded against Neon.
- `prisma migrate dev --name init`: created and applied `20261121043600_init` using `DIRECT_URL`.
- `prisma migrate status`: database is up to date.
- `prisma migrate deploy`: no pending migrations.
- `prisma db seed`: completed; second run produced the same counts, confirming idempotency.
- Seeded data: 13 users, 5 courses, 19 enrollments, 7 assignments, 11 submissions, 6 announcements.
- Relationship query: confirmed the `CSE-2201` instructor role, 5 enrollments, 2 assignments, and 1 announcement; confirmed a student's enrollments and submissions.
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`: passed.
- `pnpm install --frozen-lockfile` triggered the Prisma `postinstall` generation successfully.
- `pnpm dev` and `node dist/server.js`: started successfully; `/api/health` and `/api/ready` both returned `200`.
- `.env` and generated Prisma client are Git-ignored; no Neon credentials are tracked.

### Remaining limitations

- Authentication, password verification, and role enforcement begin in Milestone 2.
- The seed uses a shared bcrypt hash for the fictional demo accounts. Demo-password handling will be finalized with authentication.
- The seed logs a `pg` SSL-mode deprecation warning because the direct URL uses `sslmode=require`; runtime uses the explicit `verify-full` mode.
- Prisma `7.10.1` emits a preinstall warning about its listed Node.js support range on Node `26.13.1`, but schema validation, generation, migrations, seeding, and runtime connectivity all passed.
- Request validation and logging helpers are in place but are not yet used by feature routes.
- Local Docker Compose PostgreSQL and automated backend tests arrive in later milestones.
