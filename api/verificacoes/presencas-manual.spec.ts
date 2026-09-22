import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3014;
const BASE_URL = `http://localhost:${PORT}`;

async function fetchJson(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, headers: res.headers };
}

function semearEncontro(opts: {
  inscricoes?: Array<{ participanteId: string; status: string }>;
  novosParticipantes?: string[];
} = {}) {
  const db = server.db;
  db.run(
    "INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao) VALUES (?, 'Palestra de teste', 'palestra', 'sala-101', 40, 'prevista')",
    ["atv_a1b2c3d4"]
  );
  db.run(
    "INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES ('enc_5e6f7a8b', 'atv_a1b2c3d4', ?, ?, 1)",
    ["2026-10-19T10:00:00-03:00", "2026-10-19T11:00:00-03:00"]
  );
  for (const p of opts.novosParticipantes ?? []) {
    db.run(
      "INSERT OR REPLACE INTO usuarios (id, nome, papel) VALUES (?, ?, 'participante')",
      [p, `Participante ${p}`]
    );
  }
  for (const i of opts.inscricoes ?? []) {
    db.run(
      "INSERT INTO inscricoes (id, atividade_id, participante_id, status) VALUES (?, 'atv_a1b2c3d4', ?, ?)",
      [`ins_${i.participanteId}_${i.status}`, i.participanteId, i.status]
    );
  }
}

async function resetar(agora: string, opts: Parameters<typeof semearEncontro>[0] = {}) {
  await fetchJson("/_teste/reset", { method: "POST" });
  await fetchJson("/_teste/relogio", {
    method: "PUT",
    body: JSON.stringify({ agora }),
  });
  semearEncontro(opts);
}

async function registrarManual(participanteId: string, justificativa?: string) {
  const corpo: Record<string, unknown> = { participanteId };
  if (justificativa !== undefined) corpo.justificativa = justificativa;
  return fetchJson("/encontros/enc_5e6f7a8b/presencas/manual", {
    method: "POST",
    headers: { "X-Usuario": "org-ana" },
    body: JSON.stringify(corpo),
  });
}

describe("M3 Fatia 5 - Presença manual (R15-R18)", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R20 - POST manual de inscrito confirmado retorna 201 com origem='manual', lidoEm=null e justificativa preenchida", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const r = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(r.status, 201);
    const body = r.body as {
      id: string;
      encontroId: string;
      participanteId: string;
      origem: string;
      lidoEm: string | null;
      registradaEm: string;
      justificativa: string | null;
    };
    assert.match(body.id, /^pre_[0-9a-f]{8}$/);
    assert.equal(body.encontroId, "enc_5e6f7a8b");
    assert.equal(body.participanteId, "p-carla");
    assert.equal(body.origem, "manual");
    assert.equal(body.lidoEm, null);
    assert.equal(
      new Date(body.registradaEm).toISOString(),
      new Date("2026-10-19T10:15:30-03:00").toISOString()
    );
    assert.equal(body.justificativa, "Presença registrada pela coordenação");
  });

  it("R16 - POST manual sem justificativa retorna 422 JUSTIFICATIVA_OBRIGATORIA", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const r = await registrarManual("p-carla");
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "JUSTIFICATIVA_OBRIGATORIA");
  });

  it("R16 - justificativa de 9 caracteres retorna 422 JUSTIFICATIVA_OBRIGATORIA; de 10 retorna 201", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const r9 = await registrarManual("p-carla", "justifica");
    assert.equal(r9.status, 422);
    assert.equal((r9.body as { erro: string }).erro, "JUSTIFICATIVA_OBRIGATORIA");

    const r10 = await registrarManual("p-carla", "compareceu");
    assert.equal(r10.status, 201);
  });

  it("R18 - justificativa obrigatória vem antes da presença já existente (200): sem justificativa retorna 422 mesmo com presença registrada", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const r1 = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(r1.status, 201);
    const primeira = r1.body as {
      id: string;
      origem: string;
      lidoEm: string | null;
      registradaEm: string;
      justificativa: string | null;
    };

    const rSemJust = await registrarManual("p-carla");
    assert.equal(rSemJust.status, 422);
    assert.equal((rSemJust.body as { erro: string }).erro, "JUSTIFICATIVA_OBRIGATORIA");

    const r2 = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(r2.status, 200);
    const segunda = r2.body as {
      id: string;
      origem: string;
      lidoEm: string | null;
      registradaEm: string;
      justificativa: string | null;
    };
    assert.equal(segunda.id, primeira.id);
    assert.equal(segunda.origem, primeira.origem);
    assert.equal(segunda.lidoEm, primeira.lidoEm);
    assert.equal(segunda.registradaEm, primeira.registradaEm);
    assert.equal(segunda.justificativa, primeira.justificativa);
  });

  it("R18 - ordem: justificativa e presença existente vêm antes de NAO_INSCRITO; NAO_INSCRITO vem antes de fora da janela", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [
        { participanteId: "p-carla", status: "confirmada" },
        { participanteId: "p-diego", status: "em_espera" },
      ],
    });

    const semJust = await registrarManual("p-diego");
    assert.equal(semJust.status, 422);
    assert.equal((semJust.body as { erro: string }).erro, "JUSTIFICATIVA_OBRIGATORIA");

    const registrada = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(registrada.status, 201);
    const db = server.db;
    db.run(
      "UPDATE inscricoes SET status = 'em_espera' WHERE participante_id = 'p-carla' AND atividade_id = 'atv_a1b2c3d4'"
    );
    const comPresenca = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(comPresenca.status, 200);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T09:44:00-03:00" }),
    });
    const naoInscrito = await registrarManual("p-diego", "Presença fora da janela");
    assert.equal(naoInscrito.status, 403);
    assert.equal((naoInscrito.body as { erro: string }).erro, "NAO_INSCRITO");
  });

  it("R15 - relógio 16 min antes do início retorna 422 FORA_DA_JANELA; 15 min antes (borda) aceita", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T09:44:00-03:00" }),
    });
    const fora = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(fora.status, 422);
    assert.equal((fora.body as { erro: string }).erro, "FORA_DA_JANELA");

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T09:45:00-03:00" }),
    });
    const borda = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(borda.status, 201);
  });

  it("R15 - borda fim + 2h aceita; fim + 2h + 1 min retorna 422 FORA_DA_JANELA", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [
        { participanteId: "p-carla", status: "confirmada" },
        { participanteId: "p-diego", status: "confirmada" },
      ],
    });

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T13:00:00-03:00" }),
    });
    const borda = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(borda.status, 201);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T13:01:00-03:00" }),
    });
    const depois = await registrarManual("p-diego", "Presença registrada pela coordenação");
    assert.equal(depois.status, 422);
    assert.equal((depois.body as { erro: string }).erro, "FORA_DA_JANELA");
  });

  it("R17 - com 13 inscrições confirmadas o teto é 2: 2ª manual aceita (201), 3ª retorna 422 LIMITE_DE_MANUAIS", async () => {
    const existentes = ["p-carla", "p-diego", "p-elisa", "p-fabio", "p-gabriela", "p-heitor", "p-isadora", "p-joao"];
    const novos = ["p-x1", "p-x2", "p-x3", "p-x4", "p-x5"];
    await resetar("2026-10-19T10:15:30-03:00", {
      novosParticipantes: novos,
      inscricoes: [...existentes, ...novos].map((participanteId) => ({
        participanteId,
        status: "confirmada",
      })),
    });

    const r1 = await registrarManual("p-carla", "Presença registrada pela coordenação");
    assert.equal(r1.status, 201);

    const r2 = await registrarManual("p-diego", "Presença registrada pela coordenação");
    assert.equal(r2.status, 201);

    const r3 = await registrarManual("p-elisa", "Presença registrada pela coordenação");
    assert.equal(r3.status, 422);
    assert.equal((r3.body as { erro: string }).erro, "LIMITE_DE_MANUAIS");
  });
});
