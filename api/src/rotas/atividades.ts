import { FastifyInstance } from "fastify";

export function registrarRotasAtividades(app: FastifyInstance) {
  // Placeholder - implementação virá nas fatias posteriores
  app.get("/atividades", async (_req, reply) => {
    return reply.send([]);
  });

  app.get("/atividades/:id", async (req, reply) => {
    return reply.code(404).send({
      erro: "NAO_ENCONTRADO",
      mensagem: "Atividade não encontrada",
    });
  });
}