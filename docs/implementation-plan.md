# The Ultimate Werewolf — Implementation Plan

## Context

We have a full build spec (`ultimatewerewolfspec_3.md`) for a browser-based
Werewolf/Mafia social deduction game, plus ~20 clarifying decisions made in
this session that resolve every ambiguity in the spec (Poisoner mechanics,
night action ordering, Mayor vote stacking, win-condition scope, AFK
handling, accounts, etc.) The repo currently contains only placeholder
scaffolding from a "learning full-stack" starter — a Create React App
frontend with mock `logo.svg` boilerplate, and a plain Express backend
serving hardcoded mock users/posts. None of it matches the agreed tech
stack (Vite, Fastify, Socket.IO, Prisma/Postgres, bcrypt+JWT) or contains
any reusable logic, so this is effectively a greenfield build that replaces
the scaffold.

Given the size of the system (real-time multiplayer game engine, 6 chat
channel types, an LLM-driven AI host, full accounts), this plan breaks the
build into sequential milestones, each independently runnable/testable, so
we can verify correctness before layering on the next piece rather than
attempting the whole system in one pass.

## Decisions carried in from spec discussion (authoritative — see full list in conversation)

- AI host = real LLM-driven conversational host (Claude API), not just structured buttons.
- Poisoner: normal ability effect always resolves truthfully **and** poison triggers on top; only one poison pending at a time (extra targeting while pending is wasted); poison resolves during the **immediately following night**, checked against that night's Doctor shield.
- Two Doctors: system blocks picking the same target the same night; self-shield counts toward the no-repeat-2-nights rule.
- Detective's nightly guess is **mandatory**.
- Hunter drag-down uses the Hunter's **original first-round vote** (tied candidates don't vote in their own tie-break).
- Mayor can stack-vote in tie-break revotes too; using the stack resets it to 1 immediately, so they can still vote normally in a later revote the same round.
- Win tally: wolves vs. all living Village-team players; **Tanner is a neutral third team**, not Village — doesn't count toward either side (correction needed in spec's §9 table).
- Discussion timer: human host can override the 2-minute default; AI host cannot.
- Disconnects: 60s grace period → flagged AFK, that round's action defaults/no-ops, no elimination.
- Full account system (bcrypt + JWT), persistent match history.
- AI-host Poisoner inclusion at 3–4 wolves: 50/50 coin flip.
- Night resolution order: Doctor shield(s) → Masons → Werewolf kill → Seer/Detective actions → pending poison resolution → morning announcement (all deaths from the night announced together, no public wolf/poison distinction).

## Architecture Overview

```
frontend/  (React + TS + Vite)
  - REST calls for auth/room-lifecycle
  - Socket.IO client for everything live (chat, phase state, actions, votes)

backend/  (Node + TS + Fastify)
  - REST routes: auth, room create/join, match history
  - Socket.IO gateway: thin layer that validates + delegates to the game engine
  - Game engine: pure, transport-agnostic state machine (the core asset —
    fully unit-testable without sockets/DB/LLM)
  - Persistence layer: Prisma repositories (games, players, actions, votes,
    chat messages) — engine emits events, a persistence subscriber writes them
  - AI host module: wraps the Claude API behind a constrained tool-calling
    interface so the LLM can only invoke specific host actions, never
    freely narrate game state (prevents info leaks to the wrong player)

Postgres (via Prisma)
```

Key design principle: the **game engine is a pure reducer** —
`(state, action) -> {state, events[]}` — with no knowledge of Socket.IO,
Prisma, or the LLM. This is what makes the trickiest rules (tie-break
stages, poison timing, Mayor stacking, win conditions) testable with plain
unit tests instead of full integration tests through sockets.

## Data Model (Prisma schema, `backend/prisma/schema.prisma`)

- `User` — id, email, passwordHash, displayName, createdAt
- `Game` — id, code, hostUserId (nullable if AI host), hostType (HUMAN/AI), status, playerCount, createdAt, finishedAt, winningTeam
- `GamePlayer` — id, gameId, userId, role, team, seatOrder, isAlive, diedNight/diedDay pointers
- `NightAction` — id, gameId, night, actorPlayerId, actionType (SHIELD/CHECK/GUESS/KILL_VOTE), targetPlayerId, createdAt
- `PoisonPending` — id, gameId, triggeredNight, targetPlayerId (the poisoned actor), resolved bool
- `Vote` — id, gameId, round, stage, voterPlayerId, targetPlayerId, weight (for Mayor stack)
- `MayorState` — gameId, playerId, savedVotes
- `ChatMessage` — id, gameId, channel (ALIVE/DEAD/WEREWOLF/HOST_PRIVATE/MASON/DOCTOR_PAIR), senderPlayerId (nullable = host), content, createdAt
- `GameEvent` — id, gameId, type, payload (jsonb), createdAt — append-only log used to reconstruct state and to drive the Dead-chat spectator view

## Backend Module Breakdown

- `src/auth/` — signup/login routes, bcrypt hashing, JWT issuance/verification middleware
- `src/rooms/` — room create/join REST endpoints, role-distribution algorithm (implements the §2.3 table + Poisoner inclusion rule + AI 50/50 coin flip), host "randomize vs hand-pick" support
- `src/engine/` — the pure state machine:
  - `phases.ts` — LOBBY → NIGHT → DAY_DISCUSSION → DAY_VOTE → TIEBREAK_1 → TIEBREAK_2 → RESOLUTION → (NIGHT | GAME_OVER)
  - `nightResolution.ts` — implements the fixed action order (Doctor → Masons → Wolves → Seer/Detective → Poison)
  - `voting.ts` — tie detection + two-stage tie-break + Mayor stacking
  - `winConditions.ts` — Tanner instant-win, wolves-vs-village tally (Tanner excluded)
  - `roles.ts` — role/team enums, distribution table lookup
  - Comprehensive unit test suite here is the highest-value testing investment in the whole project
- `src/realtime/` — Socket.IO gateway: auth handshake (JWT), room namespaces, event handlers that call into `engine/` and broadcast resulting events to the right channel(s)/players only (critical: private info like Seer results, Detective guesses, wolf chat must never be broadcast beyond their audience)
- `src/aiHost/` — Claude API wrapper; tool definitions restricted to the same action set human players trigger via UI (answer Seer query, record Doctor shield, record Detective guess, decide Poisoner inclusion, run werewolf kill negotiation prompts); system prompt scoped per-conversation so the model only ever sees the info that specific player/channel is entitled to
- `src/persistence/` — Prisma repositories + an event-log subscriber that writes `GameEvent` rows as the engine emits them

## Frontend Structure

- `src/auth/` — login/signup pages, auth context
- `src/rooms/` — dashboard, create/join room, host setup (randomize/hand-pick roles UI)
- `src/game/`
  - `GameShell` — role-aware layout switching between living-player / dead-spectator / host-admin views
  - `NightPanel` — role-specific action UI (wolf chat + kill proposal, Seer/Doctor/Detective private host chat, Mason chat)
  - `DayPanel` — discussion timer (host-adjustable), Alive chat, voting UI incl. tie-break flow
  - `ChatWindow` — shared component reused across all 6 channel types
  - `useGameSocket` — hook wrapping Socket.IO client + local state sync

## Milestones (build + verify incrementally)

1. **Scaffolding replacement** — Vite+TS frontend, Fastify+TS backend, Prisma schema + migration, Postgres via docker-compose for local dev, JWT auth (signup/login), delete the CRA/mock-Express placeholder.
2. **Room lifecycle + role assignment** — create/join room by code, host setup flow (AI vs human, randomize vs hand-pick), role-distribution engine with full unit tests across all player counts (8–18) including Poisoner inclusion rules.
3. **Core game engine** — the full night/day state machine, tie-breaks, Mayor stacking, poison timing, Hunter drag-down, win conditions — built and unit-tested headlessly (no sockets/UI yet), driven by a test harness that scripts whole games.
4. **Real-time wiring** — Socket.IO gateway exposing the engine to real players; all 6 chat channels; minimal functional UI (can be plain, not polished) so a full human-hosted game is playable end-to-end.
5. **AI host integration** — Claude-backed host for AI-hosted games (private chat Q&A, werewolf kill negotiation facilitation, Poisoner coin-flip, role announcements), with prompt scoping so it can't leak hidden info.
6. **Polish** — AFK/disconnect grace period + flag, discussion-timer host override, match history/stats dashboard, UI refinement.

This plan covers the full system design; given the scope, I'd suggest we
execute **Milestone 1** first (after confirming this plan), verify it end
to end, then proceed milestone by milestone rather than attempting
everything in one pass.

## Verification

- Milestone 1: `npm run build`/typecheck on both packages; Prisma migration applies cleanly against a local Postgres; manual signup/login via curl or REST client; automated tests for password hashing + JWT round-trip.
- Milestone 2: unit tests enumerating every player count 8–18 asserting exact role counts against the §2.3 table, including Poisoner mandatory/optional/never cases.
- Milestone 3: scripted-game unit tests covering tie-break stage 1 and 2, Mayor stacking across multiple rounds, poison trigger + delayed death + Doctor-shield save, Hunter drag-down (including the tied-candidate edge case), and both win conditions (including Tanner exclusion).
- Milestone 4: manual playtest of a full human-hosted game with 8 browser sessions (or scripted Socket.IO test clients) confirming private channels never leak to the wrong audience.
- Milestone 5: manual playtest of an AI-hosted game verifying the LLM host never reveals hidden information it isn't scoped to see.
