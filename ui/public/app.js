(function () {
  "use strict";

  var QUERY = new URLSearchParams(window.location.search);

  var M3 = {
    config: {
      apiBase: QUERY.get("api") || "http://localhost:3000",
      orgUsuario: QUERY.get("org") || "org-ana",
      parUsuario: QUERY.get("par") || "p-carla",
    },
  };

  function ErroApi(status, erro, mensagem) {
    this.status = status;
    this.erro = erro;
    this.mensagem = mensagem;
    this.nome = "ErroApi";
    this.mensagemCompleta = erro + ": " + mensagem;
  }
  ErroApi.prototype = Object.create(Error.prototype);

  function ErroRede() {
    this.nome = "ErroRede";
    this.mensagemCompleta = "Sem conexão com a API";
  }
  ErroRede.prototype = Object.create(Error.prototype);

  async function requisicao(caminho, opcoes) {
    opcoes = opcoes || {};
    var cabecalhos = { "Content-Type": "application/json" };
    if (opcoes.usuario) cabecalhos["X-Usuario"] = opcoes.usuario;

    var resposta;
    try {
      resposta = await window.fetch(M3.config.apiBase + caminho, {
        method: opcoes.metodo || "GET",
        headers: cabecalhos,
        body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      });
    } catch (erro) {
      throw new ErroRede();
    }

    var texto = await resposta.text();
    var dados = null;
    if (texto) {
      try { dados = JSON.parse(texto); } catch (erro) { dados = texto; }
    }

    if (!resposta.ok) {
      var corpo = dados && typeof dados === "object" ? dados : {};
      throw new ErroApi(
        resposta.status,
        corpo.erro || "ERRO",
        corpo.mensagem || texto || resposta.statusText
      );
    }
    return dados;
  }

  M3.api = {
    buscarCodigo: function (encontroId, usuario) {
      return requisicao("/encontros/" + encodeURIComponent(encontroId) + "/codigo", {
        usuario: usuario,
      });
    },
    registrarPresenca: function (encontroId, codigo, lidoEm, usuario) {
      var corpo = { codigo: codigo };
      if (lidoEm) corpo.lidoEm = lidoEm;
      return requisicao("/encontros/" + encodeURIComponent(encontroId) + "/presencas", {
        metodo: "POST",
        usuario: usuario,
        corpo: corpo,
      });
    },
  };

  var CHAVE_LEITURAS = "m3.leiturasPendentes";
  var assinantes = [];

  function lerLeituras() {
    try {
      var bruto = window.localStorage.getItem(CHAVE_LEITURAS);
      var dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch (erro) {
      return [];
    }
  }

  function persistirLeituras(leituras) {
    window.localStorage.setItem(CHAVE_LEITURAS, JSON.stringify(leituras));
    for (var i = 0; i < assinantes.length; i++) assinantes[i](leituras.slice());
  }

  function novoId() {
    return "m3_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  M3.store = {
    listar: lerLeituras,
    assinar: function (fn) { assinantes.push(fn); },
    adicionarLeitura: function (dados) {
      var leituras = lerLeituras();
      var leitura = {
        id: novoId(),
        encontroId: dados.encontroId,
        codigo: dados.codigo,
        lidoEm: dados.lidoEm,
        status: "pendente",
      };
      leituras.push(leitura);
      persistirLeituras(leituras);
      return leitura;
    },
    setarStatus: function (id, status, extra) {
      var leituras = lerLeituras().map(function (l) {
        if (l.id !== id) return l;
        var novo = { id: l.id, encontroId: l.encontroId, codigo: l.codigo, lidoEm: l.lidoEm, status: status };
        if (extra) {
          for (var chave in extra) if (Object.prototype.hasOwnProperty.call(extra, chave)) novo[chave] = extra[chave];
        }
        return novo;
      });
      persistirLeituras(leituras);
    },
  };

  async function executarSincronizacao(usuario) {
    var participantes = usuario || M3.config.parUsuario;
    var pendentes = lerLeituras().filter(function (l) { return l.status !== "sincronizada"; });
    var resumo = { enviadas: 0, falhas: 0 };
    for (var indice = 0; indice < pendentes.length; indice++) {
      var leitura = pendentes[indice];
      try {
        await M3.api.registrarPresenca(leitura.encontroId, leitura.codigo, leitura.lidoEm, participantes);
        M3.store.setarStatus(leitura.id, "sincronizada");
        resumo.enviadas++;
      } catch (erro) {
        if (erro instanceof ErroRede) {
          resumo.falhas++;
          return resumo;
        }
        M3.store.setarStatus(leitura.id, "falhou", { erro: erro.erro });
        resumo.falhas++;
      }
    }
    return resumo;
  }

  M3.sinc = { executar: executarSincronizacao };

  function elemento(id) { return document.getElementById(id); }

  function formatarInstante(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  M3.formatarInstante = formatarInstante;

  var timerOrganizacao = null;

  function mensagemOrg(tipo, texto) {
    var msg = elemento("org-msg");
    msg.className = "msg " + tipo;
    msg.textContent = texto;
  }

  function trataErroCodigo(erro) {
    if (erro instanceof ErroRede) {
      mensagemOrg("aviso", "Sem conexão; o último código permanece e a tentativa será repetida.");
      return;
    }
    if (erro instanceof ErroApi) {
      if (erro.erro === "FORA_DA_JANELA") {
        elemento("org-codigo-box").hidden = true;
        mensagemOrg("erro", "FORA_DA_JANELA: o código só pode ser obtido de 15 minutos antes até 30 minutos depois do início do encontro.");
        return;
      }
      if (erro.erro === "ATIVIDADE_CANCELADA") {
        elemento("org-codigo-box").hidden = true;
        mensagemOrg("erro", "ATIVIDADE_CANCELADA: a atividade deste encontro foi cancelada e não há código.");
        return;
      }
      mensagemOrg("erro", erro.erro + ": " + erro.mensagem);
      return;
    }
    mensagemOrg("erro", "Não foi possível obter o código.");
  }

  function deltaAte(iso) {
    return Math.max(0, new Date(iso).getTime() - Date.now()) + 250;
  }

  function agendarProxima(ms) {
    if (timerOrganizacao) clearTimeout(timerOrganizacao);
    timerOrganizacao = setTimeout(rotacaoAtingida, ms);
  }

  async function rotacaoAtingida() {
    timerOrganizacao = null;
    await carregarCodigo(false);
  }

  function temAgendamento() {
    return timerOrganizacao !== null;
  }

  async function carregarCodigo(mostrarAviso) {
    var encontroId = (elemento("org-encontro-id").value || "").trim();
    if (!encontroId) {
      if (mostrarAviso !== false) mensagemOrg("erro", "Informe o ID do encontro.");
      return false;
    }
    if (timerOrganizacao) { clearTimeout(timerOrganizacao); timerOrganizacao = null; }

    var dados;
    try {
      dados = await M3.api.buscarCodigo(encontroId, M3.config.orgUsuario);
    } catch (erro) {
      trataErroCodigo(erro);
      if (erro instanceof ErroRede) agendarProxima(5000);
      return false;
    }

    var box = elemento("org-codigo-box");
    box.hidden = false;
    elemento("org-codigo").textContent = dados.codigo;
    elemento("org-valido").textContent = formatarInstante(dados.validoAte);
    elemento("org-valido").dateTime = dados.validoAte;
    elemento("org-troca").textContent = formatarInstante(dados.trocaEm);
    elemento("org-troca").dateTime = dados.trocaEm;
    elemento("org-encontro-info").textContent = encontroId;
    mensagemOrg("", "");
    agendarProxima(deltaAte(dados.trocaEm));
    return true;
  }

  M3.organizacao = {
    carregar: carregarCodigo,
    atualizar: function () { return carregarCodigo(false); },
    rotacaoAtingida: rotacaoAtingida,
    deltaAte: deltaAte,
    temAgendamento: temAgendamento,
    parar: function () { if (timerOrganizacao) { clearTimeout(timerOrganizacao); timerOrganizacao = null; } },
  };

  function mensagemPar(tipo, texto) {
    var msg = elemento("par-msg");
    msg.className = "msg " + tipo;
    msg.textContent = texto;
  }

  function normalizarCodigo(valor) {
    return (valor || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  }

  function renderizarLeituras() {
    var box = elemento("par-leituras-box");
    var lista = elemento("par-leituras");
    var leituras = lerLeituras();
    box.hidden = leituras.length === 0;
    lista.textContent = "";
    for (var i = 0; i < leituras.length; i++) {
      var l = leituras[i];
      var item = document.createElement("li");
      item.className = "leitura " + l.status;
      item.dataset.leituraId = l.id;

      var detalhes = document.createElement("span");
      detalhes.textContent = l.encontroId + " · " + l.codigo + " · " + formatarInstante(l.lidoEm);

      var selo = document.createElement("span");
      selo.className = "selo";
      selo.textContent = l.status === "pendente" ? "aguardando sincronização"
        : l.status === "sincronizada" ? "sincronizada"
        : "falhou: " + (l.erro || "erro");

      item.appendChild(detalhes);
      item.appendChild(selo);
      lista.appendChild(item);
    }
  }

  async function enviarPresenca() {
    var encontroId = (elemento("par-encontro-id").value || "").trim();
    var codigo = normalizarCodigo(elemento("par-codigo").value);

    if (!encontroId) { mensagemPar("erro", "Informe o ID do encontro."); return; }
    if (codigo.length !== 6) { mensagemPar("erro", "Digite os 6 caracteres do código."); return; }

    try {
      await M3.api.registrarPresenca(encontroId, codigo, undefined, M3.config.parUsuario);
      mensagemPar("sucesso", "Presença registrada com sucesso.");
      elemento("par-codigo").value = "";
    } catch (erro) {
      if (erro instanceof ErroRede) {
        M3.store.adicionarLeitura({
          encontroId: encontroId,
          codigo: codigo,
          lidoEm: new Date().toISOString(),
        });
        mensagemPar("aviso", "Sem conexão: presença guardada localmente e será sincronizada automaticamente.");
        renderizarLeituras();
        await executarSincronizacao();
      } else if (erro instanceof ErroApi) {
        mensagemPar("erro", erro.erro + ": " + erro.mensagem);
      } else {
        mensagemPar("erro", "Não foi possível registrar a presença.");
      }
    }
  }

  M3.participante = {
    enviar: enviarPresenca,
    normalizarCodigo: normalizarCodigo,
    renderizarLeituras: renderizarLeituras,
  };

  function alternarTela(nome) {
    var org = nome === "organizacao";
    elemento("tela-organizacao").hidden = !org;
    elemento("tela-participante").hidden = org;
    elemento("tab-organizacao").classList.toggle("ativo", org);
    elemento("tab-participante").classList.toggle("ativo", !org);
  }

  var intervaloSinc = null;
  var iniciado = false;

  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    elemento("tab-organizacao").addEventListener("click", function () { alternarTela("organizacao"); });
    elemento("tab-participante").addEventListener("click", function () { alternarTela("participante"); });
    elemento("org-form").addEventListener("submit", function (ev) { ev.preventDefault(); carregarCodigo(true); });
    elemento("par-form").addEventListener("submit", function (ev) { ev.preventDefault(); enviarPresenca(); });
    elemento("org-cheia").addEventListener("click", function () {
      var box = elemento("org-codigo-box");
      if (box.requestFullscreen) box.requestFullscreen();
    });
    elemento("par-codigo").addEventListener("input", function (ev) {
      ev.target.value = normalizarCodigo(ev.target.value);
    });
    M3.store.assinar(renderizarLeituras);
    renderizarLeituras();
    window.addEventListener("online", function () { executarSincronizacao(); });
    window.addEventListener("offline", function () {
      var msg = elemento("par-msg");
      if (!msg.textContent) mensagemPar("aviso", "Sem conexão com a API.");
    });
    intervaloSinc = setInterval(function () { executarSincronizacao(); }, 10000);
    alternarTela("organizacao");
  }

  M3.iniciar = iniciar;
  M3.foiIniciado = function () { return iniciado; };
  M3.desligar = function () {
    M3.organizacao.parar();
    if (intervaloSinc) clearInterval(intervaloSinc);
    assinantes.length = 0;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.M3 = M3;
})();