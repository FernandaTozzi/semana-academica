# Entrevista — M1 Grade de Atividades

**Data:** 22/09/2026  
**Especificação base:** `specs/M1-grade-de-atividades.md`  
**Skill utilizada:** `grilling` (`.opencode/skills/grilling/SKILL.md`)

---

## Rodadas realizadas

### Rodada 1 — Fronteira inicial (15 perguntas: P-01 a P-15)

Perguntas abertas cobrindo as 6 famílias do grilling: números, ordem/precedência, estados/transições, fronteira do escopo, contrato de saída, critérios de verificação.

### Rodada 2 — Esclarecimentos pendentes (4 perguntas: P-04, P-06, P-07, P-09)

Respostas do usuário para decisões que não poderiam ser recomendadas sem confirmação explícita.

---

## Perguntas e decisões

| Pergunta | Tópico | Decisão (entrevista) | Regra spec (RN) | Origem |
|----------|--------|----------------------|-----------------|--------|
| **P-01** | Precedência erros criação | Ordem: `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA_DA_CAPACIDADE` → `CONFLITO_DE_SALA` | R8 (RN-102 a RN-108) | **Entrevista** |
| **P-02** | Precedência erros alteração | Ordem: `CAMPO_NAO_EDITAVEL` → `VAGAS_ACIMA_DA_CAPACIDADE` → `VAGAS_ABAIXO_DOS_INSCRITOS` | R13 (RN-110, RN-107, RN-111) | **Entrevista** |
| **P-03** | Precedência erros cancelamento | Ordem: `ATIVIDADE_CANCELADA` → `ATIVIDADE_JA_INICIADA` | R17 (RN-112, RN-113) | **Entrevista** |
| **P-04** | Salas iniciais | `sala_01` (Sala 01, cap 30), `sala_02` (Sala 02, cap 60), `sala_03` (Auditório, cap 100) | Modelo → Sala | **Entrevista** |
| **P-05** | Formato IDs gerados | `atv_` + 8 hex lowercase aleatório; `enc_` + 8 hex lowercase aleatório | Modelo → Atividade/Encontro (id) | **Entrevista** |
| **P-06** | Corpo de erro | Objeto: `{ "erro": "CODIGO", "mensagem": "fixa por código" }` | — (contrato de saída) | **Entrevista** |
| **P-07** | Validação `titulo` | Sem regras adicionais; não criar `TITULO_INVALIDO` | — (spec não define) | **Entrevista** |
| **P-08** | Intervalo 15 min (R7) | Simétrico: 15 min antes do início **e** 15 min após o fim | R7 (RN-108) | **Entrevista** |
| **P-09** | Paginação GET /atividades | Sem paginação (array completo); GET /salas idem | R21–R23 | **Entrevista** |
| **P-10** | ID malformado GET /atividades/:id | `400 ID_INVALIDO` (formato inválido); `404 NAO_ENCONTRADO` (válido, inexistente) | — (contrato de saída) | **Entrevista** |
| **P-11** | Cancelamento + inscrições (R16) | M1 só marca `situacao = "cancelada"`; M2 reage depois | R16 (RN-217) | **Entrevista** |
| **P-12** | Fuso "Brasília" | `America/Sao_Paulo` (IANA); 2026 = `-03:00` fixo | R4, R19, R21 | **Entrevista** |
| **P-13** | `vagasRestantes` clamp | Apenas na resposta GET; nunca negativo | R20 (RN-114) | **Entrevista** |
| **P-14** | Canceladas em listagens | Sempre retornadas (`situacao = "cancelada"`), com ou sem filtros | R24 (RN-115) | **Entrevista** |
| **P-15** | Novos códigos de erro | Permitidos conforme necessidade (ex: `ID_INVALIDO`); específicos | — (extensibilidade) | **Entrevista** |

**Legenda:**  
- **Entrevista** = decisão tomada durante a entrevista (não existia na spec)  
- **Spec** = regra já definida em `specs/M1-grade-de-atividades.md`

---

## 15 Decisões finais (numeradas)

1. **Precedência criação (R8):** `QUANTIDADE_DE_ENCONTROS` → `ENCONTRO_INVALIDO` → `VAGAS_ACIMA_DA_CAPACIDADE` → `CONFLITO_DE_SALA`
2. **Precedência alteração (R13):** `CAMPO_NAO_EDITAVEL` → `VAGAS_ACIMA_DA_CAPACIDADE` → `VAGAS_ABAIXO_DOS_INSCRITOS`
3. **Precedência cancelamento (R17):** `ATIVIDADE_CANCELADA` → `ATIVIDADE_JA_INICIADA`
4. **Salas iniciais:** 3 salas definidas (`sala_01`/`30`, `sala_02`/`60`, `sala_03`/`100`)
5. **IDs gerados:** prefixo + 8 hex lowercase aleatório (`crypto.randomBytes(4).toString('hex')`)
6. **Corpo de erro:** objeto padronizado `{ "erro", "mensagem" }` com mensagens fixas por código
7. **Título:** sem validação extra além da spec; não criar `TITULO_INVALIDO`
8. **Intervalo 15 min (R7):** simétrico (antes do início e após o fim)
9. **Paginação:** nenhuma (array completo em GET /atividades e GET /salas)
10. **ID malformado:** `400 ID_INVALIDO` vs `404 NAO_ENCONTRADO`
11. **Cancelamento + inscrições:** M1 só muda `situacao`; M2 trata inscrições (fora de escopo)
12. **Fuso horário:** `America/Sao_Paulo` (IANA), `-03:00` fixo em 2026
13. **`vagasRestantes` clamp:** apenas na serialização da resposta
14. **Canceladas nas listagens:** sempre incluídas com `situacao = "cancelada"`
15. **Códigos de erro extensíveis:** novos códigos permitidos (ex: `ID_INVALIDO`)

---

## Verificação das 6 famílias do grilling

| Família | Status | Observação |
|---------|--------|------------|
| **Números** | ✅ Resolvida | Capacidades, vagas, durações (60–240 min), intervalo 15 min, limites de encontros (1 vs 2–5) — todos definidos |
| **Ordem e precedência** | ✅ Resolvida | R8, R13, R17 — ordens explícitas nas decisões 1, 2, 3 |
| **Estados e transições** | ✅ Resolvida | `prevista` → `em_andamento` → `encerrada` (relógio); `cancelada` terminal (R14, R15, R19) |
| **Fronteira do escopo** | ✅ Resolvida | M1 = grade; M2 = inscrições; M3 = presença; M4 = certificados; M5 = relatórios (seção 2 da spec) |
| **Contrato de saída** | ✅ Resolvida | Códigos de erro, formato resposta, IDs, filtros, paginação — decisões 5, 6, 9, 10 |
| **Como se verifica** | ✅ Resolvida | 44 critérios de aceite (seção 6) mapeiam 1:1 para testes automatizados (seção 7) |

**Resultado:** Fronteira vazia. Nenhuma decisão implícita restante para o M1.

---

## Recomendações aceitas como decisões

As seguintes recomendações feitas pelo entrevistador foram aceitas integralmente pelo usuário:

- P-01, P-02, P-03: ordens de precedência recomendadas
- P-05: IDs aleatórios lowercase
- P-08: intervalo simétrico
- P-10: distinção `400` vs `404`
- P-11: M1 não mexe em inscrições
- P-12: `America/Sao_Paulo` IANA
- P-13: clamp apenas na resposta
- P-14: canceladas sempre nas listagens
- P-15: códigos extensíveis

Nenhuma regra nova foi inventada além do necessário para preencher lacunas explícitas da spec.

---

## Arquivos não alterados

- `specs/M1-grade-de-atividades.md` — mantido inalterado
- Nenhum código criado ou modificado
- Nenhum teste executado
- Nenhum outro arquivo gerado