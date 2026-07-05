import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../persistence/prisma.js";

async function signup(app: FastifyInstance, email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { email, password: "correcthorsebattery", displayName: email.split("@")[0] },
  });
  return res.json() as { token: string; user: { id: string } };
}

describe("room routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.gamePlayer.deleteMany();
    await prisma.game.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects unauthenticated room creation", async () => {
    const res = await app.inject({ method: "POST", url: "/rooms", payload: { hostType: "AI" } });
    expect(res.statusCode).toBe(401);
  });

  it("lets a human host create a room and see it in the lobby", async () => {
    const host = await signup(app, "host@example.com");

    const createRes = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.token}` },
      payload: { hostType: "HUMAN" },
    });
    expect(createRes.statusCode).toBe(201);
    const room = createRes.json();
    expect(room.status).toBe("LOBBY");
    expect(room.isHost).toBe(true);
    expect(room.code).toHaveLength(6);
  });

  it("lets other players join by code, but blocks the host from joining their own room", async () => {
    const host = await signup(app, "host2@example.com");
    const player = await signup(app, "player2@example.com");

    const createRes = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.token}` },
      payload: { hostType: "HUMAN" },
    });
    const { code } = createRes.json();

    const joinRes = await app.inject({
      method: "POST",
      url: `/rooms/${code}/join`,
      headers: { authorization: `Bearer ${player.token}` },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().players).toHaveLength(1);

    const hostJoinRes = await app.inject({
      method: "POST",
      url: `/rooms/${code}/join`,
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(hostJoinRes.statusCode).toBe(409);
  });

  it("rejects starting a game with fewer than 8 players", async () => {
    const host = await signup(app, "host3@example.com");
    const player = await signup(app, "player3@example.com");

    const createRes = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.token}` },
      payload: { hostType: "HUMAN" },
    });
    const { code } = createRes.json();

    await app.inject({
      method: "POST",
      url: `/rooms/${code}/join`,
      headers: { authorization: `Bearer ${player.token}` },
    });

    const startRes = await app.inject({
      method: "POST",
      url: `/rooms/${code}/start`,
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(startRes.statusCode).toBe(409);
  });

  it("assigns roles and starts an 8-player AI-hosted game, hiding roles from other players", async () => {
    const host = await signup(app, "aihost@example.com");
    const createRes = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${host.token}` },
      payload: { hostType: "AI" },
    });
    const { code } = createRes.json();

    const players = [];
    for (let i = 0; i < 8; i++) {
      const p = await signup(app, `p${i}@example.com`);
      await app.inject({
        method: "POST",
        url: `/rooms/${code}/join`,
        headers: { authorization: `Bearer ${p.token}` },
      });
      players.push(p);
    }

    const startRes = await app.inject({
      method: "POST",
      url: `/rooms/${code}/start`,
      headers: { authorization: `Bearer ${host.token}` },
    });
    expect(startRes.statusCode).toBe(200);
    const started = startRes.json();
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.playerCount).toBe(8);

    // A regular player only sees their own role, not everyone else's.
    const viewRes = await app.inject({
      method: "GET",
      url: `/rooms/${code}`,
      headers: { authorization: `Bearer ${players[0].token}` },
    });
    const view = viewRes.json();
    const self = view.players.find((p: { userId: string }) => p.userId === players[0].user.id);
    const others = view.players.filter((p: { userId: string }) => p.userId !== players[0].user.id);
    expect(self.role).not.toBeNull();
    for (const other of others) {
      expect(other.role === null || other.role === "MAYOR").toBe(true);
    }

    // The host sees every role.
    const hostViewRes = await app.inject({
      method: "GET",
      url: `/rooms/${code}`,
      headers: { authorization: `Bearer ${host.token}` },
    });
    const hostView = hostViewRes.json();
    expect(hostView.players.every((p: { role: string | null }) => p.role !== null)).toBe(true);
  });
});
