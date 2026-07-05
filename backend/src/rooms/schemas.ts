import { z } from "zod";
import { Role } from "@prisma/client";

export const createRoomSchema = z.object({
  hostType: z.enum(["HUMAN", "AI"]),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const startGameSchema = z.object({
  poisonerDecision: z.boolean().optional(),
  assignments: z.record(z.string(), z.nativeEnum(Role)).optional(),
});

export type StartGameInput = z.infer<typeof startGameSchema>;
