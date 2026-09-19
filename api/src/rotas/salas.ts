import { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyAuth } from "../middleware/auth.js";

const SalaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  capacidade: z.number().int(),
});

function rowToSala(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    nome: row.nome as string,
    capacidade: row.capacidade as number,
  };
}

export function registrarRotasSalas(app: FastifyInstance) {
  app.get(
    "/salas",
    { preHandler: verifyAuth, schema: { response: { 200: z.array(SalaSchema) } } },
    async (_req, reply) => {
      const db = app.db;
      const result = db.exec("SELECT id, nome, capacidade FROM salas ORDER BY id");
      if (result.length === 0 || result[0].values.length === 0) {
        return reply.send([]);
      }
      const cols = result[0].columns;
      const salas = result[0].values.map((vals) => {
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        return rowToSala(row);
      });
      return reply.send(salas);
    }
  );
}