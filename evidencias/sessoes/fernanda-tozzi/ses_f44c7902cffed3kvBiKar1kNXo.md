# Implementar Fatia 1 de M3-presenca com TDD

| | |
|---|---|
| Sessão | `ses_f44c7902cffed3kvBiKar1kNXo` |
| Pasta | semana-academica/api |
| Período | 19/09 16:50 → 19/09 17:14 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 38 |
| Tokens de entrada / saída | 48.712 / 27.930 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 2 vermelhas, 8 verdes |
| TDD | 1 ciclo(s) vermelho → verde · 4 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 6 de teste, 3 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `19/09 16:50` **prompt** — Use a skill tdd. Implemente só a Fatia 1 de ../specs/M3-presenca.md. Faça um teste por vez: primeiro escreva o teste, execute e mostre ele falhando; somente depois implemente o código mínimo necessário para fazê-lo passar. Não implemente nenhuma regra das fatias seguintes. Siga contrato-api.md e a spec do M3 sem alterar os testes existentes apenas para fazê-los passar.
- `19/09 16:50` carrega a skill **tdd**
- `19/09 17:08` roda `node --version; npm run test 2>&1` → **vermelho**
- `19/09 17:09` roda `npm run test 2>&1` → verde (5 passaram)
- `19/09 17:10` edita teste `verificacoes/encontros.spec.ts`
- `19/09 17:10` roda `npm test 2>&1` → **vermelho** (5 passaram, 1 falharam) — _teste novo falhando, como deve ser_
- `19/09 17:10` edita código `src/rotas/encontros.ts`
- `19/09 17:10` edita código `src/server.ts` (2×)
- `19/09 17:11` roda `npm test 2>&1` → verde (6 passaram) — _fecha um ciclo vermelho → verde_
- `19/09 17:11` edita teste `verificacoes/encontros.spec.ts`
- `19/09 17:11` roda `npm test 2>&1` → verde (8 passaram) — _teste novo já nasceu verde_
- `19/09 17:11` edita teste `verificacoes/encontros.spec.ts` (2×)
- `19/09 17:11` roda `npm test 2>&1` → verde (9 passaram) — _teste novo já nasceu verde_
- `19/09 17:12` edita teste `verificacoes/encontros.spec.ts`
- `19/09 17:12` roda `npm test 2>&1` → verde (10 passaram) — _teste novo já nasceu verde_
- `19/09 17:12` edita teste `verificacoes/encontros.spec.ts`
- `19/09 17:12` roda `npm test 2>&1` → verde (11 passaram) — _teste novo já nasceu verde_
- `19/09 17:12` roda `npm test 2>&1 | Select-Object -Last 12` → verde (11 passaram)
- `19/09 17:14` **prompt** — O que foi feito: - src/rotas/encontros.ts — GET /encontros/:id/codigo: auth → SOMENTE_ORGANIZACAO, 404, ATIVIDADE_CANCELADA (R2 precede R1), FORA_DA_JANELA em [inicio−15min, inicio+30min] inclusivo (R1), código determinístico por (encontro, janela) com trocaEm/validoAte alinhados ao minuto (R3/R4). Tempo vem do relógio de teste em MODO_TESTE. - src/server.ts — registro da rota. - verificacoes/enc…
- `19/09 17:14` **prompt** — Execute os testes da Fatia 1 e me informe o resultado final. Não implemente mais nada.
- `19/09 17:14` roda `npm test 2>&1 | Select-Object -Last 14` → verde (11 passaram)
