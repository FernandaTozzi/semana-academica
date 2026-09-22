import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3010";

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

describe("Fatia 8 — Situação pelo relógio", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3010";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3010 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("atividade antes do primeiro encontro → prevista", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Futura",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Relógio inicial: 2026-10-13T09:00:00-03:00 (antes do evento)
    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "prevista");
  });

  it("atividade no exato momento do primeiro encontro → em_andamento", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Inicio",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para exatamente o início
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T10:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "em_andamento");
  });

  it("atividade durante o encontro → em_andamento", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Durante",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para meio do encontro
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "em_andamento");
  });

  it("atividade no exato momento do fim do último encontro → encerrada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Fim",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para exatamente o fim
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T12:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("atividade após o fim do último encontro → encerrada", async () => {
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

    // Avança relógio para depois do fim
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T12:01:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("minicurso: antes do primeiro encontro → prevista", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso Futuro",
        tipo: "minicurso",
        salaId: "sala_01",
        vagas: 15,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });
    const atividade = created as { id: string };

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "prevista");
  });

  it("minicurso: durante o segundo encontro → em_andamento", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso Durante Segundo",
        tipo: "minicurso",
        salaId: "sala_01",
        vagas: 15,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para durante o segundo encontro
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T15:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "em_andamento");
  });

  it("minicurso: após o último encontro → encerrada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso Encerrado",
        tipo: "minicurso",
        salaId: "sala_01",
        vagas: 15,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });
    const atividade = created as { id: string };

    // Avança relógio para depois do último encontro
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T17:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("atividade cancelada permanece cancelada independentemente do relógio", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Cancelada",
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

    // Avança relógio para durante a atividade
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.equal((body as { situacao: string }).situacao, "cancelada");
  });

  it("mudança da situação conforme relógio avança: prevista → em_andamento → encerrada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Transicao",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // 1. Antes do início
    let { body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal((body as { situacao: string }).situacao, "prevista");

    // 2. Durante
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // 3. Após
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T13:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("atividade no limite de virada de dia (meia-noite UTC) comporta-se corretamente", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Virada UTC",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T20:00:00-03:00", fim: "2026-10-19T22:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Antes do início (dia 19, 19h)
    let { body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal((body as { situacao: string }).situacao, "prevista");

    // Durante (dia 19, 21h - meia-noite UTC)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T21:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // 22:00 do dia 19 = encerrada (fim era 22:00, relógio ≥ fim)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T22:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");

    // 00:30 do dia 20 = encerrada
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T00:30:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");

    // 02:00 do dia 20 = encerrada
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T02:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("GET /atividades com filtro reflete situação correta pelo relógio", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Filtro",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T11:00:00-03:00" }),
    });

    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ situacao: string }>;
    assert.ok(atividades.some((a) => a.situacao === "em_andamento"));
  });
});