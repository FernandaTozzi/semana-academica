import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comApp, esperar, enviarSubmit, formatarInstanteLocal } from "./apoio.js";
import { JANELA } from "./apiMock.js";

describe("Tela da organização", () => {
  it("exibe o código do encontro, trocaEm e validoAte retornados pela API", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      local.document.querySelector("#org-encontro-id").value = "enc_5e6f7a8b";
      enviarSubmit(local, "#org-form");
      await esperar();

      const codigo = mock.codigoAtual("enc_5e6f7a8b");
      assert.match(codigo, /^[A-Z0-9]{6}$/);

      const box = local.document.getElementById("org-codigo-box");
      assert.equal(box.hidden, false);
      assert.equal(local.document.getElementById("org-codigo").textContent, codigo);
      assert.equal(local.document.getElementById("org-encontro-info").textContent, "enc_5e6f7a8b");

      const janela = Math.floor(mock.estado.agora / JANELA) * JANELA;
      assert.equal(
        local.document.getElementById("org-troca").textContent,
        formatarInstanteLocal(new Date(janela + JANELA).toISOString())
      );
      assert.equal(
        local.document.getElementById("org-valido").dateTime,
        new Date(janela + 2 * JANELA).toISOString()
      );
      assert.equal(
        local.document.getElementById("org-troca").dateTime,
        new Date(janela + JANELA).toISOString()
      );

      const chamada = mock.estado.requisicoes.codigos[0];
      assert.equal(chamada.encontroId, "enc_5e6f7a8b");
      assert.equal(chamada.usuario, "org-ana");
    });
  });

  it("atualiza o código automaticamente quando chega a rotação e reagenda a próxima", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock, app }) => {
      local.document.querySelector("#org-encontro-id").value = "enc_5e6f7a8b";
      enviarSubmit(local, "#org-form");
      await esperar();

      const antes = local.document.getElementById("org-codigo").textContent;
      assert.equal(app.organizacao.temAgendamento(), true);

      mock.avancarSegundos(60);
      await app.organizacao.rotacaoAtingida();
      await esperar();

      const depois = local.document.getElementById("org-codigo").textContent;
      assert.notEqual(depois, antes);
      assert.equal(depois, mock.codigoAtual("enc_5e6f7a8b"));
      assert.equal(app.organizacao.temAgendamento(), true);
    });
  });

  it("trata FORA_DA_JANELA retornando pela API", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock, app }) => {
      mock.estado.erroCodigo = {
        status: 422,
        erro: "FORA_DA_JANELA",
        mensagem: "Fora da janela de obtenção do código",
      };
      local.document.querySelector("#org-encontro-id").value = "enc_5e6f7a8b";
      enviarSubmit(local, "#org-form");
      await esperar();

      const msg = local.document.getElementById("org-msg");
      assert.ok(msg.className.includes("erro"));
      assert.ok(msg.textContent.includes("FORA_DA_JANELA"));
      assert.equal(local.document.getElementById("org-codigo-box").hidden, true);
      assert.equal(app.organizacao.temAgendamento(), false);
    });
  });

  it("trata ATIVIDADE_CANCELADA retornando pela API", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      mock.estado.erroCodigo = {
        status: 422,
        erro: "ATIVIDADE_CANCELADA",
        mensagem: "A atividade foi cancelada",
      };
      local.document.querySelector("#org-encontro-id").value = "enc_5e6f7a8b";
      enviarSubmit(local, "#org-form");
      await esperar();

      const msg = local.document.getElementById("org-msg");
      assert.ok(msg.className.includes("erro"));
      assert.ok(msg.textContent.includes("ATIVIDADE_CANCELADA"));
      assert.equal(local.document.getElementById("org-codigo-box").hidden, true);
    });
  });

  it("sem conexão mantém código exibido e agenda nova tentativa", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock, app }) => {
      local.document.querySelector("#org-encontro-id").value = "enc_5e6f7a8b";
      enviarSubmit(local, "#org-form");
      await esperar();
      const primeiro = local.document.getElementById("org-codigo").textContent;

      mock.estado.semRede = true;
      mock.avancarSegundos(60);
      await app.organizacao.rotacaoAtingida();
      await esperar();

      const msg = local.document.getElementById("org-msg");
      assert.ok(msg.className.includes("aviso"));
      assert.ok(msg.textContent.includes("Sem conexão"));
      assert.equal(local.document.getElementById("org-codigo").textContent, primeiro);
      assert.equal(app.organizacao.temAgendamento(), true);
    });
  });
});