# Estratégia de testes — reaferição de 2026-10-13

> A estratégia completa (pirâmide, dublês, cobertura por área, 12 cenários E2E, quality gates) está em
> [`../testes-estrategia.md`](../testes-estrategia.md) e continua válida. Este documento registra o
> estado real em `7ead1bb6`, o que muda na ordem de implantação e o conteúdo concreto das primeiras
> suítes. Aprovado, o que está aqui é incorporado àquele arquivo.

## 1. Estado real

A tabela descreve o commit `7ead1bb6`, antes da etapa 1. O que a etapa 1 mudou está no §6.

| Item | Situação |
| --- | --- |
| Runner de testes | Nenhum. `vitest`, `jest` e `playwright` não estão no `package.json` |
| Arquivos `*.test.*` / `*.spec.ts` | 0 |
| CI | `next build` com checagem de tipos em todo PR. Não roda lint, teste nem regra de fronteira |
| Banco de teste | Não existe `docker-compose.test.yml` |
| Substituto em uso | 5 scripts `scripts/*-qa-check.ts`, 1.035 linhas, rodados à mão com `tsx` contra o Postgres de desenvolvimento |

Os scripts de QA são a informação nova mais importante. O time já escreve testes de integração: cada
script cria empresas descartáveis, exercita casos de uso reais, injeta um gateway falso pelo port,
confere cada `CA-n` da spec e limpa no fim. Faltam três coisas que um runner dá de graça: rodar no
CI, isolar o banco e falhar o PR. O cabeçalho de `social-accounts-qa-check.ts` diz isso com todas as
letras ("Não há runner de testes no projeto").

Consequência para a ordem: instalar o runner não é mais um item de fundação a fazer depois da
contenção de segurança. É pré-requisito dela. O registro de segurança exige que todo item corrigido
tenha um teste que falhe se a correção for revertida, e hoje isso não pode ser cumprido.

## 2. Ordem de implantação revista

| # | Passo | Antes estava em | Motivo da mudança |
| --- | --- | --- | --- |
| 1 | Vitest, projeto `unit`, job no CI | Fase 1 | Custa um dia, não toca código de produção, destrava todo o resto |
| 2 | Testes unitários das regras já puras (§3) | Fase 1 | Prova o pipeline com risco zero |
| 3 | Projeto `integration` + Postgres de teste | Fase 1 | Igual, antecipado |
| 4 | Converter os 5 scripts de QA em testes de integração | não previsto | Trabalho já feito; só muda o invólucro |
| 5 | Teste de assinatura junto de cada correção S1, S2, S4, S7 | Fase 1, depois das correções | A correção e o teste entram no mesmo PR |
| 6 | Testes de caracterização do `submut-response` | Fase 1 | Sem mudança |
| 7 | Playwright, cenários 1 a 4 | Fase 1 | Adiado para depois do piloto: integração cobre os mesmos riscos mais barato e o time é de 2 pessoas |

## 3. Primeira suíte unitária

Arquivos verificados como livres de I/O (sem import de Prisma, rede ou framework):

| Arquivo | Linhas | O que testar |
| --- | ---: | --- |
| `src/features/form/lib/derive-response-label.ts` | 93 | Rótulo derivado para cada formato de resposta |
| `src/features/form/lib/form-response-state.ts` | 187 | `deriveResponseState` para cada combinação de entrada |
| `src/features/form/lib/form-readiness.ts` | 152 | Formulário pronto ou não para publicar (só importa um tipo) |
| `src/features/form/lib/masks.ts` | 211 | Máscaras e validadores de telefone, CPF, CEP e e-mail, com valores limite |
| `src/features/form/lib/response-slug.ts` | 29 | Geração de slug |
| `src/features/payment/lib/permissions.ts` | 123 | `resolveEffectivePermissions`: toda combinação de papel e override |
| `src/lib/reminder-recurrence.ts` | 144 | Próxima ocorrência; virada de mês e de ano (importa só um enum gerado) |
| `src/modules/social/domain/*.ts` | 8 arquivos | Casamento de regra, normalização de texto, quebra de mensagem, seleção de gatilho |

`can-edit-response.ts` fica fora desta lista: importa o cliente Prisma. Entra na suíte de integração,
e a parte de política é separada do carregamento de dados durante o piloto.

São testes de caracterização: registram o que o código faz hoje. Se um deles revelar comportamento
que parece errado, o teste fica documentando o comportamento atual, o achado vira item de decisão, e
nada é corrigido no mesmo PR.

## 4. Configuração que este projeto exige

Pontos que não são óbvios e que os scripts de QA já tiveram de resolver:

- **`server-only`**: vários módulos começam com `import "server-only"`, que lança erro fora da
  condição `react-server`. Os scripts rodam com `tsx --conditions=react-server`. No Vitest, definir
  `resolve.conditions: ["react-server"]` no projeto de integração ou apontar `server-only` para um
  módulo vazio por `alias`.
- **Alias `@/*`**: resolver a partir do `tsconfig.json` (`vite-tsconfig-paths` ou `resolve.alias`).
- **Cliente Prisma gerado**: `prisma generate` antes dos testes, como o CI já faz antes do build.
- **`tests/` fora da checagem de tipos do build**: o `tsconfig.json` já exclui `prisma` e `scripts`
  para manter o `next build` leve (regra 24 do `CLAUDE.md`). Testes ficam ao lado do código
  (`*.test.ts`), e o `tsconfig` de build passa a excluir `**/*.test.ts`. O Vitest faz a própria
  transpilação.
- **Isolamento do banco**: truncate entre casos, não transação por teste (o código abre 108
  transações interativas e transação aninhada mudaria o comportamento observado). Os scripts de QA
  hoje limpam por `RUN_ID`; com banco dedicado isso deixa de ser necessário.
- **Nada de rede**: o projeto de integração falha se algo chamar `fetch` para fora. Gateways entram
  por port (em `modules/`) ou por servidor HTTP falso local (código legado).

## 5. Caracterização do piloto

Para `router/form/public/submut-response.ts`, antes de qualquer refatoração:

1. Chamar a procedure pelo `call()` do oRPC, sem HTTP, contra banco semeado.
2. Cobrir os três caminhos da spec 0001 (lead no mesmo tracking, em outro, inexistente), mais
   resposta parcial retomada, formulário com escopo de action (spec 0002) e formulário com tags.
3. Gravar como golden master o **retorno e o estado do banco** depois da chamada: lead, resposta,
   tags, actions criadas, eventos de jornada. O retorno sozinho não basta.
4. Registrar os efeitos externos por dublê: quais eventos Inngest foram enviados, o que foi publicado
   no realtime, o que foi para o log de atividade. A ordem relativa ao commit faz parte do contrato
   (regra 18).
5. Normalizar ids, datas e tokens antes de comparar, para o golden master ser estável.

Diferença entre o golden master e o resultado depois da refatoração é regressão até prova em
contrário.

## 6. Achados da primeira suíte (2026-10-13)

A etapa 1 foi executada: Vitest 5, projeto `unit`, 166 testes em 12 arquivos, menos de 2 segundos.
Os testes registram o comportamento atual. Quatro comportamentos pareciam errados; os quatro foram
corrigidos:

| # | Arquivo | Comportamento atual | Efeito | Gravidade sugerida |
| --- | --- | --- | --- | --- |
| 1 | `src/lib/reminder-recurrence.ts` (`computeNextRemindAt`) | ✅ **Corrigido em 2026-10-13** ([spec 0105](../../specs/tracking-chat/0105-lembrete-mensal-em-mes-curto.md)). Era: lembrete mensal em dia 29, 30 ou 31 pulava o mês sem esse dia e mudava de dia para sempre (31/01 → 03/03). Alcançável só em lembrete mensal sem dia fixo, porque o dia fixo é limitado a 1–28 nas três entradas | Lembrete mensal não disparava em meses curtos | Alta |
| 2 | `src/lib/reminder-recurrence.ts` (`buildFirstRemindAt`) | ✅ **Corrigido junto** (spec 0105, CA-7). Era: dia 31 pedido em abril agendava 01/05. Inalcançável hoje pelo mesmo limite de 1–28 | — | Baixa |
| 3 | `src/features/form/lib/form-readiness.ts` | ✅ **Corrigido em 2026-10-13** ([spec 0104](../../specs/form/0104-correcoes-achadas-na-caracterizacao.md), CA-7). Era: parágrafo com `text` vazio (string) dado como sem conteúdo mesmo com `content` preenchido | Formulário podia aparecer como não pronto sem motivo | Baixa |
| 4 | `src/features/form/lib/response-slug.ts` | ✅ **Corrigido em 2026-10-13** ([spec 0104](../../specs/form/0104-correcoes-achadas-na-caracterizacao.md), CA-6). Era: nome cortado em 80 caracteres podia terminar em hífen, gerando `--` antes da data | Cosmético | Baixa |

A causa dos itens 1 e 2 era a mesma: `addOneMonth` somava um mês a uma data cujo dia pode não existir no
mês seguinte, e `Date.UTC` transbordava em vez de limitar. O limite ao último dia do mês
era aplicado depois, já sobre o mês errado. Pendência: reparo dos lembretes já afetados em produção
(spec 0105, §9).

Desvios em relação ao planejado no §4: os testes **ficam** na checagem de tipos do `tsconfig.json`
(são poucos arquivos, e erro de tipo em teste passa a quebrar o build, o que é desejável). Conferir o
tempo de `Finished TypeScript` no primeiro CI; se subir de forma perceptível, excluir `**/*.test.ts`.
O arquivo de configuração é `vitest.config.mts`, porque o `package.json` não declara
`"type": "module"`.

## 7. Achados da caracterização do envio de formulário (2026-10-13)

Comportamentos registrados em teste. A coluna **Situação** diz o que foi feito com cada um em
2026-10-13 ([spec 0104](../../specs/form/0104-correcoes-achadas-na-caracterizacao.md)): os defeitos foram corrigidos, os intencionais foram conferidos no código e
mantidos, e três seguem como estão por serem decisão de produto.

| # | Comportamento registrado | Leitura | Situação |
| --- | --- | --- | --- |
| 1 | Cada envio grava **dois** eventos `form_submit` na jornada do lead, e cada mudança de coluna grava **dois** `status_changed` | A rota registra o evento duas vezes por caminhos diferentes (histórico do lead e jornada). Provável duplicidade na linha do tempo | ✅ Corrigido (CA-4, CA-5): um registro por envio e um por mudança de coluna. Registros antigos continuam duplicados |
| 2 | Lead recém-criado volta na resposta com `publicToken: null` | O comentário no código diz que tenta buscar o link "agora"; ninguém o gera nesse caminho | Mantido, intencional: o link público é gerado sob demanda por `leads.generatePublicLink` |
| 3 | Sem telefone, cada envio cria um lead novo; dois envios iguais geram dois leads | Não há outra chave para reconhecer a pessoa | Mantido. Decisão de produto em aberto |
| 4 | Resposta que não é JSON válido é aceita, gravada como veio, e cria um lead "Sem nome" | A entrada não é validada além de ser texto | Mantido, intencional (comentado em `save-partial-response.ts`). Corrigido só o JSON `null`, que dava erro interno (CA-9) |
| 5 | Lead existente mantém o nome do cadastro; o nome digitado no formulário é ignorado | Pode ser intencional | Mantido. Decisão de produto em aberto |
| 6 | O salvamento parcial cria o lead no primeiro "Próximo". Quem abandona o formulário deixa um lead no funil, sem aviso à equipe além do board | Decisão de produto: é assim que o consultor acompanha o preenchimento ao vivo | Mantido. Decisão de produto em aberto |
| 7 | A pontuação da 10ª e da 100ª resposta só acontece se a regra existir no banco. A função que criava as regras padrão (`ensureGlobalSpacePointRules`) está com o corpo comentado | Em banco sem as regras cadastradas, ninguém pontua, sem erro e sem aviso | Mantido, intencional: as regras vêm de `prisma/seed-a.ts`. **A conferir em produção** se o seed rodou (`SELECT count(*) FROM space_point_rules`) |
| 8 | A pontuação roda dentro da transação do envio, com o cliente global (regra 18). Não trava: o envio conclui normalmente | Violação da regra sem o efeito de espera circular | ✅ Corrigido (CA-8): roda depois do commit |
| 9 | As tags vindas da resposta (`meta.tagId`) e a tag do botão "Próximo" são aplicadas ao lead sem conferir se pertencem à empresa do formulário | Quem conhece o id de uma tag de outra empresa consegue anexá-la a um lead pelo formulário público. Achado ao escrever os ports do módulo | Aberto. Preservado na migração (etapa 7); a corrigir na etapa 8 |

Sobre a regra 18: `leads/create-lead-with-tags.ts` chama `logActivity` (cliente global) dentro da
transação. O overview (§8, R3) afirma que isso causa espera circular e 500 por timeout. O teste de
caracterização **não reproduz**: a procedure conclui em bem menos que os 5 s do timeout, porque o log
de atividade não referencia a linha travada. A violação existe (o log é gravado mesmo se a transação
desfizer, e a procedure faz chamada de rede dentro da transação), mas a consequência descrita não foi
confirmada neste caminho.

## 8. Limitações da reaferição

Nada foi executado: não havia teste para rodar e esta etapa não instala ferramenta. O passivo de
`pnpm lint` segue desconhecido, porque o CI não roda lint e ele não foi rodado aqui. As contagens de
linhas e de arquivos "puros" vêm de leitura dos imports, não de execução.
