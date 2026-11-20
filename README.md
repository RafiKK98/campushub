# CampusHub

CampusHub is a role-based university student portal built as a full-stack portfolio project. It demonstrates a React + TypeScript frontend, an Express + TypeScript API, PostgreSQL with Prisma, backend-enforced authorization, automated tests, Docker Compose, and CI/CD deployment.

**Repository:** https://github.com/RafiKK98/campushub

## Current status

Milestone 0 is complete: the repository skeleton, tooling, development proxy, health endpoint, and initial documentation are in place. The application does not yet include authentication, database models, or the role-specific portal screens.

See [CAMPUSHUB_PROJECT_PLAN.md](./CAMPUSHUB_PROJECT_PLAN.md) for the full specification and milestone order.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js 26 LTS, Express 5, TypeScript
- Database: PostgreSQL 17 with Prisma 7 (later milestone)
- Tooling: pnpm, ESLint, Prettier
- Delivery: Docker Compose, GitHub Actions, GHCR, Vercel, Render, Neon (later milestones)

## Repository layout

```text
campushub/
├── frontend/                 React + Vite application
├── backend/                  Express API
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

The repository includes `.nvmrc` with the selected Node version. If you use `pnpm` to manage Node versions:

```bash
pnpm env use --global 26.13.1
```

## Install

```bash
pnpm --dir backend install
pnpm --dir frontend install
```

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
- Frontend-proxied health: http://localhost:5173/api/health

Vite proxies `/api` requests to the backend, so the browser uses one origin during development.

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

`.env` files are ignored by Git. `.env.example` files contain placeholders only and never real credentials.

## Health endpoint

`GET /api/health` returns:

```json
{
  "data": {
    "status": "ok",
    "service": "campushub-api"
  }
}
```

## Security notes

- No real secrets, credentials, or student data belong in this repository.
- `.env` files, local databases, generated dependencies, and build output are ignored.
- Authorization will be enforced by the API, not only by the React UI.

## Known limitations

This is a portfolio project running on free-tier infrastructure later in the project. It is not intended for real institutional use. The current milestone is a development skeleton only.
