import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const PORT = 3010;
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

function semearEncontro(cancelada = false) {
  const db = server.db;
  db.run(
    "INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, situacao) VALUES (?, ?, 'palestra', 'sala-101', 40, ?)",
    ["atv_a1b2c3d4", "Palestra de teste", cancelada ? "cancelada" : "prevista"]
  );
  db.run(
    "INSERT INTO encontros (id, atividade_id, inicio, fim, ordem) VALUES ('enc_5e6f7a8b', 'atv_a1b2c3d4', ?, ?, 1)",
    ["2026-10-19T10:00:00-03:00", "2026-10-19T11:00:00-03:00"]
  );
}

async function resetar(agora: string, cancelada = false) {
  await fetchJson("/_teste/reset", { method: "POST" });
  await fetchJson("/_teste/relogio", {
    method: "PUT",
    body: JSON.stringify({ agora }),
  });
  semearEncontro(cancelada);
}

describe("M3 Fatia 1 - Código do encontro", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: PORT }, resolve));
  });

  after(async () => {
    await server.close();
  });

  it("R4 - consultas na mesma janela devolvem o mesmo código; na janela seguinte, outro", async () => {
    await resetar("2026-10-19T10:15:30-03:00");
    const cab = { headers: { "X-Usuario": "org-ana" } };

    const r1 = await fetchJson("/encontros/enc_5e6f7a8b/codigo", cab);
    assert.equal(r1.status, 200);
    const corpo1 = r1.body as { codigo: string };

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:15:55-03:00" }),
    });
    const r2 = await fetchJson("/encontros/enc_5e6f7a8b/codigo", cab);
    assert.equal(r2.status, 200);
    const corpo2 = r2.body as { codigo: string };
    assert.equal(corpo2.codigo, corpo1.codigo);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:16:00-03:00" }),
    });
    const r3 = await fetchJson("/encontros/enc_5e6f7a8b/codigo", cab);
    assert.equal(r3.status, 200);
    const corpo3 = r3.body as { codigo: string };
    assert.notEqual(corpo3.codigo, corpo1.codigo);
  });

  it("R3 - relógio em 10:15:30: trocaEm=10:16:00 e validoAte=10:17:00", async () => {
    await resetar("2026-10-19T10:15:30-03:00");
    const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r.status, 200);
    const body = r.body as { codigo: string; trocaEm: string; validoAte: string };
    assert.match(body.codigo, /^[A-Z0-9]{6}$/);
    assert.equal(
      new Date(body.trocaEm).toISOString(),
      new Date("2026-10-19T10:16:00-03:00").toISOString()
    );
    assert.equal(
      new Date(body.validoAte).toISOString(),
      new Date("2026-10-19T10:17:00-03:00").toISOString()
    );
  });

  it("R2 - encontro de atividade cancelada (relógio dentro da janela) retorna 422 ATIVIDADE_CANCELADA", async () => {
    await resetar("2026-10-19T10:00:00-03:00", true);
    const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "ATIVIDADE_CANCELADA");
  });

  it("R1 - fora da janela 16 min antes do início retorna 422 FORA_DA_JANELA", async () => {
    await resetar("2026-10-19T09:44:00-03:00");
    const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "FORA_DA_JANELA");
  });

  it("R1 - fora da janela 31 min após o início retorna 422 FORA_DA_JANELA", async () => {
    await resetar("2026-10-19T10:31:00-03:00");
    const r = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r.status, 422);
    assert.equal((r.body as { erro: string }).erro, "FORA_DA_JANELA");
  });

  it("R1 - bordas da janela de obtenção: início - 15 min e início + 30 min retornam 200", async () => {
    await resetar("2026-10-19T09:45:00-03:00");
    const r1 = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r1.status, 200);
    const body1 = r1.body as {
      encontroId: string;
      codigo: string;
      trocaEm: string;
      validoAte: string;
    };
    assert.equal(body1.encontroId, "enc_5e6f7a8b");
    assert.match(body1.codigo, /^[A-Z0-9]{6}$/);
    assert.ok(body1.trocaEm);
    assert.ok(body1.validoAte);

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      body: JSON.stringify({ agora: "2026-10-19T10:30:00-03:00" }),
    });
    const r2 = await fetchJson("/encontros/enc_5e6f7a8b/codigo", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(r2.status, 200);
  });
});