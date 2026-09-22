export const JANELA = 60000;
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function hashStr(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function codigoDaJanela(encontroId, janelaInicio) {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    const h = hashStr(`${encontroId}|${janelaInicio}#${i}`);
    codigo += ALFABETO[h % ALFABETO.length];
  }
  return codigo;
}

export function makeApiMock(opts = {}) {
  const estado = {
    agora: opts.agora ? Date.parse(opts.agora) : Date.now(),
    semRede: false,
    erroCodigo: null,
    erroPresenca: null,
    requisicoes: { codigos: [], presencas: [] },
  };

  function codigoAtual(encontroId) {
    const janela = Math.floor(estado.agora / JANELA) * JANELA;
    return codigoDaJanela(encontroId, janela);
  }

  function responder(status, dados) {
    return {
      ok: status < 400,
      status,
      statusText: String(status),
      headers: new Headers({ "Content-Type": "application/json" }),
      async text() { return JSON.stringify(dados); },
    };
  }

  async function fetchImpl(url, opcoes = {}) {
    if (estado.semRede) throw new TypeError("Failed to fetch");
    const u = new URL(String(url));
    const metodo = (opcoes.method || "GET").toUpperCase();
    const cabecalhos = opcoes.headers || {};
    const usuario = cabecalhos["X-Usuario"];
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : undefined;

    const mLegivel = u.pathname.match(/^\/encontros\/([^/]+)\/codigo$/);
    const mRegistro = u.pathname.match(/^\/encontros\/([^/]+)\/presencas$/);

    if (mLegivel && metodo === "GET") {
      estado.requisicoes.codigos.push({ encontroId: mLegivel[1], usuario });
      if (estado.erroCodigo) return responder(estado.erroCodigo.status, estado.erroCodigo);
      const janela = Math.floor(estado.agora / JANELA) * JANELA;
      return responder(200, {
        encontroId: mLegivel[1],
        codigo: codigoDaJanela(mLegivel[1], janela),
        trocaEm: new Date(janela + JANELA).toISOString(),
        validoAte: new Date(janela + 2 * JANELA).toISOString(),
      });
    }

    if (mRegistro && metodo === "POST") {
      estado.requisicoes.presencas.push({ encontroId: mRegistro[1], usuario, corpo });
      if (estado.erroPresenca) return responder(estado.erroPresenca.status, estado.erroPresenca);
      const offline = typeof corpo.lidoEm === "string";
      const registradaEm = new Date(estado.agora).toISOString();
      return responder(201, {
        id: "pre_mock00000001",
        encontroId: mRegistro[1],
        participanteId: usuario,
        origem: offline ? "qr_offline" : "qr",
        lidoEm: offline ? corpo.lidoEm : registradaEm,
        registradaEm,
        justificativa: null,
      });
    }

    return responder(404, { erro: "NAO_ENCONTRADO", mensagem: "rota inexistente no mock" });
  }

  return {
    estado,
    codigoAtual,
    codigoDaJanela,
    fetchImpl,
    setAgora(iso) { estado.agora = Date.parse(iso); },
    avancarSegundos(s) { estado.agora += s * 1000; },
  };
}