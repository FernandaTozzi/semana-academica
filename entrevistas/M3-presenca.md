# Entrevista — M3 Presença por QR

Responsável: Fernanda Tozzi
Contrato de referência: `contrato-api.md`, seção 5 (M3) e seção 6.
Processo: rodada 1 (grilling) → rodada 2 (consulta aos requisitos) → rodada final (decisões de regra de negócio).

## Rotas do módulo (do contrato — não negociável)

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| GET | `/encontros/:id/codigo` | organização | 200 `CodigoDoEncontro` |
| POST | `/encontros/:id/presencas` | participante | 201 1ª vez; 200 depois |
| POST | `/encontros/:id/presencas/manual` | organização | 201 1ª vez; 200 depois |
| GET | `/encontros/:id/presencas` | organização | 200 `[Presenca]` |

Códigos de erro do módulo: `FORA_DA_JANELA`, `CODIGO_INVALIDO`, `NAO_INSCRITO`, `SINCRONIZACAO_TARDIA`, `JUSTIFICATIVA_OBRIGATORIA`, `LIMITE_DE_MANUAIS`, `ATIVIDADE_CANCELADA` (obter código), além dos gerais (`USUARIO_DESCONHECIDO`, `SOMENTE_ORGANIZACAO`, `SOMENTE_PARTICIPANTE`, `NAO_ENCONTRADO`, `DADOS_INVALIDOS`).

O contrato define **o que** a API responde. **Quando** cada código aparece (prazo, limite, janela, tolerância, ordem) é o que esta entrevista levanta.

---

## Rodada 1 — Perguntas da fronteira

Legenda de status: **[ ] pendente** → **[R] requisitos (consultar na rodada 2)** → **[RN] regra de negócio — a decidir na rodada final do grilling** → **[D] decidido pelo grupo**.

### A. Código do encontro (GET /encontros/:id/codigo)

**P-01 — [D] Janela para gerar o código.**    Quando a organização está "dentro da janela"? Folga antes do início? Só durante o encontro? Encontrou de atividade cancelada → `ATIVIDADE_CANCELADA`? Encontrou encerrado → `FORA_DA_JANELA`?
➡️ Recomendação: gerar a partir de X min antes do início até o fim; cancelada → `ATIVIDADE_CANCELADA`; fora → `FORA_DA_JANELA`.

**P-02 — [D] Rotação do código (`trocaEm` × `validoAte`).**   De quanto em quanto tempo o código muda? `validoAte` coincide com o `trocaEm` do próximo código (sem sobreposição de validade) ou há folga (código antigo continua aceito um pouco além da troca)?
➡️ Recomendação: intervalo fixo (tipicamente 60 s); `validoAte` = `trocaEm` do próximo código, sem sobreposição.

**P-03 — [D] Consulta repetida na mesma janela.**   Organização pede o código de novo antes de `trocaEm`: devolve o mesmo código (idempotente) ou gera outro?
➡️ Recomendação: mesmo código até `trocaEm`; novo código só depois.

**P-04 — [D] Unicidade do código.**   Os 6 caracteres são únicos no evento, ou podem colidir por sorte (validade atada ao par encontro + janela)? Um código expirado de outra janela é aceito?
➡️ Recomendação: aceitar colisão; validade restrita a (encontro, janela); código de outra janela → `CODIGO_INVALIDO`.

### B. Registro de presença online (POST /encontros/:id/presencas)

**P-05 — [D] Janela de aceite da presença online.**   O `codigo` só é aceito dentro da janela de validade do próprio código (P-02)? Presença tem janela própria diferente da do código?
➡️ Recomendação: aceitar presença enquanto o código for válido; fora → `FORA_DA_JANELA`.

**P-06 — [D] `NAO_INSCRITO`.**   Que status de inscrição conta como "inscrito" para registrar presença? (`confirmada` e `convocada`; `em_espera`, `cancelada`, `expirada` → `NAO_INSCRITO` 403?)
➡️ Recomendação: `confirmada` e `convocada`; os demais → `NAO_INSCRITO`.

**P-07 — [D] `lidoEm` ausente (online).**   Sem `lidoEm`, origem = `qr` e `lidoEm` = `registradaEm` = instante do servidor?
➡️ Recomendação: sim; `lidoEm` = `registradaEm` = agora do relógio.

**P-08 — [D] Código errado × código expirado.**   Código que nunca existiu e código que já valeu (expirado) retornam o mesmo `422 CODIGO_INVALIDO`?
➡️ Recomendação: sim, mesmo código e status.

**P-09 — [D] Presença em encontro de atividade cancelada.**   Registrar presença num encontro cuja atividade foi cancelada → `422 ATIVIDADE_CANCELADA` (antes das regras do recurso)?
➡️ Recomendação: sim, consistente com a tabela de retornos (que só cita "obter código", mas a regra vale igual).

### C. Sincronização offline (origem `qr_offline`)

**P-10 — [D] Tolerância do `lidoEm`.**   O app lê o QR sem internet e posta depois com `lidoEm`. Quanto tempo após a leitura o POST ainda é aceito sem `SINCRONIZACAO_TARDIA`? Quão antigo o `lidoEm` pode ser?
➡️ Recomendação: `lidoEm` dentro da janela do código; tolerância de transporte de X minutos para o POST chegar.

**P-11 — [D] Ordem offline.**   POST com `lidoEm` problemático (fora da janela e/ou código vencido): qual erro vem primeiro — `CODIGO_INVALIDO`, `FORA_DA_JANELA` ou `SINCRONIZACAO_TARDIA`?
➡️ Recomendação: validar código → depois janela do `lidoEm` → depois atraso do POST.

### D. Duplicidade (201 × 200)

**P-12 — [D] Segunda presença do mesmo participante no mesmo encontro.**   Devolve 200 com a presença original intacta (idempotente puro: `lidoEm`/`registradaEm`/`origem` não mudam) ou atualiza algum campo?
➡️ Recomendação: idempotente puro — retorna a original, nada muda.

### E. Presença manual (POST /encontros/:id/presencas/manual)

**P-13 — [D] Janela da presença manual.**   Manual tem janela estendida (pode registrar depois do fim do encontro)? Até quanto tempo depois? Fora → `FORA_DA_JANELA`.
➡️ Recomendação: janela estendida (ex.: até X após o fim do encontro); valores a consultar.

**P-14 — [D] `JUSTIFICATIVA_OBRIGATORIA`.**   Além de ausente, justificativa em branco/"só espaços" conta como inválida? Há tamanho mínimo?
➡️ Recomendação: `trim` vazio = inválida; sem tamanho mínimo.

**P-15 — [D] `LIMITE_DE_MANUAIS`.**   Qual o teto? Por participante? Por atividade? Por encontro? Fração das vagas?
➡️ Recomendação: teto a consultar nos requisitos (número/percentual).

**P-16 — [D] Precedência na manual.**   Com múltiplas violações, ordem entre `FORA_DA_JANELA`, `NAO_INSCRITO`, `JUSTIFICATIVA_OBRIGATORIA` e `LIMITE_DE_MANUAIS`?
➡️ Recomendação: ordem consistente e documentada (janela → inscrito → justificativa → limite).

### F. Listagem (GET /encontros/:id/presencas)

**P-17 — [D] Ordenação e forma.**   A lista vem ordenada por quê? Sem filtros além do encontro da rota?
➡️ Recomendação: ordenar por `registradaEm` crescente; sem filtros.

### G. Precedência geral e fronteira de escopo

**P-18 — [D] Precedência no POST online.**   Quando várias regras recusam a mesma requisição de presença, ordem entre `NAO_INSCRITO`, `CODIGO_INVALIDO`, `FORA_DA_JANELA` e `SINCRONIZACAO_TARDIA`? (Como no M1, se os requisitos não definirem, escolher ordem consistente e documentada.)
➡️ Recomendação: verificar existência/encontrou → inscrito → código → janela → sincronização.

**P-19 — [D] Fora de escopo do M3.**   Confirmar que M3 **não** faz: gerar a imagem do QR (tela Flutter faz), editar/remover presença (sem rota), geolocalização, bloqueios de participante (M5) e emissão de certificados (M4).
➡️ Recomendação: confirmar esses limites.

---

## Pendentes para consulta aos requisitos (rodada 2)

> Preenchido quando o usuário responder **"consultar requisitos"**.

| Perq | Assunto | Resposta | Fonte | Status |
|---|---|---|---|---|
| P-01 | Janela para gerar o código | De 15 min antes até 30 min depois do início do encontro, incluindo as duas bordas. Fora dela a organização não obtém o código; atividade cancelada também não fornece código. | RN-301, RN-302 | respondida |
| P-02 | Rotação do código (`trocaEm` × `validoAte`) | O código muda a cada minuto, em janelas alinhadas ao relógio, de hh:mm:00 até hh:mm:59. Para registrar presença, é aceito tanto o código do minuto atual quanto o do minuto anterior. | RN-303, RN-304 | respondida |
| P-05 | Janela de aceite da presença online | A janela de registro vai de 15 min antes até 30 min depois do início do encontro, incluindo as duas bordas. | RN-301 | respondida |
| P-06 | `NAO_INSCRITO` — status que valem como inscrito | Só quem possui inscrição confirmada pode registrar presença; os demais status de inscrição não são aceitos. | RN-306 | respondida |
| P-10 | Tolerância do `lidoEm` / `SINCRONIZACAO_TARDIA` | Com `lidoEm`, janela e código são conferidos pelo instante da leitura, não do envio. Se `lidoEm` for posterior ao envio, vale o instante do envio. O envio com `lidoEm` é aceito até 2 horas após o fim do encontro. | RN-308, RN-309, RN-310 | respondida |
| P-11 | Ordem offline (`CODIGO_INVALIDO`/`FORA_DA_JANELA`/`SINCRONIZACAO_TARDIA`) | Na presença registrada pelo participante, a ordem é: encontro inexistente (404) → presença já existente (200) → não inscrito → sincronização tardia → fora da janela → código inválido. | RN-314 | respondida |
| P-13 | Janela da presença manual | A presença manual pode ser registrada desde a abertura da janela de presença até 2 horas depois do fim do encontro. Fora desse período retorna `FORA_DA_JANELA`. | RN-312 | respondida |
| P-14 | `JUSTIFICATIVA_OBRIGATORIA` (branco/tamanho mínimo) | A presença manual exige justificativa de pelo menos 10 caracteres. | RN-311 | respondida |
| P-15 | `LIMITE_DE_MANUAIS` | Por encontro, no máximo 10% das inscrições confirmadas podem ter presença manual, com o resultado arredondado para cima. | RN-313 | respondida |
| P-16 | Precedência na presença manual | Na presença manual, a ordem é: justificativa obrigatória → presença já existente (200) → não inscrito → fora da janela → limite de presenças manuais. | RN-314 | respondida |
| P-02 | Rotação do código (`trocaEm` × `validoAte`) | responder "consultar requisitos" |
| P-05 | Janela de aceite da presença online | responder "consultar requisitos" |
| P-06 | `NAO_INSCRITO` — status que valem como inscrito | responder "consultar requisitos" |
| P-10 | Tolerância do `lidoEm` / `SINCRONIZACAO_TARDIA` | responder "consultar requisitos" |
| P-11 | Ordem offline (`CODIGO_INVALIDO`/`FORA_DA_JANELA`/`SINCRONIZACAO_TARDIA`) | responder "consultar requisitos" |
| P-13 | Janela da presença manual | responder "consultar requisitos" |
| P-14 | `JUSTIFICATIVA_OBRIGATORIA` (branco/tamanho mínimo) | responder "consultar requisitos" |
| P-15 | `LIMITE_DE_MANUAIS` | responder "consultar requisitos" |
| P-16 | Precedência na presença manual | responder "consultar requisitos" |

---

## Regras de negócio — separadas para a rodada final

> Decisões de regra de negócio que ficam para a rodada final do grilling (após a consulta aos requisitos). Não pode haver decisão implícita.
>
> **As recomendações da rodada 1 NÃO são decisões.** Nenhuma recomendação foi aceita pelo usuário ainda.

| Perq | Assunto | Decisão |
|---|---|---|
| P-03 | Consulta repetida na mesma janela de rotação | Consultas repetidas dentro da mesma janela de um minuto retornam o mesmo código. Novo código só é gerado quando inicia a próxima janela de rotação. |
| P-04 | Unicidade × colisão de códigos | Não é necessário garantir unicidade global dos códigos; colisões podem ocorrer. A validade do código fica vinculada ao encontro e à sua janela de rotação. Um código de outra janela que não esteja entre os ainda válidos é rejeitado como `CODIGO_INVALIDO`. |
| P-07 | `lidoEm` = `registradaEm` no online | Quando `lidoEm` não for informado, a presença é considerada online: `origem` = `qr` e `lidoEm` = `registradaEm` = instante atual do servidor. |
| P-08 | Código errado × expirado no mesmo erro | Tanto um código que nunca existiu quanto um que já existiu mas não está mais dentro das janelas válidas retornam `422 CODIGO_INVALIDO`. |
| P-09 | Presença em encontro de atividade cancelada | Não há regra de `ATIVIDADE_CANCELADA` para o registro de presença. Esse erro vale apenas para a obtenção do código, conforme os requisitos; o registro de presença segue as demais validações da rota. |
| P-12 | Idempotência da 2ª presença | A segunda tentativa é idempotente: retorna 200 com a presença original já registrada, sem alterar `lidoEm`, `registradaEm` ou `origem`. |
| P-17 | Ordenação da listagem | A listagem retorna apenas as presenças do encontro da rota, sem filtros adicionais, ordenadas por `registradaEm` em ordem crescente. |
| P-18 | Precedência de erros no POST online | Aplica-se exatamente a precedência da RN-314. Após verificar a existência do encontro e a existência de presença, a ordem é: `NAO_INSCRITO` → `SINCRONIZACAO_TARDIA` → `FORA_DA_JANELA` → `CODIGO_INVALIDO`. Nenhuma ordem diferente é definida. |
| P-19 | Fora de escopo | Confirmados os limites: o M3 não edita nem remove presenças, não faz geolocalização, não faz bloqueio de participantes (M5) nem emissão de certificados (M4). A interface pode exibir o QR a partir do código fornecido pela API, mas a API do M3 é responsável pelo código, não pela geração da imagem do QR. |
| P-04 | Unicidade × colisão de códigos | |
| P-07 | `lidoEm` = `registradaEm` no online | |
| P-08 | Código errado × expirado no mesmo erro | |
| P-09 | Presença em encontro de atividade cancelada | |
| P-12 | Idempotência da 2ª presença | |
| P-17 | Ordenação da listagem | |
| P-18 | Precedência de erros no POST online | |
| P-19 | Fora de escopo | |