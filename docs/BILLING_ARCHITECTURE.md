# Arquitetura comercial do ÓRBITA — planos, Stars e custo

> **Fonte de verdade** do motor econômico: planos, cobrança em Stars, medição de custo e
> roteamento de IA. Leia antes de mexer em `src/features/stars/`, `src/features/billing/`,
> nos modelos `Plan`/`Subscription`/`AppStarCost`/`StarTransaction` do Prisma, ou em qualquer
> ponto que cobre Stars.
>
> Espelha a obrigação das Regras 10 (NASA Route), 14 (WhatsApp Oficial) e 19 (evolução
> arquitetural) do [`CLAUDE.md`](../CLAUDE.md): **mexeu no domínio, atualiza este arquivo no mesmo
> PR.** Documentação atualizada depois não existe.

**Última atualização:** 2026-09-18
**Status geral:** 🚧 Fases 0 a 5 concluídas — Fase 6 aberta

---

## 0. Como ler este documento

Todo conteúdo aqui é marcado por natureza. Isso não é formalidade: a auditoria que originou esta
frente perdeu tempo porque documentos antigos afirmavam com autoridade coisas que o código não
fazia (ver §8).

| Marca | Significado |
| --- | --- |
| **[CÓDIGO]** | Verificado lendo o código ou consultando o banco. É fato. |
| **[PROPOSTA]** | Desenho ainda não implementado. |
| **[ABERTO]** | Questão sem resposta. Não decida em cima disso. |

E todo custo é classificado:

| Marca | Significado |
| --- | --- |
| **MEDIDO** | Registramos o número real por evento. |
| **ESTIMADO** | Calculamos a partir de tabela ou fórmula, sem registrar o real. |
| **NÃO MEDIDO** | Não temos ideia. Qualquer número aqui é chute. |

---

## 1. O problema que esta frente resolve

O ÓRBITA cobra por assinatura mensal mais consumo em Stars. A pergunta que o negócio precisa
responder — **"quanto custa atender esta organização?"** — hoje não tem resposta, e a estrutura de
cobrança tem vazamentos.

Dois fatos motivaram a frente:

**1. Não conseguimos medir custo. [CÓDIGO]**
O ASTRO, maior superfície de IA da plataforma, não registra telemetria nenhuma. Apenas 2 dos ~30
pontos de chamada de IA gravam uso. A tabela de preço em dólar é de outubro/2024 e devolve **zero**
para os modelos que estão em uso hoje. Não há telemetria alguma de WhatsApp, storage, e-mail,
vídeo, imagem ou transcrição.

**2. Há vazamentos de receita ativos. [CÓDIGO]** — detalhados na §3.

**Consequência de método:** não se define preço antes de medir. A ordem desta frente é
**corrigir → centralizar → instrumentar → observar → precificar**, e o preço fica de fora até
existir dado real.

---

## 2. Estado atual — o que existe hoje [CÓDIGO]

### 2.1 Saldo e extrato

Saldo mora em duas colunas inteiras em `Organization`: saldo comprado e saldo de bônus. O extrato é
`StarTransaction`, com 12 tipos de movimento. O débito gasta o saldo comprado primeiro e o bônus
depois, com opção de proibir o uso de bônus — usada na compra de curso, para que bônus de
boas-vindas não vire dinheiro real na mão do criador.

**Limitação central:** `StarTransaction` **não guarda usuário**. A atribuição por pessoa depende de
um contador acumulado que nunca é zerado — ou seja, é exibido como se fosse do mês, mas é de sempre.

### 2.2 Preço: três fontes concorrentes

Antes das Fases 1 e 3, o preço vinha de três lugares que não concordavam:

| Fonte | Onde | Quem lia |
| --- | --- | --- |
| `AppStarCost` (banco) | 66 linhas, editável pelo admin sem deploy | A função principal de cobrança |
| `StarRule` (banco, por organização) | 3.241 linhas | Apenas um handler de automação |
| Constantes no código | 13 constantes em 12 arquivos | 19 pontos que ignoravam as duas acima |

> ✅ **Resolvido.** Existe um ponto único de cobrança, e os 19 pontos que debitavam com número fixo
> foram migrados: as constantes `STARS_*`, `MODEL_TO_STARS`, `STAR_COSTS`, `STARS_PER_TOOL` e
> `PAGES_STARS_COST` viraram linhas de catálogo, ajustáveis sem deploy. `debitStars` está fechado
> por regra de lint — usá-lo fora do módulo é erro de build.
>
> A migração foi verificada valor a valor: **25 preços portados conferidos contra as constantes
> originais, zero divergências.** A única exceção documentada é o upload de vídeo, cujo preço é
> fórmula (tamanho × horizonte × margem × câmbio × preço da estrela) e não constante — achatá-lo
> num valor por MB congelaria câmbio e preço da estrela dentro do catálogo.
>
> As 3.241 regras por organização foram comparadas com o catálogo global antes da migração:
> **zero divergências**, o que responde a questão aberta 4 e tornou a troca neutra.

> ✅ **Resolvido parcialmente na Fase 1.** Existe agora um ponto único de cobrança, e a função que os
> ~62 pontos já chamavam virou fachada sobre ele — sem mudar nenhuma linha nesses pontos. O catálogo
> passou a suportar cobrança por quantidade e por variante, com teto de segurança, e o preço é
> servido por cache com invalidação no salvamento do admin. Os ~25 pontos de débito direto migram na
> Fase 3.

### 2.3 Catálogo furado — o achado mais grave da Fase 0 [CÓDIGO]

**14 das 38 chaves de ação cobradas no código não têm linha de preço no banco.** Quando a linha não
existe, a cobrança é **pulada em silêncio**, sem log e sem registro.

Entre elas está **`astro_prompt`** — a cobrança-base de cada prompt do ASTRO. Ela está desligada
desde sempre. O que ainda cobra no ASTRO é apenas o excedente por token, que roda por outro caminho
e não passa pelo catálogo.

Lista completa em [`relatorios/inventario-stars-2026-09-18.md`](relatorios/inventario-stars-2026-09-18.md), §3.1.

> ⚠️ **A Fase 1 acabou com o silêncio, não com o furo.** Ação sem preço passou a avisar no log e a
> entrar no relatório de ações sem preço — mas segue sem cobrar. Definir quanto cada uma vale é
> decisão de negócio (RF-9 da spec 0020), e `astro_prompt` é o caso sensível: cadastrá-la passa a
> cobrar algo que hoje é grátis.

### 2.5 Aluguel por app — aposentado na Fase 1

### 2.4 Planos

Quatro planos, com os nomes que o negócio já usa. Preços **travados por decisão** — esta frente não
os altera.

| Plano | Preço | Franquia | Papel |
| --- | --- | ---: | --- |
| Suite | R$ 0 | 100 ★ | Aquisição |
| Earth | R$ 197 | 1.000 ★ | Entrada paga |
| Explore | R$ 397 | 3.000 ★ | Plano principal |
| Constellation | Sob consulta | 20.000 ★ | Operações robustas |

A assinatura vive inteiramente no plugin Stripe do better-auth. O plano é vinculado ao **usuário**,
não à organização, e propaga para as organizações onde esse usuário é dono ou admin — o maior plano
vence.

**Não existe bloqueio por plano em lugar nenhum da plataforma.** Visitar qualquer ferramenta não é
barrado. Ou seja, o princípio "o ecossistema é o produto, o plano define a capacidade" **já é o
comportamento atual** — esta frente o ratifica, não o inventa.

Existia um segundo modelo comercial dormente: apps "instalados" com custo mensal próprio em ★, que
contradizia o princípio acima. O ciclo mensal deixou de cobrá-lo, e o histórico foi preservado.

**Organizações afetadas: zero** — nenhuma tinha app alugado ativo.

### 2.6 Medição de custo

Situação **depois da Fase 2**:

| Domínio de custo | Situação | Mudou? |
| --- | --- | --- |
| IA — ASTRO no app | **ESTIMADO** — tokens, modelo e custo persistidos por evento | ✅ era NÃO MEDIDO |
| IA — ASTRO no WhatsApp | **ESTIMADO** | ✅ era NÃO MEDIDO |
| IA — chatbot de tracking | **ESTIMADO** — custo agora persistido, não recalculado na leitura | ✅ |
| IA — workflows | **ESTIMADO** — inclusive workflow de organização, antes cego | ✅ |
| WhatsApp / Instagram / Facebook | **ESTIMADO** — evento registrado; falta o custo real por conversa do fornecedor | ✅ era NÃO MEDIDO |
| IA — demais ~25 pontos | **NÃO MEDIDO** | Fase 3 |
| Storage (S3/R2) | **NÃO MEDIDO** — o custo de upload de vídeo é calculado e descartado | Fase 3 |
| Imagem, vídeo, transcrição | **NÃO MEDIDO** | Fase 3 |
| E-mail, realtime, geocode | **NÃO MEDIDO** | — |
| Infraestrutura | **NÃO MEDIDO** | — |

> ⚠️ **Por que ainda é ESTIMADO e não MEDIDO.** Os preços por modelo adicionados em 2026-09-18
> estão marcados com `// conferir` em `src/features/ia/lib/token-pricing.ts`: foram postos a partir
> de valores de referência, sem checagem nas páginas oficiais dos providers. **Conferir antes de
> basear preço de plano neles.** Modelo fora da tabela é gravado como `unknown`, nunca como custo
> zero — zero seria indistinguível de "de graça" na hora de apurar margem.

---

## 3. Vazamentos de receita conhecidos [CÓDIGO]

| # | Vazamento | Tamanho medido | Situação |
| --- | --- | --- | --- |
| V1 | Ciclo mensal não tem cron, e renovação no mesmo plano retorna antes de creditar | **Todas as 12 organizações com crédito têm exatamente 1.** Uma do Earth está há 94 dias sem segundo crédito | 🚧 Cron criado, **desligado**. Aguarda decisão de produto — ver §3.1 |
| V2 | `astro_prompt` e mais 13 ações cobram no código sem preço no banco | Caiu de 14 para 9 ações sem preço | 🚧 Silêncio corrigido; falta o negócio definir os valores |
| V3 | Refill automático de 1.000.000 ★ para organização com membro "moderador" | 1 organização, 1 ocorrência, 999.902 ★ | ✅ Atrás de `STARS_MODERATOR_REFILL`, desligado |
| V4 | Painel de consumo procura o plano pelo campo errado | Denominador sempre zero; o cliente nunca vê quanto tem | ✅ Lê `Organization.plan` |
| V5 | Bloqueio por suspensão não está aplicado a nenhuma procedure | 1 organização suspensa, com saldo zero e sem plano | ✅ Aplicado às procedures caras e à rota do ASTRO |
| V6 | Contador de gasto por membro nunca é zerado | Número do mês exibido com valor acumulado de sempre | ✅ Zerado no ciclo |

### 3.1 V1 — a decisão de produto que falta [ABERTO]

O ciclo capa o saldo que passa adiante em `rolloverPct` da franquia. Como ele nunca rodou uma
segunda vez, há organizações com saldo acumulado de vários meses — e elas **perderiam o excedente**
na primeira execução.

Simulação de 2026-09-18
([relatório completo](relatorios/simulacao-ciclo-mensal-2026-09-18.md)):

| | |
| --- | ---: |
| Organizações com ciclo vencido | 23 |
| Créditos de franquia a distribuir | 170.900 ★ |
| **Saldo que seria perdido pelo teto** | **41.355 ★** |
| Organizações que perderiam saldo | 17 |
| Maior perda individual (PLENOCAR) | 13.602 ★ |

**Esse saldo foi acumulado porque o ciclo estava quebrado, não porque o cliente deixou de usar.**
Ligar sem decidir transfere para ele o custo de um bug nosso. As saídas:

- **a)** Ligar assim mesmo e comunicar aos afetados.
- **b)** Creditar a diferença de volta com um ajuste manual registrado.
- **c)** Elevar `rolloverPct` só no primeiro ciclo corrigido, deixando todo o saldo passar.

O cron exige `STARS_MONTHLY_CYCLE_CRON=true`. Sem a variável, roda em simulação e só loga.

**Efeito colateral já visível:** com o V4 corrigido, duas organizações aparecem com 826% e 564% da
franquia no painel. É artefato do V1 — o consumo é cumulativo contra a franquia de um mês. Normaliza
quando o ciclo for ligado.

---

## 4. Arquitetura proposta [PROPOSTA]

### 4.1 Princípio

> **Simplicidade para o cliente, precisão para o ÓRBITA.**
> O cliente vê: meu plano, minha capacidade, minhas Stars, meu consumo, meu ASTRO.
> Nós vemos: receita, custo, consumo, margem, provider, modelo, tenant, feature.

E um princípio de método:

> **Uma STAR não é um token.** É a unidade econômica do ÓRBITA, e precisa representar custo de IA,
> processamento, imagem, vídeo, voz, transcrição, WhatsApp, storage e APIs externas. Trocar de
> fornecedor ou de modelo não pode exigir mexer em dezenas de ferramentas.

### 4.2 Camadas

```
        pontos de cobrança espalhados (~87)
                      |
        +------------------------------+
        |   ponto único de cobrança    |  <- catálogo de preço + cache
        +------------------------------+
                 |              |
         débito de saldo   registro de custo
          (transação)       (após o commit)
                                |
                    custo por organização / solução /
                    feature / provider / modelo / dia / mês
```

Duas regras que não se negociam:

1. **O registro de custo grava fora da transação de débito.** A cobrança é uma transação de banco,
   e a Regra 18 do CLAUDE.md proíbe I/O lá dentro. O ledger grava depois do commit, e falhar nele
   não pode derrubar a cobrança já persistida.
2. **Ação sem preço cadastrado deixa de ser grátis e silenciosa.** Passa a gerar aviso e registro.
   É o vazamento V2.

### 4.3 O que o catálogo precisa suportar

- Custo fixo por ação (o que já existe)
- Custo por quantidade: token, MB, segundo, imagem, mensagem
- Custo por variante: modelo ou provider diferente, preço diferente
- Teto de segurança contra disparada
- Sobrescrita por organização
- Custo esperado em dólar, para comparar o preço cobrado contra o custo real

### 4.4 O que o registro de custo precisa responder

Custo por: organização · solução · feature · usuário · provider · modelo · dia · mês.
E, cruzando com receita: margem bruta por organização e por plano.

Ele registra também **a ação que saiu de graça e a que falhou por saldo** — ambas custaram dinheiro
no fornecedor, e ignorá-las é subestimar o próprio custo.

### 4.5 Roteamento de IA (ASTRO FAST / SMART / DEEP)

O ASTRO era **OpenAI-only e derrubava o copiloto inteiro se faltasse uma variável de ambiente**,
mesmo quando a organização tinha chave de outro provider configurada. O `docs/ASTRO_PROGRESS.md`
afirmava que o padrão era Anthropic — **o código contradizia o documento** (ver §8).

Existe agora uma camada única que escolhe o modelo por **capacidade exigida** (visão, ferramentas,
contexto longo), **preferência declarada** e **chave disponível** — a da organização antes da nossa.
Três níveis expostos, vários providers por baixo. **O cliente nunca escolhe GPT, Gemini ou Claude.**

| Nível | Quando | Ordem de preferência |
| --- | --- | --- |
| FAST | Classificação, extração simples | gpt-4.1-nano → gemini-2.5-flash-lite → claude-haiku-4-5 |
| SMART | Uso do dia a dia, com ferramentas | gpt-4o-mini → gemini-2.5-flash → claude-haiku-4-5 |
| DEEP | Raciocínio longo, ferramentas encadeadas | gpt-4o → claude-sonnet-4-5 → gemini-2.5-pro |

Quatro decisões deliberadas:

- **Não ordena por preço.** Modelo barato que não chama ferramenta não resolve a tarefa mais
  barato — não resolve. E a tabela de custo ainda está marcada `// conferir`: deixá-la escolher
  trocaria o modelo de todo mundo com base em número não confiável. A verificação pegou exatamente
  isso — o nível DEEP resolvia para `gemini-2.5-pro` em vez de `gpt-4o`. A ordem passou a ser a
  declarada no catálogo, que é decisão assinada, não efeito colateral.
- **A classificação de complexidade é preservada.** É gratuita e funciona. Substituí-la por um
  classificador de IA adicionaria uma chamada para economizar uma chamada.
- **Compatibilidade verificada.** Com chave da OpenAI, o modelo escolhido é idêntico ao de antes.
  Sem ela, cai para o Gemini em vez de derrubar a conversa.
- **Fallback honesto.** Troca de provider em tempo de seleção sempre, e em tempo de execução só nas
  chamadas não-streaming — e apenas para erro de disponibilidade. Falha no meio de uma resposta
  transmitida continua sendo erro visível: o erro surge depois de os cabeçalhos já terem sido
  enviados, e prometer o contrário seria promessa falsa.

### 4.5.1 O que deliberadamente NÃO foi migrado para o roteador

- **A escolha de modelo do financeiro** (`resolve-extraction-model.ts`) tem spec própria (0014),
  razão de custo documentada por mil leituras e modelos default diferentes dos níveis. Migrar
  trocaria qual modelo lê o boleto do cliente, sem ganho — ela já fazia a parte boa que o roteador
  generaliza.
- **A escolha por tracking** (`tracking-chat-ai/lib/model.ts`) é outra coisa: o usuário escolheu
  aquele modelo e aquela chave na tela de configuração. Roteamento por nível passaria por cima de
  uma escolha explícita.

Refatorar as duas seria mudança por mudança.

---

## 5. Roadmap

| Fase | Entrega | Status |
| --- | --- | --- |
| 0 | Desbloquear e inventariar | ✅ Concluída |
| 1 | Catálogo único de preço, ponto único de cobrança | ✅ Concluída — falta definir o preço das 14 ações |
| 2 | Registro de custo e instrumentação | ✅ Concluída — 5 superfícies instrumentadas |
| 3 | Migrar os pontos que hoje escapam do catálogo | ✅ Concluída — 19 pontos migrados, `debitStars` fechado por lint |
| 4 | Roteador de IA | ✅ Concluída |
| 5 | Correção dos vazamentos, cada um atrás de flag | ✅ Código pronto — V1 aguarda decisão de produto |
| 6 | Catálogo unificado de soluções por setor | ⬜ |

### Fora de escopo desta frente

Preço dos planos (travado por decisão) · simulações de escala · UX da página de Soluções · ASTRO
pré-venda · dashboard econômico do admin (depende de o ledger existir) · dashboard de consumo do
cliente (depende da Fase 5) · Extensions.

---

## 6. Decisões travadas

| Decisão | Razão | Data |
| --- | --- | --- |
| Preço dos planos travado; calibra-se só a quantidade de ★ | Muda sem tocar em Stripe nem em quem já assina | 2026-09-18 |
| Aluguel por app aposentado | Contradiz "o ecossistema é o produto"; zero organizações afetadas | 2026-09-18 |
| Ecossistema liberado nos planos pagos | Já é o comportamento atual; diferenciação por capacidade | 2026-09-18 |
| Instrumentar antes de precificar | Sem telemetria, qualquer preço é chute com aparência de cálculo | 2026-09-18 |
| Um documento, não quatro | O CLAUDE.md §20 já registra deriva; docs órfãos viram passivo | 2026-09-18 |
| Ledger grava fora da transação | Regra 18 do CLAUDE.md | 2026-09-18 |

### Descartado, com a razão

| Descartado | Por quê |
| --- | --- |
| Simular 100 mil clientes agora | Sem telemetria seria número fabricado. E a plataforma roda num único servidor — 100 mil tenants é outra empresa, não outro cenário |
| STAR atrelada a token | Impediria representar WhatsApp, storage e vídeo na mesma unidade |
| Janela móvel anti-abuso nova | Já existem dois mecanismos prontos e nunca ligados. Usar o que existe primeiro |
| Classificador de complexidade por IA | Adiciona uma chamada para economizar uma chamada |
| Failover no meio do streaming | O erro surge depois dos cabeçalhos; seria promessa falsa |

---

## 7. Questões abertas [ABERTO]

1. ~~**Drift de migrations.**~~ ✅ **Resolvido em 2026-09-18.** `migrate status` devolve
   "Database schema is up to date" e todos os itens que `prisma/PENDING_MIGRATIONS.md` dava como
   faltando já existiam no banco. O documento estava desatualizado havia mais de quatro meses e
   foi marcado como resolvido, preservando o histórico. Único item real: o cliente Prisma estava
   defasado, e foi regenerado. A migration `astro_pgvector` que ele citava nunca foi commitada —
   e não gera drift porque a coluna `embedding` não está no `schema.prisma`.
2. **Slugs de plano divergentes.** O seed define `suite`/`earth`/`explore`/`constellation`; o banco
   tem `suit-mnj5mcxr`, `earth-mo1vk0jx`, `explore-mo1vq0oi`, `constellation-mnj648ae`. A
   propagação de plano casa por slug **ou** nome — com slug sufixado, depende só do nome. Verificar
   antes de mexer no ciclo mensal.
3. **O primeiro ciclo corrigido pode derrubar saldo.** O ciclo aplica rollover limitado a uma
   percentagem da franquia do plano. Organizações que acumularam saldo durante os meses quebrados
   podem perder o excedente. **Decisão de produto antes de subir.**
4. ~~**Quantas regras por organização divergem do padrão.**~~ ✅ **Respondido em 2026-09-18:**
   nenhuma. As 3.241 linhas ativas batem exatamente com o catálogo global — zero divergências,
   zero ações sem linha correspondente. Por isso migrar `process-user-action` para o catálogo não
   alterou preço para nenhuma organização.
5. **Não há test runner instalado.** A Regra 17 exige que cada critério de aceite vire teste — hoje
   inexequível, como a Regra 20 já admite. As specs desta frente saem com **aceite manual
   declarado**, não com teste silenciosamente pulado.

---

## 8. Documentação que precisa ser corrigida

Parte do custo desta auditoria veio de documento desatualizado afirmando coisa errada com
autoridade. Corrigir faz parte da frente:

| Documento | O que afirma | O que o código faz |
| --- | --- | --- |
| `STARS_OVERVIEW.md` | O extrato guarda o usuário | Não guarda |
| `STARS_OVERVIEW.md` | Regra por organização sobrescreve o preço da ação | Não sobrescreve; só o catálogo global é lido |
| `STARS_OVERVIEW.md` | "~15 ações ativas" | ~87 pontos de cobrança |
| `STARS_AUDIT.md` | Lista ações como "ainda não cobram" | Várias já cobram |
| `ASTRO_PROGRESS.md` | Provider padrão é Anthropic | ✅ Corrigido na Fase 4: o ASTRO passou a funcionar com qualquer provedor disponível |

---

## 9. Rastreabilidade

Esta frente mexe em dinheiro, saldo e schema. As regras de disciplina estão em vigor:

- **Uma fase = uma branch = um PR = um ponto de rollback.** A Fase 1 é propositalmente
  "nada muda para o cliente", justamente para ser um ponto de retorno seguro.
- **Commits pequenos, um assunto cada.** Schema e regra de cobrança nunca no mesmo commit.
- **Toda migration é aditiva e tem nota de rollback escrita.** Saldo e extrato existentes nunca são
  reescritos.
- **Toda mudança de comportamento de cobrança entra atrás de flag**, desligada por padrão.
  Reverter é desligar a flag, não reverter código em produção.
- **Relatórios de inventário e simulação são arquivos versionados**, não saída de terminal.

---

## 10. Changelog

| Data | PR | O que mudou | Como desfazer |
| --- | --- | --- | --- |
| 2026-09-18 | — | Fase 0: inventário no banco real, criação deste documento e das specs 0020/0021. Nenhuma mudança de comportamento. | Nada a desfazer — só documentação |
| 2026-09-18 | — | Drift de migrations verificado e encerrado: não existia mais. `PENDING_MIGRATIONS.md` marcado como resolvido, com o histórico preservado. Cliente Prisma regenerado. | Nada a desfazer |
| 2026-09-18 | — | Fase 1: catálogo passa a suportar quantidade e variante (migration aditiva `20260918160000`); ponto único de cobrança criado; `chargeStarsByAction` virou fachada sem alterar os ~62 pontos; cache de preço com invalidação no admin; aluguel por app aposentado. Verificado: 52 ações de custo fixo com zero divergência. | Reverter o código faz o sistema voltar a ler só o custo fixo; as colunas novas ficam ociosas. A migration não precisa ser desfeita (nota de rollback no próprio SQL). Nenhum saldo ou extrato foi tocado |
| 2026-09-18 | — | Correção do inventário: 5 das 14 ações sem preço **já tinham valor decidido** e nunca foram seedadas — `astro_prompt` (5★) e `calendar_share_enable` (5★) em `prisma/seed-star-rules.ts`, e as três `astro_finance_*` (5★/1★/10★) em `DEFAULT_STAR_RULES`. A causa raiz não era falta de decisão, era o seed nunca ter rodado neste banco. As três do financeiro foram cadastradas; `astro_prompt` aguarda decisão por mudar cobrança de alta frequência. Restam **9** realmente sem valor. | Remover as 3 linhas de `app_star_costs` volta o financeiro do ASTRO a gratuito |
| 2026-09-18 | — | Fase 2: `UsageEvent` criado (migration aditiva `20260918170000`); extrato ganha usuário e ação; câmbio sai do código para `RouterPaymentSettings`; tabela de preço em dólar corrigida (os modelos default valiam zero); 5 superfícies instrumentadas. Verificado por `pnpm tsx scripts/verify-usage-ledger.ts` sem alterar saldo. | Reverter o código para de gravar; o que já foi registrado segue consultável e nenhum saldo foi tocado. Nota de rollback no próprio SQL |
| 2026-09-18 | — | ⚠️ Mudança de comportamento: a cobrança por token do ASTRO passou a arredondar para cima em vez de arredondamento normal. Medido em 11 volumes reais: 3 divergem, soma 77★ → 80★ (~4% mais caro). O arredondamento para baixo fazia toda chamada pequena sair de graça. | Ajustar `unit_cost` da ação `astro_tokens` no catálogo, sem deploy |
| 2026-09-18 | — | Fase 5: V3, V4, V5 e V6 corrigidos; V1 com cron criado e desligado. Ciclo mensal virou idempotente (não recredita com menos de 28 dias) e ganhou modo simulação. Nenhum saldo foi alterado. | Cada correção tem a própria flag ou é reversível revertendo o commit. Reverter o V4 volta o denominador a zero; reverter o V5 volta a não bloquear ninguém |
| 2026-09-18 | — | ⚠️ **Decisão pendente de produto:** ligar o cron do ciclo mensal faria 17 organizações perderem 41.355★ acumuladas. Ver §3.1. | Não aplicável — nada foi aplicado |
| 2026-09-18 | — | Fase 3: 16 ações portadas para o catálogo e 19 pontos de débito migrados; `meterOrThrow` e o caso de custo calculado adicionados; `debitStars` fechado por regra de lint. Verificado: 25 preços conferidos contra as constantes originais, zero divergências. | Reverter os commits devolve as constantes ao código; as linhas de catálogo ficam ociosas sem quebrar nada. Nenhum saldo foi alterado |
| 2026-09-18 | — | Fase 4: roteador de modelos com níveis FAST/SMART/DEEP; ASTRO deixa de depender de um provedor único. Verificado por `pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/verify-ai-router.ts` — modelo idêntico ao anterior com chave da OpenAI, e queda para o Gemini sem ela. | Reverter os commits volta o ASTRO a OpenAI-only. Nenhum dado é tocado |
