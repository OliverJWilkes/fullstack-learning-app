# The Ultimate Werewolf

A browser-based social deduction game (Werewolf/Mafia) for 8–18 players. See
`ultimatewerewolfspec_3.md` for the full game design spec, and
`docs/implementation-plan.md` for the implementation plan.

## Tech stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Fastify
- Real-time: Socket.IO (coming in a later milestone)
- Database: PostgreSQL via Prisma
- Auth: bcrypt + JWT

## Running it (Docker — recommended, no Node/npm needed on your machine)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on
Windows, this sets up its own WSL2 integration automatically — no manual
`apt`/`sudo` steps needed), then from the repo root:

```
docker compose up --build
```

This builds and runs Postgres, the backend, and the frontend together.
Once it's up, open **http://localhost:5173** in your browser.

To stop everything: `Ctrl+C`, then `docker compose down` (add `-v` to also
wipe the database).

## Running it without Docker (local Node + Postgres)

### 1. Database

```
docker compose up -d postgres
```

(Or point at any local Postgres 16 instance — match the credentials in
`backend/.env.example`.)

### 2. Backend

```
cd backend
cp .env.example .env
npm install
npm run prisma:migrate   # applies schema, generates Prisma client
npm run dev              # starts Fastify on http://localhost:3001
```

Run tests with `npm test`.

### 3. Frontend

```
cd frontend
cp .env.example .env
npm install
npm run dev               # starts Vite on http://localhost:5173
```

## Status

**Milestone 1 (scaffolding + accounts) — done:** signup/login/JWT auth,
Prisma schema, Vite + Fastify project scaffolds. There is no gameplay yet —
this only gets you as far as creating an account and logging in.

Remaining milestones (room lifecycle & role assignment, core game engine,
real-time wiring, AI host, polish) are tracked in `docs/implementation-plan.md`.
