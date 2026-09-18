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
**Status geral:** 🚧 Fase 0 concluída — Fases 1 a 6 abertas

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

| Fonte | Onde | Quem lê |
| --- | --- | --- |
| `AppStarCost` (banco) | 66 linhas, editável pelo admin sem deploy | A função principal de cobrança |
| `StarRule` (banco, por organização) | 3.241 linhas | Apenas um handler de automação |
| Constantes no código | 6+ arquivos | ~25 pontos de cobrança que ignoram as duas acima |

São ~62 pontos que usam a função principal e ~25 que debitam com número fixo no código. Mudar preço
hoje pode exigir deploy, dependendo de onde a ação cai.

### 2.3 Catálogo furado — o achado mais grave da Fase 0 [CÓDIGO]

**14 das 38 chaves de ação cobradas no código não têm linha de preço no banco.** Quando a linha não
existe, a cobrança é **pulada em silêncio**, sem log e sem registro.

Entre elas está **`astro_prompt`** — a cobrança-base de cada prompt do ASTRO. Ela está desligada
desde sempre. O que ainda cobra no ASTRO é apenas o excedente por token, que roda por outro caminho
e não passa pelo catálogo.

Lista completa em [`relatorios/inventario-stars-2026-09-18.md`](relatorios/inventario-stars-2026-09-18.md), §3.1.

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

### 2.5 Aluguel por app — a ser aposentado

Existe um segundo modelo comercial dormente: apps "instalados" com custo mensal próprio em ★. Ele
contradiz o princípio acima.

**Organizações com app alugado ativo hoje: zero.** Aposentar é risco zero.

### 2.6 Medição de custo

| Domínio de custo | Situação |
| --- | --- |
| IA — chatbot de tracking | **ESTIMADO** — tokens gravados, custo calculado na leitura, nunca persistido |
| IA — workflows | **ESTIMADO** — e cego quando o workflow é de organização, não de tracking |
| IA — ASTRO (app e WhatsApp) | **NÃO MEDIDO** |
| IA — demais ~25 pontos | **NÃO MEDIDO** |
| WhatsApp / Instagram / Facebook | **NÃO MEDIDO** |
| Storage (S3/R2) | **NÃO MEDIDO** — o custo de upload de vídeo é calculado e descartado |
| Imagem, vídeo, transcrição | **NÃO MEDIDO** |
| E-mail, realtime, geocode | **NÃO MEDIDO** |
| Infraestrutura | **NÃO MEDIDO** |

A tabela de preço em dólar não tem entrada para os modelos default de hoje, e devolve zero para
eles. Na prática, mesmo o "ESTIMADO" está estimando zero nos casos mais comuns.

---

## 3. Vazamentos de receita conhecidos [CÓDIGO]

| # | Vazamento | Tamanho medido | Fase |
| --- | --- | --- | --- |
| V1 | Ciclo mensal não tem cron, e renovação no mesmo plano retorna antes de creditar | **Todas as 12 organizações com crédito têm exatamente 1.** Uma do Earth está há 94 dias sem segundo crédito | 5 |
| V2 | `astro_prompt` e mais 13 ações cobram no código sem preço no banco | Cobrança pulada em silêncio, sem log | 1 |
| V3 | Refill automático de 1.000.000 ★ para organização com membro "moderador" | 1 organização, 1 ocorrência, 999.902 ★ | 5 |
| V4 | Painel de consumo procura o plano pelo campo errado | Denominador sempre zero; o cliente nunca vê quanto tem | 5 |
| V5 | Bloqueio por suspensão não está aplicado a nenhuma procedure | 1 organização marcada como suspensa, sem efeito | 5 |
| V6 | Contador de gasto por membro nunca é zerado | Número do mês exibido com valor acumulado de sempre | 5 |

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

Hoje o ASTRO é **OpenAI-only e derruba o copiloto inteiro se faltar uma variável de ambiente**,
mesmo quando a organização tem chave de outro provider configurada. O `docs/ASTRO_PROGRESS.md`
afirma que o padrão é Anthropic — **o código contradiz o documento** (ver §8).

Proposta: uma camada única que escolhe o modelo por capacidade necessária (visão, ferramentas,
contexto longo), chave disponível (a da organização antes da nossa) e custo dentro do nível. Três
níveis expostos, vários providers por baixo. **O cliente nunca escolhe GPT, Gemini ou Claude.**

Já existe um bom exemplo disso no repositório — a escolha de modelo do financeiro, com cascata
ordenada por custo e fallback. O roteador nasce dali, não do zero.

Duas decisões deliberadas:

- **A classificação de complexidade atual é preservada.** É gratuita e funciona. Substituí-la por
  um classificador de IA adicionaria uma chamada para economizar uma chamada.
- **Fallback honesto.** Troca de provider quando falta chave ou o provider está fora. Falha no meio
  de uma resposta em streaming continua sendo erro visível — prometer o contrário seria promessa
  falsa, porque o erro surge depois de os cabeçalhos já terem sido enviados.

---

## 5. Roadmap

| Fase | Entrega | Status |
| --- | --- | --- |
| 0 | Desbloquear e inventariar | ✅ Concluída (inventário feito; drift pendente de ação do dev) |
| 1 | Catálogo único de preço, ponto único de cobrança | ⬜ |
| 2 | Registro de custo e instrumentação | ⬜ |
| 3 | Migrar os pontos que hoje escapam do catálogo | ⬜ |
| 4 | Roteador de IA | ⬜ |
| 5 | Correção dos vazamentos, cada um atrás de flag | ⬜ |
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
4. **Quantas regras por organização divergem do padrão.** São 3.241 linhas; se alguma foi editada à
   mão, promover essa tabela a camada de sobrescrita muda preço em silêncio.
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
| `ASTRO_PROGRESS.md` | Provider padrão é Anthropic | É OpenAI, e falha sem a chave dela |

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
