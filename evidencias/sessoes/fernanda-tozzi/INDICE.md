# Sessões — Fernanda Tozzi

Cada execução de teste é lida pelo que mudou desde a anterior:

- **Ciclo** — vermelho logo depois de mexer só em teste, e depois verde logo depois de mexer só em código. É o TDD.
- **Nasceu verde** — verde logo depois de mexer só em teste. Ou o comportamento já existia, ou o teste não testa o que diz.
- **Juntos** — teste e código mudaram antes da mesma execução. Não houve vermelho para ver.

**Alertas:** *colou* = prompt com 10 palavras seguidas ou mais iguais às do documento de requisitos (só aparece quando o resumo é gerado com `--requisitos`); *leu* = o agente acessou um arquivo de requisitos; *anexou* = o documento foi anexado à conversa.

Requisições são chamadas ao modelo: cada passo do agente é uma. Skills contam tanto a ferramenta `skill` quanto o comando `/nome`.

| Início | Sessão | Requisições | Skills | Subagentes | Vermelhas / verdes | Ciclos | Nasceu verde | Juntos | Alertas |
|---|---|---|---|---|---|---|---|---|---|
| 19/09 16:12 | [Grilling M3 presença QR Semana Acadêmica](ses_f44ea6158ffezztqtHOei4e6eu.md) | 10 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 19/09 16:23 | [Responder perguntas PENDENTE em M3-presenca.md](ses_f44e005eaffeIGthTpZNqd7amJ.md) | 65 | grilling | — | 0 / 0 | 0 | 0 | 0 | — |
| 19/09 16:43 | [Escrever spec M3-presenca a partir de entrevistas](ses_f44ce4f6bffebDf3jEQvmq1gai.md) | 12 | to-spec | — | 0 / 0 | 0 | 0 | 0 | — |
| 19/09 16:50 | [Implementar Fatia 1 de M3-presenca com TDD](ses_f44c7902cffed3kvBiKar1kNXo.md) | 38 | tdd | — | 2 / 8 | 1 | 4 | 0 | — |
| 19/09 17:16 | [Implementar Fatia 2 de M3-presenca com TDD](ses_f44affcadffeCxSRdtDGp8hNR5.md) | 39 | tdd | — | 1 / 12 | 1 | 8 | 0 | — |
| 19/09 17:31 | [Fatia 3 de M3-presenca com TDD](ses_f44a25256ffeeF9ZojiMWkK3lF.md) | 21 | tdd | — | 0 / 3 | 0 | 1 | 1 | — |
| 22/09 14:21 | [New session - 2026-09-22T17:21:35.542Z](ses_f35dcdccaffeejX6JL7DmrrhaY.md) | 31 | tdd | — | 0 / 4 | 0 | 0 | 3 | — |
| 22/09 14:33 | [TDD Fatia 4 de M3-presenca](ses_f35d1a880ffeoC6tDRn8eYqRje.md) | 12 | tdd | — | 0 / 2 | 0 | 1 | 0 | — |
| 22/09 14:48 | [Implementar Fatia 5 de M3-presenca com TDD](ses_f35c42318ffe5eKWXOO5ndnquZ.md) | 86 | tdd (2) | auditor | 0 / 12 | 0 | 0 | 11 | — |
| 22/09 15:33 | [Auditoria módulo M3 (R1-R20)](ses_f359b34daffeq1iRu3V8m1cRhv.md) | 16 | — | — | 0 / 1 | 0 | 0 | 0 | — |
| 22/09 15:43 | [Salvar relatório auditoria M3 completo](ses_f35918396ffesq0mEuoIgApcXE.md) | 3 | — | — | 0 / 0 | 0 | 0 | 0 | — |
| 22/09 15:46 | [Auditoria M3: R1-R20, testes e relatório](ses_f358f2b51ffeymHfmcPFPGn3vN.md) | 15 | — | auditor | 0 / 1 | 0 | 0 | 0 | — |
| 22/09 15:58 | [Testes TDD para achados R13 e R18](ses_f3583cdd6ffeYJO2wz9OqS9hr6.md) | 8 | tdd | — | 0 / 1 | 0 | 1 | 0 | — |
| 22/09 16:19 | [Implementar interface M3 Presença por QR](ses_f357095a2ffe3W7RtoZhiU5fQq.md) | 47 | — | — | 2 / 4 | 0 | 1 | 1 | — |
| 22/09 16:43 | [Corrigir inicialização da API](ses_f355b4d6dffey3ItB2J8Ymr4g2.md) | 13 | — | — | 0 / 1 | 0 | 0 | 1 | — |
| 22/09 16:51 | [Criar skill de verificação e AGENTS.md](ses_f355377c5ffeeDheo73Fp6Jwkc.md) | 8 | — | — | 0 / 0 | 0 | 0 | 0 | — |
| | **Total: 16 sessões** | 424 | grilling (2), to-spec, tdd (8) | auditor (2) | 5 / 49 | 2 | 16 | 17 | — |
