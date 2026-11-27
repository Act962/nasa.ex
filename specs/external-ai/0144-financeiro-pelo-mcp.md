---
id: 0144
titulo: Ler o Financeiro e lançar contas pelo MCP do ÓRBITA
dominio: external-ai
status: implementada
autor: João Gabriel
criada: 2026-11-13
atualizada: 2026-11-13
branch: feature/external-ai-mcp-financeiro-20261113
pr:
peso: completa
---

# 0144 — Ler o Financeiro e lançar contas pelo MCP do ÓRBITA

## 1. Contexto

O MCP do ÓRBITA já tem Planner, FlowAstro, trafeGO e Workspace ([specs 0135](0135-mcp-conectar-pelo-chatgpt-oauth.md),
[0142](0142-flowastro-pelo-mcp.md), [0143](0143-workspace-pelo-mcp.md)). O Financeiro (`/payment`) guarda contas a pagar e
a receber, contas bancárias, categorias, contatos e relatórios (painel, fluxo de caixa, DRE, DRO, projeção). Hoje, para a
IA da pessoa responder "quanto tenho a pagar esta semana" ou lançar as contas de um extrato colado, ela precisa copiar
tudo da tela.

O Astro já tem ferramentas de financeiro (`features/astro/server/tools/finance/`) sobre os mesmos serviços das telas, com
a mesma matriz de permissão. O MCP usa esses serviços; não usa as ferramentas do Astro, que dependem do contexto e da
confirmação do chat dele.

## 2. Objetivo

Pela IA, a pessoa lê os lançamentos e os relatórios do Financeiro e cria lançamentos, categorias e contatos, com as
permissões que tem no Financeiro. Nada que mova dinheiro, mexa no banco ou mande mensagem ao cliente.

### Não-objetivos

- Dar baixa (pagar ou receber), conciliar extrato, cancelar ou apagar lançamento. Muda o saldo e não tem volta pela IA.
- Gerar PIX ou boleto, conexões de banco, régua de cobrança, envio de cobrança e lembrete ao cliente.
- Aprovar ou recusar lançamento, governança, acessos, metas e caixa de entrada do Gmail.
- Editar lançamento, conta, categoria ou contato já existente.
- Anexos e documentos.

## 3. Requisitos

### Funcionais

- **RF-1 — App novo no MCP**: entrada `financeiro` em `MCP_APPS`, liberada a quem tem acesso autorizado ao Financeiro
  (`PaymentAccess.isAuthorized`) ou é dono de alguma empresa (o dono ganha o acesso sozinho ao abrir o módulo, spec 0007).
  Por OAuth vale sozinho; chave nova ganha o escopo `financeiro`; chave antiga não ganha nada sem ser recriada. Na chave,
  valem só as empresas gravadas nela.
- **RF-2 — Permissão**: toda ferramenta recebe `organizationId` e confere a matriz do Financeiro
  (`resolvePaymentPermissions` + `isPaymentActionAllowed`, a mesma do middleware `requirePaymentAccess` e do Astro):
  recurso (`dashboard`, `entries`, `accounts`, `categories`, `contacts`) e ação (`view`, `create`). Sem acesso:
  "Você não tem acesso ao Financeiro desta empresa", sem dizer se a empresa existe.
- **RF-3 — Ferramentas**:

  | Ferramenta | O que faz | Permissão |
  | --- | --- | --- |
  | `finance_list_organizations` | Empresas em que a pessoa tem Financeiro, com o papel e o que ela pode ver e criar | — |
  | `finance_list_entries` | Lançamentos com filtros (tipo, status, vencimento, valor, categoria, contato, conta, busca) e os totais do filtro, até 100 | `entries.view` |
  | `finance_get_dashboard` | Painel do período: a receber, a pagar, recebido, pago, vencidos, saldo, resultado, próximos vencimentos, por categoria | `dashboard.view` |
  | `finance_get_cashflow` | Fluxo de caixa por dia: entradas, saídas e saldo acumulado | `dashboard.view` |
  | `finance_get_income_statement` | DRE do período, regime de caixa ou competência | `dashboard.view` |
  | `finance_get_operational_result` | DRO por centro de custo | `dashboard.view` |
  | `finance_get_projection` | Projeção de caixa para 3, 6 ou 12 meses | `dashboard.view` |
  | `finance_list_accounts` | Contas bancárias com o saldo calculado (o mesmo da tela) | `accounts.view` |
  | `finance_list_categories` | Categorias ativas | `categories.view` |
  | `finance_list_contacts` | Clientes e fornecedores, com busca | `contacts.view` |
  | `finance_create_entry` | Lança conta a pagar ou a receber, com parcelas | `entries.create` |
  | `finance_create_category` | Cria categoria | `categories.create` |
  | `finance_create_contact` | Cria cliente ou fornecedor | `contacts.create` |

- **RF-4 — Lançar pelo mesmo serviço da tela**: `finance_create_entry` chama `createPaymentEntryRecord`. Assim a regra de
  aprovação da empresa vale (o lançamento nasce em "Aguardando aprovação" e os aprovadores são avisados quando passa do
  limite), a reserva de caixa é conferida e o lançamento vai para a contabilidade, como na tela.
- **RF-5 — Referências da mesma empresa**: categoria, conta, contato e categoria-mãe de outra empresa são recusados com o
  nome do campo. O serviço da tela já descarta contato de fora em silêncio; o MCP recusa antes, para a IA corrigir.
- **RF-6 — Sem régua nem anexo**: o MCP não aceita `dunningRuleId` (a régua manda mensagem ao cliente) nem anexos.
- **RF-7 — Valores e datas**: valores em centavos inteiros (`amountCents`), como no banco; a resposta traz também o valor
  formatado em reais. Datas `AAAA-MM-DD`.
- **RF-8 — Registro com o nome da IA**: a criação de lançamento entra no histórico de atividades pelo próprio serviço,
  e a observação do lançamento ganha "Lançado via <nome da IA>" (aparece na tela). Categoria e contato criados entram no
  histórico com `(via <nome da IA>)`.
- **RF-9 — Instruções do app**: o texto do app ensina a ordem (empresas → contas, categorias e contatos → lançar), a
  mostrar os lançamentos e pedir confirmação antes de lançar, e diz que dar baixa, apagar e cobrar ficam na tela.

### Não-funcionais

- **RNF-1**: nenhuma tabela, migration, flag ou função do Inngest.
- **RNF-2**: nenhuma rota oRPC muda.
- **RNF-3**: limite de 300 chamadas por hora por pessoa e chave; listas com `take`.
- **RNF-4**: `canAccess` só lê o banco; quem cria o acesso automático do dono é a primeira ferramenta chamada, pelo
  mesmo `resolvePaymentPermissions` da tela.

## 4. Critérios de aceite

- **CA-1**: com chave nova, "lança o aluguel de R$ 2.500 para dia 5, categoria Aluguel" cria um lançamento a pagar
  pendente, que aparece em `/payment`.
- **CA-2**: numa empresa com aprovação acima de um valor, lançar acima dele cria o lançamento em "Aguardando aprovação".
- **CA-3**: `installments: 3` cria 3 parcelas, uma por mês.
- **CA-4**: papel VIEWER lê tudo e recebe recusa em `finance_create_*`.
- **CA-5**: pessoa sem acesso ao Financeiro não vê o app em `tools/list`; com acesso em outra empresa, recebe recusa ao
  passar o id desta.
- **CA-6**: categoria de outra empresa em `finance_create_entry` é recusada e nada é criado.
- **CA-7**: os números de `finance_get_dashboard` batem com o Painel da tela no mesmo período.
- **CA-8**: chave antiga não recebe as ferramentas `finance_*`.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Valor zero ou negativo | Recusa: "O valor precisa ser maior que zero". |
| CB-2 | Data inválida | Recusa com o campo. |
| CB-3 | Dono da empresa sem registro de acesso | Ganha o acesso de dono na primeira chamada, como ao abrir a tela. Staff da plataforma não (spec 0007, RF-13): recebe a recusa e libera o próprio acesso na tela. |
| CB-4 | Acesso revogado no meio da conversa | A próxima chamada recusa (a permissão é lida a cada chamada). |
| CB-5 | Categoria de tipo diferente do lançamento (receita num lançamento a pagar) | Aceita, como a tela. |
| CB-6 | Contato com o mesmo documento já existe | Cria, como a tela. A instrução do app pede para buscar com `finance_list_contacts` antes. |

## 6. Decisões de design

### D-1 — Só ler e lançar na primeira fase

- **Escolha**: nada de baixa, conciliação, PIX, boleto ou cobrança.
- **Por quê**: dar baixa errado muda o saldo e o status do PIX, e não existe desfazer. Pela tela isso é um clique
  consciente; pela IA, um id trocado.

### D-2 — Serviços do Financeiro, não as ferramentas do Astro

- **Escolha**: o arquivo do MCP chama `queryPaymentEntries`, `loadPaymentDashboard`, `loadCashflow`,
  `loadIncomeStatement`, `loadOperationalResult`, `loadPaymentProjection` e `createPaymentEntryRecord`.
- **Alternativa descartada**: reaproveitar as ferramentas do Astro. Dependem do `AgentContext` e devolvem tabela e
  gráfico para o chat do Astro.

### D-3 — Criar categoria e contato no arquivo do MCP

- As rotas fazem só um `create` com `organizationId`, sem efeito nenhum. Extrair um serviço para uma linha seria
  abstração sem ganho.

## 7. Dívida e pendências

- `createPaymentEntryRecord` não confere se categoria, conta e centro de custo são da empresa (só contato, lead, régua e
  tracking). A tela e o Astro podem gravar lançamento apontando para categoria de outra empresa passando o id. O MCP
  confere antes; a correção no serviço fica como tarefa separada.
- `payment.categories.create` também não confere a categoria-mãe.
- O histórico de "Lançou pagamento" mostra o valor em centavos como se fosse reais ("R$ 250000.00" para R$ 2.500,00):
  `createPaymentEntryRecord` usa `totalAmount.toFixed(2)` sem dividir por 100 (`create-entry.ts`, linha 262). Já existia;
  vale para a tela, o Astro e o MCP. Fora deste PR.
- O guarda das ferramentas (escopo + limite de chamadas) está copiado em FlowAstro, Workspace e Financeiro. Extrair
  quando os três estiverem na `main`.

## Changelog

- 2026-11-13 — criada.
- 2026-11-13 — testada de ponta a ponta no banco local pelo `/api/mcp` com chaves, numa empresa descartável: CA-1 a CA-6
  e CA-8 conferidos (aprovação acima do limite, 3 parcelas mensais, VIEWER só lê, categoria de outra empresa recusada,
  pessoa sem acesso sem o app, chave antiga sem as ferramentas, dono ganha o acesso, staff não). CA-7 (comparar com a
  tela) não conferido.
