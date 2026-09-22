import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3012;
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

describe("M3 Fatia 3 - Presença offline (lidoEm)", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R11 - POST com lidoEm dentro da janela, código válido nesse instante e envio até 2h após o fim retorna 201 com origem='qr_offline'", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T12:00:00-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo, lidoEm: "2026-10-19T10:15:30-03:00" }),
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
    assert.equal(body.origem, "qr_offline");
    assert.equal(
      new Date(body.lidoEm).toISOString(),
      new Date("2026-10-19T10:15:30-03:00").toISOString()
    );
    assert.equal(
      new Date(body.registradaEm).toISOString(),
      new Date("2026-10-19T12:00:00-03:00").toISOString()
    );
    assert.equal(body.justificativa, null);
  });

  it("R11 - POST com lidoEm dentro da janela, mas envio após 2h do fim do encontro retorna 422 SINCRONIZACAO_TARDIA", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T13:00:01-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo, lidoEm: "2026-10-19T10:15:30-03:00" }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "SINCRONIZACAO_TARDIA");
  });

  it("R11 - POST com lidoEm posterior ao envio valida janela e código pelo instante do envio", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:16:30-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo, lidoEm: "2026-10-19T10:18:00-03:00" }),
    });
    assert.equal(r.status, 201);
    const body = r.body as {
      origem: string;
      lidoEm: string;
      registradaEm: string;
    };
    assert.equal(body.origem, "qr_offline");
    assert.equal(
      new Date(body.lidoEm).toISOString(),
      new Date("2026-10-19T10:18:00-03:00").toISOString()
    );
    assert.equal(
      new Date(body.registradaEm).toISOString(),
      new Date("2026-10-19T10:16:30-03:00").toISOString()
    );
  });
});