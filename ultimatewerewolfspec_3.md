# The Ultimate Werewolf — Build Spec

A browser-based social deduction game for 8–18 players, inspired by Werewolf/Mafia.

---

## 1. Overview

Two teams — **Villagers** and **Werewolves** — take turns during Night and Day phases. Werewolves secretly kill a villager each night; during the day, everyone discusses and votes to banish a suspected werewolf. The game repeats until one side wins.

---

## 2. Players & Roles Setup

### 2.1 Player count
- Minimum: 8 players
- Maximum: 18 players
- The **host is separate from the players** — they do not play a role and are not part of any win condition.

### 2.2 Werewolf count by player count

| Players | Werewolves |
|---|---|
| 8–10 | 2 |
| 11–13 | 3 |
| 14–15 | 4 |
| 16–18 | 5 |

### 2.3 Role distribution table

Minimum of **3 plain Villagers** in every game, no matter the player count.

| Players | Wolves | Special Roles Included | Plain Villagers |
|---|---|---|---|
| 8 | 2 | Seer, Doctor | 4 |
| 9 | 2 | Seer, Doctor, Detective | 4 |
| 10 | 2 | Seer, Doctor, Detective, Mayor | 4 |
| 11 | 3 | Seer, Doctor, Detective, Mayor | 4 |
| 12 | 3 | Seer, Doctor, Detective, Mayor, Hunter | 4 |
| 13 | 3 | Seer, Doctor, Detective, Mayor, Hunter, Tanner | 4 |
| 14 | 4 | Seer, Doctor, Detective, Mayor, Hunter, Tanner | 4 |
| 15 | 4 | Seer, Doctor, Detective, Mayor, Hunter, Tanner, Masons ×2 | 3 |
| 16 | 5 (Poisoner mandatory) | Seer, Doctor, Detective, Mayor, Hunter, Tanner, Masons ×2 | 3 |
| 17 | 5 (Poisoner mandatory) | Seer, Doctor ×2, Detective, Mayor, Hunter, Tanner, Masons ×2 | 3 |
| 18 | 5 (Poisoner mandatory) | Seer, Doctor ×2, Detective, Mayor, Hunter, Tanner, Masons ×2 | 4 |

**Poisoner inclusion rule** (applies at all wolf counts, replacing one plain werewolf slot):
- 2 werewolves → Poisoner never included
- 3–4 werewolves → optional. Human host chooses; AI host decides randomly.
- 5 werewolves → Poisoner mandatory (always included)

### 2.4 Role assignment
- **AI host**: roles always assigned randomly.
- **Human host**: can click "Randomize" or hand-pick every player's role.
- The host has admin visibility — sees every player's role at all times, from game start.

---

## 3. Game Loop

1. **Night phase** — Werewolves (and any night-active special roles) act.
2. **Day phase** — Death announcement → 2 minutes discussion → vote → banishment + role reveal.
3. Repeat from step 1 until a win condition is met.

---

## 4. Night Phase

### 4.1 Werewolf kill
- All werewolves (including the Poisoner, if present) wake together and see each other's identities.
- They discuss in the **Werewolf chat** and must reach **unanimous agreement** on one kill target.
- **Unlimited time** to decide — no timer.
- If they can't agree on a target, they keep proposing alternatives until all wolves agree. A kill must always happen — the night cannot end with the wolves choosing no target.

### 4.2 Special role night actions
Each of the following happens via the player's **private 1-on-1 chat with the host** (except where noted):

- **Seer**: once per night, asks the host "what role does [player] have?" and is told the truth. Ends completely if the Seer dies (no replacement, no afterlife power).
- **Doctor**: once per night, picks one player (including themself) to shield from the werewolf kill that night. **Cannot pick the same target on two consecutive nights.** At 17–18 players there are two Doctors — they know each other's identity and can discuss/coordinate via a private 2-person chat, to avoid wasting a shield on a duplicate target.
- **Detective**: once per night, guesses one player as a werewolf.
  - Correct guess → announced publicly the next day: "A werewolf has been found: [name]" — the Detective's own identity is **not** revealed.
  - Wrong guess → nothing happens, no announcement.
- **Poisoner** (werewolf team, counts as one of the fixed werewolf slots): has no proactive night action — it's purely reactive. If a Seer, Doctor, or Detective ever uses their power *on* the Poisoner (checks them, shields them, or guesses them), the Poisoner is told immediately that they've been targeted. The targeting player is then poisoned and **dies the following night**, unless a Doctor happens to shield them that same night (poison does not bypass Doctor protection — it's treated like a normal kill). Nobody else is told who has been poisoned or that a poisoning has occurred.
- **Masons** (2 players): wake at night and learn who the other Mason is. Can talk via a private 2-person chat if they choose to.

### 4.3 Roles with no night action
Villager, Werewolf (plain), Hunter, Tanner, Mayor all act only during the day (or not at all).

---

## 5. Day Phase

### 5.1 Sequence
1. The host announces who died overnight (if anyone — a shielded target survives with no announcement of the attempt).
2. **2 minutes of open discussion** in the Alive chat.
3. **Open voting** — everyone sees who voted for whom.

### 5.2 Vote resolution & tie-breaking
- Whoever gets the most votes is banished.
- **Tie (stage 1)**: everyone who did *not* vote for either tied player must revote, choosing only between the two.
- **Tie (stage 2)**: if still tied after the stage 1 revote, both tied players give a speech, then **everyone votes again except one randomly excluded player** (to force an odd number and guarantee a decisive result).

### 5.3 Mayor's vote
- The Mayor is publicly revealed to all players from the start of the game.
- Each round, the Mayor may choose to **save** their vote instead of casting it. Saved votes stack uncapped (2, 3, 4...).
- When the Mayor chooses to use their vote, it counts for the full stacked amount — then resets back down to 1 for future rounds.

### 5.4 Banishment & role reveal
- The banished player's role is revealed to everyone.
- **Hunter special case**: if the Hunter is banished by day vote, whoever the Hunter voted for in that same round is *also* immediately banished and reveals their role. (Only triggers on day banishment — not if the Hunter is killed by werewolves at night.)
- **Twins removed from spec — not included** (cut during design for role-count balance).

---

## 6. Special Win Conditions

- **Tanner**: has no night action. If banished by day vote, the game ends **immediately** — the Tanner wins, and nobody else wins or loses. If killed by werewolves at night instead, the Tanner simply loses and the game continues normally.

---

## 7. Standard Win Conditions

- **Villagers win** when all werewolves have been banished.
- **Werewolves win** when werewolves equal or outnumber villagers.
- "Villagers" here means all living Village-team players (Villager, Seer, Doctor, Detective, Mayor, Hunter, Masons) — i.e. wolves vs. everyone else. The **Tanner is a neutral third team** and does not count toward either side of this tally.
- No draw condition is needed — the player count shrinks every round, guaranteeing the game reaches one of these conditions.

---

## 8. Chats

Four chat types:

1. **Alive chat** — all living players.
2. **Dead chat** — eliminated players only. They can watch the live game (including seeing werewolves wake up at night, which reveals wolf identities to them) and chat with other eliminated players. They cannot interact with the live game (can't vote, can't post in Alive chat). Living players have no visibility into this chat at all.
3. **Werewolf chat** — werewolves only (including the Poisoner), used for night kill negotiation.
4. **Private host chat** — one per player, 1-on-1 with the host, used for special role actions (Seer questions, Detective guesses, Doctor targeting, etc.) and for asking the host anything else.

Plus two small optional 2-person chats:
- **Masons' private chat**
- **Doctors' private chat** (17–18 player games only, when 2 Doctors are present)

---

## 9. Roles Reference Table

| Role | Team | Night Action | Notes |
|---|---|---|---|
| Villager | Village | None | Plain role |
| Werewolf | Werewolf | Votes on kill | Plain role |
| Seer | Village | Ask host 1 player's role, once/night | Ends on death |
| Doctor | Village | Shield 1 player from kill, once/night | No repeat target 2 nights running; 2 Doctors at 17–18 players, know each other |
| Detective | Village | Guess 1 werewolf, once/night | Correct guess announced publicly next day (Detective stays anonymous); wrong = nothing |
| Poisoner | Werewolf | None (reactive only) | If Seer/Doctor/Detective targets them, that player dies next night unless shielded; counts as 1 of the fixed werewolf slots; mandatory at 5 wolves, optional at 3–4, never at 2 |
| Hunter | Village | None | If banished, drags down whoever they voted for |
| Masons (×2) | Village | Learn who the other Mason is | Optional private chat |
| Tanner | Neutral (solo) | None | Wins alone if banished; loses if killed by wolves; does not count toward either side for the wolves-vs-village win tally |
| Mayor | Village | None | Revealed publicly; can stack votes by saving them each round |

---

## 10. Tech Stack (agreed separately)

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Fastify
- Real-time: Socket.IO
- Database: PostgreSQL via Prisma
- Auth: bcrypt + JWTs
- Hosting: deferred — built host-agnostic via environment variables (Azure or self-hosting both remain options)

---

## 11. Open Questions / Notes for Build Phase

- Confirm exact UI flow for host choosing AI vs human-host mode at room creation.
- Confirm exact UI flow for human host hand-picking roles vs randomizing.
- Consider how "who fires first" (initial night vs day) should work — currently assumed to start with Night 1.
