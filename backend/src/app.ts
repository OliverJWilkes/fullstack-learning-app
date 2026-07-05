import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwtPlugin from "./plugins/jwt.js";
import authRoutes from "./auth/routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(jwtPlugin);
  app.register(authRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
