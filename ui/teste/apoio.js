import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { makeApiMock } from "./apiMock.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));

export async function montarApp(opts = {}) {
  const [html, appjs] = await Promise.all([
    readFile(path.join(DIR, "..", "public", "index.html"), "utf8"),
    readFile(path.join(DIR, "..", "public", "app.js"), "utf8"),
  ]);

  const mock = makeApiMock(opts);

  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = mock.fetchImpl;
    },
  });

  dom.window.eval(appjs);
  if (!dom.window.M3.foiIniciado()) dom.window.M3.iniciar();

  return { dom, local: dom.window, mock, app: dom.window.M3 };
}

export async function esperar(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function comApp(opts, fn) {
  const { dom, local, mock, app } = await montarApp(opts);
  try {
    return await fn({ dom, local, mock, app });
  } finally {
    app.desligar();
    dom.window.close();
  }
}

export function enviarSubmit(local, seletorFormulario) {
  const form = local.document.querySelector(seletorFormulario);
  form.dispatchEvent(new local.Event("submit", { bubbles: true, cancelable: true }));
}

export async function preencherEEnviar(local, { encontroId, codigo, form }) {
  local.document.querySelector(`${form} [name="encontroId"]`).value = encontroId;
  if (codigo !== undefined) {
    local.document.querySelector(`${form} [name="codigo"]`).value = codigo;
  }
  enviarSubmit(local, form);
  await esperar();
}

export function formatarInstanteLocal(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}