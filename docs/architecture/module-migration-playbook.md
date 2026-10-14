# Roteiro: migrar um fluxo para `src/modules`

> Escrito a partir do piloto `form` (etapa 7 de [`migration-plan.md`](migration-plan.md)), que migrou o
> envio público de formulário. Serve para repetir o processo em outro fluxo. Decisões de arquitetura
> estão em [`../arquitetura-evolucao-overview.md`](../arquitetura-evolucao-overview.md) e não são
> rediscutidas aqui.

## Antes de começar

Só migre um fluxo que já tem **testes de caracterização** passando contra o código atual
([`testing-strategy.md`](testing-strategy.md) §5). Eles são a única prova de que o caminho novo se
comporta igual. Defeito conhecido se corrige **antes**, em mudança separada com spec: a migração
não altera comportamento.

## Os cinco passos

| Passo | O que fazer | Como saber que terminou |
| --- | --- | --- |
| a. Domínio | Mover para `domain/` as regras que já são puras. O caminho antigo vira `export * from` do novo, para nenhum consumidor mudar. Tipos do Prisma viram tipos próprios (união de textos) | `pnpm arch` sem violação de R1 e R7; testes unitários movidos junto e passando |
| b. Ports e adapters | Escrever em `ports/` o que o fluxo precisa do mundo: um repositório para o que roda **dentro** da transação e uma interface de efeitos para o que roda **depois**. Em `infra/`, implementar copiando as queries e os `try/catch` do handler, sem reescrever | Nada consome ainda; tipos e lint limpos |
| c. Caso de uso | `application/<verbo>.ts` recebe os ports por parâmetro. Duas fases: gravar dentro da transação e devolver o que falta; executar os efeitos na ordem original | Teste unitário com ports falsos cobrindo cada ramo, sem banco |
| d. Flag | No handler, um desvio no começo: flag ligada chama o módulo, desligada segue o código antigo, que fica intacto. Um arquivo de teste liga a flag e importa as caracterizações existentes | A mesma suíte passa nos dois caminhos |
| e. Remoção | Depois de um período em produção com a flag ligada, apagar o caminho antigo, a flag e as reexportações sem consumidor | Handler abaixo de 80 linhas |

## Regras que o piloto confirmou

- **Transação só grava** (regra 18). O caso de uso devolve os efeitos e eles rodam depois do commit.
  Com dois ports separados, chamar rede dentro da transação deixa de ser possível por descuido: o
  repositório transacional não tem método para isso.
- **Preserve o tratamento de falha de cada efeito.** O que era tolerado (`try/catch` com log)
  continua tolerado no adapter; o que propagava continua propagando. Mudar isso é mudança de
  comportamento.
- **Prisma só em `infra/`**, inclusive o cliente global: quem liga os adapters ao cliente é um
  arquivo de `infra/` (`production-adapters.ts`), e o `index.ts` do módulo só monta as dependências.
- **`TenantScope` nasce de uma leitura explícita.** Em entrada pública não há sessão: a empresa vem
  do recurso público (o formulário), e essa é a única leitura sem escopo.
- **Regra de outro domínio fica como port.** O posicionamento do lead pertence a `leads`; o piloto
  chama o helper atual por trás do port, sem migrar `leads` junto.
- **Prove que o caminho novo rodou.** Suíte verde com flag ligada não basta: quebre o módulo de
  propósito uma vez e confira que a suíte da flag falha e a outra não.

## O que o piloto não resolveu

- O salvamento parcial foi migrado depois do envio, com a mesma flag. A migração mostrou que os dois
  liam a identidade da pessoa com regras diferentes; as duas foram preservadas, lado a lado no domínio,
  para a diferença ficar visível (achado 10 em [`testing-strategy.md`](testing-strategy.md) §7).
- As operações por id de lead e de tag dentro do envio não conferem a empresa, como no código de
  origem. Ver achado 9 em [`testing-strategy.md`](testing-strategy.md) §7.
- O adapter de efeitos importa helpers de `features/` e de `app/router/`. É dependência de `infra/`
  para fora, permitida pelas regras, mas cada helper desses é candidato a port próprio quando o
  domínio dele for migrado.
