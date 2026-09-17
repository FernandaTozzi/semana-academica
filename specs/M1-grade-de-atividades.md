# Spec — M1 Grade de atividades

## 1. Objetivo
Gerenciar a grade de atividades da Semana Acadêmica: listar salas, criar, consultar, alterar e cancelar atividades (palestras e minicursos), com validações de capacidade, horários, conflitos de sala e regras de negócio do evento.

## 2. Fora de escopo
- Inscrições, lista de espera, cancelamento de inscrição → M2
- Presença por QR, presença manual, códigos de encontro → M3
- Emissão e verificação de certificados, extrato → M4
- Painel da organização, bloqueios, relatórios CSV → M5
- Criação de usuários e salas (dados iniciais fixos)
- Regras de prazo máximo para criar/alterar atividades (não existe no M1)

## 3. Modelo

### Sala
| Campo | Tipo | Origem |
|-------|------|--------|
| id | string | informado pelo cliente (dados iniciais) |
| nome | string | informado pelo cliente (dados iniciais) |
| capacidade | integer | informado pelo cliente (dados iniciais) |

### Atividade
| Campo | Tipo | Origem |
|-------|------|--------|
| id | string (prefixo `atv_` + 8 hex) | calculado |
| titulo | string | informado pelo cliente |
| tipo | "palestra" \| "minicurso" | informado pelo cliente |
| salaId | string | informado pelo cliente |
| vagas | integer | informado pelo cliente |
| encontros | array de Encontro | informado pelo cliente |
| cargaHorariaMinutos | integer | calculado (soma das durações) |
| situacao | "prevista" \| "em_andamento" \| "encerrada" \| "cancelada" | calculado (pelo relógio) |
| ocupadas | integer | derivado (confirmadas + convocadas) |
| vagasRestantes | integer | derivado (vagas - ocupadas) |
| emEspera | integer | derivado (inscrições em espera) |

### Encontro
| Campo | Tipo | Origem |
|-------|------|--------|
| id | string (prefixo `enc_` + 8 hex) | calculado |
| inicio | string (ISO 8601 com fuso) | informado pelo cliente |
| fim | string (ISO 8601 com fuso) | informado pelo cliente |

## 4. Endpoints

| Método | Rota | Quem | Sucesso | Corpo entrada |
|--------|------|------|---------|---------------|
| GET | `/salas` | todos | 200 `[Sala]` | — |
| GET | `/atividades` | todos | 200 `[Atividade]` | query: `dia=AAAA-MM-DD`, `tipo=palestra\|minicurso` |
| GET | `/atividades/:id` | todos | 200 `Atividade` | — |
| POST | `/atividades` | organização | 201 `Atividade` | `{titulo, tipo, salaId, vagas, encontros[]}` |
| PATCH | `/atividades/:id` | organização | 200 `Atividade` | subconjunto de `{titulo, vagas}` |
| POST | `/atividades/:id/cancelamento` | organização | 200 `Atividade` | — |

## 5. Regras

### Validações de criação (POST /atividades)

**R1** (P-01, RN-102)  
Se `tipo == "palestra"`, `encontros` deve ter exatamente 1 item. Caso contrário → `422 QUANTIDADE_DE_ENCONTROS`.

**R2** (P-01, RN-103)  
Se `tipo == "minicurso"`, `encontros` deve ter entre 2 e 5 itens. Caso contrário → `422 QUANTIDADE_DE_ENCONTROS`.

**R3** (P-02, RN-104)  
Cada encontro deve ter duração entre 60 e 240 minutos (inclusive). Caso contrário → `422 ENCONTRO_INVALIDO`.

**R4** (P-02, RN-105)  
Cada encontro deve ter `inicio` e `fim` no mesmo dia civil (fuso de Brasília) e dentro do período do evento (19/10/2026 a 23/10/2026). Caso contrário → `422 ENCONTRO_INVALIDO`.

**R5** (P-02, RN-106)  
Encontros da mesma atividade não podem se sobrepor (intervalos fechados em `inicio`, abertos em `fim`). Caso contrário → `422 ENCONTRO_INVALIDO`.

**R6** (P-03, RN-107)  
`vagas` deve ser ≥ 1 e ≤ `capacidade` da `salaId`. Caso contrário → `422 VAGAS_ACIMA_DA_CAPACIDADE`.

**R7** (P-04, RN-108)  
Não pode haver conflito de sala: nenhum encontro da nova atividade pode sobrepor ou ficar a menos de 15 minutos do fim/início de qualquer encontro de **outra atividade não cancelada** na mesma sala. Caso contrário → `409 CONFLITO_DE_SALA`.

**R8** (P-12)  
Quando múltiplas regras de validação de criação recusam a mesma requisição, a ordem de precedência entre os códigos `QUANTIDADE_DE_ENCONTROS`, `ENCONTRO_INVALIDO`, `VAGAS_ACIMA_DA_CAPACIDADE`, `CONFLITO_DE_SALA` **não foi definida pelas regras consultadas**. A implementação deve escolher uma ordem consistente e documentada.

### Validações de alteração (PATCH /atividades/:id)

**R9** (P-05, RN-110)  
Campos `tipo`, `salaId`, `encontros` são imutáveis após criação. Tentativa de alterá-los → `422 CAMPO_NAO_EDITAVEL`.

**R10** (P-03, RN-107)  
Se `vagas` for informado, deve ser ≥ 1 e ≤ `capacidade` da sala original. Caso contrário → `422 VAGAS_ACIMA_DA_CAPACIDADE`.

**R11** (P-06, RN-111)  
Se `vagas` for informado e for menor que `ocupadas` (inscrições `confirmada` + `convocada` da atividade), → `409 VAGAS_ABAIXO_DOS_INSCRITOS`.

**R12** (P-04, RN-108)  
Se `vagas` for alterado, a validação de conflito de sala (R7) **não** é reexecutada, pois `salaId` e `encontros` não mudam.

**R13** (P-12)  
Quando múltiplas regras de validação de alteração recusam a mesma requisição, a ordem de precedência entre `CAMPO_NAO_EDITAVEL`, `VAGAS_ACIMA_DA_CAPACIDADE`, `VAGAS_ABAIXO_DOS_INSCRITOS` **não foi definida pelas regras consultadas**. A implementação deve escolher uma ordem consistente e documentada.

### Cancelamento (POST /atividades/:id/cancelamento)

**R14** (P-07, RN-112)  
Cancelamento só é permitido enquanto `situacao == "prevista"` (ou seja, antes do `inicio` do primeiro encontro). Se a atividade já iniciou (`em_andamento` ou `encerrada`) → `422 ATIVIDADE_JA_INICIADA`.

**R15** (P-16, RN-113)  
Atividade cancelada fica com `situacao = "cancelada"` definitivamente. Não pode ser alterada nem cancelada novamente. Tentativa de PATCH ou novo cancelamento → `422 ATIVIDADE_CANCELADA`.

**R16** (P-17, RN-217)  
Ao cancelar, todas as inscrições ativas da atividade (`confirmada`, `em_espera`, `convocada`) são canceladas automaticamente (mudam para `cancelada`).

**R17** (P-12)  
Quando múltiplas regras de cancelamento recusam a mesma requisição, a ordem de precedência entre `ATIVIDADE_JA_INICIADA`, `ATIVIDADE_CANCELADA` **não foi definida pelas regras consultadas**. A implementação deve escolher uma ordem consistente e documentada.

### Cálculos derivados

**R18** (P-08, RN-109)  
`cargaHorariaMinutos` = soma de `(fim - inicio)` em minutos de todos os encontros. Sem arredondamento. Intervalos entre encontros não contam.

**R19** (P-09, RN-114)  
`situacao` é calculada pelo relógio de teste:
- `prevista`: relógio < `inicio` do primeiro encontro
- `em_andamento`: `inicio` do primeiro encontro ≤ relógio < `fim` do último encontro
- `encerrada`: relógio ≥ `fim` do último encontro
- `cancelada`: prevalece sobre todas as anteriores

**R20** (P-10)  
`ocupadas` = contagem de inscrições com status `confirmada` ou `convocada` da atividade.  
`emEspera` = contagem de inscrições com status `em_espera` da atividade.  
`vagasRestantes` = `vagas - ocupadas` (nunca negativo; se `ocupadas > vagas`, mostra 0).

### Filtros de listagem (GET /atividades)

**R21** (P-11, RN-116)  
Filtro `dia=AAAA-MM-DD` (calendário de Brasília): retorna a atividade se **qualquer** um de seus encontros ocorre nessa data (comparação de dia civil no fuso -03:00).

**R22** (P-11, RN-116)  
Filtro `tipo=palestra|minicurso`: retorna só atividades do tipo indicado.

**R23** (P-11, RN-116)  
Filtros `dia` e `tipo` são combinados com AND (ambos devem satisfazer quando presentes).

### Consultas de atividade cancelada

**R24** (P-16, RN-115)  
Atividades canceladas continuam sendo retornadas em `GET /atividades`, `GET /atividades/:id` e `GET /atividades?dia=...` com `situacao = "cancelada"`.

**R25** (P-16, RN-113)  
Atividades canceladas são excluídas da verificação de conflito de sala (R7).

### Limites globais

**R26** (P-15)  
Não há limite de quantidade de atividades por sala/dia nem limite total de atividades no evento. A única restrição é o conflito de sala com intervalo de 15 minutos (R7).

### Prazo de criação/alteração

**R27** (P-14)  
Não existe prazo máximo (data-limite) para criar ou alterar atividades no M1. As regras RN-101 a RN-116 não estabelecem tal restrição.

## 6. Critérios de aceite

1. (R1) POST `/atividades` com `tipo=palestra` e 2 encontros → 422 `QUANTIDADE_DE_ENCONTROS`
2. (R2) POST `/atividades` com `tipo=minicurso` e 1 encontro → 422 `QUANTIDADE_DE_ENCONTROS`
3. (R2) POST `/atividades` com `tipo=minicurso` e 6 encontros → 422 `QUANTIDADE_DE_ENCONTROS`
4. (R3) POST `/atividades` com encontro de 30 min → 422 `ENCONTRO_INVALIDO`
5. (R3) POST `/atividades` com encontro de 5 horas → 422 `ENCONTRO_INVALIDO`
6. (R4) POST `/atividades` com encontro em 18/10/2026 → 422 `ENCONTRO_INVALIDO`
7. (R4) POST `/atividades` com encontro em 24/10/2026 → 422 `ENCONTRO_INVALIDO`
8. (R4) POST `/atividades` com encontro `inicio=2026-10-19T19:00:00-03:00`, `fim=2026-10-20T22:00:00-03:00` (dias diferentes) → 422 `ENCONTRO_INVALIDO`
9. (R5) POST `/atividades` com dois encontros sobrepostos na mesma atividade → 422 `ENCONTRO_INVALIDO`
10. (R6) POST `/atividades` com `vagas=0` → 422 `VAGAS_ACIMA_DA_CAPACIDADE`
11. (R6) POST `/atividades` com `vagas=41` na `sala-101` (capacidade 40) → 422 `VAGAS_ACIMA_DA_CAPACIDADE`
12. (R7) POST `/atividades` com encontro que sobrepõe outro na mesma sala → 409 `CONFLITO_DE_SALA`
13. (R7) POST `/atividades` com encontro que começa 10 min após fim de outro na mesma sala → 409 `CONFLITO_DE_SALA`
14. (R7) POST `/atividades` com encontro que começa 15 min após fim de outro na mesma sala → 201 (OK)
15. (R7) POST `/atividades` com encontro em sala onde outra atividade cancelada tem encontro no mesmo horário → 201 (OK)
16. (R8) Verificar que a ordem de erro é consistente quando múltiplas violações ocorrem juntas
17. (R9) PATCH `/atividades/:id` tentando mudar `tipo` → 422 `CAMPO_NAO_EDITAVEL`
18. (R9) PATCH `/atividades/:id` tentando mudar `salaId` → 422 `CAMPO_NAO_EDITAVEL`
19. (R9) PATCH `/atividades/:id` tentando mudar `encontros` → 422 `CAMPO_NAO_EDITAVEL`
20. (R10) PATCH `/atividades/:id` com `vagas=0` → 422 `VAGAS_ACIMA_DA_CAPACIDADE`
21. (R10) PATCH `/atividades/:id` com `vagas > capacidade` → 422 `VAGAS_ACIMA_DA_CAPACIDADE`
22. (R11) PATCH `/atividades/:id` reduzindo `vagas` abaixo de `ocupadas` → 409 `VAGAS_ABAIXO_DOS_INSCRITOS`
23. (R11) PATCH `/atividades/:id` reduzindo `vagas` para exatamente `ocupadas` → 200 OK
24. (R13) Verificar ordem de erro consistente em PATCH com múltiplas violações
25. (R14) POST `/atividades/:id/cancelamento` com atividade `prevista` → 200, `situacao=cancelada`
26. (R14) POST `/atividades/:id/cancelamento` com atividade `em_andamento` → 422 `ATIVIDADE_JA_INICIADA`
27. (R14) POST `/atividades/:id/cancelamento` com atividade `encerrada` → 422 `ATIVIDADE_JA_INICIADA`
28. (R15) PATCH em atividade `cancelada` → 422 `ATIVIDADE_CANCELADA`
29. (R15) POST cancelamento em atividade `cancelada` → 422 `ATIVIDADE_CANCELADA`
30. (R16) Cancelar atividade com inscrições `confirmada`, `em_espera`, `convocada` → todas viram `cancelada`
31. (R17) Verificar ordem de erro consistente em cancelamento com múltiplas violações
32. (R18) Atividade com 2 encontros de 3h cada → `cargaHorariaMinutos = 360`
33. (R19) Atividade `prevista` → avançar relógio para 1º início → `em_andamento`
34. (R19) Atividade `em_andamento` → avançar relógio para último fim → `encerrada`
35. (R19) Atividade `cancelada` → qualquer relógio → `cancelada`
36. (R20) Verificar `ocupadas`, `emEspera`, `vagasRestantes` batem com inscrições simuladas
37. (R21) GET `/atividades?dia=2026-10-19` retorna atividade com encontro nesse dia
38. (R21) GET `/atividades?dia=2026-10-19` não retorna atividade cujos encontros são só no dia 20
39. (R22) GET `/atividades?tipo=palestra` retorna só palestras
40. (R23) GET `/atividades?dia=2026-10-19&tipo=minicurso` retorna só minicursos no dia 19
41. (R24) GET `/atividades` lista atividades canceladas com `situacao=cancelada`
42. (R25) Criar atividade em sala/horário de atividade cancelada → 201 OK
43. (R26) Criar 100 atividades na mesma sala em dias diferentes (sem conflito) → 201 OK
44. (R27) Criar atividade em 2026-12-31 (fora do evento) → falha por R4, não por prazo

## 7. Como isto será verificado
Testes de integração HTTP (via `supertest` ou similar) contra a API rodando em modo `MODO_TESTE=1`, usando o relógio de teste (`PUT /_teste/relogio`) para controlar tempo e `POST /_teste/reset` para isolamento. Cada critério de aceite mapeia para um caso de teste automatizado.

## 8. Fatias de entrega

### Fatia 1 — Leitura básica
- GET `/salas` retorna dados iniciais
- GET `/atividades` sem filtros retorna lista vazia inicialmente
- GET `/atividades/:id` inexistente → 404 `NAO_ENCONTRADO`

### Fatia 2 — Criação de palestra
- POST `/atividades` com `tipo=palestra`, 1 encontro válido, vagas válidas → 201
- Validações R1, R3, R4, R5, R6
- `cargaHorariaMinutos`, `situacao=prevista`, `ocupadas=0`, `vagasRestantes=vagas`, `emEspera=0` calculados corretamente

### Fatia 3 — Criação de minicurso
- POST `/atividades` com `tipo=minicurso`, 2–5 encontros válidos → 201
- Validações R2, R3, R4, R5, R6

### Fatia 4 — Conflito de sala
- R7: bloquear sobreposição e intervalo < 15 min
- R25: permitir sobreposição com atividade cancelada

### Fatia 5 — Filtros de listagem
- R21, R22, R23: `dia`, `tipo`, combinação AND

### Fatia 6 — Alteração (PATCH)
- R9: campos imutáveis
- R10, R11: validações de `vagas`
- `vagasRestantes` recalcula

### Fatia 7 — Cancelamento
- R14, R15, R16: cancelar só `prevista`, definitivo, cancela inscrições
- R24: cancelada aparece nas listagens

### Fatia 8 — Situação pelo relógio
- R19: `prevista` → `em_andamento` → `encerrada` via `PUT /_teste/relogio`
- R19: `cancelada` prevalece

### Fatia 9 — Precedência de erros (R8, R13, R17)
- Documentar e testar ordem escolhida para cada operação