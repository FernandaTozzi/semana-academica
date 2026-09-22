# Fatia 3 de M3-presenca com TDD

| | |
|---|---|
| Sessão | `ses_f44a25256ffeeF9ZojiMWkK3lF` |
| Pasta | semana-academica/api |
| Período | 19/09 17:31 → 19/09 17:34 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 21 |
| Tokens de entrada / saída | 29.990 / 14.210 |
| Skills | tdd |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 3 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 1 teste(s) que já nasceram verdes · 1 vez(es) teste e código juntos |
| Arquivos editados | 3 de teste, 2 de código, 0 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `19/09 17:31` **prompt** — Use a skill tdd. Implemente somente a Fatia 3 de ../specs/M3-presenca.md. Faça um teste por vez: escreva o teste, execute e mostre ele falhando; somente depois implemente o código mínimo necessário para fazê-lo passar. Use seed/helper no setup dos testes quando precisar de dados dos módulos M1 ou M2 ainda não implementados. Não implemente rotas ou regras desses módulos. Não implemente nenhuma reg…
- `19/09 17:31` carrega a skill **tdd**
- `19/09 17:32` roda `npm test 2>&1` → verde (20 passaram)
- `19/09 17:32` edita teste `verificacoes/presencas-offline.spec.ts`
- `19/09 17:33` edita código `src/rotas/presencas.ts` (2×)
- `19/09 17:33` roda `npm test 2>&1` → verde (21 passaram) — _teste e código mudaram juntos: não houve vermelho para ver_
- `19/09 17:33` edita teste `verificacoes/presencas-offline.spec.ts` (2×)
- `19/09 17:34` roda `npm test 2>&1` → verde (23 passaram) — _teste novo já nasceu verde_
