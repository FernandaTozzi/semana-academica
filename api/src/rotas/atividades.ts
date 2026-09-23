import { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyAuth } from "../middleware/auth.js";
import { salvarBanco } from "../db.js";
import crypto from "node:crypto";

const ATIVIDADE_ID_REGEX = /^atv_[0-9a-f]{8}$/;

const EncontroSchema = z.object({
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
});

const CreateAtividadeSchema = z.object({
  titulo: z.string(),
  tipo: z.enum(["palestra", "minicurso"]),
  salaId: z.string(),
  vagas: z.number().int(),
  encontros: z.array(EncontroSchema),
});

const AtividadeResponseSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  tipo: z.enum(["palestra", "minicurso"]),
  salaId: z.string(),
  vagas: z.number().int(),
  encontros: z.array(z.object({ id: z.string(), inicio: z.string(), fim: z.string() })),
  cargaHorariaMinutos: z.number().int(),
  situacao: z.enum(["prevista", "em_andamento", "encerrada", "cancelada"]),
  ocupadas: z.number().int(),
  vagasRestantes: z.number().int(),
  emEspera: z.number().int(),
});

function gerarIdAtividade(): string {
  return `atv_${crypto.randomBytes(4).toString("hex")}`;
}

function gerarIdEncontro(): string {
  return `enc_${crypto.randomBytes(4).toString("hex")}`;
}

function parseISODateTime(dateStr: string): Date {
  return new Date(dateStr);
}

function duracaoEmMinutos(inicio: string, fim: string): number {
  const dtInicio = parseISODateTime(inicio);
  const dtFim = parseISODateTime(fim);
  return Math.round((dtFim.getTime() - dtInicio.getTime()) / 60000);
}

function mesmoDiaCivil(inicio: string, fim: string): boolean {
  const dtInicio = parseISODateTime(inicio);
  const dtFim = parseISODateTime(fim);
  // Comparar no fuso America/Sao_Paulo (Brasília)
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const inicioStr = fmt.format(dtInicio);
  const fimStr = fmt.format(dtFim);
  return inicioStr === fimStr;
}

function dentroDoPeriodoEvento(inicio: string, fim: string): boolean {
  const eventoInicio = new Date("2026-10-19T00:00:00-03:00");
  const eventoFim = new Date("2026-10-23T23:59:59-03:00");
  const dtInicio = parseISODateTime(inicio);
  const dtFim = parseISODateTime(fim);
  return dtInicio >= eventoInicio && dtFim <= eventoFim;
}

function encontrosSobrepoem(encontros: Array<{ inicio: string; fim: string }>): boolean {
  const sorted = [...encontros].sort((a, b) => parseISODateTime(a.inicio).getTime() - parseISODateTime(b.inicio).getTime());
  for (let i = 0; i < sorted.length - 1; i++) {
    const atualFim = parseISODateTime(sorted[i].fim).getTime();
    const proximoInicio = parseISODateTime(sorted[i + 1].inicio).getTime();
    if (atualFim > proximoInicio) {
      return true;
    }
  }
  return false;
}

// Calcular situacao da atividade baseada no relógio atual
// R19: situacao é calculada pelo relógio de teste
function calcularSituacao(
  situacaoDb: string,
  encontros: Array<{ inicio: string; fim: string }>,
  db: any
): string {
  // cancelada é terminal
  if (situacaoDb === "cancelada") {
    return "cancelada";
  }

  // Buscar relógio de teste
  const relogioResult = db.exec(`SELECT agora FROM relogio_teste WHERE id = 1`);
  const agora = relogioResult.length > 0 && relogioResult[0].values.length > 0
    ? relogioResult[0].values[0][0] as string
    : "2026-10-13T09:00:00-03:00";

  const relogio = new Date(agora);

  // Primeiro início
  const primeiroInicio = new Date(encontros[0].inicio);
  // Último fim
  const ultimoFim = new Date(encontros[encontros.length - 1].fim);

  // prevista: relógio < início do primeiro encontro
  if (relogio < primeiroInicio) {
    return "prevista";
  }

  // em_andamento: início do primeiro encontro ≤ relógio < fim do último encontro
  if (relogio >= primeiroInicio && relogio < ultimoFim) {
    return "em_andamento";
  }

  // encerrada: relógio ≥ fim do último encontro
  return "encerrada";
}

// R7: Verificar conflito de sala com intervalo de 15 minutos
// Intervalo fechado em inicio, aberto em fim. 15 min antes do início e 15 min após o fim.
function verificarConflitoSala(
  db: any,
  salaId: string,
  novosEncontros: Array<{ inicio: string; fim: string }>
): boolean {
  // Buscar todas as atividades NÃO canceladas na mesma sala com seus encontros
  const result = db.exec(`
    SELECT a.id, a.situacao, e.inicio, e.fim
    FROM atividades a
    JOIN encontros e ON a.id = e.atividade_id
    WHERE a.sala_id = ? AND a.situacao != 'cancelada'
    ORDER BY e.inicio
  `, [salaId]);

  if (result.length === 0 || result[0].values.length === 0) {
    return false; // Sem atividades na sala
  }

  const cols = result[0].columns;
  const encontrosExistentes: Array<{ inicio: string; fim: string }> = [];

  for (const vals of result[0].values) {
    const row: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
    if (row.inicio && row.fim) {
      encontrosExistentes.push({
        inicio: row.inicio as string,
        fim: row.fim as string,
      });
    }
  }

  const QUINZE_MINUTOS_MS = 15 * 60 * 1000;

  // Para cada novo encontro, verificar conflito com todos os encontros existentes
  for (const novoEnc of novosEncontros) {
    const novoInicio = parseISODateTime(novoEnc.inicio).getTime();
    const novoFim = parseISODateTime(novoEnc.fim).getTime();

    for (const existEnc of encontrosExistentes) {
      const existInicio = parseISODateTime(existEnc.inicio).getTime();
      const existFim = parseISODateTime(existEnc.fim).getTime();

      // Verifica sobreposição OU intervalo < 15 min
      // Intervalo: [inicio, fim) - fechado no início, aberto no fim
      // Conflito se: novoInicio < existFim + 15min E novoFim > existInicio - 15min
      // Isso cobre:
      // - Sobreposição direta
      // - Novo encontro começando menos de 15 min antes do fim do existente
      // - Novo encontro terminando menos de 15 min após o início do existente
      const inicioConflito = novoInicio < existFim + QUINZE_MINUTOS_MS;
      const fimConflito = novoFim > existInicio - QUINZE_MINUTOS_MS;

      if (inicioConflito && fimConflito) {
        return true; // Conflito detectado
      }
    }
  }

  return false;
}

export function registrarRotasAtividades(app: FastifyInstance) {
  app.post(
    "/atividades",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const db = app.db;

      // Validar body manualmente com Zod
      const parseResult = CreateAtividadeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Corpo da requisição inválido",
        });
      }

      const { titulo, tipo, salaId, vagas, encontros } = parseResult.data;

      // R1/R2: Validar quantidade de encontros por tipo
      if (tipo === "palestra" && encontros.length !== 1) {
        return reply.code(422).send({
          erro: "QUANTIDADE_DE_ENCONTROS",
          mensagem: "Palestra deve ter exatamente 1 encontro",
        });
      }
      if (tipo === "minicurso" && (encontros.length < 2 || encontros.length > 5)) {
        return reply.code(422).send({
          erro: "QUANTIDADE_DE_ENCONTROS",
          mensagem: "Minicurso deve ter entre 2 e 5 encontros",
        });
      }

      // R4: Validar mesmo dia civil e período do evento
      for (const enc of encontros) {
        if (!mesmoDiaCivil(enc.inicio, enc.fim) || !dentroDoPeriodoEvento(enc.inicio, enc.fim)) {
          return reply.code(422).send({
            erro: "ENCONTRO_INVALIDO",
            mensagem: "Encontro deve ocorrer no mesmo dia civil e dentro do período do evento",
          });
        }
      }

      // R3: Validar duração de cada encontro (60-240 min)
      for (const enc of encontros) {
        const duracao = duracaoEmMinutos(enc.inicio, enc.fim);
        if (duracao < 60 || duracao > 240) {
          return reply.code(422).send({
            erro: "ENCONTRO_INVALIDO",
            mensagem: "Encontro deve ter duração entre 60 e 240 minutos",
          });
        }
      }

      // R5: Encontros da mesma atividade não podem se sobrepor
      if (encontrosSobrepoem(encontros)) {
        return reply.code(422).send({
          erro: "ENCONTRO_INVALIDO",
          mensagem: "Encontros da mesma atividade não podem se sobrepor",
        });
      }

      // R6: Validar vagas (1 a capacidade da sala)
      const salaResult = db.exec(`SELECT capacidade FROM salas WHERE id = ?`, [salaId]);
      if (salaResult.length === 0 || salaResult[0].values.length === 0) {
        return reply.code(422).send({
          erro: "VAGAS_ACIMA_DA_CAPACIDADE",
          mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
        });
      }
      const capacidade = salaResult[0].values[0][0] as number;
      if (vagas < 1 || vagas > capacidade) {
        return reply.code(422).send({
          erro: "VAGAS_ACIMA_DA_CAPACIDADE",
          mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
        });
      }

      // R7: Verificar conflito de sala (com intervalo de 15 min)
      if (verificarConflitoSala(db, salaId, encontros)) {
        return reply.code(409).send({
          erro: "CONFLITO_DE_SALA",
          mensagem: "Conflito de horário com outra atividade na mesma sala",
        });
      }

      // Criar atividade
      const atividadeId = gerarIdAtividade();
      const agora = new Date().toISOString();

      // Inserir atividade
      db.run(
        `INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao, criada_em) VALUES (?, ?, ?, ?, ?, 'prevista', ?)`,
        [atividadeId, titulo, tipo, salaId, vagas, agora]
      );

      // Inserir encontros
      const encontroIds: string[] = [];
      for (let i = 0; i < encontros.length; i++) {
        const encontroId = gerarIdEncontro();
        encontroIds.push(encontroId);
        db.run(
          `INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES (?, ?, ?, ?, ?)`,
          [encontroId, atividadeId, encontros[i].inicio, encontros[i].fim, i + 1]
        );
      }

      salvarBanco(db);

      // Calcular carga horária
      const cargaHorariaMinutos = encontros.reduce((acc, enc) => acc + duracaoEmMinutos(enc.inicio, enc.fim), 0);

      // Retornar atividade criada
      const resposta = {
        id: atividadeId,
        titulo,
        tipo,
        salaId,
        vagas,
        encontros: encontroIds.map((id, idx) => ({
          id,
          inicio: encontros[idx].inicio,
          fim: encontros[idx].fim,
        })),
        cargaHorariaMinutos,
        situacao: "prevista" as const,
        ocupadas: 0,
        vagasRestantes: vagas,
        emEspera: 0,
      };

      return reply.code(201).send(resposta);
    }
  );

  app.get(
    "/atividades",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const db = app.db;
      const query = req.query as { dia?: string; tipo?: string };
      const { dia, tipo } = query;

      const result = db.exec(`
        SELECT a.id, a.titulo, a.tipo, a.sala_id as salaId, a.vagas, a.situacao, a.criada_em,
               e.id as encontro_id, e.inicio, e.fim
        FROM atividades a
        LEFT JOIN encontros e ON a.id = e.atividade_id
        ORDER BY a.criada_em, e.ordem
      `);
      if (result.length === 0 || result[0].values.length === 0) {
        return reply.send([]);
      }
      const cols = result[0].columns;
      const atividadesMap = new Map<string, any>();
      for (const vals of result[0].values) {
        const row: Record<string, unknown> = {};
        cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
        const atividadeId = row.id as string;
        if (!atividadesMap.has(atividadeId)) {
          atividadesMap.set(atividadeId, {
            id: atividadeId,
            titulo: row.titulo as string,
            tipo: row.tipo as string,
            salaId: row.salaId as string,
            vagas: row.vagas as number,
            situacao: row.situacao as string,
            encontros: [] as Array<{ id: string; inicio: string; fim: string }>,
          });
        }
        if (row.encontro_id) {
          atividadesMap.get(atividadeId).encontros.push({
            id: row.encontro_id as string,
            inicio: row.inicio as string,
            fim: row.fim as string,
          });
        }
      }
      let atividades = Array.from(atividadesMap.values()).map((a) => ({
        ...a,
        situacao: calcularSituacao(a.situacao, a.encontros, db),
        cargaHorariaMinutos: a.encontros.reduce((acc: number, enc: { inicio: string; fim: string }) => acc + duracaoEmMinutos(enc.inicio, enc.fim), 0),
        ocupadas: 0,
        vagasRestantes: a.vagas,
        emEspera: 0,
      }));

      // Filtro por dia (R21)
      if (dia) {
        // Validar formato AAAA-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
          return reply.code(422).send({
            erro: "DADOS_INVALIDOS",
            mensagem: "Formato de dia inválido. Use AAAA-MM-DD",
          });
        }
        atividades = atividades.filter((a) =>
          a.encontros.some((enc: { inicio: string; fim: string }) => {
            const encDate = new Date(enc.inicio);
            // Comparar dia civil no fuso America/Sao_Paulo (-03:00)
            const encDia = encDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
            return encDia === dia;
          })
        );
      }

      // Filtro por tipo (R22)
      if (tipo) {
        if (tipo !== "palestra" && tipo !== "minicurso") {
          return reply.code(422).send({
            erro: "DADOS_INVALIDOS",
            mensagem: "Tipo inválido. Use 'palestra' ou 'minicurso'",
          });
        }
        atividades = atividades.filter((a) => a.tipo === tipo);
      }

      return reply.send(atividades);
    }
  );

  app.get(
    "/atividades/:id",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!ATIVIDADE_ID_REGEX.test(id)) {
        return reply.code(400).send({
          erro: "ID_INVALIDO",
          mensagem: "ID inválido",
        });
      }
      const db = app.db;
      const result = db.exec(`
        SELECT a.id, a.titulo, a.tipo, a.sala_id as salaId, a.vagas, a.situacao,
               e.id as encontro_id, e.inicio, e.fim
        FROM atividades a
        LEFT JOIN encontros e ON a.id = e.atividade_id
        WHERE a.id = ?
        ORDER BY e.ordem
      `, [id]);
      if (result.length === 0 || result[0].values.length === 0) {
        return reply.code(404).send({
          erro: "NAO_ENCONTRADO",
          mensagem: "Atividade não encontrada",
        });
      }
      const cols = result[0].columns;
      const vals = result[0].values[0];
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      const encontros = result[0].values
        .filter((v) => v[cols.indexOf("encontro_id")] !== null)
        .map((v) => {
          const r: Record<string, unknown> = {};
          cols.forEach((c, i) => { r[c] = v[i]; });
          return { id: r.encontro_id as string, inicio: r.inicio as string, fim: r.fim as string };
        });
      const atividade = {
        id: row.id as string,
        titulo: row.titulo as string,
        tipo: row.tipo as string,
        salaId: row.salaId as string,
        vagas: row.vagas as number,
        encontros,
        cargaHorariaMinutos: encontros.reduce((acc, enc) => acc + duracaoEmMinutos(enc.inicio, enc.fim), 0),
        situacao: calcularSituacao(row.situacao as string, encontros, db),
        ocupadas: 0,
        vagasRestantes: row.vagas as number,
        emEspera: 0,
      };
      return reply.send(atividade);
    }
  );

  // PATCH /atividades/:id
  const PatchAtividadeSchema = z.object({
    titulo: z.string().min(1).optional(),
    vagas: z.number().int().optional(),
    // Permitir campos extras para validar manualmente
    tipo: z.unknown().optional(),
    salaId: z.unknown().optional(),
    encontros: z.unknown().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser informado",
  });

  app.patch(
    "/atividades/:id",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!ATIVIDADE_ID_REGEX.test(id)) {
        return reply.code(400).send({
          erro: "ID_INVALIDO",
          mensagem: "ID inválido",
        });
      }
      const db = app.db;

      // Verificar se atividade existe
      const atividadeResult = db.exec(`SELECT id, titulo, tipo, sala_id, vagas, situacao FROM atividades WHERE id = ?`, [id]);
      if (atividadeResult.length === 0 || atividadeResult[0].values.length === 0) {
        return reply.code(404).send({
          erro: "NAO_ENCONTRADO",
          mensagem: "Atividade não encontrada",
        });
      }
      const row = atividadeResult[0].values[0];
      const atividadeAtual = {
        id: row[0] as string,
        titulo: row[1] as string,
        tipo: row[2] as string,
        salaId: row[3] as string,
        vagas: row[4] as number,
        situacao: row[5] as string,
      };

      // Validar body
      const parseResult = PatchAtividadeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "Corpo da requisição inválido",
        });
      }

      const { titulo, vagas } = parseResult.data;

      // R9: Verificar campos não editáveis (tipo, salaId, encontros)
      // Verificamos se o body contém campos não permitidos
      const bodyKeys = Object.keys(req.body as object);
      const camposNaoEditaveis = ["tipo", "salaId", "encontros"];
      for (const key of bodyKeys) {
        if (camposNaoEditaveis.includes(key)) {
          return reply.code(422).send({
            erro: "CAMPO_NAO_EDITAVEL",
            mensagem: "Campo não pode ser alterado após a criação",
          });
        }
      }

      // R10: Validar vagas (1 a capacidade da sala)
      if (vagas !== undefined) {
        const salaResult = db.exec(`SELECT capacidade FROM salas WHERE id = ?`, [atividadeAtual.salaId]);
        if (salaResult.length === 0 || salaResult[0].values.length === 0) {
          return reply.code(422).send({
            erro: "VAGAS_ACIMA_DA_CAPACIDADE",
            mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
          });
        }
        const capacidade = salaResult[0].values[0][0] as number;
        if (vagas < 1 || vagas > capacidade) {
          return reply.code(422).send({
            erro: "VAGAS_ACIMA_DA_CAPACIDADE",
            mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
          });
        }

        // R11: Validar vagas não pode ser menor que ocupadas
        // No M1, ocupadas = 0 (inscrições são M2), mas mantemos a validação para compatibilidade futura
        const ocupadas = 0; // No M1, não há inscrições
        if (vagas < ocupadas) {
          return reply.code(409).send({
            erro: "VAGAS_ABAIXO_DOS_INSCRITOS",
            mensagem: "Vagas não pode ser menor que a quantidade de inscritos",
          });
        }
      }

      // Atualizar campos
      const novoTitulo = titulo !== undefined ? titulo : atividadeAtual.titulo;
      const novasVagas = vagas !== undefined ? vagas : atividadeAtual.vagas;

      db.run(
        `UPDATE atividades SET titulo = ?, vagas = ? WHERE id = ?`,
        [novoTitulo, novasVagas, id]
      );
      salvarBanco(db);

      // Retornar atividade atualizada
      const encontrosResult = db.exec(`SELECT id, inicio, fim FROM encontros WHERE atividade_id = ? ORDER BY ordem`, [id]);
      const encontros = encontrosResult.length > 0 && encontrosResult[0].values.length > 0
        ? encontrosResult[0].values.map((vals) => {
            const cols = encontrosResult[0].columns;
            const r: Record<string, unknown> = {};
            cols.forEach((c: string, i: number) => { r[c] = vals[i]; });
            return { id: r.id as string, inicio: r.inicio as string, fim: r.fim as string };
          })
        : [];

      const cargaHorariaMinutos = encontros.reduce((acc, enc) => acc + duracaoEmMinutos(enc.inicio, enc.fim), 0);

      const resposta = {
        id: atividadeAtual.id,
        titulo: novoTitulo,
        tipo: atividadeAtual.tipo,
        salaId: atividadeAtual.salaId,
        vagas: novasVagas,
        encontros,
        cargaHorariaMinutos,
        situacao: atividadeAtual.situacao,
        ocupadas: 0,
        vagasRestantes: novasVagas,
        emEspera: 0,
      };

      return reply.send(resposta);
    }
  );

  // R14/R15: Cancelamento de atividade
  app.post(
    "/atividades/:id/cancelamento",
    { preHandler: verifyAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!ATIVIDADE_ID_REGEX.test(id)) {
        return reply.code(400).send({
          erro: "ID_INVALIDO",
          mensagem: "ID inválido",
        });
      }
      const db = app.db;

      // Verificar se atividade existe
      const atividadeResult = db.exec(`SELECT id, titulo, tipo, sala_id, vagas, situacao FROM atividades WHERE id = ?`, [id]);
      if (atividadeResult.length === 0 || atividadeResult[0].values.length === 0) {
        return reply.code(404).send({
          erro: "NAO_ENCONTRADO",
          mensagem: "Atividade não encontrada",
        });
      }
      const row = atividadeResult[0].values[0];
      const situacaoDb = row[5] as string;

      // R15: Verificar se já cancelada (precedência 1)
      if (situacaoDb === "cancelada") {
        return reply.code(422).send({
          erro: "ATIVIDADE_CANCELADA",
          mensagem: "Atividade já cancelada",
        });
      }

      // Buscar encontros para calcular situacao atual
      const encontrosResult = db.exec(`SELECT inicio, fim FROM encontros WHERE atividade_id = ? ORDER BY ordem`, [id]);
      if (encontrosResult.length === 0 || encontrosResult[0].values.length === 0) {
        return reply.code(422).send({
          erro: "ATIVIDADE_JA_INICIADA",
          mensagem: "Atividade sem encontros não pode ser cancelada",
        });
      }

      const cols = encontrosResult[0].columns;
      const encontros: Array<{ inicio: string; fim: string }> = [];
      for (const vals of encontrosResult[0].values) {
        const r: Record<string, unknown> = {};
        cols.forEach((c: string, i: number) => { r[c] = vals[i]; });
        encontros.push({ inicio: r.inicio as string, fim: r.fim as string });
      }

      // Calcular situacao atual usando a mesma lógica dos GETs (R19)
      const situacaoAtual = calcularSituacao(situacaoDb, encontros, db);

      // R14: Só pode cancelar se situacao == "prevista"
      if (situacaoAtual !== "prevista") {
        return reply.code(422).send({
          erro: "ATIVIDADE_JA_INICIADA",
          mensagem: "Atividade já iniciada ou encerrada",
        });
      }

      // R15: Cancelar definitivamente
      db.run(`UPDATE atividades SET situacao = 'cancelada' WHERE id = ?`, [id]);
      salvarBanco(db);

      // Retornar atividade cancelada
      const result = db.exec(`
        SELECT a.id, a.titulo, a.tipo, a.sala_id as salaId, a.vagas, a.situacao,
               e.id as encontro_id, e.inicio, e.fim
        FROM atividades a
        LEFT JOIN encontros e ON a.id = e.atividade_id
        WHERE a.id = ?
        ORDER BY e.ordem
      `, [id]);

      const cols2 = result[0].columns;
      const vals = result[0].values[0];
      const row2: Record<string, unknown> = {};
      cols2.forEach((c, i) => { row2[c] = vals[i]; });
      const encontrosRet = result[0].values
        .filter((v) => v[cols2.indexOf("encontro_id")] !== null)
        .map((v) => {
          const r: Record<string, unknown> = {};
          cols2.forEach((c, i) => { r[c] = v[i]; });
          return { id: r.encontro_id as string, inicio: r.inicio as string, fim: r.fim as string };
        });

      const atividade = {
        id: row2.id as string,
        titulo: row2.titulo as string,
        tipo: row2.tipo as string,
        salaId: row2.salaId as string,
        vagas: row2.vagas as number,
        encontros: encontrosRet,
        cargaHorariaMinutos: encontrosRet.reduce((acc, enc) => acc + duracaoEmMinutos(enc.inicio, enc.fim), 0),
        situacao: row2.situacao as string,
        ocupadas: 0,
        vagasRestantes: row2.vagas as number,
        emEspera: 0,
      };
      return reply.send(atividade);
    }
  );
}