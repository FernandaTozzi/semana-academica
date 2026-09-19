import { FastifyInstance } from "fastify";
import { resetarBanco, obterRelogioTeste, definirRelogioTeste, salvarBanco } from "../db.js";

export function registrarRotasTeste(app: FastifyInstance) {
  app.post("/_teste/reset", async (_req, reply) => {
    const db = app.db;
    resetarBanco(db);
    definirRelogioTeste(db, "2026-10-13T09:00:00-03:00");
    salvarBanco(db);
    return reply.code(204).send();
  });

  app.get("/_teste/relogio", async (_req, reply) => {
    const db = app.db;
    const agora = obterRelogioTeste(db);
    return reply.send({ agora });
  });

  app.put("/_teste/relogio", async (req, reply) => {
    const { agora } = req.body as { agora: string };
    if (!agora) {
      return reply.code(422).send({
        erro: "DADOS_INVALIDOS",
        mensagem: "Campo 'agora' é obrigatório",
      });
    }
    const db = app.db;
    const novoAgora = definirRelogioTeste(db, agora);
    salvarBanco(db);
    return reply.send({ agora: novoAgora });
  });
}