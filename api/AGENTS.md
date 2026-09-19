# AGENTS.md — API Semana Acadêmica

## Stack
- Node.js 20+
- TypeScript 5.6+
- Fastify 4.28+
- SQLite via sql.js (WASM, sem dependências nativas)
- Testes: Node.js test runner (`node --test`) via tsx

## Estrutura
```
api/
├── src/
│   ├── server.ts           # Criação do servidor Fastify
│   ├── db.ts               # Inicialização e helpers do banco SQLite
│   ├── types.d.ts          # Extensões de tipo do Fastify
│   ├── middleware/
│   │   └── auth.ts         # Verificação de X-Usuario
│   └── rotas/
│       ├── teste.ts        # Rotas de modo de teste (/teste/*)
│       ├── salas.ts        # GET /salas
│       └── atividades.ts   # Rotas de atividades (placeholder)
├── verificacoes/
│   └── infraestrutura.spec.ts  # Testes de infraestrutura
├── data/                   # Arquivo do banco (gitignored)
├── package.json
└── tsconfig.json
```

## Regras relevantes para este subprojeto
- **Modo de teste**: Ativado com `MODO_TESTE=1`. Expõe `POST /_teste/reset`, `GET/PUT /_teste/relogio`. Sem a variável, rotas `/_teste/*` → 404.
- **Relógio de teste**: Em modo de teste, o tempo é controlado via `PUT /_teste/relogio`. Inicial: `2026-10-13T09:00:00-03:00`. Todas as regras de tempo usam esse relógio.
- **Identificação**: Cabeçalho `X-Usuario: <id>` obrigatório em todas as rotas (exceto `/certificados/:codigo` e `/_teste/*`). Usuário inexistente → `401 USUARIO_DESCONHECIDO`.
- **Dados iniciais**: Carregados no primeiro start e a cada `POST /_teste/reset` (10 usuários, 4 salas).
- **Banco**: SQLite embutido (arquivo `data/semana.db`), sem servidor externo.
- **Porta**: Variável `PORT` (padrão 3000).

## Comandos
- `npm run dev` — sobe com hot-reload (tsx watch)
- `npm run build` — compila para `dist/`
- `npm start` — roda `dist/server.js`
- `npm test` — roda testes (`tsx --test verificacoes/*.spec.ts`)

## Convenções de código
- Testes em `verificacoes/*.spec.ts`, um arquivo por fatia/funcionalidade.
- TDD: teste falha → código mínimo → verde → próxima fatia.
- Rotas registradas em `src/rotas/`, uma por recurso.
- Middleware de auth em `src/middleware/auth.ts`.
- Banco acessado via `app.db` (decorado no Fastify).
- Persistência: `salvarBanco(db)` após escritas.