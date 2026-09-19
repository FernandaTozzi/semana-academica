# Spec — M3 Presença por QR

## 1. Objetivo
Permitir que a organização disponibilize um código por encontro (que muda a cada minuto) para que participantes registrem presença por QR no ato, e registrar presenças por QR lido offline (com tolerância de sincronização) ou manualmente (com justificativa e limite), e listar as presenças de um encontro.

## 2. Fora de escopo
- Editar ou remover presenças → não existe rota
- Gerar a imagem do QR. A API responde o `codigo`; a renderização do QR é responsabilidade da interface
- Geolocalização na presença
- Bloqueio de participantes → M5
- Emissão e verificação de certificados, extrato → M4
- `ATIVIDADE_CANCELADA` vale apenas para a obtenção do código; **não** existe para o registro de presença (o registro segue as validações normais da rota)

## 3. Modelo

### CodigoDoEncontro (resposta de GET /encontros/:id/codigo)
| Campo | Tipo | Origem |
|-------|------|--------|
| encontroId | string | informado pela rota |
| codigo | string (6 caracteres) | calculado — um código por janela de rotação do encontro |
| trocaEm | string (ISO 8601 com fuso) | calculado — início da próxima janela de rotação |
| validoAte | string (ISO 8601 com fuso) | calculado — fim da janela seguinte (primeiro instante em que o código deixa de ser aceito) |

### Presenca
| Campo | Tipo | Origem |
|-------|------|--------|
| id | string (prefixo `pre_` + 8 hex) | calculado |
| encontroId | string | informado pela rota |
| participanteId | string | informado (rota online: cabeçalho `X-Usuario`; rota manual: corpo) |
| origem | "qr" \| "qr_offline" \| "manual" | derivado (ver R20) |
| lidoEm | string (ISO 8601 com fuso) ou null | online sem `lidoEm`: derivado = `registradaEm`; offline: informado; manual: nulo |
| registradaEm | string (ISO 8601 com fuso) | calculado — relógio do servidor no momento da gravação |
| justificativa | string ou null | informado — só quando `origem = "manual"` |

## 4. Endpoints

| Método | Rota | Quem | Sucesso | Corpo de entrada |
|--------|------|------|---------|------------------|
| GET | `/encontros/:id/codigo` | organização | 200 `CodigoDoEncontro` | — |
| POST | `/encontros/:id/presencas` | participante | 201 1ª vez; 200 depois | `{codigo, lidoEm?}` |
| POST | `/encontros/:id/presencas/manual` | organização | 201 1ª vez; 200 depois | `{participanteId, justificativa}` |
| GET | `/encontros/:id/presencas` | organização | 200 `[Presenca]` | — |

## 5. Regras

Ordem geral de verificação (do contrato): identificação (401 `USUARIO_DESCONHECIDO`) → perfil (403 `SOMENTE_ORGANIZACAO`/`SOMENTE_PARTICIPANTE`) → existência do encontro (404 `NAO_ENCONTRADO`) → corpo (422 `DADOS_INVALIDOS`) → regras do recurso. Em `POST /encontros/:id/presencas/manual`, `justificativa` ausente **não** é `DADOS_INVALIDOS` (é `JUSTIFICATIVA_OBRIGATORIA`, R16).

### Obtenção do código (GET /encontros/:id/codigo)

**R1** (P-01, RN-301)  
O código pode ser obtido de 15 minutos antes até 30 minutos depois do `inicio` do encontro, incluindo as duas bordas. Fora desse intervalo → `422 FORA_DA_JANELA`.

**R2** (P-01, RN-302)  
Se a atividade do encontro estiver cancelada, o código não é fornecido → `422 ATIVIDADE_CANCELADA`. Vale mesmo dentro da janela (R1); a checagem de cancelada precede a da janela.

**R3** (P-02, RN-303)  
O código muda a cada minuto, em janelas de rotação alinhadas ao relógio (de `hh:mm:00` até `hh:mm:59`). `trocaEm` = início da próxima janela (início da janela atual + 60 s). `validoAte` = fim da janela seguinte (início da janela atual + 120 s), pois o código é aceito no minuto da própria janela e no minuto seguinte (R14).

**R4** (P-03)  
Consultas repetidas dentro da mesma janela de rotação devolvem o mesmo código. Um código novo só é gerado quando inicia a próxima janela de rotação.

**R5** (P-04)  
Não é garantida unicidade global dos códigos; colisões podem ocorrer. A validade de um código é restrita ao par (encontro, janela de rotação). Um código que não seja o da janela atual nem o da anterior é rejeitado → `422 CODIGO_INVALIDO` (na rota de presença).

### Registro de presença online (POST /encontros/:id/presencas)

**R6** (P-05, RN-301)  
A presença online só é aceita se o instante efetivo (R8/R11) estiver no intervalo de 15 minutos antes até 30 minutos depois do `inicio` do encontro, incluindo as bordas. Fora → `422 FORA_DA_JANELA`.

**R7** (P-06, RN-306)  
Só conta como inscrito quem tem inscrição com status `confirmada` na atividade do encontro. Qualquer outro status (`em_espera`, `convocada`, `cancelada`, `expirada`) → `403 NAO_INSCRITO`.

**R8** (P-07)  
Sem `lidoEm` no corpo, a presença é online: `origem = "qr"` e `lidoEm = registradaEm` = instante atual do relógio do servidor.

**R9** (P-08)  
Um código que nunca existiu e um código que já existiu mas não está mais entre os válidos (expirado) retornam exatamente o mesmo erro → `422 CODIGO_INVALIDO`.

**R10** (P-09)  
Diferente de R2 (obtenção do código), `ATIVIDADE_CANCELADA` **não é** uma validação adicional do POST de presença: a rota não checa a situação de cancelada da atividade e nunca devolve esse erro — aplicam-se apenas as demais validações da rota (R6–R9, R11–R14). A R2 permanece: `GET /encontros/:id/codigo` continua recusando atividade cancelada.

**R11** (P-10, RN-308, RN-309, RN-310)  
Com `lidoEm` informado, a presença é offline (`origem = "qr_offline"`). Janela (R6) e código (R14) são verificados no instante do `lidoEm`, não no do envio. Se `lidoEm` for posterior ao envio, vale o instante do envio. O envio com `lidoEm` é aceito até 2 horas após o `fim` do encontro; além disso → `422 SINCRONIZACAO_TARDIA`.

**R12** (P-12)  
A segunda tentativa é idempotente pura: retorna `200` com a presença original já registrada, sem alterar `lidoEm`, `registradaEm` nem `origem`.

**R13** (P-11, P-18, RN-314)  
Precedência no POST online, após as verificações gerais e a verificação de presença já existente (R12): `NAO_INSCRITO` → `SINCRONIZACAO_TARDIA` → `FORA_DA_JANELA` → `CODIGO_INVALIDO`. Nenhuma ordem diferente é definida.

**R14** (P-02, RN-304)  
Para registrar presença, é aceito tanto o código da janela de rotação atual quanto o da anterior. Qualquer outro código → `422 CODIGO_INVALIDO`.

### Presença manual (POST /encontros/:id/presencas/manual)

**R15** (P-13, RN-312)  
A presença manual pode ser registrada do início da janela de presença (15 minutos antes do `inicio` do encontro) até 2 horas depois do `fim` do encontro, incluindo as bordas. Fora → `422 FORA_DA_JANELA`.

**R16** (P-14, RN-311)  
`justificativa` ausente ou com menos de 10 caracteres → `422 JUSTIFICATIVA_OBRIGATORIA`.

**R17** (P-15, RN-313)  
Por encontro, no máximo 10% das inscrições `confirmadas` da atividade podem ter presença manual, com o resultado arredondado para cima. Registrar uma manual que estoure o teto → `422 LIMITE_DE_MANUAIS`.

**R18** (P-16, RN-314)  
Precedência no POST manual: `JUSTIFICATIVA_OBRIGATORIA` → presença já existente (200, R12) → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`.

### Listagem (GET /encontros/:id/presencas)

**R19** (P-17)  
A listagem retorna apenas as presenças do encontro da rota, sem filtros adicionais, ordenadas por `registradaEm` em ordem crescente.

### Dados derivados

**R20** (P-07)  
`origem` é derivado: `"qr"` quando online sem `lidoEm`, `"qr_offline"` quando online com `lidoEm`, `"manual"` na rota manual. `justificativa` só é preenchida quando `origem = "manual"`.

## 6. Critérios de aceite

1. (R1) GET `/encontros/:id/codigo` com relógio em `inicio - 16 min` → 422 `FORA_DA_JANELA`
2. (R1) GET `/encontros/:id/codigo` com relógio em `inicio + 31 min` → 422 `FORA_DA_JANELA`
3. (R1) GET `/encontros/:id/codigo` com relógio em `inicio - 15 min` e em `inicio + 30 min` → 200
4. (R2) GET `/encontros/:id/codigo` de encontro cuja atividade está cancelada (relógio dentro da janela) → 422 `ATIVIDADE_CANCELADA`
5. (R3) GET `/encontros/:id/codigo` às 10:15:30 → código `C`, `trocaEm=10:16:00`, `validoAte=10:17:00`
6. (R4) GET `/encontros/:id/codigo` às 10:15:30 e às 10:15:55 → mesmo código; às 10:16:00 → código diferente
7. (R5, R14) POST `/encontros/:id/presencas` com o código da janela anterior (dentro da janela de presença) → 201
8. (R5) Código de 6 caracteres igual ao de outra janela/encontro, mas que é o código da janela atual do encontro → 201 (colisão aceita)
9. (R6) POST `/encontros/:id/presencas` com código de janela válida, mas relógio fora de `[inicio - 15, inicio + 30]` → 422 `FORA_DA_JANELA`
10. (R6) POST `/encontros/:id/presencas` com relógio em `inicio + 30 min:00` (borda) → 201
11. (R7) POST `/encontros/:id/presencas` de participante com inscrição `em_espera` → 403 `NAO_INSCRITO`
12. (R7) POST `/encontros/:id/presencas` de participante com inscrição `confirmada` → 201
13. (R8) POST `/encontros/:id/presencas` sem `lidoEm` → 201, `origem="qr"`, `lidoEm=registradaEm` = relógio
14. (R9) POST `/encontros/:id/presencas` com código que nunca foi gerado → 422 `CODIGO_INVALIDO`
15. (R9) POST `/encontros/:id/presencas` com código já expirado (fora das janelas atual e anterior) → 422 `CODIGO_INVALIDO`
16. (R10) Obter o código (GET 200) dentro da janela, cancelar a atividade e então, no mesmo relógio, POST `/encontros/:id/presencas` com esse código → não devolve `ATIVIDADE_CANCELADA`; retorna o erro normal da rota (403 `NAO_INSCRITO`, pois o cancelamento também cancela as inscrições confirmadas — R16 do M1). O cenário prova apenas a ausência da validação adicional: o GET /codigo já recusa após o cancelamento (R2).
17. (R11) POST `/encontros/:id/presencas` com `lidoEm` dentro da janela, código válido nesse instante e envio dentro de 2 h após o `fim` → 201, `origem="qr_offline"`
18. (R11) POST `/encontros/:id/presencas` com `lidoEm` dentro da janela, mas envio após 2 h do `fim` do encontro → 422 `SINCRONIZACAO_TARDIA`
19. (R11) POST `/encontros/:id/presencas` com `lidoEm` posterior ao envio → janela e código verificados pelo instante do envio
20. (R12) Segundo POST `/encontros/:id/presencas` do mesmo participante/encontro → 200, `lidoEm`/`registradaEm`/`origem` intactos
21. (R13) POST `/encontros/:id/presencas` de participante não inscrito com código inválido → 403 `NAO_INSCRITO` (antes de `CODIGO_INVALIDO`)
22. (R13) POST `/encontros/:id/presencas` com `lidoEm` dentro da janela, código errado e envio após 2 h do `fim` → 422 `SINCRONIZACAO_TARDIA` (antes de `FORA_DA_JANELA` e `CODIGO_INVALIDO`)
23. (R13) POST `/encontros/:id/presencas` com código errado e `lidoEm` fora da janela → 422 `FORA_DA_JANELA` (antes de `CODIGO_INVALIDO`)
24. (R15) POST `/encontros/:id/presencas/manual` com relógio em `inicio - 16 min` → 422 `FORA_DA_JANELA`
25. (R15) POST `/encontros/:id/presencas/manual` em `fim + 2 h` (borda) → 201 (demais regras satisfeitas); em `fim + 2 h + 1 min` → 422 `FORA_DA_JANELA`
26. (R16) POST `/encontros/:id/presencas/manual` sem `justificativa` → 422 `JUSTIFICATIVA_OBRIGATORIA`
27. (R16) POST `/encontros/:id/presencas/manual` com justificativa de 9 caracteres → 422 `JUSTIFICATIVA_OBRIGATORIA`; com 10 → 201
28. (R17) Com 13 inscrições confirmadas no encontro, teto = 2 (`ceil(13 × 10%)`); 2ª manual → 201, 3ª → 422 `LIMITE_DE_MANUAIS`
29. (R18) POST `/encontros/:id/presencas/manual` sem justificativa de participante que já tem presença manual → 422 `JUSTIFICATIVA_OBRIGATORIA` (não 200)
30. (R19) GET `/encontros/:id/presencas` → apenas presenças do encontro, ordenadas por `registradaEm` crescente
31. (R20) Compõem cenários 13 (`qr`), 17 (`qr_offline`) e o manual (`manual` com `justificativa` preenchida)

## 7. Como isto será verificado
Testes de integração HTTP (via `supertest` ou similar) contra a API em modo `MODO_TESTE=1`, usando o relógio de teste (`PUT /_teste/relogio`) para controlar janelas, rotações de código, tolerância de sincronização e limites, e `POST /_teste/reset` para isolamento. Cada critério de aceite mapeia para um caso de teste automatizado.

## 8. Fatias de entrega

### Fatia 1 — Código do encontro (obtenção e rotação)
- R1, R2: janela de obtenção e atividade cancelada
- R3, R4: rotação por minuto alinhada ao relógio, `trocaEm`/`validoAte`, idempotência na janela

### Fatia 2 — Presença online básica
- R6, R7, R8: janela de registro, `confirmada` como inscrito, `origem="qr"`
- R9, R14: código inexistente/expirado e aceite de janela atual ou anterior
- R12: idempotência (201 → 200)

### Fatia 3 — Sincronização offline
- R11: verificação por `lidoEm`, `lidoEm` futuro → vale o envio, `SINCRONIZACAO_TARDIA` após 2 h do fim, `origem="qr_offline"`

### Fatia 4 — Precedência do POST online
- R13: ordem `NAO_INSCRITO` → `SINCRONIZACAO_TARDIA` → `FORA_DA_JANELA` → `CODIGO_INVALIDO`
- R10: sem `ATIVIDADE_CANCELADA` no registro de presença

### Fatia 5 — Presença manual
- R15, R16, R17: janela manual, `JUSTIFICATIVA_OBRIGATORIA`, `LIMITE_DE_MANUAIS`
- R18: ordem `JUSTIFICATIVA_OBRIGATORIA` → 200 → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`

### Fatia 6 — Listagem
- R19, R20: presenças do encontro, ordenadas por `registradaEm`, derivados de `origem`/`justificativa`