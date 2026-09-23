import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3004";

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

describe("Fatia 2 — Criação de palestra", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3004";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3004 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("POST /atividades com palestra válida retorna 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Teste",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 20,
      encontros: [
        {
          inicio: "2026-10-19T10:00:00-03:00",
          fim: "2026-10-19T12:00:00-03:00",
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
    assert.equal(atividade.id.length, 12); // atv_ + 8 hex
    assert.equal(atividade.titulo, "Palestra Teste");
    assert.equal(atividade.tipo, "palestra");
    assert.equal(atividade.salaId, "sala_01");
    assert.equal(atividade.vagas, 20);
    assert.equal(atividade.encontros.length, 1);
    assert.ok(atividade.encontros[0].id.startsWith("enc_"));
    assert.equal(atividade.encontros[0].id.length, 12); // enc_ + 8 hex
    assert.equal(atividade.encontros[0].inicio, "2026-10-19T10:00:00-03:00");
    assert.equal(atividade.encontros[0].fim, "2026-10-19T12:00:00-03:00");
    assert.equal(atividade.cargaHorariaMinutos, 120);
    assert.equal(atividade.situacao, "prevista");
    assert.equal(atividade.ocupadas, 0);
    assert.equal(atividade.vagasRestantes, 20);
    assert.equal(atividade.emEspera, 0);
  });

  it("GET /atividades retorna a palestra criada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Lista",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 15,
      encontros: [
        {
          inicio: "2026-10-19T14:00:00-03:00",
          fim: "2026-10-19T16:00:00-03:00",
        },
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
    const atividades = body as Array<{ id: string }>;
    assert.ok(atividades.some((a) => a.id === atividade.id));
  });

  it("GET /atividades/:id recupera a palestra criada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra GetById",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        {
          inicio: "2026-10-20T09:00:00-03:00",
          fim: "2026-10-20T11:00:00-03:00",
        },
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
    const encontrada = body as { id: string; titulo: string };
    assert.equal(encontrada.id, atividade.id);
    assert.equal(encontrada.titulo, "Palestra GetById");
  });

  it("POST /atividades com palestra e 0 encontros retorna 422 QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Sem Encontros",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [],
    };
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify(payload),
    });
    assert.equal(status, 422);
    assert.deepEqual(body, {
      erro: "QUANTIDADE_DE_ENCONTROS",
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades com palestra e 2 encontros retorna 422 QUANTIDADE_DE_ENCONTROS", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Dois Encontros",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T11:00:00-03:00" },
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
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades com encontro de 30 min retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Curta",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
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

  it("POST /atividades com encontro de 5 horas retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Longa",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T15:00:00-03:00" },
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

  it("POST /atividades com encontro antes do evento retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Antes",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-18T10:00:00-03:00", fim: "2026-10-18T12:00:00-03:00" },
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

  it("POST /atividades com encontro depois do evento retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Depois",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-24T10:00:00-03:00", fim: "2026-10-24T12:00:00-03:00" },
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

  it("POST /atividades com encontro em dias diferentes retorna 422 ENCONTRO_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Dias Diferentes",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T19:00:00-03:00", fim: "2026-10-20T22:00:00-03:00" },
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

  it("POST /atividades com vagas=0 retorna 422 VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Vagas Zero",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 0,
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
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  it("POST /atividades com vagas acima da capacidade retorna 422 VAGAS_ACIMA_DA_CAPACIDADE", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Vagas Excesso",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 31,
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
      erro: "VAGAS_ACIMA_DA_CAPACIDADE",
      mensagem: "Vagas deve ser entre 1 e a capacidade da sala",
    });
  });

  it("POST /atividades violando R1 e R3 retorna QUANTIDADE_DE_ENCONTROS (precedência)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Precedencia R1 R3",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 10,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
        { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T15:30:00-03:00" },
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
      mensagem: "Palestra deve ter exatamente 1 encontro",
    });
  });

  it("POST /atividades violando R3 e R6 retorna ENCONTRO_INVALIDO (precedência)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const payload = {
      titulo: "Palestra Precedencia R3 R6",
      tipo: "palestra",
      salaId: "sala_01",
      vagas: 31,
      encontros: [
        { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" },
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
});