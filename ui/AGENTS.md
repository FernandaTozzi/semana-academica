# AGENTS.md — UI da Semana Acadêmica (M3 Presença por QR)

## Escopo
Somente as duas telas obrigatórias do M3:
- **Organização**: informa o ID do encontro, consulta `GET /encontros/:id/codigo`, exibe o código em destaque (com "Tela cheia"), atualiza sozinho na rotação (`trocaEm`) e trata `FORA_DA_JANELA` e `ATIVIDADE_CANCELADA`.
- **Participante**: informa o ID do encontro, DIGITA o código de 6 caracteres (sem câmera/QR scanner) e envia `POST /encontros/:id/presencas`. Sem rede, guarda a leitura localmente e sincroniza quando a conexão volta, enviando `lidoEm` original.

Não implementar rotas/regras de M1, M2, M4 ou M5.
Não implementar login: a identificação é o cabeçalho `X-Usuario` (contrato da API).

## Stack
- Vanilla HTML/CSS/JS — sem build, sem framework. Arquivos estáticos em `public/`.
- `servidor.mjs` serve `public/` com um servidor HTTP puro do Node (porta `PORT`, padrão 3001).
- Testes: Node test runner (`node --test`) + `jsdom`, com API fake em `teste/apiMock.js` — a UI nunca depende da API real nos testes.

## Estrutura
```
ui/
├── public/            # app servido: index.html, style.css, app.js
├── teste/
│   ├── apiMock.js     # API fake das rotas M3 usadas pela UI
│   ├── apoio.js       # monta JSDOM, injeta o fetch mock, helpers de interação
│   ├── organizacao.test.js
│   ├── participante.test.js
│   └── offline.test.js
├── servidor.mjs
├── package.json
└── AGENTS.md
```

## Contrato com a API
- Todas as rotas exigem `X-Usuario: <id>`; perfis: `organizacao` (código) e `participante` (presença).
- Usuários padrão por tela: organizador `org-ana`, participante `p-carla`. Sobrescrever via query string `?org=` e `?par=`.
- Base da API: `http://localhost:3000` (`?api=<url>` para sobrescrever). A API envia CORS para a UI funcionar no navegador.
- Erros da API chegam como `{"erro","mensagem"}`; a UI trata por `erro`.

## Comandos
- `npm install` — instala devDependencies (jsdom).
- `npm start` — serve a UI em `http://localhost:3001`.
- `npm test` — roda os testes da UI.

## Convenções
- Novos testes em `teste/*.test.js`, um por funcionalidade (organização, participante, offline).
- `app.js` expõe tudo em `window.M3` (api, store, sinc, organizacao, participante) para os testes; `iniciar()` é idempotente e `desligar()` limpa timers — os testes sempre fecham o JSDOM no final.
- `store` persiste leituras pendentes em `localStorage["m3.leiturasPendentes"]` com `status`: `pendente` | `sincronizada` | `falhou`.
- Manter a solução executável com um comando, sem build.