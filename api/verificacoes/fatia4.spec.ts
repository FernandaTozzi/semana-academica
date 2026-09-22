import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3006";

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

describe("Fatia 4 — Conflitos de sala", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3006";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3006 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("POST /atividades com sobreposição na mesma sala retorna 409 CONFLITO_DE_SALA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria primeira atividade
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    // Tenta criar segunda atividade com sobreposição
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T11:00:00-03:00", fim: "2026-10-19T13:00:00-03:00" }],
      }),
    });
    assert.equal(status, 409);
    assert.deepEqual(body, {
      erro: "CONFLITO_DE_SALA",
      mensagem: "Conflito de horário com outra atividade na mesma sala",
    });
  });

  it("POST /atividades com segundo encontro começando antes do primeiro terminar retorna 409 CONFLITO_DE_SALA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T11:30:00-03:00", fim: "2026-10-19T13:30:00-03:00" }],
      }),
    });
    assert.equal(status, 409);
    assert.deepEqual(body, {
      erro: "CONFLITO_DE_SALA",
      mensagem: "Conflito de horário com outra atividade na mesma sala",
    });
  });

  it("POST /atividades com intervalo de 10 minutos retorna 409 CONFLITO_DE_SALA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T12:10:00-03:00", fim: "2026-10-19T14:10:00-03:00" }],
      }),
    });
    assert.equal(status, 409);
    assert.deepEqual(body, {
      erro: "CONFLITO_DE_SALA",
      mensagem: "Conflito de horário com outra atividade na mesma sala",
    });
  });

  it("POST /atividades com intervalo de 14 minutos retorna 409 CONFLITO_DE_SALA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T12:14:00-03:00", fim: "2026-10-19T14:14:00-03:00" }],
      }),
    });
    assert.equal(status, 409);
    assert.deepEqual(body, {
      erro: "CONFLITO_DE_SALA",
      mensagem: "Conflito de horário com outra atividade na mesma sala",
    });
  });

  it("POST /atividades com intervalo exatamente 15 minutos retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T12:15:00-03:00", fim: "2026-10-19T14:15:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    assert.ok((body as { id: string }).id.startsWith("atv_"));
  });

  it("POST /atividades com intervalo superior a 15 minutos retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T12:30:00-03:00", fim: "2026-10-19T14:30:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    assert.ok((body as { id: string }).id.startsWith("atv_"));
  });

  it("POST /atividades na mesma janela mas salas diferentes retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade Sala 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade Sala 2",
        tipo: "palestra",
        salaId: "sala_02",
        vagas: 20,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    assert.ok((body as { id: string }).id.startsWith("atv_"));
  });

  it("POST /atividades com atividade cancelada não gera conflito", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria primeira atividade
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade Para Cancelar",
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
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    assert.ok((body as { id: string }).id.startsWith("atv_"));
  });

  it("Conflito simétrico: atividade começando 10 min antes do fim de outra retorna 409", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T12:00:00-03:00", fim: "2026-10-19T14:00:00-03:00" }],
      }),
    });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Atividade 2",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T11:50:00-03:00", fim: "2026-10-19T13:50:00-03:00" }],
      }),
    });
    assert.equal(status, 409);
    assert.deepEqual(body, {
      erro: "CONFLITO_DE_SALA",
      mensagem: "Conflito de horário com outra atividade na mesma sala",
    });
  });

  it("POST /atividades válido sem conflito continua funcionando", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Válida",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    assert.equal(status, 201);
    const atividade = body as { id: string; situacao: string };
    assert.equal(atividade.situacao, "prevista");
    assert.ok(atividade.id.startsWith("atv_"));
  });

  it("Precedência: conflito de sala só é verificado após validações anteriores", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Viola R1 (quantidade de encontros) E conflito de sala
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Precedencia",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.equal((body as { erro: string }).erro, "QUANTIDADE_DE_ENCONTROS");
  });
});