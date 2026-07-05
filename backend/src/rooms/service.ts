import type { PrismaClient } from "@prisma/client";
import { generateRoomCode } from "./roomCode.js";
import { RoomNotFoundError, RoomNotJoinableError, NotRoomHostError, InvalidPlayerCountError } from "./errors.js";
import { MAX_PLAYERS, MIN_PLAYERS, Role } from "../engine/roles.js";
import { assignRolesRandom, validateHandPickedRoles, type HostType } from "../engine/roleAssignment.js";

const CODE_GENERATION_ATTEMPTS = 10;

export async function createRoom(prisma: PrismaClient, hostUserId: string, hostType: HostType) {
  for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const existing = await prisma.game.findUnique({ where: { code } });
    if (existing) continue;

    return prisma.game.create({
      data: { code, hostUserId, hostType },
    });
  }
  throw new Error("Failed to generate a unique room code, please retry");
}

export async function getRoomState(prisma: PrismaClient, code: string) {
  const game = await prisma.game.findUnique({
    where: { code },
    include: { players: { include: { user: true }, orderBy: { seatOrder: "asc" } } },
  });
  if (!game) throw new RoomNotFoundError();
  return game;
}

export async function joinRoom(prisma: PrismaClient, code: string, userId: string) {
  const game = await prisma.game.findUnique({
    where: { code },
    include: { players: true },
  });
  if (!game) throw new RoomNotFoundError();
  if (game.status !== "LOBBY") throw new RoomNotJoinableError("This game has already started");
  if (game.hostUserId === userId) throw new RoomNotJoinableError("The host cannot join as a player");
  if (game.players.length >= MAX_PLAYERS) throw new RoomNotJoinableError("This room is full");
  if (game.players.some((p) => p.userId === userId)) throw new RoomNotJoinableError("You have already joined this room");

  await prisma.gamePlayer.create({
    data: { gameId: game.id, userId, seatOrder: game.players.length },
  });

  return getRoomState(prisma, code);
}

export interface StartGameOptions {
  poisonerDecision?: boolean;
  /** Hand-picked assignments keyed by GamePlayer id. Omit to randomize. */
  assignments?: Record<string, Role>;
}

export async function startGame(
  prisma: PrismaClient,
  code: string,
  requestingUserId: string,
  options: StartGameOptions = {},
) {
  const game = await prisma.game.findUnique({
    where: { code },
    include: { players: true },
  });
  if (!game) throw new RoomNotFoundError();
  if (game.hostUserId !== requestingUserId) throw new NotRoomHostError();
  if (game.status !== "LOBBY") throw new RoomNotJoinableError("This game has already started");

  const playerCount = game.players.length;
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new InvalidPlayerCountError(playerCount);
  }

  const assignments = options.assignments
    ? validateHandPickedRoles(playerCount, options.assignments)
    : assignRolesRandom(
        game.players.map((p) => p.id),
        { hostType: game.hostType, poisonerDecision: options.poisonerDecision },
      );

  await prisma.$transaction([
    ...assignments.map((a) =>
      prisma.gamePlayer.update({
        where: { id: a.playerId },
        data: { role: a.role, team: a.team },
      }),
    ),
    prisma.game.update({
      where: { id: game.id },
      data: { status: "IN_PROGRESS", playerCount },
    }),
  ]);

  return getRoomState(prisma, code);
}
