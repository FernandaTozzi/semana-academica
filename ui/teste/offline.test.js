import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comApp, esperar, preencherEEnviar } from "./apoio.js";

describe("Presença offline do participante", () => {
  it("sem conexão guarda localmente a leitura (encontro, código, lidoEm) aguardando sincronização", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      mock.estado.semRede = true;
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "K7M2QX",
        form: "#par-form",
      });

      const guardadas = JSON.parse(local.localStorage.getItem("m3.leiturasPendentes"));
      assert.equal(guardadas.length, 1);
      const leitura = guardadas[0];
      assert.equal(leitura.encontroId, "enc_5e6f7a8b");
      assert.equal(leitura.codigo, "K7M2QX");
      assert.ok(leitura.lidoEm && !Number.isNaN(new Date(leitura.lidoEm).getTime()));
      assert.equal(leitura.status, "pendente");

      const msg = local.document.getElementById("par-msg");
      assert.ok(msg.className.includes("aviso"));
      assert.match(msg.textContent, /guardada/);

      const itens = local.document.querySelectorAll("#par-leituras .leitura");
      assert.equal(itens.length, 1);
      assert.ok(itens[0].className.includes("pendente"));
      assert.ok(itens[0].textContent.includes("aguardando sincronização"));
    });
  });

  it("quando a conexão volta, sincroniza automaticamente enviando o lidoEm original", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      mock.estado.semRede = true;
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "K7M2QX",
        form: "#par-form",
      });

      const lidoOriginal = JSON.parse(
        local.localStorage.getItem("m3.leiturasPendentes")
      )[0].lidoEm;

      mock.estado.semRede = false;
      local.dispatchEvent(new local.Event("online"));
      await esperar(30);

      const enviado = mock.estado.requisicoes.presencas[0];
      assert.equal(enviado.encontroId, "enc_5e6f7a8b");
      assert.equal(enviado.usuario, "p-carla");
      assert.equal(enviado.corpo.codigo, "K7M2QX");
      assert.equal(enviado.corpo.lidoEm, lidoOriginal);

      const atualizadas = JSON.parse(local.localStorage.getItem("m3.leiturasPendentes"));
      assert.equal(atualizadas[0].status, "sincronizada");

      const selo = local.document.querySelector("#par-leituras .leitura .selo");
      assert.equal(selo.textContent, "sincronizada");
    });
  });

  it("uma leitura que a API recusa na sincronização fica marcada como falhou e não é removida", async () => {
    await comApp({ agora: "2026-10-19T10:15:30-03:00" }, async ({ local, mock }) => {
      mock.estado.semRede = true;
      await preencherEEnviar(local, {
        encontroId: "enc_5e6f7a8b",
        codigo: "K7M2QX",
        form: "#par-form",
      });

      mock.estado.semRede = false;
      mock.estado.erroPresenca = {
        status: 422,
        erro: "SINCRONIZACAO_TARDIA",
        mensagem: "Envio offline após 2 horas do fim",
      };
      local.dispatchEvent(new local.Event("online"));
      await esperar(30);

      const atualizadas = JSON.parse(local.localStorage.getItem("m3.leiturasPendentes"));
      assert.equal(atualizadas.length, 1);
      assert.equal(atualizadas[0].status, "falhou");

      const selo = local.document.querySelector("#par-leituras .leitura .selo");
      assert.ok(selo.textContent.includes("falhou"));
    });
  });
});