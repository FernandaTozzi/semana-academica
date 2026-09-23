import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3001";

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

describe("Modo de teste - infraestrutura", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3001";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3001 }, resolve));
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

  it("após reset, GET /_teste/relogio retorna o relógio inicial 2026-10-13T09:00:00-03:00", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/_teste/relogio");
    assert.equal(status, 200);
    assert.deepEqual(body, { agora: "2026-10-13T09:00:00-03:00" });
  });

  it("após reset, dados iniciais de usuários são carregados", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Verifica se usuários existem fazendo uma requisição autenticada
    const { status } = await fetchJson("/salas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
  });

  it("após reset, dados iniciais de salas são carregados", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/salas", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal((body as Array<{ id: string }>).length, 3);
    const ids = (body as Array<{ id: string }>).map((s) => s.id).sort();
    assert.deepEqual(ids, ["sala_01", "sala_02", "sala_03"]);
  });

  it("sem MODO_TESTE, rotas /_teste/* retornam 404", async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3002 }, resolve));

    const { status: statusReset } = await fetch("http://localhost:3002/_teste/reset", {
      method: "POST",
    });
    assert.equal(statusReset, 404);

    const { status: statusRelogioGet } = await fetch("http://localhost:3002/_teste/relogio");
    assert.equal(statusRelogioGet, 404);

    const { status: statusRelogioPut } = await fetch("http://localhost:3002/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-13T09:00:00-03:00" }),
    });
    assert.equal(statusRelogioPut, 404);

    await server.close();
    process.env.MODO_TESTE = "1";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3001 }, resolve));
  });
});