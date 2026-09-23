import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3005";

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

describe("Fatia 3 — Criação de minicurso", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3005";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3005 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("POST /atividades com minicurso válido (2 encontros) retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Dois Encontros",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 15,
      encontros: [
        {
          inicio: "2026-10-19T10:00:00-03:00",
          fim: "2026-10-19T12:00:00-03:00",
        },
        {
          inicio: "2026-10-20T14:00:00-03:00",
          fim: "2026-10-20T17:00:00-03:00",
        },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 201);
    const atividade = body as {
      id: string;
      titulo: string;
      tipo: string;
      salaId: string;
      vagas: number;
      encontros: Array<{ id: string; inicio: string; fim: string }>;
      cargaHorariaMinutos: number;
      situacao: string;
      ocupadas: number;
      vagasRestantes: number;
      emEspera: number;
    };
    assert.ok(atividade.id.startsWith("atv_"));
    assert.equal(atividade.id.length, 12);
    assert.equal(atividade.titulo, "Minicurso Dois Encontros");
    assert.equal(atividade.tipo, "minicurso");
    assert.equal(atividade.salaId, "sala_01");
    assert.equal(atividade.vagas, 15);
    assert.equal(atividade.encontros.length, 2);
    assert.ok(atividade.encontros[0].id.startsWith("enc_"));
    assert.equal(atividade.encontros[0].id.length, 12);
    assert.ok(atividade.encontros[1].id.startsWith("enc_"));
    assert.equal(atividade.encontros[1].id.length, 12);
    assert.equal(atividade.encontros[0].inicio, "2026-10-19T10:00:00-03:00");
    assert.equal(atividade.encontros[0].fim, "2026-10-19T12:00:00-03:00");
    assert.equal(atividade.encontros[1].inicio, "2026-10-20T14:00:00-03:00");
    assert.equal(atividade.encontros[1].fim, "2026-10-20T17:00:00-03:00");
    assert.equal(atividade.cargaHorariaMinutos, 300); // 120 + 180
    assert.equal(atividade.situacao, "prevista");
    assert.equal(atividade.ocupadas, 0);
    assert.equal(atividade.vagasRestantes, 15);
    assert.equal(atividade.emEspera, 0);
  });

  it("POST /atividades com minicurso válido (5 encontros) retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Cinco Encontros",
      tipo: "minicurso",
      salaId: "sala_02",
      vagas: 30,
      encontros: [
        { inicio: "2026-10-19T09:00:00-03:00", fim: "2026-10-19T11:00:00-03:00" },
        { inicio: "2026-10-20T09:00:00-03:00", fim: "2026-10-20T11:00:00-03:00" },
        { inicio: "2026-10-21T09:00:00-03:00", fim: "2026-10-21T11:00:00-03:00" },
        { inicio: "2026-10-22T09:00:00-03:00", fim: "2026-10-22T11:00:00-03:00" },
        { inicio: "2026-10-23T09:00:00-03:00", fim: "2026-10-23T11:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 201);
    const atividade = body as {
      id: string;
      titulo: string;
      tipo: string;
      encontros: Array<{ id: string; inicio: string; fim: string }>;
      cargaHorariaMinutos: number;
    };
    assert.equal(atividade.titulo, "Minicurso Cinco Encontros");
    assert.equal(atividade.tipo, "minicurso");
    assert.equal(atividade.encontros.length, 5);
    assert.equal(atividade.cargaHorariaMinutos, 600); // 5 * 120
    assert.ok(atividade.encontros.every((e) => e.id.startsWith("enc_") && e.id.length === 12));
  });

  it("GET /atividades retorna o minicurso criado", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Lista",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 20,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
        { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
      ],
    };
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    const atividade = created as { id: string };
    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; tipo: string }>;
    assert.ok(atividades.some((a) => a.id === atividade.id && a.tipo === "minicurso"));
  });

  it("GET /atividades/:id recupera o minicurso criado", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso GetById",
      tipo: "minicurso",
      salaId: "sala_03",
      vagas: 50,
      encontros: [
        { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T17:00:00-03:00" },
        { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T17:00:00-03:00" },
        { inicio: "2026-10-21T14:00:00-03:00", fim: "2026-10-21T17:00:00-03:00" },
      ],
    };
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    const atividade = created as { id: string };
    const { status, body } = await fetchJson(`/atividades/${atividade.id}`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const encontrada = body as { id: string; titulo: string; tipo: string; encontros: Array<unknown> };
    assert.equal(encontrada.id, atividade.id);
    assert.equal(encontrada.titulo, "Minicurso GetById");
    assert.equal(encontrada.tipo, "minicurso");
    assert.equal(encontrada.encontros.length, 3);
  });

  it("POST /atividades com minicurso e 1 encontro retorna 422 QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Um Encontro",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Minicurso deve ter entre 2 e 5 encontros",
    });
  });

  it("POST /atividades com minicurso e 6 encontros retorna 422 QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Seis Encontros",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T09:00:00-03:00", fim: "2026-10-19T10:00:00-03:00" },
        { inicio: "2026-10-20T09:00:00-03:00", fim: "2026-10-20T10:00:00-03:00" },
        { inicio: "2026-10-21T09:00:00-03:00", fim: "2026-10-21T10:00:00-03:00" },
        { inicio: "2026-10-22T09:00:00-03:00", fim: "2026-10-22T10:00:00-03:00" },
        { inicio: "2026-10-23T09:00:00-03:00", fim: "2026-10-23T10:00:00-03:00" },
        { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T15:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Minicurso deve ter entre 2 e 5 encontros",
    });
  });

  it("POST /atividades com minicurso e encontro de 30 min retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Encontro Curto",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
        { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ter duração entre 60 e 240 minutos",
    });
  });

  it("POST /atividades com minicurso e encontro de 5 horas retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Encontro Longo",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T15:00:00-03:00" },
        { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ter duração entre 60 e 240 minutos",
    });
  });

  it("POST /atividades com minicurso e encontro antes do evento retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Antes",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-18T10:00:00-03:00", fim: "2026-10-18T12:00:00-03:00" },
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ocorrer no mesmo dia civil e dentro do período do evento",
    });
  });

  it("POST /atividades com minicurso e encontro em dias diferentes retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Dias Diferentes",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T19:00:00-03:00", fim: "2026-10-20T22:00:00-03:00" },
        { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontro deve ocorrer no mesmo dia civil e dentro do período do evento",
    });
  });

  it("POST /atividades com minicurso e encontros sobrepostos retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Minicurso Sobreposto",
      tipo: "minicurso",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T14:00:00-03:00" },
        { inicio: "2026-10-19T12:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" },
      ],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "ENCONTRO_INVALIDO",
      mensagem: "Encontros da mesma atividade não podem se sobrepor",
    });
  });
});