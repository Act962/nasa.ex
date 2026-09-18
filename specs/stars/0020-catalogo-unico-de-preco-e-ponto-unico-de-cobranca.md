---
id: 0020
titulo: Catálogo único de preço e ponto único de cobrança de Stars
dominio: stars
status: rascunho
autor: João Gabriel
criada: 2026-09-18
atualizada: 2026-09-18
branch: feature/stars-catalogo-unico-preco-20260918
pr:
peso: completa
---

# 0020 — Catálogo único de preço e ponto único de cobrança de Stars

---

## 1. Contexto

O ÓRBITA cobra consumo em Stars a partir de **~87 pontos de cobrança** espalhados pelo código.
Esses pontos não concordam sobre onde está o preço:

| Caminho | Quantos pontos | Onde busca o preço |
| --- | ---: | --- |
| Função principal de cobrança por ação | ~62 | `AppStarCost` (banco) |
| Débito direto com número calculado pelo chamador | ~25 | Constante no código |

Além disso, existe uma terceira tabela de preço por organização (`StarRule`, 3.241 linhas) lida por
um único handler de automação, e pelo menos seis arquivos com constantes de preço fixas — incluindo
a razão token/★ do ASTRO, **duplicada em dois arquivos diferentes**.

### Evidência — o catálogo está furado

Inventário de 2026-09-18 no banco real
([relatório completo](../../docs/relatorios/inventario-stars-2026-09-18.md)):

- 38 chaves de ação são cobradas no código.
- **14 delas não têm linha de preço no banco.**
- Quando a linha não existe, a função de cobrança retorna `skipped` e **não registra nada**: sem
  log, sem transação, sem sinal.

Entre as 14 está **`astro_prompt`** — a cobrança-base de cada prompt do ASTRO. Ela nunca cobrou.
O que ainda cobra no ASTRO é apenas o excedente por token, que roda pelo caminho de débito direto e
não passa pelo catálogo.

As quatro chaves `astro_finance_*` confirmam uma pendência que o `docs/ASTRO_PROGRESS.md` já
registrava como "falta cadastrar" — está faltando de fato.

**A dor:** mudar um preço hoje pode ou não exigir deploy, dependendo de qual dos três caminhos a
ação usa. E uma ação nova que ninguém cadastra fica gratuita para sempre, sem ninguém perceber.

## 2. Objetivo

Existe **um** ponto por onde toda cobrança de Stars passa, e **um** catálogo que define o preço de
qualquer ação — capaz de cobrar por quantidade e por variante — editável sem deploy, e que avisa
quando uma ação cobra sem ter preço definido.

### Não-objetivos

- **Não muda o valor cobrado de nenhuma ação que hoje já cobra.** Esta spec é de infraestrutura; a
  calibragem de preço vem depois, com dado de custo real (spec 0021).
- **Não corrige os vazamentos de receita** V1, V3, V4, V5 e V6 do
  [`BILLING_ARCHITECTURE.md`](../../docs/BILLING_ARCHITECTURE.md) §3 — cada um entra atrás da
  própria flag, na Fase 5.
- **Não migra os ~25 pontos de débito direto** — isso é a Fase 3, depois que o catálogo suportar
  quantidade e variante.
- **Não mexe em preço de plano**, em Stripe, nem em assinatura.
- **Não cria Extensions** nem qualquer nível comercial novo.
- Não registra custo de fornecedor — isso é a spec 0021.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O catálogo resolve preço nesta ordem: sobrescrita por organização → catálogo global → padrão no código → não encontrado |
| RF-2 | O catálogo suporta custo fixo por ação (comportamento atual preservado) |
| RF-3 | O catálogo suporta custo por quantidade, com unidade (token, MB, segundo, imagem, mensagem) e divisor |
| RF-4 | O catálogo suporta custo por variante (modelo ou provider), em valor absoluto ou multiplicador |
| RF-5 | O catálogo suporta cobrança mínima e **teto máximo** por evento, como guarda contra disparada |
| RF-6 | Ação cobrada sem preço definido em nenhuma camada gera aviso no log e registro de ocorrência, em vez de ser silenciosamente gratuita |
| RF-7 | A função de cobrança por ação mantém assinatura e formato de retorno idênticos aos de hoje |
| RF-8 | Preço passa a ser servido por cache em memória, invalidado explicitamente quando o admin salva |
| RF-9 | As 14 chaves sem preço são cadastradas, com valor definido pelo negócio antes do merge |
| RF-10 | A cobrança mensal por app instalado é desligada, preservando as linhas históricas |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A resolução de preço não faz consulta ao banco no caminho quente quando o cache está quente |
| RNF-2 | A migration é estritamente aditiva: nenhum `DROP`, nenhum `RENAME`, nenhuma coluna obrigatória sem default |
| RNF-3 | Nenhuma linha de saldo ou de extrato existente é reescrita |
| RNF-4 | A resolução de preço não faz I/O de rede, e nada dela roda dentro da transação de débito (Regra 18 do CLAUDE.md) |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma ação com preço fixo já cadastrado hoje, quando cobrada, então o valor
      debitado é **exatamente** o mesmo de antes da mudança.
- [ ] **CA-2** — Dada uma ação com unidade `token`, divisor 1000 e custo unitário 1, quando cobrada
      com 2.500 tokens, então o débito é de 3 ★ (arredondado para cima, respeitando a cobrança
      mínima).
- [ ] **CA-3** — Dada uma ação com variantes por modelo, quando cobrada informando um modelo
      específico, então o preço aplicado é o da variante, e não o preço-base.
- [ ] **CA-4** — Dada uma ação com teto máximo definido, quando a quantidade produziria um valor
      acima do teto, então o débito é limitado ao teto e a ocorrência fica registrada.
- [ ] **CA-5** — Dada uma ação **sem** preço em nenhuma camada, quando cobrada, então nada é
      debitado, um aviso vai para o log e a ocorrência fica registrada como ação sem preço.
- [ ] **CA-6** — Dada uma organização com sobrescrita própria para uma ação, quando cobrada, então
      vale a sobrescrita e não o catálogo global.
- [ ] **CA-7** — Dado que o admin altera um preço na tela de regras, quando a próxima cobrança
      acontece, então o novo preço já vale, sem restart.
- [ ] **CA-8** — Dada a cobrança de um curso, quando o saldo de bônus é suficiente mas a cobrança
      proíbe bônus, então o bônus **não** é usado (proteção contra bônus virar dinheiro real).
- [ ] **CA-9** — Após a mudança, nenhuma organização tem app com cobrança mensal ativa, e as linhas
      históricas continuam consultáveis.
- [ ] **CA-10** — As 14 chaves listadas no inventário passam a ter preço definido, incluindo
      `astro_prompt`.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Ação sem linha no banco e sem padrão no código | Não cobra, avisa no log, registra ocorrência. **Muda o comportamento atual**, que era silencioso |
| CB-2 | Ação com linha no banco e preço zero | Não cobra, **sem** aviso — zero explícito é decisão do admin, não esquecimento |
| CB-3 | Quantidade zero ou negativa | Não cobra; registra ocorrência. Nunca credita |
| CB-4 | Quantidade fracionária após divisão (ex.: 1 token com divisor 1000) | Arredonda para cima até a cobrança mínima |
| CB-5 | Variante informada que não existe no catálogo | Aplica o preço-base e registra a variante desconhecida |
| CB-6 | Quantidade absurda por bug do chamador (ex.: 10 milhões de tokens) | Teto máximo limita o débito. Sem teto, cobra — por isso o teto é obrigatório em toda ação por quantidade |
| CB-7 | Saldo insuficiente | Comportamento atual preservado: cobrança falha, retorno indica falha |
| CB-8 | Sobrescrita por organização existe mas com valor igual ao global | Indiferente; vale a sobrescrita |
| CB-9 | Cache quente e admin altera o preço | Invalidação explícita no salvamento; sem ela o preço velho valeria por até o TTL |
| CB-10 | Duas cobranças simultâneas da mesma organização | Comportamento atual preservado — a transação de débito já serializa |
| CB-11 | Organização de escopo trafeGO, hoje isenta no ASTRO | A isenção é preservada; esta spec não altera quem é isento |
| CB-12 | Chave de ação existe no banco mas nenhum código a usa | Inofensivo. Fica visível no relatório de chaves órfãs |

## 6. Decisões de design

### D-1 — Estender o catálogo que já existe, em vez de criar tabela nova

- **Escolha**: adicionar colunas à tabela de preço atual (`AppStarCost`).
- **Alternativas descartadas**: criar uma tabela de preço nova e migrar. Descartada porque a tabela
  atual já é lida por ~62 pontos e já tem tela de administração funcionando — uma tabela nova
  significaria manter as duas em sincronia durante a transição, que é exatamente o problema que
  esta spec existe para resolver.
- **Consequência**: a migration é aditiva e nenhum dos 62 pontos muda.

### D-2 — Preservar a assinatura da função de cobrança por ação

- **Escolha**: a função que os ~62 pontos já chamam mantém nome, parâmetros e formato de retorno,
  passando a delegar internamente para o novo ponto único.
- **Alternativas descartadas**: renomear e atualizar os 62 pontos no mesmo PR. Descartada porque
  produziria um diff grande demais para revisar com atenção, num PR que mexe em dinheiro.
- **Consequência**: a Fase 1 entrega "nada muda para o cliente", o que a torna um ponto de rollback
  seguro.

### D-3 — Ação sem preço deixa de ser silenciosamente gratuita

- **Escolha**: registrar e avisar.
- **Alternativas descartadas**: cobrar um valor padrão. Descartada porque cobrar do cliente um
  valor que ninguém decidiu é pior do que não cobrar — o erro fica com o cliente, não conosco.
- **Consequência**: passamos a enxergar o vazamento. O `astro_prompt` é a prova de que sem isso ele
  fica invisível por meses.

### D-4 — Promover a tabela de regras por organização a camada de sobrescrita, com marcação explícita

- **Escolha**: as 3.241 linhas existentes entram como **não-sobrescrita** por padrão; só viram
  sobrescrita as que forem explicitamente marcadas.
- **Alternativas descartadas**: passar a ler a tabela como preço direto. Descartada porque mudaria
  preço em silêncio para qualquer organização cuja linha tenha sido editada à mão — e ainda não
  sabemos quantas foram ([questão aberta 4](../../docs/BILLING_ARCHITECTURE.md#7-questões-abertas)).
- **Consequência**: nada muda para nenhuma organização até alguém marcar deliberadamente.

### D-5 — Teto máximo obrigatório em toda ação por quantidade

- **Escolha**: ação que cobra por quantidade não pode ser cadastrada sem teto.
- **Alternativas descartadas**: teto opcional. Descartada porque a cobrança por quantidade é
  alimentada por número vindo de fornecedor externo — um bug de contagem vira cobrança
  desproporcional direto no saldo do cliente.
- **Consequência**: um pouco mais de atrito ao cadastrar. Aceito.

### D-6 — Aposentar a cobrança mensal por app

- **Escolha**: desligar o mecanismo, preservando o histórico.
- **Alternativas descartadas**: manter como mecanismo de Extension. Descartada por decisão
  comercial: o ecossistema é o produto e o plano define a capacidade, e manter os dois modelos
  convivendo contradiz isso.
- **Consequência**: risco zero — o inventário mostrou **zero** organizações com app alugado ativo.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — aditiva
- [ ] Procedures oRPC (contrato de entrada/saída) — nenhum contrato muda
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest) — o ciclo mensal deixa de cobrar app instalado
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória — `docs/BILLING_ARCHITECTURE.md` (changelog no mesmo PR),
      `docs/STARS_OVERVIEW.md` e `docs/STARS_AUDIT.md` (correção das afirmações falsas)

**Bloqueador conhecido:** o drift de migrations descrito em `prisma/PENDING_MIGRATIONS.md` precisa
ser resolvido antes, ou nenhuma migration nova aplica limpo. É ação do dev.

**Ritual obrigatório após a migration** (Regra 11 do CLAUDE.md): regenerar o cliente Prisma →
bumpar a versão de schema → registrar a migration no histórico → tocar as rotas catch-all →
validar por requisição que as rotas respondem, antes de devolver o controle.

## 8. Plano de testes

Não há test runner instalado no projeto (confirmado em `package.json`). Conforme a Regra 20 do
CLAUDE.md, o aceite desta spec é **manual e declarado** — não omitido.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Cobrar `lead_create`, `message_send` e `chat_ai_message` antes e depois; comparar o extrato. Os valores devem ser idênticos |
| CA-2 | manual | Cadastrar a ação por token, disparar um prompt do ASTRO com tamanho conhecido, conferir o débito |
| CA-3 | manual | Gerar imagem com dois modelos diferentes; conferir preços distintos no extrato |
| CA-4 | manual | Forçar quantidade acima do teto por chamada direta; conferir que o débito para no teto |
| CA-5 | manual | Cobrar uma chave inexistente; conferir aviso no log e ocorrência registrada |
| CA-6 | manual | Marcar uma sobrescrita para uma organização de teste; conferir que vale sobre o global |
| CA-7 | manual | Alterar preço na tela de admin e cobrar em seguida, sem restart |
| CA-8 | manual | Comprar curso com saldo de bônus suficiente; conferir que o bônus não foi consumido |
| CA-9 | consulta | Consultar integrações de app ativas: deve ser zero; histórico ainda consultável |
| CA-10 | consulta | Cruzar as chaves do código com as linhas do banco: nenhuma chave sem preço |

## 9. Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Cobrança dupla se um ponto ganhar a nova chamada sem perder a antiga | Um PR por área; a função antiga vira privada e ganha regra de lint só no fechamento da Fase 3 |
| Preço muda em silêncio ao promover a tabela por organização | Marcação explícita de sobrescrita, desligada por padrão |
| Cadastrar as 14 chaves faltantes passa a cobrar o que hoje é grátis | **É mudança de comportamento visível ao cliente.** Precisa de decisão de negócio sobre os valores e sobre comunicar, antes do merge. `astro_prompt` é o caso sensível |
| Cache serve preço velho | Invalidação explícita no salvamento, além do TTL |
| Migration não aplica por causa do drift | Resolver o drift na Fase 0, com autorização do dev |

**Rollback:** a migration é aditiva — reverter o código faz o sistema voltar a ler apenas o preço
fixo, e as colunas novas ficam ociosas sem quebrar nada. Nenhum saldo ou extrato é reescrito, então
não há perda de dado em nenhuma direção. Desligar a cobrança por app é reversível reativando o
trecho; como não há nenhuma integração ativa, não há efeito prático em nenhuma das direções.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-18 | João Gabriel | Criada, com o inventário de 2026-09-18 como base factual |
