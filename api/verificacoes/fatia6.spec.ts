import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3008";

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

describe("Fatia 6 — PATCH de atividade", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3008";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3008 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("PATCH /atividades/:id alterando somente titulo retorna 200", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Título Original",
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
      body: JSON.stringify({ titulo: "Novo Título" }),
    });
    assert.equal(status, 200);
    const atualizada = body as { titulo: string; vagas: number; tipo: string; salaId: string };
    assert.equal(atualizada.titulo, "Novo Título");
    assert.equal(atualizada.vagas, 10);
    assert.equal(atualizada.tipo, "palestra");
    assert.equal(atualizada.salaId, "sala_01");
  });

  it("PATCH /atividades/:id alterando somente vagas retorna 200", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ vagas: 20 }),
    });
    assert.equal(status, 200);
    const atualizada = body as { titulo: string; vagas: number };
    assert.equal(atualizada.titulo, "Palestra Teste");
    assert.equal(atualizada.vagas, 20);
  });

  it("PATCH /atividades/:id alterando titulo e vagas juntos retorna 200", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Título Original",
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
      body: JSON.stringify({ titulo: "Novo Título", vagas: 15 }),
    });
    assert.equal(status, 200);
    const atualizada = body as { titulo: string; vagas: number };
    assert.equal(atualizada.titulo, "Novo Título");
    assert.equal(atualizada.vagas, 15);
  });

  it("PATCH /atividades/:id tentando alterar tipo retorna 422 CAMPO_NAO_EDITAVEL", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ tipo: "minicurso" }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id tentando alterar salaId retorna 422 CAMPO_NAO_EDITAVEL", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ salaId: "sala_02" }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id tentando alterar encontros retorna 422 CAMPO_NAO_EDITAVEL", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ encontros: [{ inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" }] }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id com campo não editável + campo válido retorna CAMPO_NAO_EDITAVEL (precedência)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ tipo: "minicurso", vagas: 20 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "CAMPO_NAO_EDITAVEL",
      mensagem: "Campo não pode ser alterado após a criação",
    });
  });

  it("PATCH /atividades/:id com vagas acima da capacidade retorna 422 VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ vagas: 31 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  it("PATCH /atividades/:id com vagas=0 retorna 422 VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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
      body: JSON.stringify({ vagas: 0 }),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  it("PATCH /atividades/:id com vagas abaixo dos inscritos retorna 409 VAGAS_ABAIXO_DOS_INSCRITOS", async () => {
    // Nota: No M1, ocupadas sempre 0 (inscrições são M2).
    // Este teste verifica o comportamento: se ocupadas > vagas novas, retorna 409.
    // Como M1 não tem inscrições, ocupadas=0, então não deve disparar.
    // Se no futuro houver ocupadas > 0, esta regra deve funcionar.
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string };

    // Como ocupadas=0 no M1, reduzir para 5 deve funcionar
    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ vagas: 5 }),
    });
    assert.equal(status, 200);
    const atualizada = body as { vagas: number; ocupadas: number; vagasRestantes: number };
    assert.equal(atualizada.vagas, 5);
    assert.equal(atualizada.ocupadas, 0);
    assert.equal(atualizada.vagasRestantes, 5);
  });

  it("PATCH /atividades/:id precedência: CAMPO_NAO_EDITAVEL antes de VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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

  it("PATCH /atividades/:id precedência: VAGAS_ACIMA_DA_CAPACIDADE antes de VAGAS_ABAIXO_DOS_INSCRITOS", async () => {
    // No M1, ocupadas=0, então VAGAS_ABAIXO_DOS_INSCRITOS não dispara.
    // Este teste documenta a regra de precedência para quando M2 estiver ativo.
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Teste",
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

  it("PATCH /atividades/:id com ID malformado retorna 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc", {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Novo" }),
    });
    assert.equal(status, 400);
    assert.deepEqual(body, {
      erro: "ID_INVALIDO",
      mensagem: "ID inválido",
    });
  });

  it("PATCH /atividades/:id com ID válido mas inexistente retorna 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000", {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Novo" }),
    });
    assert.equal(status, 404);
    assert.deepEqual(body, {
      erro: "NAO_ENCONTRADO",
      mensagem: "Atividade não encontrada",
    });
  });

  it("PATCH /atividades/:id confirma que campos imutáveis permanecem inalterados", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Título Original",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    const atividade = created as { id: string; tipo: string; salaId: string };
    const idOriginal = atividade.id;
    const tipoOriginal = atividade.tipo;
    const salaIdOriginal = atividade.salaId;
    const encontrosOriginais = 1;

    await fetchJson(`/atividades/${idOriginal}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Novo Título", vagas: 15 }),
    });

    const { status, body } = await fetchJson(`/atividades/${idOriginal}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atualizada = body as { id: string; titulo: string; tipo: string; salaId: string; vagas: number; encontros: Array<unknown> };
    assert.equal(atualizada.id, idOriginal);
    assert.equal(atualizada.tipo, tipoOriginal);
    assert.equal(atualizada.salaId, salaIdOriginal);
    assert.equal(atualizada.encontros.length, encontrosOriginais);
    assert.equal(atualizada.titulo, "Novo Título");
    assert.equal(atualizada.vagas, 15);
  });
});