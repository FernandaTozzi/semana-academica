import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3007";

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

describe("Fatia 5 — Filtros de atividades", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3007";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3007 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  it("GET /atividades sem filtro retorna todas as atividades", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria uma palestra
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    // Cria um minicurso
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso 1",
        tipo: "minicurso",
        salaId: "sala_02",
        vagas: 20,
        encontros: [
          { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });

    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; tipo: string }>;
    assert.equal(atividades.length, 2);
    const tipos = atividades.map((a) => a.tipo).sort();
    assert.deepEqual(tipos, ["minicurso", "palestra"]);
  });

  it("GET /atividades?dia=2026-10-19 retorna apenas atividades com encontro no dia", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria atividade no dia 19
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 19",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    // Cria atividade no dia 20
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 20",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-19", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; titulo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].titulo, "Palestra Dia 19");
  });

  it("GET /atividades?dia=2026-10-20 retorna apenas atividades com encontro no dia 20", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 19",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 20",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-20", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; titulo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].titulo, "Palestra Dia 20");
  });

  it("GET /atividades?tipo=palestra retorna apenas palestras", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso 1",
        tipo: "minicurso",
        salaId: "sala_02",
        vagas: 20,
        encontros: [
          { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });

    const { status, body } = await fetchJson("/atividades?tipo=palestra", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; tipo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].tipo, "palestra");
  });

  it("GET /atividades?tipo=minicurso retorna apenas minicursos", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso 1",
        tipo: "minicurso",
        salaId: "sala_02",
        vagas: 20,
        encontros: [
          { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
        ],
      }),
    });

    const { status, body } = await fetchJson("/atividades?tipo=minicurso", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; tipo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].tipo, "minicurso");
  });

  it("GET /atividades?dia=2026-10-19&tipo=palestra aplica ambos os filtros", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Palestra no dia 19
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 19",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });
    // Minicurso no dia 19
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso Dia 19",
        tipo: "minicurso",
        salaId: "sala_02",
        vagas: 20,
        encontros: [{ inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" }],
      }),
    });
    // Palestra no dia 20
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 20",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-19&tipo=palestra", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; titulo: string; tipo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].titulo, "Palestra Dia 19");
    assert.equal(atividades[0].tipo, "palestra");
  });

  it("GET /atividades com dia sem atividades retorna []", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Dia 19",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-22", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });

  it("GET /atividades com tipo sem atividades retorna []", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra 1",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?tipo=minicurso", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });

  it("Atividade cancelada continua aparecendo na listagem", async () => {
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
    await fetchJson(`/atividades/${atividade.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    const { status, body } = await fetchJson("/atividades", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; situacao: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].situacao, "cancelada");
  });

  it("Atividade cancelada aparece com filtro por dia", async () => {
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

    const { status, body } = await fetchJson("/atividades?dia=2026-10-19", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; situacao: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].situacao, "cancelada");
  });

  it("Atividade cancelada aparece com filtro por tipo", async () => {
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

    const { status, body } = await fetchJson("/atividades?tipo=palestra", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; situacao: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].situacao, "cancelada");
  });

  it("Minicurso com múltiplos encontros aparece quando possui encontro no dia filtrado", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso 3 Dias",
        tipo: "minicurso",
        salaId: "sala_01",
        vagas: 15,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-20T14:00:00-03:00", fim: "2026-10-20T16:00:00-03:00" },
          { inicio: "2026-10-21T09:00:00-03:00", fim: "2026-10-21T11:00:00-03:00" },
        ],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-20", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; titulo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].titulo, "Minicurso 3 Dias");
  });

  it("Atividade cujos encontros não pertencem ao dia não é retornada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Minicurso Sem Dia 20",
        tipo: "minicurso",
        salaId: "sala_01",
        vagas: 15,
        encontros: [
          { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
          { inicio: "2026-10-21T14:00:00-03:00", fim: "2026-10-21T16:00:00-03:00" },
        ],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-20", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });

  it("Filtro por dia usa fuso America/Sao_Paulo corretamente", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Encontro à meia-noite UTC do dia 20 = 21h do dia 19 no fuso -03:00
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Fuso",
        tipo: "palestra",
        salaId: "sala_01",
        vagas: 10,
        encontros: [{ inicio: "2026-10-20T00:00:00-03:00", fim: "2026-10-20T02:00:00-03:00" }],
      }),
    });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-20", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string; titulo: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].titulo, "Palestra Fuso");
  });
});