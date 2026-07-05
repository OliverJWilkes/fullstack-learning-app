import type { FastifyInstance } from "fastify";
import { prisma } from "../persistence/prisma.js";
import { createRoom, getRoomState, joinRoom, startGame } from "./service.js";
import { createRoomSchema, startGameSchema } from "./schemas.js";
import { serializeRoomState } from "./serialize.js";
import {
  RoomNotFoundError,
  RoomNotJoinableError,
  NotRoomHostError,
  InvalidPlayerCountError,
} from "./errors.js";
import { PoisonerDecisionRequiredError, InvalidRoleAssignmentError } from "../engine/roleAssignment.js";

export default async function roomRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/rooms", async (request, reply) => {
    const parsed = createRoomSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const game = await createRoom(prisma, request.user.userId, parsed.data.hostType);
    const state = await getRoomState(prisma, game.code);
    return reply.code(201).send(serializeRoomState(state, request.user.userId));
  });

  fastify.get("/rooms/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    try {
      const state = await getRoomState(prisma, code.toUpperCase());
      return reply.send(serializeRoomState(state, request.user.userId));
    } catch (err) {
      if (err instanceof RoomNotFoundError) return reply.code(404).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/rooms/:code/join", async (request, reply) => {
    const { code } = request.params as { code: string };
    try {
      const state = await joinRoom(prisma, code.toUpperCase(), request.user.userId);
      return reply.send(serializeRoomState(state, request.user.userId));
    } catch (err) {
      if (err instanceof RoomNotFoundError) return reply.code(404).send({ error: err.message });
      if (err instanceof RoomNotJoinableError) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  fastify.post("/rooms/:code/start", async (request, reply) => {
    const { code } = request.params as { code: string };
    const parsed = startGameSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const state = await startGame(prisma, code.toUpperCase(), request.user.userId, parsed.data);
      return reply.send(serializeRoomState(state, request.user.userId));
    } catch (err) {
      if (err instanceof RoomNotFoundError) return reply.code(404).send({ error: err.message });
      if (err instanceof NotRoomHostError) return reply.code(403).send({ error: err.message });
      if (
        err instanceof RoomNotJoinableError ||
        err instanceof InvalidPlayerCountError ||
        err instanceof PoisonerDecisionRequiredError ||
        err instanceof InvalidRoleAssignmentError
      ) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  });
}
