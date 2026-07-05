import type { FastifyInstance } from "fastify";
import { prisma } from "../persistence/prisma.js";
import { signup, login } from "./service.js";
import { signupSchema, loginSchema } from "./schemas.js";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./errors.js";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const user = await signup(prisma, parsed.data);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return reply.code(201).send({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const user = await login(prisma, parsed.data);
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return reply.send({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/auth/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    return reply.send({ id: user.id, email: user.email, displayName: user.displayName });
  });
}
