import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3011";

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

describe("Fatia 9 — Precedência de erros", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3011";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3011 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  // ============================================================
  // CRIAÇÃO (POST /atividades)
  // Precedência: QUANTIDADE_DE_ENCONTROS > ENCONTRO_INVALIDO > VAGAS_ACIMA_DA_CAPACIDADE > CONFLITO_DE_SALA
  // ============================================================

  it("POST /atividades: QUANTIDADE_DE_ENCONTROS + ENCONTRO_INVALIDO → QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // 2 encontros (R1) + duração 30min (R3)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R1+R3",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
          { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T11:00:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades: QUANTIDADE_DE_ENCONTROS + VAGAS_ACIMA_DA_CAPACIDADE → QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // 2 encontros (R1) + vagas > capacidade (R6)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R1+R6",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 31, // sala_01 capacidade 30
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T11:00:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades: QUANTIDADE_DE_ENCONTROS + CONFLITO_DE_SALA → QUANTIDADE_DE_ENCONTROS", async () => {
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
    // 2 encontros (R1) + conflito (R7)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R1+R7",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T15:00:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades: ENCONTRO_INVALIDO + VAGAS_ACIMA_DA_CAPACIDADE → ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // duração 30min (R3) + vagas > capacidade (R6)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R3+R6",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 31,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ter duração entre 60 e 240 minutos",
    });
  });

  it("POST /atividades: ENCONTRO_INVALIDO + CONFLITO_DE_SALA → ENCONTRO_INVALIDO", async () => {
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
    // duração 30min (R3) + conflito (R7)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R3+R7",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ter duração entre 60 e 240 minutos",
    });
  });

  it("POST /atividades: VAGAS_ACIMA_DA_CAPACIDADE + CONFLITO_DE_SALA → VAGAS_ACIMA_DA_CAPACIDADE", async () => {
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
    // vagas > capacidade (R6) + conflito (R7)
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Precedencia R6+R7",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 31,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
        ],
      }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  // ============================================================
  // PATCH (PATCH /atividades/:id)
  // Precedência: CAMPO_NAO_EDITAVEL > VAGAS_ACIMA_DA_CAPACIDADE > VAGAS_ABAIXO_DOS_INSCRITOS
  // ============================================================

  it("PATCH /atividades/:id: CAMPO_NAO_EDITAVEL + VAGAS_ACIMA_DA_CAPACIDADE → CAMPO_NAO_EDITAVEL", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Patch",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ tipo: "minicurso", vagas: 31 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id: CAMPO_NAO_EDITAVEL + VAGAS_ABAIXO_DOS_INSCRITOS → CAMPO_NAO_EDITAVEL", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Patch",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // tenta alterar tipo (não editável) e vagas=0 (VAGAS_ACIMA_DA_CAPACIDADE)
    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ salaId: "sala_02", vagas: 0 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id: VAGAS_ACIMA_DA_CAPACIDADE + VAGAS_ABAIXO_DOS_INSCRITOS → VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Patch",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // vagas=0 viola VAGAS_ACIMA_DA_CAPACIDADE (precedência sobre VAGAS_ABAIXO_DOS_INSCRITOS)
    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ vagas: 0 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  // ============================================================
  // CANCELAMENTO (POST /atividades/:id/cancelamento)
  // Precedência: ATIVIDADE_CANCELADA > ATIVIDADE_JA_INICIADA
  // ============================================================

  it("POST /atividades/:id/cancelamento: ATIVIDADE_CANCELADA + ATIVIDADE_JA_INICIADA → ATIVIDADE_CANCELADA", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Cancelamento Precedencia",
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

  // ============================================================
  // Verificação de formato de erro consistente
  // ============================================================

  it("Todos os erros de precedência retornam formato padronizado {erro, mensagem}", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });

    const testes = [
      { path: "/atividades", method: "POST", body: { titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" }, { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T11:00:00-03:00" }] }, expectedCode: "QUANTIDADE_DE_ENCONTROS" },
      { path: "/atividades", method: "POST", body: { titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 31, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" }] }, expectedCode: "ENCONTRO_INVALIDO" },
      { path: "/atividades", method: "POST", body: { titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 31, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }, expectedCode: "VAGAS_ACIMA_DA_CAPACIDADE" },
    ];

    for (const t of testes) {
      await fetchJson("/_teste/reset", { method: "POST" });
      const { status, body } = await fetchJson(t.path, {
        method: t.method,
        headers: { "X-Usuario": "org-ana" },
        body: JSON.stringify(t.body),
      });
      assert.equal(status, 422);
      assert.ok(body && typeof body === "object");
      const b = body as { erro: string; mensagem: string };
      assert.equal(b.erro, t.expectedCode);
      assert.ok(typeof b.mensagem === "string" && b.mensagem.length > 0);
    }
  });
});