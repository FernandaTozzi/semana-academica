# AGENTS.md — Semana Acadêmica

## 1. Identidade do projeto

Projeto **Semana Acadêmica**.

A API (`api/`) é atualmente o principal subprojeto executável.

A raiz **não possui `package.json`**.

Todos os comandos da API são executados dentro de `api/`.

---

## 2. Estrutura principal

| Pasta | Descrição |
|-------|-----------|
| `api/` | Aplicação Fastify (Node.js + TypeScript) |
| `specs/` | Especificações funcionais por módulo (ex: `M1-grade-de-atividades.md`) |
| `entrevistas/` | Decisões explícitas obtidas via `grilling` (ex: `M1-grade.md`) |
| `auditorias/` | Registros de auditoria de conformidade |
| `.opencode/` | Skills e agentes do opencode (grilling, to-spec, tdd, novo-subagente) |

---

## 3. Hierarquia de fontes (regra obrigatória)

1. **`specs/`** — define os requisitos funcionais da tarefa.
2. **`entrevistas/`** — registra decisões explícitas tomadas para preencher ambiguidades da especificação.
3. **Código existente** — não deve ser tratado como fonte de verdade quando estiver em conflito com uma decisão funcional documentada.
4. Antes de alterar regras funcionais, consultar a spec e a entrevista correspondente.
5. Não alterar a spec apenas para fazer o código atual parecer correto.

---

## 4. Processo de desenvolvimento

- Usar **`grilling`** para descobrir decisões implícitas antes de implementar.
- Registrar decisões em **`entrevistas/`**.
- Usar **`to-spec`** quando houver necessidade de transformar decisões em especificação verificável.
- Usar **TDD** para implementação (fatias verticais, teste primeiro).
- Ciclo TDD: teste falha → implementação mínima → teste passa → próxima fatia.
- Usar **auditoria** quando a etapa exigir verificação de conformidade.

---

## 5. Regra importante sobre o M1

O arquivo `entrevistas/M1-grade.md` contém decisões funcionais aprovadas para o M1 (Grade de Atividades).

Decisões específicas do M1 devem ser consultadas diretamente em:

```
entrevistas/M1-grade.md
```

Não replicar as decisões aqui.

---

## 6. API

Para regras específicas da API (stack, comandos, estrutura interna, modo de teste, autenticação, banco, convenções), consulte:

```
api/AGENTS.md
```

---

## 7. Comandos (executados dentro de `api/`)

```bash
cd api
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run test:watch
```

```bash
npm run build
```

```bash
npm start
```

---

## 8. Regra sobre arquivos

- Não modificar `specs/` para corrigir comportamento de implementação.
- Não modificar `entrevistas/` para refletir código automaticamente.
- Alterações funcionais devem respeitar as decisões registradas.
- Não criar novas tecnologias, frameworks ou dependências sem necessidade.

---

## 9. Conflito entre implementação e decisão funcional

Quando houver divergência entre implementação existente e decisão funcional registrada em `entrevistas/`, a decisão funcional documentada deve ser considerada antes da implementação.