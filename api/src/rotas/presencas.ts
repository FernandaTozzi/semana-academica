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
      const corpo = (req.body ?? {}) as { codigo?: unknown; lidoEm?: unknown };
      if (typeof corpo.codigo !== "string" || corpo.codigo.length !== 6) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Campo 'codigo' é obrigatório e deve ter 6 caracteres",
        });
      }

      const agoraMs = agoraServidor(app).getTime();

      const lidoEm = corpo.lidoEm as string | undefined;
      const offline = lidoEm !== undefined;
      const lidoMs = offline ? new Date(lidoEm).getTime() : agoraMs;
      if (offline && Number.isNaN(lidoMs)) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Campo 'lidoEm' deve ser uma data ISO 8601",
        });
      }
      const instanteEfetivo = offline ? Math.min(lidoMs, agoraMs) : agoraMs;

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
      const fim = new Date(encontro.fim as string).getTime();

      if (offline) {
        const limiteSincronizacao = fim + 2 * 60 * 60 * 1000;
        if (agoraMs > limiteSincronizacao) {
          return reply.code(422).send({
            erro: "SINCRONIZACAO_TARDIA",
            mensagem: "Envio offline após 2 horas do fim do encontro",
          });
        }
      }

      if (instanteEfetivo < inicio - MINUTOS_ANTES || instanteEfetivo > inicio + MINUTOS_DEPOIS) {
        return reply.code(422).send({
          erro: "FORA_DA_JANELA",
          mensagem: "Fora da janela de registro de presença",
        });
      }

      if (!codigoEhValido(id, corpo.codigo, instanteEfetivo)) {
        return reply.code(422).send({
          erro: "CODIGO_INVALIDO",
          mensagem: "Código não é válido para este encontro neste momento",
        });
      }

      const idPresenca = novoIdPresenca();
      const registradaEm = new Date(agoraMs).toISOString();
      const lidoEmArmazenado = offline ? lidoEm : registradaEm;
      const origem = offline ? "qr_offline" : "qr";
      db.run(
        `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idPresenca, id, usuario.id, origem, lidoEmArmazenado, registradaEm]
      );
      salvarBanco(db);

      return reply.code(201).send({
        id: idPresenca,
        encontroId: id,
        participanteId: usuario.id,
        origem,
        lidoEm: lidoEmArmazenado,
        registradaEm,
        justificativa: null,
      });
    }
  );

  app.post(
    "/encontros/:id/presencas/manual",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const usuario = req.usuario;
      if (!usuario || usuario.papel !== "organizacao") {
        return reply.code(403).send({
          erro: "SOMENTE_ORGANIZACAO",
          mensagem: "Apenas a organização registra presença manual",
        });
      }

      const { id } = req.params as { id: string };
      const db = app.db;

      const result = db.exec(
        `SELECT e.id, e.inicio, e.fim, e.atividade_id
         FROM encontros e
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

      const corpo = (req.body ?? {}) as { participanteId?: unknown; justificativa?: unknown };
      const participanteId =
        typeof corpo.participanteId === "string" ? corpo.participanteId : "";
      if (!participanteId) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Campo 'participanteId' é obrigatório",
        });
      }
      const justificativa =
        typeof corpo.justificativa === "string" ? corpo.justificativa : null;
      if (justificativa === null || justificativa.length < 10) {
        return reply.code(422).send({
          erro: "JUSTIFICATIVA_OBRIGATORIA",
          mensagem: "justificativa é obrigatória e deve ter pelo menos 10 caracteres",
        });
      }

      const existente = db.exec(
        `SELECT id, origem, lido_em, registrada_em, justificativa
         FROM presencas
         WHERE encontro_id = ? AND participante_id = ?`,
        [id, participanteId]
      );
      if (existente.length > 0 && existente[0].values.length > 0) {
        return reply.code(200).send(
          presencaParaObjeto(existente[0].columns, existente[0].values[0], id, participanteId)
        );
      }

      const inscrito = db.exec(
        `SELECT 1 FROM inscricoes
         WHERE atividade_id = ? AND participante_id = ? AND status = 'confirmada'`,
        [encontro.atividade_id as string, participanteId]
      );
      if (inscrito.length === 0 || inscrito[0].values.length === 0) {
        return reply.code(403).send({
          erro: "NAO_INSCRITO",
          mensagem: "Participante não tem inscrição confirmada na atividade",
        });
      }

      const agoraMs = agoraServidor(app).getTime();
      const inicio = new Date(encontro.inicio as string).getTime();
      const fim = new Date(encontro.fim as string).getTime();
      if (
        agoraMs < inicio - MINUTOS_ANTES ||
        agoraMs > fim + 2 * 60 * 60 * 1000
      ) {
        return reply.code(422).send({
          erro: "FORA_DA_JANELA",
          mensagem: "Fora da janela de registro de presença manual",
        });
      }

      const idPresenca = novoIdPresenca();
      const registradaEm = new Date(agoraMs).toISOString();
      db.run(
        `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
         VALUES (?, ?, ?, 'manual', NULL, ?, ?)`,
        [idPresenca, id, participanteId, registradaEm, justificativa]
      );
      salvarBanco(db);

      return reply.code(201).send({
        id: idPresenca,
        encontroId: id,
        participanteId,
        origem: "manual",
        lidoEm: null,
        registradaEm,
        justificativa,
      });
    }
  );

  app.get(
    "/encontros/:id/presencas",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const usuario = req.usuario;
      if (!usuario || usuario.papel !== "organizacao") {
        return reply.code(403).send({
          erro: "SOMENTE_ORGANIZACAO",
          mensagem: "Apenas a organização lista presenças",
        });
      }

      const { id } = req.params as { id: string };
      const db = app.db;

      const existe = db.exec("SELECT id FROM encontros WHERE id = ?", [id]);
      if (existe.length === 0 || existe[0].values.length === 0) {
        return reply.code(404).send({
          erro: "NAO_ENCONTRADO",
          mensagem: "Encontro não encontrado",
        });
      }

      const result = db.exec(
        "SELECT id, participante_id, origem, lido_em, registrada_em, justificativa FROM presencas WHERE encontro_id = ? ORDER BY registrada_em ASC",
        [id]
      );
      if (result.length === 0 || result[0].values.length === 0) {
        return reply.send([]);
      }
      const { columns, values } = result[0];
      const idxParticipante = columns.indexOf("participante_id");
      return reply.send(
        values.map((v) => presencaParaObjeto(columns, v, id, v[idxParticipante] as string))
      );
    }
  );
}