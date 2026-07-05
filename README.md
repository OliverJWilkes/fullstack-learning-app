# The Ultimate Werewolf

A browser-based social deduction game (Werewolf/Mafia) for 8–18 players. See
`ultimatewerewolfspec_3.md` for the full game design spec, and
`/root/.claude/plans/dapper-growing-pumpkin.md` for the implementation plan.

## Tech stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Fastify
- Real-time: Socket.IO (coming in a later milestone)
- Database: PostgreSQL via Prisma
- Auth: bcrypt + JWT

## Local development

### 1. Database

Start Postgres with Docker:

```
docker compose up -d
```

(If Docker isn't available, any local Postgres 16 instance works — just
match the credentials in `backend/.env.example`.)

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
Prisma schema, Vite + Fastify project scaffolds.

Remaining milestones (room lifecycle & role assignment, core game engine,
real-time wiring, AI host, polish) are tracked in the implementation plan.
