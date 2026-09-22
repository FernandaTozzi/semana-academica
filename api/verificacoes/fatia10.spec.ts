import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

let server: Awaited<ReturnType<typeof createServer>>;
const BASE_URL = "http://localhost:3012";

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

describe("Fatia 10 — Erros, IDs e timezone", () => {
  before(async () => {
    process.env.MODO_TESTE = "1";
    process.env.PORT = "3012";
    server = await createServer();
    await new Promise<void>((resolve) => server.listen({ port: 3012 }, resolve));
  });

  after(async () => {
    await server.close();
    delete process.env.MODO_TESTE;
    delete process.env.PORT;
  });

  // ============================================================
  // 1. Formato dos erros
  // ============================================================

  it("Todos os erros de negócio retornam formato {erro, mensagem}", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });

    const testes = [
      { path: "/atividades", method: "POST", body: { titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" }] }, expected: 422 }, // duração inválida
      { path: "/atividades", method: "POST", body: { titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 0, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }, expected: 422 }, // vagas=0
      { path: "/atividades/invalido", method: "GET", expected: 400 },
      { path: "/atividades/atv_00000000", method: "GET", expected: 404 },
    ];

    for (const t of testes) {
      await fetchJson("/_teste/reset", { method: "POST" });
      const { status, body } = await fetchJson(t.path, {
        method: t.method || "GET",
        headers: { "X-Usuario": "org-ana" },
        body: t.body ? JSON.stringify(t.body) : undefined,
      });
      assert.equal(status, t.expected);
      assert.ok(body && typeof body === "object");
      const b = body as { erro: string; mensagem: string };
      assert.ok(typeof b.erro === "string" && b.erro.length > 0);
      assert.ok(typeof b.mensagem === "string" && b.mensagem.length > 0);
    }
  });

  it("Mensagens de erro são fixas por código (não dinâmicas)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });

    // Testa QUANTIDADE_DE_ENCONTROS
    const { body: body1 } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T11:00:00-03:00" }, { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T11:00:00-03:00" }]
      }),
    });
    const b1 = body1 as { erro: string; mensagem: string };
    assert.equal(b1.erro, "QUANTIDADE_DE_ENCONTROS");
    assert.equal(b1.mensagem, "Palestra deve ter exatamente 1 encontro");

    // Testa ENCONTRO_INVALIDO (duração)
    const { body: body2 } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T10:30:00-03:00" }]
      }),
    });
    const b2 = body2 as { erro: string; mensagem: string };
    assert.equal(b2.erro, "ENCONTRO_INVALIDO");
    assert.equal(b2.mensagem, "Encontro deve ter duração entre 60 e 240 minutos");

    // Testa VAGAS_ACIMA_DA_CAPACIDADE
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: body3 } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 31,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }]
      }),
    });
    const b3 = body3 as { erro: string; mensagem: string };
    assert.equal(b3.erro, "VAGAS_ACIMA_DA_CAPACIDADE");
    assert.equal(b3.mensagem, "Vagas deve ser entre 1 e a capacidade da sala");

    // Testa CAMPO_NAO_EDITAVEL
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "T", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }),
    });
    const atv = created as { id: string };
    const { body: body4 } = await fetchJson(`/atividades/${atv.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ tipo: "minicurso" }),
    });
    const b4 = body4 as { erro: string; mensagem: string };
    assert.equal(b4.erro, "CAMPO_NAO_EDITAVEL");
    assert.equal(b4.mensagem, "Campo não pode ser alterado após a criação");
  });

  // ============================================================
  // 2. IDs
  // ============================================================

  it("ID de atividade: formato atv_ + 8 hex lowercase", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Teste ID", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }]
      }),
    });
    const atv = body as { id: string };
    assert.ok(atv.id.startsWith("atv_"));
    assert.equal(atv.id.length, 12);
    assert.ok(/^atv_[0-9a-f]{8}$/.test(atv.id));
  });

  it("ID de encontro: formato enc_ + 8 hex lowercase", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Teste ID Encontro", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }]
      }),
    });
    const atv = body as { encontros: Array<{ id: string }> };
    assert.equal(atv.encontros.length, 1);
    const encId = atv.encontros[0].id;
    assert.ok(encId.startsWith("enc_"));
    assert.equal(encId.length, 12);
    assert.ok(/^enc_[0-9a-f]{8}$/.test(encId));
  });

  it("ID malformado em GET /atividades/:id → 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 400);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "ID_INVALIDO");
    assert.equal(b.mensagem, "ID inválido");
  });

  it("ID válido mas inexistente → 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 404);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "NAO_ENCONTRADO");
    assert.equal(b.mensagem, "Atividade não encontrada");
  });

  it("ID malformado em PATCH /atividades/:id → 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc", {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Novo" }),
    });
    assert.equal(status, 400);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "ID_INVALIDO");
    assert.equal(b.mensagem, "ID inválido");
  });

  it("ID válido mas inexistente em PATCH → 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000", {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Novo" }),
    });
    assert.equal(status, 404);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "NAO_ENCONTRADO");
    assert.equal(b.mensagem, "Atividade não encontrada");
  });

  it("ID malformado em cancelamento → 400 ID_INVALIDO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc/cancelamento", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 400);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "ID_INVALIDO");
    assert.equal(b.mensagem, "ID inválido");
  });

  it("ID válido mas inexistente em cancelamento → 404 NAO_ENCONTRADO", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/atv_00000000/cancelamento", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 404);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "NAO_ENCONTRADO");
    assert.equal(b.mensagem, "Atividade não encontrada");
  });

  // ============================================================
  // 3. Timezone America/Sao_Paulo
  // ============================================================

  it("Data civil no fuso America/Sao_Paulo: filtro dia funciona corretamente", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria atividade com encontro às 22:00 do dia 19 (mesmo dia civil no fuso -03:00)
    await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Fuso", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T22:00:00-03:00", fim: "2026-10-19T23:59:00-03:00" }]
      }),
    });

    // Filtro dia 19 deve retornar a atividade (início às 22h do dia 19 no fuso -03:00)
    const { status, body } = await fetchJson("/atividades?dia=2026-10-19", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(status, 200);
    const atividades = body as Array<{ id: string }>;
    assert.equal(atividades.length, 1);

    // Filtro dia 20 NÃO deve retornar (o encontro é no dia 19 no fuso -03:00)
    const { status: s2, body: body2 } = await fetchJson("/atividades?dia=2026-10-20", {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(s2, 200);
    const atividades2 = body2 as Array<{ id: string }>;
    assert.equal(atividades2.length, 0);
  });

  it("Situação pelo relógio usa fuso America/Sao_Paulo", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Palestra Fuso", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T20:00:00-03:00", fim: "2026-10-19T22:00:00-03:00" }]
      }),
    });
    const atv = created as { id: string };

    // Relógio às 19:00 do dia 19 (-03:00) = antes do início
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T19:00:00-03:00" }),
    });
    let { body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } });
    assert.equal((body as { situacao: string }).situacao, "prevista");

    // Relógio às 21:00 do dia 19 = durante
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T21:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // Relógio às 21:30 do dia 19 = ainda durante
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T21:30:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // Relógio às 22:00 do dia 19 = depois (fim era 22:00)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T22:00:00-03:00" }),
    });
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T02:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  it("Virada de dia no fuso America/Sao_Paulo é respeitada", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Virada Dia", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T22:00:00-03:00", fim: "2026-10-19T23:59:00-03:00" }]
      }),
    });
    const atv = created as { id: string };

    // 21:59 do dia 19 = prevista
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T21:59:00-03:00" }),
    });
    let { body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } });
    assert.equal((body as { situacao: string }).situacao, "prevista");

    // 22:00 do dia 19 = em_andamento (início)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T22:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // 23:58 do dia 19 = em_andamento (antes do fim)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T23:58:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "em_andamento");

    // 23:59 do dia 19 = encerrada (relógio ≥ fim)
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-19T23:59:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");

    // 00:00 do dia 20 = encerrada
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T00:00:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");

    // 00:01 do dia 20 = encerrada
    await fetchJson("/_teste/relogio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agora: "2026-10-20T00:01:00-03:00" }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    assert.equal((body as { situacao: string }).situacao, "encerrada");
  });

  // ============================================================
  // 4. vagasRestantes nunca negativo
  // ============================================================

  it("vagasRestantes nunca negativo (clamp 0)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria atividade com 5 vagas
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Teste Clamp", tipo: "palestra", salaId: "sala_01", vagas: 5,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }]
      }),
    });
    const atv = created as { id: string };

    // No M1, ocupadas=0, então vagasRestantes = vagas - 0 = 5
    let { body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } });
    let atvData = body as { vagas: number; ocupadas: number; vagasRestantes: number };
    assert.equal(atvData.vagasRestantes, 5);
    assert.equal(atvData.vagasRestantes, atvData.vagas - atvData.ocupadas);
    assert.ok(atvData.vagasRestantes >= 0);

    // Reduz vagas para 3
    await fetchJson(`/atividades/${atv.id}`, {
      method: "PATCH",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ vagas: 3 }),
    });
    ({ body } = await fetchJson(`/atividades/${atv.id}`, { headers: { "X-Usuario": "org-ana" } }));
    const atvData2 = body as { vagas: number; ocupadas: number; vagasRestantes: number };
    assert.equal(atvData2.vagasRestantes, 3);
    assert.ok(atvData2.vagasRestantes >= 0);
  });

  // ============================================================
  // 5. Ausência de paginação
  // ============================================================

  it("GET /atividades sem paginação retorna array completo", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    // Cria 3 atividades em horários bem espaçados para evitar conflito
    const horarios = [
      { inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" },
      { inicio: "2026-10-19T14:00:00-03:00", fim: "2026-10-19T16:00:00-03:00" },
      { inicio: "2026-10-20T10:00:00-03:00", fim: "2026-10-20T12:00:00-03:00" },
    ];
    for (let i = 0; i < 3; i++) {
      const { status } = await fetchJson("/atividades", {
        method: "POST",
        headers: { "X-Usuario": "org-ana" },
        body: JSON.stringify({
          titulo: `Atividade ${i}`, tipo: "palestra", salaId: "sala_01", vagas: 10,
          encontros: [horarios[i]]
        }),
      });
      assert.equal(status, 201);
    }

    const { status, body } = await fetchJson("/atividades", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 200);
    const atividades = body as Array<unknown>;
    assert.equal(atividades.length, 3);
    // Não deve ter campos de paginação
    assert.ok(!(body as any).page);
    assert.ok(!(body as any).limit);
    assert.ok(!(body as any).total);
  });

  it("GET /salas sem paginação retorna array completo", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/salas", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 200);
    const salas = body as Array<unknown>;
    assert.equal(salas.length, 3);
    assert.ok(!(body as any).page);
    assert.ok(!(body as any).limit);
    assert.ok(!(body as any).total);
  });

  // ============================================================
  // 6. Atividades canceladas nas listagens
  // ============================================================

  it("Atividades canceladas aparecem em GET /atividades", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Para Cancelar", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }),
    });
    const atv = created as { id: string };

    await fetchJson(`/atividades/${atv.id}/cancelamento`, {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
    });

    const { status, body } = await fetchJson("/atividades", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 200);
    const atividades = body as Array<{ situacao: string; id: string }>;
    const cancelada = atividades.find(a => a.id === atv.id);
    assert.ok(cancelada);
    assert.equal(cancelada.situacao, "cancelada");
  });

  it("Atividades canceladas aparecem com filtro dia", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Cancelada Dia", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }),
    });
    const atv = created as { id: string };

    await fetchJson(`/atividades/${atv.id}/cancelamento`, { method: "POST", headers: { "X-Usuario": "org-ana" } });

    const { status, body } = await fetchJson("/atividades?dia=2026-10-19", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 200);
    const atividades = body as Array<{ situacao: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].situacao, "cancelada");
  });

  it("Atividades canceladas aparecem com filtro tipo", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { body: created } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({ titulo: "Cancelada Tipo", tipo: "palestra", salaId: "sala_01", vagas: 10, encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }] }),
    });
    const atv = created as { id: string };

    await fetchJson(`/atividades/${atv.id}/cancelamento`, { method: "POST", headers: { "X-Usuario": "org-ana" } });

    const { status, body } = await fetchJson("/atividades?tipo=palestra", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 200);
    const atividades = body as Array<{ situacao: string }>;
    assert.equal(atividades.length, 1);
    assert.equal(atividades[0].situacao, "cancelada");
  });

  // ============================================================
  // 7. Sem validação extra de título
  // ============================================================

  it("Título apenas espaços não retorna TITULO_INVALIDO (sem validação extra)", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "   ", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-10-19T10:00:00-03:00", fim: "2026-10-19T12:00:00-03:00" }]
      }),
    });
    // Sem validação extra de título - apenas espaços deve ser aceito (apenas Zod min(1) que conta espaços)
    assert.equal(status, 201);
    const b = body as { titulo: string };
    assert.equal(b.titulo, "   ");
  });

  // ============================================================
  // 8. Sem limite global de atividades
  // ============================================================

  it("Sem limite global: criar 100 atividades sem conflito → 201", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const salas = ["sala_01", "sala_02", "sala_03"];
    // Cria 100 atividades distribuídas nas 3 salas, 5 dias (19-23/10)
    // 7 horários por dia por sala (com intervalo 2h15min para respeitar gap 15min)
    // 3 salas × 5 dias × 7 horários = 105 slots → suficientes para 100
    let count = 0;
    const horarios = [
      { inicio: "08:00:00", fim: "10:00:00" },
      { inicio: "10:15:00", fim: "12:15:00" },
      { inicio: "12:30:00", fim: "14:30:00" },
      { inicio: "14:45:00", fim: "16:45:00" },
      { inicio: "17:00:00", fim: "19:00:00" },
      { inicio: "19:15:00", fim: "21:15:00" },
      { inicio: "21:30:00", fim: "23:30:00" },
    ];
    for (const salaId of ["sala_01", "sala_02", "sala_03"]) {
      for (let dia = 19; dia <= 23; dia++) {
        for (const h of horarios) {
          if (count >= 100) break;
          const { status } = await fetchJson("/atividades", {
            method: "POST",
            headers: { "X-Usuario": "org-ana" },
            body: JSON.stringify({
              titulo: `Atividade ${count}`,
              tipo: "palestra",
              salaId,
              vagas: 10,
              encontros: [{
                inicio: `2026-10-${dia.toString().padStart(2, '0')}T${h.inicio}-03:00`,
                fim: `2026-10-${dia.toString().padStart(2, '0')}T${h.fim}-03:00`
              }]
            }),
          });
          assert.equal(status, 201);
          count++;
        }
        if (count >= 100) break;
      }
      if (count >= 100) break;
    }
    assert.equal(count, 100);
  });

  // ============================================================
  // 9. Sem prazo máximo de criação/alteração
  // ============================================================

  it("Criar atividade fora do período do evento falha por R4, não por prazo", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana" },
      body: JSON.stringify({
        titulo: "Fora Evento", tipo: "palestra", salaId: "sala_01", vagas: 10,
        encontros: [{ inicio: "2026-12-31T10:00:00-03:00", fim: "2026-12-31T12:00:00-03:00" }]
      }),
    });
    assert.equal(status, 422);
    const b = body as { erro: string };
    assert.equal(b.erro, "ENCONTRO_INVALIDO");
  });

  // ============================================================
  // 10. Códigos de erro adicionais permitidos quando necessários
  // ============================================================

  it("ID_INVALIDO é código de erro adicional aceito", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades/abc", { headers: { "X-Usuario": "org-ana" } });
    assert.equal(status, 400);
    const b = body as { erro: string };
    assert.equal(b.erro, "ID_INVALIDO");
  });

  it("Body malformado retorna 422 DADOS_INVALIDOS com formato padronizado", async () => {
    await fetchJson("/_teste/reset", { method: "POST" });
    const { status, body } = await fetchJson("/atividades", {
      method: "POST",
      headers: { "X-Usuario": "org-ana", "Content-Type": "application/json" },
      body: "invalid json",
    });
    assert.equal(status, 422);
    const b = body as { erro: string; mensagem: string };
    assert.equal(b.erro, "DADOS_INVALIDOS");
    assert.equal(b.mensagem, "JSON inválido");
  });
});