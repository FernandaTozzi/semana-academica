---
name: verificar-modulo
description: Verificação final de um módulo antes da entrega — spec, testes, build/start e escopo. Use quando pedirem "verifica o módulo antes de entregar", "revisa a entrega", "confere se o módulo está pronto" ou "valida o módulo".
---

# Verificação final antes da entrega

Sua tarefa é conferir se um módulo está pronto para ser entregue. Você não implementa,
não conserta, não altera código nem teste. Você **lê, executa e reporta**.

O contrato é a spec. Tudo o que está nela precisa existir; nada além dela precisa
existir. O que a spec não pede você não cobra — e o que ela pediu sem teste você aponta.

## Entrada

Você recebe o nome do módulo (M1, M2…). Descubra onde ele mora:

- leia `api/AGENTS.md` e `ui/AGENTS.md` — cada um declara stack, estrutura e comandos;
- procure com `grep` e `glob` os arquivos e testes cujos nomes soam do módulo.

A spec fica em `specs/<modulo>.md`. Se não achar a spec ou o subprojeto do módulo,
**pergunte ao usuário** — não adivinhe o lugar.

## Procedimento

1. **Leia a spec inteira.** Enumere as regras numeradas (R1, R2…) e os critérios de
   aceite — é a lista do que precisa existir. A seção `Fora de escopo` é a lista do que
   **não** pode existir.

2. **Rode a suíte.** No subprojeto do módulo, execute o comando de teste que o `AGENTS.md`
   dele declarar (na pasta certa, via `workdir`). Anote o número real da saída — não
   estime, não arredonde, não repita o número de outra rodada.

3. **Regra contra teste.** Para cada regra da spec, ache um teste que execute
   **exatamente** o cenário da regra — status e corpo. Nome parecido não basta: procure a
   asserção que comprova o comportamento decisivo. Regra sem teste, ou teste que não toca
   a parte decisiva: **problema**.

4. **Build/start quando aplicável.** Confira no `AGENTS.md` do subprojeto se há comandos
   de build ou start e rode-os — o módulo precisa funcionar parado de pé. Se não houver
   (ex.: UI de arquivos estáticos, sem build), registre que não se aplica; não invente
   comando.

5. **Conferência de escopo.** Verifique que o subprojeto não implementa nada da seção
   `Fora de escopo` nem funcionalidade que a spec não descreve. Procure por rotas, telas,
   arquivos e comportamentos além do contrato.

6. **Reporte** os problemas, com `arquivo:linha` quando possível.

## O que é problema

- Regra da spec sem teste, ou teste que não comprova o cenário dela.
- Teste falso: esperado calculado do mesmo jeito que o código, confere só status e ignora
  corpo, tautológico ou acoplado à implementação.
- Suíte falhando, build quebrado ou start que não sobe.
- Implementação de funcionalidade que não está na spec (fora de escopo).

## O que não é problema

- **Falta de funcionalidade que a spec não pede.** "Não tem rota de edição" só é problema
  se a spec exige rota de edição. Você não inventa requisito.

## Saída

Relatório com:

1. módulo verificado e spec lida;
2. comandos executados e o resultado real de cada um;
3. tabela regra → teste que a comprova (ou `SEM TESTE`);
4. conferência de escopo (nada além do contrato);
5. lista de problemas com `arquivo:linha`;
6. veredito simples: pronto, pronto com ressalvas ou não pronto.

Não conserte o que achou. O relatório é o produto.