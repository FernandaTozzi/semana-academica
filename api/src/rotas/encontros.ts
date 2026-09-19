import { FastifyInstance } from "fastify";
import { verifyAuth } from "../middleware/auth.js";
import { obterRelogioTeste } from "../db.js";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MINUTOS_ANTES = 15 * 60 * 1000;
const MINUTOS_DEPOIS = 30 * 60 * 1000;
const MILIS_DA_JANELA = 60 * 1000;

export { MINUTOS_ANTES, MINUTOS_DEPOIS, MILIS_DA_JANELA };

export function agoraServidor(app: FastifyInstance): Date {
  if (process.env.MODO_TESTE === "1") {
    return new Date(obterRelogioTeste(app.db));
  }
  return new Date();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function codigoDaJanela(encontroId: string, janelaInicio: number): string {
  const base = `${encontroId}|${janelaInicio}`;
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    const h = hashString(`${base}#${i}`);
    codigo += ALFABETO[h % ALFABETO.length];
  }
  return codigo;
}

function linhaParaObjeto(cols: string[], vals: unknown[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  cols.forEach((c, i) => { row[c] = vals[i]; });
  return row;
}

export function registrarRotasEncontros(app: FastifyInstance) {
  app.get(
    "/encontros/:id/codigo",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const usuario = req.usuario;
      if (!usuario || usuario.papel !== "organizacao") {
        return reply.code(403).send({
          erro: "SOMENTE_ORGANIZACAO",
          mensagem: "Apenas a organização obtém o código do encontro",
        });
      }

      const { id } = req.params as { id: string };
      const db = app.db;
      const result = db.exec(
        `SELECT e.id, e.inicio, a.situacao
         FROM encontros e
         JOIN atividades a ON a.id = e.atividade_id
         WHERE e.id = ?`,
        [id]
      );
      if (result.length === 0 || result[0].values.length === 0) {
        return reply.code(404).send({
          erro: "NAO_ENCONTRADO",
          mensagem: "Encontro não encontrado",
        });
      }

      const row = linhaParaObjeto(result[0].columns, result[0].values[0]);

      if (row.situacao === "cancelada") {
        return reply.code(422).send({
          erro: "ATIVIDADE_CANCELADA",
          mensagem: "A atividade do encontro foi cancelada",
        });
      }

      const inicio = new Date(row.inicio as string).getTime();
      const agora = agoraServidor(app).getTime();
      if (agora < inicio - MINUTOS_ANTES || agora > inicio + MINUTOS_DEPOIS) {
        return reply.code(422).send({
          erro: "FORA_DA_JANELA",
          mensagem: "Fora da janela de obtenção do código",
        });
      }

      const janelaInicio = Math.floor(agora / MILIS_DA_JANELA) * MILIS_DA_JANELA;
      return reply.send({
        encontroId: id,
        codigo: codigoDaJanela(id, janelaInicio),
        trocaEm: new Date(janelaInicio + MILIS_DA_JANELA).toISOString(),
        validoAte: new Date(janelaInicio + 2 * MILIS_DA_JANELA).toISOString(),
      });
    }
  );
}