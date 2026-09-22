import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3015;
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
  atividadeId?: string;
  encontroId?: string;
} = {}) {
  const db = server.db;
  const atividadeId = opts.atividadeId ?? "atv_a1b2c3d4";
  const encontroId = opts.encontroId ?? "enc_5e6f7a8b";
  db.run(
    "INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao) VALUES (?, 'Palestra de teste', 'palestra', 'sala-101', 40, 'prevista')",
    [atividadeId]
  );
  db.run(
    "INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES (?, ?, '2026-10-19T10:00:00-03:00', '2026-10-19T11:00:00-03:00', 1)",
    [encontroId, atividadeId]
  );
  for (const i of opts.inscricoes ?? []) {
    db.run(
      "INSERT INTO inscricoes (id, atividade_id, participante_id, status) VALUES (?, ?, ?, ?)",
      [`ins_${i.participanteId}_${i.status}_${encontroId}`, atividadeId, i.participanteId, i.status]
    );
  }
  return { atividadeId, encontroId };
}

async function resetar(agora: string, opts: Parameters<typeof semearEncontro>[0] = {}) {
  await fetchJson("/_teste/reset", { method: "POST" });
  await fetchJson("/_teste/relogio", {
    method: "PUT",
    body: JSON.stringify({ agora }),
  });
  return semearEncontro(opts);
}

async function obterCodigo() {
  const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
    headers: { "X-Usuario": "org-ana" },
  });
  assert.equal(r.status, 200);
  return (r.body as { codigo: string }).codigo;
}

async function registrarPresenca(participanteId: string, corpo: Record<string, unknown>) {
  return fetchJson("/encontros/enc_5e6f7a8b/presencas", {
    method: "POST",
    headers: { "X-Usuario": participanteId },
    body: JSON.stringify(corpo),
  });
}

describe("M3 Fatia 6 - Listagem de presenças (R19, R20)", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R20 - listagem compõe presenças manual, qr e qr_offline com a origem e a justificativa corretas", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [
        { participanteId: "p-carla", status: "confirmada" },
        { participanteId: "p-diego", status: "confirmada" },
        { participanteId: "p-elisa", status: "confirmada" },
      ],
    });

    const codigo = await obterCodigo();

    const manual = await fetchJson("/encontros/enc_5e6f7a8b/presencas/manual", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        participanteId: "p-carla",
        justificativa: "Presença registrada pela coordenação",
      }),
    });
    assert.equal(manual.status, 201);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:16:00-03:00" }),
    });
    const qr = await registrarPresenca("p-diego", { codigo });
    assert.equal(qr.status, 201);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:16:30-03:00" }),
    });
    const qrOffline = await registrarPresenca("p-elisa", {
      codigo,
      lidoEm: "2026-10-19T10:16:00-03:00",
    });
    assert.equal(qrOffline.status, 201);

    const lista = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(lista.status, 200);
    const presencas = lista.body as Array<{
      id: string;
      encontroId: string;
      participanteId: string;
      origem: string;
      lidoEm: string | null;
      registradaEm: string;
      justificativa: string | null;
    }>;
    assert.equal(presencas.length, 3);

    const porParticipante = new Map(presencas.map((p) => [p.participanteId, p]));

    const m = porParticipante.get("p-carla")!;
    assert.equal(m.origem, "manual");
    assert.equal(m.lidoEm, null);
    assert.equal(m.encontroId, "enc_5e6f7a8b");
    assert.equal(m.justificativa, "Presença registrada pela coordenação");
    assert.equal(
      new Date(m.registradaEm).toISOString(),
      new Date("2026-10-19T10:15:30-03:00").toISOString()
    );

    const q = porParticipante.get("p-diego")!;
    assert.equal(q.origem, "qr");
    assert.equal(q.justificativa, null);
    assert.equal(
      new Date(q.lidoEm as string).toISOString(),
      new Date("2026-10-19T10:16:00-03:00").toISOString()
    );
    assert.equal(
      new Date(q.registradaEm).toISOString(),
      new Date("2026-10-19T10:16:00-03:00").toISOString()
    );

    const o = porParticipante.get("p-elisa")!;
    assert.equal(o.origem, "qr_offline");
    assert.equal(o.justificativa, null);
    assert.equal(
      new Date(o.lidoEm as string).toISOString(),
      new Date("2026-10-19T10:16:00-03:00").toISOString()
    );
    assert.equal(
      new Date(o.registradaEm).toISOString(),
      new Date("2026-10-19T10:16:30-03:00").toISOString()
    );
  });

  it("R19 - listagem ordena as presenças por registradaEm crescente", async () => {
    await resetar("2026-10-19T10:15:30-03:00");
    const db = server.db;
    db.run(
      `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
       VALUES ('pre_aaaa0001', 'enc_5e6f7a8b', 'p-diego', 'qr', '2026-10-19T10:17:30-03:00', '2026-10-19T10:17:30-03:00', NULL)`
    );
    db.run(
      `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
       VALUES ('pre_aaaa0002', 'enc_5e6f7a8b', 'p-carla', 'qr', '2026-10-19T10:15:30-03:00', '2026-10-19T10:15:30-03:00', NULL)`
    );
    db.run(
      `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
       VALUES ('pre_aaaa0003', 'enc_5e6f7a8b', 'p-elisa', 'manual', NULL, '2026-10-19T10:16:30-03:00', 'Presença registrada pela coordenação')`
    );

    const lista = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(lista.status, 200);
    const presencas = lista.body as Array<{
      participanteId: string;
      registradaEm: string;
    }>;
    assert.equal(presencas.length, 3);
    assert.deepEqual(
      presencas.map((p) => p.participanteId),
      ["p-carla", "p-elisa", "p-diego"]
    );
    const registradas = presencas.map((p) => new Date(p.registradaEm).getTime());
    assert.deepEqual(registradas, [...registradas].sort((a, b) => a - b));
  });

  it("R19 - listagem retorna apenas as presenças do encontro da rota, sem filtros adicionais", async () => {
    await resetar("2026-10-19T10:15:30-03:00");
    semearEncontro({
      atividadeId: "atv_2e3f4a5b",
      encontroId: "enc_9a8b7c6d",
    });
    const db = server.db;
    db.run(
      `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
       VALUES ('pre_aaaa0001', 'enc_5e6f7a8b', 'p-carla', 'qr', '2026-10-19T10:15:30-03:00', '2026-10-19T10:15:30-03:00', NULL)`
    );
    db.run(
      `INSERT INTO presencas (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
       VALUES ('pre_aaaa0002', 'enc_9a8b7c6d', 'p-diego', 'qr', '2026-10-19T10:15:30-03:00', '2026-10-19T10:15:30-03:00', NULL)`
    );

    const lista = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(lista.status, 200);
    const presencas = lista.body as Array<{
      id: string;
      participanteId: string;
      encontroId: string;
    }>;
    assert.equal(presencas.length, 1);
    assert.equal(presencas[0].id, "pre_aaaa0001");
    assert.equal(presencas[0].participanteId, "p-carla");
    assert.equal(presencas[0].encontroId, "enc_5e6f7a8b");
  });
});