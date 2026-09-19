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

**P1 — [R] Janela para gerar o código.**    Quando a organização está "dentro da janela"? Folga antes do início? Só durante o encontro? Encontrou de atividade cancelada → `ATIVIDADE_CANCELADA`? Encontrou encerrado → `FORA_DA_JANELA`?
➡️ Recomendação: gerar a partir de X min antes do início até o fim; cancelada → `ATIVIDADE_CANCELADA`; fora → `FORA_DA_JANELA`.

**P2 — [R] Rotação do código (`trocaEm` × `validoAte`).**   De quanto em quanto tempo o código muda? `validoAte` coincide com o `trocaEm` do próximo código (sem sobreposição de validade) ou há folga (código antigo continua aceito um pouco além da troca)?
➡️ Recomendação: intervalo fixo (tipicamente 60 s); `validoAte` = `trocaEm` do próximo código, sem sobreposição.

**P3 — [RN] Consulta repetida na mesma janela.**   Organização pede o código de novo antes de `trocaEm`: devolve o mesmo código (idempotente) ou gera outro?
➡️ Recomendação: mesmo código até `trocaEm`; novo código só depois.

**P4 — [RN] Unicidade do código.**   Os 6 caracteres são únicos no evento, ou podem colidir por sorte (validade atada ao par encontro + janela)? Um código expirado de outra janela é aceito?
➡️ Recomendação: aceitar colisão; validade restrita a (encontro, janela); código de outra janela → `CODIGO_INVALIDO`.

### B. Registro de presença online (POST /encontros/:id/presencas)

**P5 — [R] Janela de aceite da presença online.**   O `codigo` só é aceito dentro da janela de validade do próprio código (P2)? Presença tem janela própria diferente da do código?
➡️ Recomendação: aceitar presença enquanto o código for válido; fora → `FORA_DA_JANELA`.

**P6 — [R] `NAO_INSCRITO`.**   Que status de inscrição conta como "inscrito" para registrar presença? (`confirmada` e `convocada`; `em_espera`, `cancelada`, `expirada` → `NAO_INSCRITO` 403?)
➡️ Recomendação: `confirmada` e `convocada`; os demais → `NAO_INSCRITO`.

**P7 — [RN] `lidoEm` ausente (online).**   Sem `lidoEm`, origem = `qr` e `lidoEm` = `registradaEm` = instante do servidor?
➡️ Recomendação: sim; `lidoEm` = `registradaEm` = agora do relógio.

**P8 — [RN] Código errado × código expirado.**   Código que nunca existiu e código que já valeu (expirado) retornam o mesmo `422 CODIGO_INVALIDO`?
➡️ Recomendação: sim, mesmo código e status.

**P9 — [RN] Presença em encontro de atividade cancelada.**   Registrar presença num encontro cuja atividade foi cancelada → `422 ATIVIDADE_CANCELADA` (antes das regras do recurso)?
➡️ Recomendação: sim, consistente com a tabela de retornos (que só cita "obter código", mas a regra vale igual).

### C. Sincronização offline (origem `qr_offline`)

**P10 — [R] Tolerância do `lidoEm`.**   O app lê o QR sem internet e posta depois com `lidoEm`. Quanto tempo após a leitura o POST ainda é aceito sem `SINCRONIZACAO_TARDIA`? Quão antigo o `lidoEm` pode ser?
➡️ Recomendação: `lidoEm` dentro da janela do código; tolerância de transporte de X minutos para o POST chegar.

**P11 — [R] Ordem offline.**   POST com `lidoEm` problemático (fora da janela e/ou código vencido): qual erro vem primeiro — `CODIGO_INVALIDO`, `FORA_DA_JANELA` ou `SINCRONIZACAO_TARDIA`?
➡️ Recomendação: validar código → depois janela do `lidoEm` → depois atraso do POST.

### D. Duplicidade (201 × 200)

**P12 — [RN] Segunda presença do mesmo participante no mesmo encontro.**   Devolve 200 com a presença original intacta (idempotente puro: `lidoEm`/`registradaEm`/`origem` não mudam) ou atualiza algum campo?
➡️ Recomendação: idempotente puro — retorna a original, nada muda.

### E. Presença manual (POST /encontros/:id/presencas/manual)

**P13 — [R] Janela da presença manual.**   Manual tem janela estendida (pode registrar depois do fim do encontro)? Até quanto tempo depois? Fora → `FORA_DA_JANELA`.
➡️ Recomendação: janela estendida (ex.: até X após o fim do encontro); valores a consultar.

**P14 — [R] `JUSTIFICATIVA_OBRIGATORIA`.**   Além de ausente, justificativa em branco/"só espaços" conta como inválida? Há tamanho mínimo?
➡️ Recomendação: `trim` vazio = inválida; sem tamanho mínimo.

**P15 — [R] `LIMITE_DE_MANUAIS`.**   Qual o teto? Por participante? Por atividade? Por encontro? Fração das vagas?
➡️ Recomendação: teto a consultar nos requisitos (número/percentual).

**P16 — [R] Precedência na manual.**   Com múltiplas violações, ordem entre `FORA_DA_JANELA`, `NAO_INSCRITO`, `JUSTIFICATIVA_OBRIGATORIA` e `LIMITE_DE_MANUAIS`?
➡️ Recomendação: ordem consistente e documentada (janela → inscrito → justificativa → limite).

### F. Listagem (GET /encontros/:id/presencas)

**P17 — [RN] Ordenação e forma.**   A lista vem ordenada por quê? Sem filtros além do encontro da rota?
➡️ Recomendação: ordenar por `registradaEm` crescente; sem filtros.

### G. Precedência geral e fronteira de escopo

**P18 — [RN] Precedência no POST online.**   Quando várias regras recusam a mesma requisição de presença, ordem entre `NAO_INSCRITO`, `CODIGO_INVALIDO`, `FORA_DA_JANELA` e `SINCRONIZACAO_TARDIA`? (Como no M1, se os requisitos não definirem, escolher ordem consistente e documentada.)
➡️ Recomendação: verificar existência/encontrou → inscrito → código → janela → sincronização.

**P19 — [RN] Fora de escopo do M3.**   Confirmar que M3 **não** faz: gerar a imagem do QR (tela Flutter faz), editar/remover presença (sem rota), geolocalização, bloqueios de participante (M5) e emissão de certificados (M4).
➡️ Recomendação: confirmar esses limites.

---

## Pendentes para consulta aos requisitos (rodada 2)

> Preenchido quando o usuário responder **"consultar requisitos"**.

| Perq | Assunto | Status |
|---|---|---|
| P1 | Janela para gerar o código | responder "consultar requisitos" |
| P2 | Rotação do código (`trocaEm` × `validoAte`) | responder "consultar requisitos" |
| P5 | Janela de aceite da presença online | responder "consultar requisitos" |
| P6 | `NAO_INSCRITO` — status que valem como inscrito | responder "consultar requisitos" |
| P10 | Tolerância do `lidoEm` / `SINCRONIZACAO_TARDIA` | responder "consultar requisitos" |
| P11 | Ordem offline (`CODIGO_INVALIDO`/`FORA_DA_JANELA`/`SINCRONIZACAO_TARDIA`) | responder "consultar requisitos" |
| P13 | Janela da presença manual | responder "consultar requisitos" |
| P14 | `JUSTIFICATIVA_OBRIGATORIA` (branco/tamanho mínimo) | responder "consultar requisitos" |
| P15 | `LIMITE_DE_MANUAIS` | responder "consultar requisitos" |
| P16 | Precedência na presença manual | responder "consultar requisitos" |

---

## Regras de negócio — separadas para a rodada final

> Decisões de regra de negócio que ficam para a rodada final do grilling (após a consulta aos requisitos). Não pode haver decisão implícita.
>
> **As recomendações da rodada 1 NÃO são decisões.** Nenhuma recomendação foi aceita pelo usuário ainda.

| Perq | Assunto | Decisão |
|---|---|---|
| P3 | Consulta repetida na mesma janela de rotação | |
| P4 | Unicidade × colisão de códigos | |
| P7 | `lidoEm` = `registradaEm` no online | |
| P8 | Código errado × expirado no mesmo erro | |
| P9 | Presença em encontro de atividade cancelada | |
| P12 | Idempotência da 2ª presença | |
| P17 | Ordenação da listagem | |
| P18 | Precedência de erros no POST online | |
| P19 | Fora de escopo | |