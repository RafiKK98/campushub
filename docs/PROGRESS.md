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

## Milestone 2 - Authentication and role-based access control

Status: Complete

- [x] Added validated authentication environment variables for JWT, cookies, proxy trust, and the frontend origin.
- [x] Added `jose` HS256 access tokens with issuer/audience validation and the user ID as `sub`.
- [x] Added bcryptjs password verification with a dummy hash for unknown/inactive users and generic login errors.
- [x] Added HttpOnly, SameSite, production-Secure session cookies with `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and `GET /api/v1/auth/me`.
- [x] Added database-authoritative `authenticate` and `requireRole` middleware; token role claims are not trusted.
- [x] Added Helmet, an Origin guard for unsafe browser requests, login rate limiting, structured errors, and request validation.
- [x] Documented that `TRUST_PROXY` must match the real proxy hop count; for Vercel -> Render it is often `2`, and `true` is unsafe.
- [x] Added integration coverage for authentication, logout, RBAC, origin checks, rate limiting (including spoofed `X-Forwarded-For` prefixes), security headers, and sensitive-field exposure.

### Verification

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`: passed.
- `pnpm test`: 19 passed.
- Security audit approved; commit `aeca20e24a9e55fff44e484ab6f7ce298dfed1e2`.
- The committed suite initially had a rate-limiter helper regression; the working tree now uses `ipKeyGenerator` and the rate-limit test passes.

## Milestone 3 - Courses and enrollments

Status: Complete

- [x] Added shared, admin, instructor, and student course routers under `/api/v1`.
- [x] Added course list/detail, admin create/update/status/delete, instructor own-course list, and admin/instructor rosters.
- [x] Added student enrollment, drop, and own-course listing with server-derived student ownership.
- [x] Enforced role-aware course visibility and ownership checks.
- [x] Added pagination, search, term, status, and roster filters.
- [x] Added transactional row locking for course mutations and enrollment capacity checks.
- [x] Added duplicate, capacity, open-status, invalid-instructor, and dependency protections.
- [x] Added course/enrollment integration tests and excluded compiled `dist` tests from Vitest.
- [x] No schema change or migration was required.

### Verification

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`: passed.
- `pnpm test`: 49 passed, including 30 new course/enrollment tests.
- Test coverage includes authorization, visibility, CRUD, deletion dependencies, enrollment/drop/re-enroll, capacity, concurrent enrollment, inactive/deleted sessions, rosters, and sensitive-field exposure.

## Milestone 4 - Assignments, submissions, and grading

Status: Complete

- [x] Added assignment CRUD and role-aware listing/detail endpoints under `/api/v1/assignments`, `/api/v1/instructor/assignments`, and `/api/v1/admin/assignments`.
- [x] Added student submission/resubmission, own-submission view, and submission listing endpoints.
- [x] Added instructor and admin submission listing and grading/feedback endpoints.
- [x] Enforced course ownership for instructors, enrollment checks for students, and admin override access.
- [x] Enforced deadline boundaries (resubmissions allowed before `dueAt`, late initial submissions allowed once, no updates after grading).
- [x] Protected assignments with graded submissions from non-admin `maxScore` or `dueAt` changes.
- [x] Added 50 integration tests in `backend/src/modules/assignments/assignment.test.ts` covering all permissions, deadlines, grading constraints, and concurrency.
- [x] No schema change or migration was required.

### Verification

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed.
- `pnpm test`: 3 test files, 99 tests passed (19 M2 auth, 30 M3 course/enrollment, 50 M4 assignment/submission/grading).

## Milestone 6 - Announcements and dashboards

Status: Complete

- [x] Added announcement listing, creation, update, and deletion under `/api/v1/announcements`.
- [x] Enforced strict creation rules: administrators publish global announcements only; instructors publish course-specific announcements only for courses they own; students cannot create announcements.
- [x] Enforced author-or-admin update and delete permissions, with `courseId` immutable and only `title`/`body` editable.
- [x] Added role-based visibility: admins see all; instructors see global plus own-course announcements; students see global plus enrolled-course announcements. Unrelated-course filters return an empty list without leaking data.
- [x] Added pagination, title/body search, and optional `courseId` filtering.
- [x] Added admin dashboard summary at `GET /api/v1/admin/overview` (students, instructors, open courses, active enrollments).
- [x] Added instructor dashboard summary at `GET /api/v1/instructor/overview` (own courses, distinct enrolled students, assignment counts, pending grading, graded submissions).
- [x] Added student dashboard summary at `GET /api/v1/student/overview` (enrolled courses, next 5 upcoming assignments with submission status, 5 recent visible announcements, grade summary).
- [x] Added 32 integration tests across announcement and dashboard modules.
- [x] No schema change or migration was required.

### Verification

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed.
- `pnpm test`: 5 test files, 131 tests passed (99 prior M1-M4/M5 tests plus 24 announcement and 8 dashboard tests).

## Milestone 7 - Frontend application and backend users module

Status: Complete

- [x] Implemented minimal admin user-management backend module at `/api/v1/admin/users` (`GET`, `POST`, `GET /:id`, `PATCH /:id`) with pagination, role/status filtering, search, normalized emails, securely hashed passwords, safe serialization (no password hash exposure), and admin self-protection (cannot deactivate self or change own role).
- [x] Added 26 backend integration tests covering user creation, duplicate email rejection (409), role authorization (403), input validation, password updates, end-to-end login with new password, and self-protection.
- [x] Configured the React + TypeScript + Vite frontend package with MUI v9, Emotion, React Router v7, TanStack Query v5, React Hook Form v7, Zod v4, Day.js, Vitest, JSDOM, and React Testing Library.
- [x] Built the typed relative API client (`/api/v1/...`) with `credentials: 'same-origin'`, error envelope handling, `ApiError` mapping, and query string helpers.
- [x] Added session bootstrap via `GET /api/v1/auth/me`, login, logout, and route guards (`ProtectedRoute`, `RoleRoute`, `RoleHomeRedirect`).
- [x] Built the responsive `AppShell` with role-based navigation tabs, mobile navigation menu, user profile summary, and sign-out action.
- [x] Implemented the **Administrator** journey: dashboard summary cards, user management (list, search, filter, create, edit, activate/deactivate), course management (list, filter, create, edit, status updates, delete, roster navigation), and global announcements.
- [x] Implemented the **Instructor** journey: dashboard workload summary, assigned courses list, roster view, assignment management (create, edit, delete), submission grading and feedback dialog, and course announcements.
- [x] Implemented the **Student** journey: dashboard summary (enrolled count, average grade, upcoming assignments, recent announcements), course catalogue (browse open courses, enroll), enrolled courses (view, drop), assignment submissions/resubmissions (with deadline and grading constraints), grades view, and announcements.
- [x] Added 20 frontend unit and component tests covering API client, date/number formatting, route guards, login page validation/submission, and role-based shell navigation.
- [x] No database schema changes were required.

### Verification

- Backend: `pnpm --dir backend format:check`, `pnpm --dir backend lint`, `pnpm --dir backend typecheck`, `pnpm --dir backend test` (157 passed across 6 test files), `pnpm --dir backend build`.
- Frontend: `pnpm --dir frontend format:check`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend test` (20 passed across 5 test files), `pnpm --dir frontend build`.

## Post-M7 extension - Public student registration

Status: Complete

- [x] Added public `POST /api/v1/auth/register` accepting only `name`, `email`, and `password`.
- [x] Always assigns `STUDENT` on the server; client-supplied `role`, `isActive`, and other privileged fields are stripped by Zod and never trusted.
- [x] Reused the shared bcrypt password helper (cost 12) and the existing session/JWT HTTP-only cookie flow, so registration signs the new student in immediately.
- [x] Normalized email (trim + lowercase) and returned `409 EMAIL_EXISTS` for duplicate addresses without leaking password hashes.
- [x] Added a dedicated per-IP registration rate limiter (`REGISTRATION_RATE_LIMIT_MAX`/`REGISTRATION_RATE_LIMIT_WINDOW_MS`).
- [x] Added `/register` with a MUI page using React Hook Form + Zod, including full name, email, password, and confirm-password validation.
- [x] Reused `AuthProvider`/TanStack Query: successful registration updates the `me` query and redirects to the student dashboard.
- [x] Added login-to-register and register-to-login links while preserving existing login/logout/RBAC behavior.
- [x] Added backend registration tests and frontend registration page tests.
- [x] No database schema change or migration was required.

### Verification

- Backend: `pnpm --dir backend format:check`, `pnpm --dir backend lint`, `pnpm --dir backend typecheck`, `pnpm --dir backend test` (164 passed across 7 test files), `pnpm --dir backend build`.
- Frontend: `pnpm --dir frontend format:check`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend test` (25 passed across 6 test files), `pnpm --dir frontend build`.


