# CampusHub

CampusHub is a role-based university student portal built as a full-stack portfolio project. It demonstrates a React + TypeScript frontend, an Express + TypeScript API, PostgreSQL with Prisma, backend-enforced authorization, automated tests, a Docker Compose stack, and (in later milestones) CI/CD deployment.

**Repository:** https://github.com/RafiKK98/campushub

## Current status

Milestones 1-8 are complete: the full-stack application includes the Prisma 7 schema, the initial Neon migration, an idempotent seed script, centralized environment validation, logging, error handling, database readiness checks, authentication and role-based authorization, admin user-management APIs, course/enrollment APIs, assignment/submission/grading APIs, announcement APIs, role-specific dashboard summaries, a complete React single-page portal covering Admin, Instructor, and Student journeys, and a Docker Compose stack for PostgreSQL, migrations, the production API image, and the Nginx-served frontend.

A post-M7 extension adds public student self-registration at `/register`. Registration always creates an active `STUDENT`, signs the new account in through the same HTTP-only session cookie used by login, and never accepts a role or active status from the client. Instructor and admin accounts are still created by administrators.

See [CAMPUSHUB_PROJECT_PLAN.md](./CAMPUSHUB_PROJECT_PLAN.md) for the full specification and milestone order.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js 26 LTS, Express 5, TypeScript
- Database: PostgreSQL with Prisma 7.10.1 and Neon
- Tooling: pnpm, ESLint, Prettier
- Delivery: Docker Compose (local); GitHub Actions, GHCR, Vercel, Render, Neon (later milestones)

## Repository layout

```text
campushub/
├── frontend/                 React + Vite application
│   ├── Dockerfile            Vite build + Nginx runtime image
│   └── nginx.conf            SPA fallback and /api reverse proxy
├── backend/                  Express API, Prisma schema, migrations, and seed
│   └── Dockerfile            API build, migrate, and runtime stages
├── docker-compose.yml        Local PostgreSQL + migrate + API + Nginx stack
├── docs/                     Project documentation and progress
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

This is a portfolio project running on free-tier infrastructure later in the project. It is not intended for real institutional use. Public self-registration is limited to student accounts and includes rate limiting but no email verification, password reset, or OAuth. Administrators remain the only way to create instructor or additional administrator accounts. The Docker Compose stack is a local-development setup: it publishes only Nginx on port 8080, uses plain HTTP, and does not yet include production TLS, a managed database, or CI/CD deployment.
