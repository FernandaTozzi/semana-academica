import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comApp, preencherEEnviar } from "./apoio.js";

describe("Tela do participante", () => {
  it("envia o código digitado e mostra sucesso quando a API aceita", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "abc123",
        form: "#par-form",
      });

      const registro = mock.estado.requisicoes.presencas[0];
      assert.equal(registro.encontroId, "enc_5e6f7a8b");
      assert.equal(registro.usuario, "p-carla");
      assert.equal(registro.corpo.codigo, "ABC123");
      assert.ok(!("lidoEm" in registro.corpo));

      const msg = local.document.getElementById("par-msg");
      assert.ok(msg.className.includes("sucesso"));
      assert.match(msg.textContent, /registrada/);
      assert.equal(local.document.getElementById("par-leituras-box").hidden, true);
    });
  });

  it("mostra erro da API e não guarda leitura offline", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      mock.estado.erroPresenca = {
        status: 422,
        erro: "CODIGO_INVALIDO",
        mensagem: "Código não é válido",
      };
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "ZZZZZZ",
        form: "#par-form",
      });

      const msg = local.document.getElementById("par-msg");
      assert.ok(msg.className.includes("erro"));
      assert.ok(msg.textContent.includes("CODIGO_INVALIDO"));
      assert.equal(local.document.getElementById("par-leituras-box").hidden, true);
      assert.equal(local.localStorage.getItem("m3.leiturasPendentes"), null);
    });
  });

  it("valida localmente o código de 6 caracteres antes de chamar a API", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "AB1",
        form: "#par-form",
      });

      const msg = local.document.getElementById("par-msg");
      assert.ok(msg.className.includes("erro"));
      assert.match(msg.textContent, /6 caracteres/);
      assert.equal(mock.estado.requisicoes.presencas.length, 0);
    });
  });
});