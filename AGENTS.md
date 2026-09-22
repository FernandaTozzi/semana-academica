# AGENTS.md — Semana Acadêmica

Orientações aprendidas ao trabalhar com agentes. Valem para qualquer módulo.
`api/` e `ui/` seguem os seus próprios `AGENTS.md`, que não são alterados por estas regras.

## Dependências entre módulos

- Ao depender de um módulo que ainda não foi implementado, **não implemente o módulo do
  colega**. Use seed/helper nos testes para prover o dado do qual o seu módulo precisa.
- Não expandir o trabalho para além do seu módulo: cada integrante é dono do escopo dele.

## TDD

- Produza o **teste vermelho antes da implementação**. Teste que já passa antes de existir
  código não está provando nada.
- Não agrupe regras de modo que uma regra nunca tenha evidência RED própria. Cada regra
  precisa de um momento em que está com o seu teste falhando sozinha — sem isso, não há
  prova de que ela foi desenvolvida por TDD.

## Testes existentes

- **Não altere testes existentes apenas para fazê-los passar.** Trocar o esperado pela
  saída do código troca o contrato pela implementação. Só se altera um teste quando a
  **spec** mudou — e aí se diz qual regra mudou e por quê.

## Escopo

- Respeite a spec do seu módulo e o módulo de cada integrante. Implemente só o que a spec
  pede; o que está em `Fora de escopo`, ou fora da spec, não entra.