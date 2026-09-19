import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3011;
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
  inicio?: string;
  fim?: string;
} = {}) {
  const db = server.db;
  const inicio = opts.inicio ?? "2026-10-19T10:00:00-03:00";
  const fim = opts.fim ?? "2026-10-19T11:00:00-03:00";
  db.run(
    "INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao) VALUES (?, 'Palestra de teste', 'palestra', 'sala-101', 40, 'prevista')",
    ["atv_a1b2c3d4"]
  );
  db.run(
    "INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES ('enc_5e6f7a8b', 'atv_a1b2c3d4', ?, ?, 1)",
    [inicio, fim]
  );
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

async function obterCodigo() {
  const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
    headers: { "X-Usuario": "org-ana" },
  });
  assert.equal(r.status, 200);
  return (r.body as { codigo: string }).codigo;
}

describe("M3 Fatia 2 - Presença online básica", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R8 - POST sem lidoEm de inscrito confirmado retorna 201 com origem='qr' e lidoEm=registradaEm=relógio", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 201);
    const body = r.body as {
      id: string;
      encontroId: string;
      participanteId: string;
      origem: string;
      lidoEm: string;
      registradaEm: string;
      justificativa: string | null;
    };
    assert.match(body.id, /^pre_[0-9a-f]{8}$/);
    assert.equal(body.encontroId, "enc_5e6f7a8b");
    assert.equal(body.participanteId, "p-carla");
    assert.equal(body.origem, "qr");
    assert.equal(
      new Date(body.lidoEm).toISOString(),
      new Date("2026-10-19T10:15:30-03:00").toISOString()
    );
    assert.equal(
      new Date(body.registradaEm).toISOString(),
      new Date("2026-10-19T10:15:30-03:00").toISOString()
    );
    assert.equal(body.justificativa, null);
  });

  it("R7 - POST de participante com inscrição em_espera retorna 403 NAO_INSCRITO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-diego", status: "em_espera" }],
    });

    const codigo = await obterCodigo();

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-diego" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 403);
    assert.equal((r.body as { erro: string }).erro, "NAO_INSCRITO");
  });

  it("R6 - POST com relógio fora de [inicio-15, inicio+30] retorna 422 FORA_DA_JANELA", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T09:44:00-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "FORA_DA_JANELA");
  });

  it("R6 - POST com relógio em inicio+30 min:00 (borda) retorna 201", async () => {
    await resetar("2026-10-19T10:30:00-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 201);
  });

  it("R9 - POST com código que nunca foi gerado retorna 422 CODIGO_INVALIDO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();
    const codigoInvalido = codigo.startsWith("A") ? "B" + codigo.slice(1) : "A" + codigo.slice(1);

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: codigoInvalido }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "CODIGO_INVALIDO");
  });

  it("R14 - POST com o código da janela anterior (dentro da janela de presença) retorna 201", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigoJanelaAnterior = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:16:00-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: codigoJanelaAnterior }),
    });
    assert.equal(r.status, 201);
  });

  it("R12 - segundo POST do mesmo participante/encontro retorna 200 mantendo lidoEm/registradaEm/origem", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();
    const cab = { "X-Usuario": "p-carla" };

    const r1 = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: cab,
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r1.status, 201);
    const primeira = r1.body as Record<string, unknown>;

    const r2 = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: cab,
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r2.status, 200);
    const segunda = r2.body as Record<string, unknown>;

    assert.equal(segunda.origem, primeira.origem);
    assert.equal(segunda.lidoEm, primeira.lidoEm);
    assert.equal(segunda.registradaEm, primeira.registradaEm);
    assert.equal(segunda.id, primeira.id);
  });

  it("R9 - POST com código já expirado (fora das janelas atual e anterior) retorna 422 CODIGO_INVALIDO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:18:00-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "CODIGO_INVALIDO");
  });

  it("R5 - validade do código é restrita ao par (encontro, janela): código de outro encontro é rejeitado", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const db = server.db;
    db.run(
      "INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao) VALUES ('atv_2e3f4a5b', 'Outra atividade', 'palestra', 'sala-102', 40, 'prevista')"
    );
    db.run(
      "INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES ('enc_9a8b7c6d', 'atv_2e3f4a5b', '2026-10-19T10:00:00-03:00', '2026-10-19T11:00:00-03:00', 1)"
    );
    db.run(
      "INSERT INTO inscricoes (id, atividade_id, participante_id, status) VALUES ('ins_c_confirmada_2', 'atv_2e3f4a5b', 'p-carla', 'confirmada')"
    );

    const codigoA = await obterCodigo();
    const rOutro = await fetchJson("/encontros/enc_9a8b7c6d/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(rOutro.status, 200);
    const codigoB = (rOutro.body as { codigo: string }).codigo;
    assert.notEqual(codigoB, codigoA);

    const rRejeita = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: codigoB }),
    });
    assert.equal(rRejeita.status, 422);
    assert.equal((rRejeita.body as { erro: string }).erro, "CODIGO_INVALIDO");

    const rAceita = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: codigoA }),
    });
    assert.equal(rAceita.status, 201);
  });
});