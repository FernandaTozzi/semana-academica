import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3009";

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

describe("Fatia 7 — Cancelamento de atividade", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3009";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3009 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("POST /atividades/:id/cancelamento com atividade prevista retorna 200 e situacao=cancelada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Para Cancelar",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    const { status, body } = await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const cancelada = body as { situacao: string; id: string };
    assert.equal(cancelada.situacao, "cancelada");
    assert.equal(cancelada.id, atividade.id);
  });

  it("após cancelamento, GET /atividades/:id retorna situacao=cancelada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Get Cancelada",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const consultada = body as { situacao: string };
    assert.equal(consultada.situacao, "cancelada");
  });

  it("atividade cancelada continua aparecendo em GET /atividades", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Listar Cancelada",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; situacao: string }>;
    const cancelada = atividades.find((a) => a.id === atividade.id);
    assert.ok(cancelada);
    assert.equal(cancelada.situacao, "cancelada");
  });

  it("POST /atividades/:id/cancelamento em atividade já cancelada retorna 422 ATIVIDADE_CANCELADA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Cancelar Duas Vezes",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ATIVIDADE_CANCELADA",
      mensagem: "Atividade já cancelada",
    });
  });

  it("POST /atividades/:id/cancelamento em atividade em_andamento retorna 422 ATIVIDADE_JA_INICIADA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Em Andamento",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para durante a atividade
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ATIVIDADE_JA_INICIADA",
      mensagem: "Atividade já iniciada ou encerrada",
    });
  });

  it("POST /atividades/:id/cancelamento em atividade encerrada retorna 422 ATIVIDADE_JA_INICIADA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Encerrada",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para depois da atividade
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T13:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ATIVIDADE_JA_INICIADA",
      mensagem: "Atividade já iniciada ou encerrada",
    });
  });

  it("precedência: ATIVIDADE_CANCELADA antes de ATIVIDADE_JA_INICIADA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Precedencia",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Cancela primeiro
    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    // Avança relógio para durante a atividade
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });

    // Tenta cancelar novamente - deve dar ATIVIDADE_CANCELADA (precedência)
    const { status, body } = await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ATIVIDADE_CANCELADA",
      mensagem: "Atividade já cancelada",
    });
  });

  it("POST /atividades/:id/cancelamento com ID malformado retorna 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc/cancelamento", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 400);
    assert.deepEqual(body, {
      erro: "ID_INVALIDO",
      mensagem: "ID inválido",
    });
  });

  it("POST /atividades/:id/cancelamento com ID válido mas inexistente retorna 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000/cancelamento", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 404);
    assert.deepEqual(body, {
      erro: "NAO_ENCONTRADO",
      mensagem: "Atividade não encontrada",
    });
  });

  it("atividade cancelada não gera conflito de sala", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria primeira atividade
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Para Cancelar",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Cancela a primeira atividade
    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    // Tenta criar segunda atividade no mesmo horário/sala
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Nova",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    assert.ok((body as { id: string }).id.startsWith("atv_"));
  });
});