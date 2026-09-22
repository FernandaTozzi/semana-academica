import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3013;
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

describe("M3 Fatia 4 - Precedência do POST online (R13, R10)", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R13 - POST de participante não inscrito com código inválido retorna 403 NAO_INSCRITO antes de CODIGO_INVALIDO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-diego", status: "em_espera" }],
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-diego" },
      body: JSON.stringify({ codigo: "ZZZZZZ" }),
    });
    assert.equal(r.status, 403);
    assert.equal((r.body as { erro: string }).erro, "NAO_INSCRITO");
  });

  it("R13 - POST de participante não inscrito com lidoEm na janela e envio após 2h do fim retorna 403 NAO_INSCRITO antes de SINCRONIZACAO_TARDIA", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-diego", status: "em_espera" }],
    });

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T13:00:01-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-diego" },
      body: JSON.stringify({ codigo: "ZZZZZZ", lidoEm: "2026-10-19T10:15:30-03:00" }),
    });
    assert.equal(r.status, 403);
    assert.equal((r.body as { erro: string }).erro, "NAO_INSCRITO");
  });

  it("R13 - POST com lidoEm dentro da janela, código errado e envio após 2h do fim retorna 422 SINCRONIZACAO_TARDIA antes de FORA_DA_JANELA e CODIGO_INVALIDO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T13:00:01-03:00" }),
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: "ZZZZZZ", lidoEm: "2026-10-19T10:15:30-03:00" }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "SINCRONIZACAO_TARDIA");
  });

  it("R13 - POST com código errado e lidoEm fora da janela retorna 422 FORA_DA_JANELA antes de CODIGO_INVALIDO", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo: "ZZZZZZ", lidoEm: "2026-10-19T09:30:00-03:00" }),
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "FORA_DA_JANELA");
  });

  it("R10 - POST de presença nunca devolve ATIVIDADE_CANCELADA, mesmo com a atividade cancelada (GET /codigo já recusa)", async () => {
    await resetar("2026-10-19T10:15:30-03:00", {
      inscricoes: [{ participanteId: "p-carla", status: "confirmada" }],
    });

    const codigo = await obterCodigo();

    const db = server.db;
    db.run(
      "UPDATE atividades SET situacao = 'cancelada' WHERE id = 'atv_a1b2c3d4'"
    );
    db.run(
      "UPDATE inscricoes SET status = 'cancelada' WHERE participante_id = 'p-carla' AND atividade_id = 'atv_a1b2c3d4'"
    );

    const rGet = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(rGet.status, 422);
    assert.equal((rGet.body as { erro: string }).erro, "ATIVIDADE_CANCELADA");

    const r = await fetchJson("/encontros/enc_5e6f7a8b/presencas", {
      method: "POST",
      headers: { "X-Usuario": "p-carla" },
      body: JSON.stringify({ codigo }),
    });
    assert.equal(r.status, 403);
    assert.equal((r.body as { erro: string }).erro, "NAO_INSCRITO");
    assert.notEqual((r.body as { erro: string }).erro, "ATIVIDADE_CANCELADA");
  });
});