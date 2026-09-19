import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { verifyAuth } from "../middleware/auth.js";
import { salvarBanco } from "../db.js";
import {
  agoraServidor,
  codigoDaJanela,
  MINUTOS_ANTES,
  MINUTOS_DEPOIS,
  MILIS_DA_JANELA,
} from "./encontros.js";

function linhaParaObjeto(cols: string[], vals: unknown[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  cols.forEach((c, i) => { row[c] = vals[i]; });
  return row;
}

function novoIdPresenca(): string {
  return `pre_${crypto.randomBytes(4).toString("hex")}`;
}

function janelaInicioDe(instante: number): number {
  return Math.floor(instante / MILIS_DA_JANELA) * MILIS_DA_JANELA;
}

function codigoEhValido(encontroId: string, codigo: string, instante: number): boolean {
  const janelaAtual = janelaInicioDe(instante);
  return (
    codigo === codigoDaJanela(encontroId, janelaAtual) ||
    codigo === codigoDaJanela(encontroId, janelaAtual - MILIS_DA_JANELA)
  );
}

function presencaParaObjeto(
  cols: string[],
  vals: unknown[],
  encontroId: string,
  participanteId: string
) {
  const row = linhaParaObjeto(cols, vals);
  return {
    id: row.id,
    encontroId,
    participanteId,
    origem: row.origem,
    lidoEm: row.lido_em,
    registradaEm: row.registrada_em,
    justificativa: row.justificativa ?? null,
  };
}

export function registrarRotasPresencas(app: FastifyInstance) {
  app.post(
    "/encontros/:id/presencas",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const usuario = req.usuario;
      if (!usuario || usuario.papel !== "participante") {
        return reply.code(403).send({
          erro: "SOMENTE_PARTICIPANTE",
          mensagem: "Apenas participantes registram presença",
        });
      }

      const { id } = req.params as { id: string };
      const db = app.db;

      const result = db.exec(
        `SELECT e.id, e.inicio, e.fim, e.atividade_id
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

      const encontro = linhaParaObjeto(result[0].columns, result[0].values[0]);
      const corpo = (req.body ?? {}) as { codigo?: unknown };
      if (typeof corpo.codigo !== "string" || corpo.codigo.length !== 6) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Campo 'codigo' é obrigatório e deve ter 6 caracteres",
        });
      }

      const agoraMs = agoraServidor(app).getTime();

      const existente = db.exec(
        `SELECT id, origem, lido_em, registrada_em, justificativa
         FROM presencas
         WHERE encontro_id = ? AND participante_id = ?`,
        [id, usuario.id]
      );
      if (existente.length > 0 && existente[0].values.length > 0) {
        return reply.code(200).send(
          presencaParaObjeto(existente[0].columns, existente[0].values[0], id, usuario.id)
        );
      }

      const inscrito = db.exec(
        `SELECT 1 FROM inscricoes
         WHERE atividade_id = ? AND participante_id = ? AND status = 'confirmada'`,
        [encontro.atividade_id as string, usuario.id]
      );
      if (inscrito.length === 0 || inscrito[0].values.length === 0) {
        return reply.code(403).send({
          erro: "NAO_INSCRITO",
          mensagem: "Participante não tem inscrição confirmada na atividade",
        });
      }

      const inicio = new Date(encontro.inicio as string).getTime();
      if (agoraMs < inicio - MINUTOS_ANTES || agoraMs > inicio + MINUTOS_DEPOIS) {
        return reply.code(422).send({
          erro: "FORA_DA_JANELA",
          mensagem: "Fora da janela de registro de presença",
        });
      }

      if (!codigoEhValido(id, corpo.codigo, agoraMs)) {
        return reply.code(422).send({
          erro: "CODIGO_INVALIDO",
          mensagem: "Código não é válido para este encontro neste momento",
        });
      }

      const idPresenca = novoIdPresenca();
      const registradaEm = new Date(agoraMs).toISOString();
      db.run(
        `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em)
         VALUES (?, ?, ?, 'qr', ?, ?)`,
        [idPresenca, id, usuario.id, registradaEm, registradaEm]
      );
      salvarBanco(db);

      return reply.code(201).send({
        id: idPresenca,
        encontroId: id,
        participanteId: usuario.id,
        origem: "qr",
        lidoEm: registradaEm,
        registradaEm,
        justificativa: null,
      });
    }
  );
}