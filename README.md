# CampusHub

CampusHub is a role-based university student portal built as a full-stack portfolio project. It demonstrates a React + TypeScript frontend, an Express + TypeScript API, PostgreSQL with Prisma, backend-enforced authorization, automated tests, a Docker Compose stack, a GitHub Actions quality gate, GHCR backend image publishing, and automated Vercel/Neon deployment. The Milestone 10 deployment pipeline is implemented locally; the first live production deployment is still pending.

**Repository:** https://github.com/RafiKK98/campushub

[![CI](https://github.com/RafiKK98/campushub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RafiKK98/campushub/actions/workflows/ci.yml)

## Current status

Milestones 1-8 are complete: the full-stack application includes the Prisma 7 schema, the initial Neon migration, an idempotent seed script, centralized environment validation, logging, error handling, database readiness checks, authentication and role-based authorization, admin user-management APIs, course/enrollment APIs, assignment/submission/grading APIs, announcement APIs, role-specific dashboard summaries, a complete React single-page portal covering Admin, Instructor, and Student journeys, and a Docker Compose stack for PostgreSQL, migrations, the production API image, and the Nginx-served frontend.

Milestone 9 is complete: pull requests and pushes to `main` run the GitHub Actions quality gate, and a successful main-branch run publishes the backend production image to GHCR with immutable commit-SHA and `latest` tags. The workflow has run successfully on GitHub, and the public GHCR package is available.

Milestone 10 adds the hosted deployment implementation: two Vercel projects from the same repository, a Neon production database, a Prisma PostgreSQL pool attached to Vercel’s request lifecycle, a frontend `/api` rewrite, and main-branch GitHub Actions jobs for production migrations, backend deployment, frontend deployment, and health/readiness smoke checks. Provider resources and the first live deployment are not yet configured.

A post-M7 extension adds public student self-registration at `/register`. Registration always creates an active `STUDENT`, signs the new account in through the same HTTP-only session cookie used by login, and never accepts a role or active status from the client. Instructor and admin accounts are still created by administrators.

See [CAMPUSHUB_PROJECT_PLAN.md](./CAMPUSHUB_PROJECT_PLAN.md) for the full specification and milestone order.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js 26 LTS, Express 5, TypeScript
- Database: PostgreSQL with Prisma 7.10.1 and Neon
- Tooling: pnpm, ESLint, Prettier
- Delivery: Docker Compose (local); GitHub Actions CI, GHCR backend image publishing, and Vercel/Neon deployment

## Repository layout

```text
campushub/
├── frontend/                 React + Vite application
│   ├── Dockerfile            Vite build + Nginx runtime image
│   ├── nginx.conf            SPA fallback and /api reverse proxy
│   └── vercel.json           Vercel /api rewrite and SPA fallback
├── backend/                  Express API, Prisma schema, migrations, and seed
│   └── Dockerfile            API build, migrate, and runtime stages
├── docker-compose.yml        Local PostgreSQL + migrate + API + Nginx stack
├── docs/                     Project documentation and progress
├── .github/workflows/ci.yml  CI, GHCR publishing, migrations, and Vercel deployment
├── .env.example              Docker Compose placeholders
├── .gitignore
├── .prettierrc
├── package.json              Root convenience scripts
└── CAMPUSHUB_PROJECT_PLAN.md
```

The frontend and backend are independent pnpm packages. Each has its own `pnpm-lock.yaml`, which keeps Docker build contexts and the Vercel project root straightforward.

## Prerequisites

- Node.js 26 LTS
- pnpm 10
- Git
- Docker Desktop with Docker Compose v2+ (for the containerized stack)

The repository includes `.nvmrc` with the selected Node version. If you use `pnpm` to manage Node versions:

```bash
pnpm env use --global 26.13.1
```

## Install

```bash
pnpm --dir backend install
pnpm --dir frontend install
```

The backend `postinstall` script generates the Prisma client from `backend/prisma/schema.prisma`. Generated client files are ignored by Git.

## Run locally

Start the API:

```bash
pnpm dev:backend
```

In a second terminal, start the frontend:

```bash
pnpm dev:frontend
```

Open:

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health
- API readiness: http://localhost:4000/api/ready
- Frontend-proxied health: http://localhost:5173/api/health

Vite proxies `/api` requests to the backend, so the browser uses one origin during development.

## Run with Docker Compose

The local Compose stack runs four services on a private bridge network:

| Service | Purpose | Host access |
|---|---|---|
| `db` | PostgreSQL 17 with the `campushub_postgres_data` volume | internal only |
| `migrate` | One-shot `prisma migrate deploy` runner | none |
| `api` | Production Express build (`node dist/server.js`) | internal only |
| `web` | Nginx serving the Vite build and proxying `/api` | http://localhost:8080 |

Prepare the Compose environment file:

```powershell
Copy-Item .env.example .env
```

Set a URL-safe `POSTGRES_PASSWORD` and a `JWT_SECRET` of at least 32 characters. `DEMO_PASSWORD` controls the seeded demo accounts and defaults to `CampusHubDemo!2026`.

Build and start:

```bash
docker compose up --build -d
```

Seed the demo data once (the `migrate` image already contains the seed script):

```bash
docker compose run --rm migrate pnpm db:seed
```

Open http://localhost:8080. Use `localhost`, not `127.0.0.1`, so the API origin check matches `FRONTEND_ORIGIN`.

Demo accounts (password: `DEMO_PASSWORD`):

- `admin@campushub.local` (admin)
- `maya.chen@campushub.local` (instructor)
- `daniel.okafor@campushub.local` (instructor)
- `priya.patel@campushub.local` (student)

Common commands:

| Command | Purpose |
|---|---|
| `docker compose ps` | Show service and health status |
| `docker compose logs -f api` | Follow API logs |
| `docker compose logs -f web` | Follow Nginx logs |
| `docker compose run --rm migrate pnpm exec prisma migrate status` | Check migration status |
| `docker compose run --rm migrate pnpm exec prisma migrate deploy` | Apply pending migrations manually |
| `docker compose down` | Stop the stack and keep the database volume |

`docker compose down -v` deletes the `campushub_postgres_data` volume and all local data. Use it only when a destructive reset is intended; then run `docker compose up --build -d` and seed again.

Compose uses the root `.env` and injects `db:5432` connection URLs into the `migrate` and `api` services. It does not read `backend/.env`. The API runs with `NODE_ENV=development` in this local stack so HTTP-only cookies work over plain HTTP; production TLS and Secure-cookie configuration belong to the deployment milestone.

## CI, GHCR, and deployment

The workflow is defined in `.github/workflows/ci.yml`.

- Pull requests targeting `main` run the quality gate only.
- Pushes to `main` run the quality gate and then publish the backend image and apply production migrations. Backend and frontend Vercel deployments wait for those jobs to succeed, and a smoke job checks health/readiness through the deployed frontend rewrite.
- The quality gate installs both packages with frozen lockfiles, checks formatting and linting, type-checks, validates and applies committed Prisma migrations against a PostgreSQL 17 service container, runs backend and frontend tests, and builds both production bundles.
- The publish job uses Docker Buildx, the existing backend `runtime` target, and the automatic `GITHUB_TOKEN`. Pull requests never receive `packages: write` or deployment secrets.
- Images are published as `ghcr.io/rafikk98/campushub-api:<full-commit-sha>` and `ghcr.io/rafikk98/campushub-api:latest`. The commit-SHA tag is the immutable artifact; Vercel deploys the backend from source.
- Production migrations run with `DIRECT_URL` against Neon. Deployment jobs are restricted to the `production` GitHub environment and main-branch pushes.
- The Vercel CLI is pinned to `66.6.0`. Both deploy jobs link the repository root to their project, pull production settings, build prebuilt output, and deploy it. Vercel Git production auto-deploys should be disabled to avoid racing the migration job.
- No frontend image is published. Vercel serves the static Vite build.

### Intended hosted topology

- Frontend: Vercel project rooted at `frontend`, intended domain `https://campushub-web.vercel.app`.
- Backend: Vercel project rooted at `backend`, intended domain `https://campushub-api.vercel.app`.
- Database: Neon PostgreSQL with pooled `DATABASE_URL` for runtime and direct `DIRECT_URL` for migrations.
- The frontend `vercel.json` rewrites `/api/:path*` to the backend production domain, followed by the SPA fallback. If either Vercel project uses a different name or custom domain, update the rewrite and `FRONTEND_ORIGIN` together. Use the stable production alias, not a per-deployment URL.
- Do not enable Vercel Deployment Protection on the production deployments used by the smoke job, or the unauthenticated health checks will fail.
- No provider resources have been created and no live deployment has been verified yet.

Backend Vercel runtime variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | Exact frontend production origin, for example `https://campushub-web.vercel.app` |
| `TRUST_PROXY` | Start with `1`; verify the real proxy hop count and rate-limit keying |

GitHub Actions production secrets:

| Name | Purpose |
|---|---|
| `DIRECT_URL` | Neon direct connection string for `prisma migrate deploy` |
| `VERCEL_TOKEN` | Vercel deployment credential |
| `VERCEL_ORG_ID` | Vercel organization/team ID |
| `VERCEL_API_PROJECT_ID` | Backend Vercel project ID |
| `VERCEL_WEB_PROJECT_ID` | Frontend Vercel project ID |

`DIRECT_URL` is not a Vercel runtime variable. The backend uses an explicit `pg.Pool` and `attachDatabasePool` from `@vercel/functions` so connections are released around function invocations.

Preview deployments are intentionally out of scope because the API accepts one exact `FRONTEND_ORIGIN`. Disable previews or do not rely on preview authentication. Verify cookie persistence through the external rewrite on the first live deployment; Vercel limits proxied requests to 120 seconds and overwrites `X-Forwarded-For`. In-memory rate limits are per function instance, so they weaken under scaling and cold starts.

Rollback is independent per Vercel project by promoting a previous production deployment. The immutable GHCR image remains available as a versioned backend artifact. Keep migrations backwards-compatible because a rollback does not undo the Neon migration.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev:frontend` | Start the Vite development server |
| `pnpm dev:backend` | Start the Express API with file watching |
| `pnpm build` | Build the backend and frontend |
| `pnpm lint` | Run ESLint in both packages |
| `pnpm typecheck` | Run TypeScript checks in both packages |
| `pnpm format` | Format both packages with Prettier |
| `pnpm format:check` | Check formatting without writing changes |

## Environment files

Create local environment files from the examples when a milestone needs them:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item .env.example .env
```

`.env` files are ignored by Git. `.env.example` files contain placeholders only and never real credentials. The root `.env` supplies Docker Compose values; `backend/.env` supplies the local (non-Docker) API and Prisma commands. Compose does not read `backend/.env`.

## Database

Prisma CLI, Prisma Client, and `@prisma/adapter-pg` are pinned to `7.10.1`. The single Prisma config is `backend/prisma7.config.ts`, the filename generated by Prisma `7.10.1`; do not add a second config file.

`DATABASE_URL` is the pooled Neon URL used by the application runtime. `DIRECT_URL` is the unpooled Neon URL used only by Prisma CLI migrations and the seed script. Keep TLS enabled on both URLs. `prisma generate` works without either URL; migration and seed commands require `DIRECT_URL`.

Run database commands from the repository root:

| Command | Purpose |
|---|---|
| `pnpm --dir backend db:validate` | Validate `backend/prisma/schema.prisma` |
| `pnpm --dir backend db:generate` | Generate the Prisma client |
| `pnpm --dir backend db:migrate:dev` | Create and apply a development migration |
| `pnpm --dir backend db:migrate:deploy` | Apply committed migrations in production |
| `pnpm --dir backend db:migrate:status` | Show migration status |
| `pnpm --dir backend db:seed` | Seed the fictional demo dataset |
| `pnpm --dir backend db:studio` | Open Prisma Studio |

The seed is idempotent and creates 1 admin, 2 instructors, 10 students, 5 courses, enrollments, assignments, submissions, and announcements. Authentication and demo sign-in are implemented in Milestone 2.

## Health endpoints

`GET /api/health` returns:

```json
{
  "data": {
    "status": "ok",
    "service": "campushub-api"
  }
}
```

`GET /api/ready` runs `SELECT 1` through the pooled Prisma adapter and returns `503` when the database is unavailable. It is separate from the liveness endpoint so a database outage does not cause the API process to be restarted.

The API logs structured JSON for startup, shutdown, completed requests, readiness failures, and unexpected errors. Request logging excludes request bodies, headers, cookies, and query strings.

## Security notes

- No real secrets, credentials, or student data belong in this repository.
- `.env` files, local databases, generated Prisma client files, dependencies, and build output are ignored.
- Neon pooled and direct URLs are never documented or committed; `.env.example` contains placeholders only.
- Authorization will be enforced by the API, not only by the React UI.

## Known limitations

This is a portfolio project intended for free-tier infrastructure. It is not intended for real institutional use. Public self-registration is limited to student accounts and includes rate limiting but no email verification, password reset, or OAuth. Administrators remain the only way to create instructor or additional administrator accounts. The Docker Compose stack is a local-development setup: it publishes only Nginx on port 8080 and uses plain HTTP. CI, GHCR publishing, and the Vercel deployment pipeline are implemented in GitHub Actions. The first live deployment, provider-side environment configuration, cookie/rewrite behavior, proxy-hop verification, preview-deployment policy, and production demo seed are still pending. Vercel function instances are ephemeral, external rewrites time out after 120 seconds, and the in-memory rate limiter is not shared across instances.
