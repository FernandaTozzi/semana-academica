import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3003";

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

describe("Fatia 1 — Leitura básica", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3003";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3003 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("POST /_teste/reset retorna 204", async () => {
    const { status } = await fetchJson("/_teste/reset", { method: "POST" });
    assert.equal(status, 204);
  });

  it("GET /salas retorna as 3 salas definidas na entrevista", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/salas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    const salas = body as Array<{ id: string; nome: string; capacidade: number }>;
    assert.equal(salas.length, 3);
    const ids = salas.map((s) => s.id).sort();
    assert.deepEqual(ids, ["sala_01", "sala_02", "sala_03"]);
    const sala01 = salas.find((s) => s.id === "sala_01");
    assert.ok(sala01);
    assert.equal(sala01?.nome, "Sala 01");
    assert.equal(sala01?.capacidade, 30);
    const sala02 = salas.find((s) => s.id === "sala_02");
    assert.ok(sala02);
    assert.equal(sala02?.nome, "Sala 02");
    assert.equal(sala02?.capacidade, 60);
    const sala03 = salas.find((s) => s.id === "sala_03");
    assert.ok(sala03);
    assert.equal(sala03?.nome, "Auditório");
    assert.equal(sala03?.capacidade, 100);
  });

  it("GET /atividades sem filtros retorna lista vazia após reset", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal((body as Array<unknown>).length, 0);
  });

  it("GET /atividades/:id com ID válido mas inexistente retorna 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 404);
    assert.deepEqual(body, {
      erro: "NAO_ENCONTRADO",
      mensagem: "Atividade não encontrada",
    });
  });

  it("GET /atividades/:id com ID malformado retorna 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 400);
    assert.deepEqual(body, {
      erro: "ID_INVALIDO",
      mensagem: "ID inválido",
    });
  });
});