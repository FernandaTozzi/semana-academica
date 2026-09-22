# Responder perguntas PENDENTE em M3-presenca.md

| | |
|---|---|
| Sessão | `ses_f44e005eaffeIGthTpZNqd7amJ` |
| Pasta | ferna_fxhnpvd/semana-academica |
| Período | 19/09 16:23 → 19/09 16:42 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 65 |
| Tokens de entrada / saída | 60.163 / 16.637 |
| Skills | grilling |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 0 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 0 de teste, 0 de código, 38 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `19/09 16:23` **prompt** — Vamos responder as perguntas marcadas como PENDENTE em entrevistas/M3-presenca.md, uma de cada vez. Eu respondo com o que li no documento de requisitos, citando a regra; registre a minha resposta e ponha a regra na coluna Fonte. Não crie perguntas novas e não mexa nas perguntas já respondidas.
- `19/09 16:24` carrega a skill **grilling**
- `19/09 16:24` **prompt** — A janela vai de 15 minutos antes até 30 minutos depois do início do encontro, incluindo as duas bordas. Fora dessa janela a organização não obtém o código, e atividade cancelada também não fornece código. Fonte: RN-301 e RN-302.
- `19/09 16:24` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:25` **prompt** — O código muda a cada minuto, em janelas alinhadas ao relógio, de hh:mm:00 até hh:mm:59. Para registrar a presença, é aceito tanto o código do minuto atual quanto o código do minuto anterior. Fonte: RN-303 e RN-304. O código muda a cada minuto, em janelas alinhadas ao relógio, de hh:mm:00 até hh:mm:59. Para registrar a presença, é aceito tanto o código do minuto atual quanto o código do minuto ant…
- `19/09 16:25` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:25` **prompt** — A janela de registro vai de 15 minutos antes até 30 minutos depois do início do encontro, incluindo as duas bordas. Fonte: RN-301.
- `19/09 16:25` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:26` **prompt** — Só pode registrar presença quem possui inscrição confirmada. Outros status de inscrição não são aceitos para o registro de presença. Fonte: RN-306.
- `19/09 16:26` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:26` **prompt** — Quando houver lidoEm, a janela e o código são conferidos considerando o instante da leitura, e não o instante do envio. Se lidoEm for posterior ao envio, deve ser considerado o instante do envio. O envio com lidoEm é aceito até 2 horas depois do fim do encontro. Fonte: RN-308, RN-309 e RN-310.
- `19/09 16:26` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:26` **prompt** — Na presença registrada pelo participante, a ordem é: encontro inexistente (404), presença já existente (200), não inscrito, sincronização tardia, fora da janela e, por último, código inválido. Fonte: RN-314.
- `19/09 16:26` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:26` **prompt** — A presença manual pode ser registrada desde a abertura da janela de presença até 2 horas depois do fim do encontro. Fora desse período retorna FORA_DA_JANELA. Fonte: RN-312.
- `19/09 16:27` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:27` **prompt** — A presença manual exige uma justificativa de pelo menos 10 caracteres. Fonte: RN-311.
- `19/09 16:27` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:27` **prompt** — Por encontro, no máximo 10% das inscrições confirmadas podem ter presença manual, com o resultado arredondado para cima. Fonte: RN-313.
- `19/09 16:27` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:32` **prompt** — Na presença manual, a ordem é: justificativa obrigatória, presença já existente (200), não inscrito, fora da janela e, por último, limite de presenças manuais. Fonte: RN-314.
- `19/09 16:32` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:33` **prompt** — Vamos fazer agora a rodada final do grilling. Apresente uma de cada vez as questões de regra de negócio que continuam em aberto: P3, P4, P7, P8, P9, P12, P17, P18 e P19. Registre cada decisão no arquivo entrevistas/M3-presenca.md. Não considere as recomendações anteriores como decisões minhas.
- `19/09 16:33` **prompt** — Decido que consultas repetidas dentro da mesma janela de um minuto devem retornar o mesmo código. Um novo código só deve ser gerado quando iniciar a próxima janela de rotação.
- `19/09 16:33` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:34` **prompt** — Decido que não é necessário garantir unicidade global dos códigos, então colisões podem ocorrer. A validade do código fica vinculada ao encontro e à sua janela de rotação. Um código de outra janela que não esteja entre os códigos ainda válidos deve ser rejeitado como CODIGO_INVALIDO.
- `19/09 16:34` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:34` **prompt** — Decido que, quando lidoEm não for informado, a presença é considerada online: origem = qr e lidoEm = registradaEm = instante atual do servidor.
- `19/09 16:34` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:35` **prompt** — Decido que tanto um código que nunca existiu quanto um código que já existiu, mas não está mais dentro das janelas válidas, devem retornar 422 CODIGO_INVALIDO.
- `19/09 16:35` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:35` **prompt** — Decido não criar uma regra adicional de ATIVIDADE_CANCELADA para o registro de presença. Esse erro será aplicado à obtenção do código conforme definido nos requisitos; o registro de presença seguirá as demais validações previstas para essa rota.
- `19/09 16:38` **prompt** — Agora estou no modo Build. Grave no arquivo entrevistas/M3-presenca.md a decisão de P9 que acabei de fornecer e depois continue a rodada final com P12.
- `19/09 16:38` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:39` **prompt** — Decido que a segunda tentativa deve ser idempotente: retorna 200 com a presença original já registrada, sem alterar lidoEm, registradaEm ou origem.
- `19/09 16:39` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:40` **prompt** — Decido que a listagem deve retornar apenas as presenças do encontro informado na rota, sem filtros adicionais, ordenadas por registradaEm em ordem crescente.
- `19/09 16:40` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:41` **prompt** — Decido aplicar exatamente a precedência definida pela RN-314. Após verificar a existência do encontro e se já existe presença, a ordem das validações é: NAO_INSCRITO → SINCRONIZACAO_TARDIA → FORA_DA_JANELA → CODIGO_INVALIDO. Não será definida uma ordem diferente.
- `19/09 16:41` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:41` **prompt** — Decido confirmar esses limites de escopo. O M3 não será responsável por editar ou remover presenças, geolocalização, bloqueios de participantes ou emissão de certificados. A interface poderá exibir o QR a partir do código fornecido pela API, mas a API do M3 é responsável pelo código, não pela geração da imagem do QR.
- `19/09 16:41` edita entrevista `entrevistas/M3-presenca.md` (2×)
- `19/09 16:42` **prompt** — git status
