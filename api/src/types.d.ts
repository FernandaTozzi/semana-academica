import "fastify";
import { Database } from "sql.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }

  interface FastifyRequest {
    usuario?: { id: string; papel: string };
  }
}