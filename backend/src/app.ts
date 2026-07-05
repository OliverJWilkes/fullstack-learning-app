import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwtPlugin from "./plugins/jwt.js";
import authRoutes from "./auth/routes.js";
import roomRoutes from "./rooms/routes.js";

export function buildApp(options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.register(cors, { origin: true });
  app.register(jwtPlugin);
  app.register(authRoutes);
  app.register(roomRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
