---
id: 0023
titulo: Roteamento do Astro por intenção, com a proposta comercial como piloto
dominio: astro
status: rascunho
autor: Weydson
criada: 2026-09-24
atualizada: 2026-09-24
branch: feature/W-forge-simulador-custos-20260923
pr:
peso: completa
---

# 0023 — Roteamento do Astro por intenção, com a proposta comercial como piloto

## 1. Contexto

Hoje o Astro tem **dois cérebros que não se conversam**.

O modo **Conversa** (`/api/astro/chat`) manda toda pergunta para o orquestrador
completo: 91 ferramentas, ~92 KB de corpo no pedido à OpenAI. Medido nesta
sessão, em 2026-09-24, com a org GOTHAN CITY:

```
[ASTRO/chat] stream finish (aborted=false, n=1, tokens=18507)
Cobrança App · −19★ · saldo 4.981 · "Astro IA — 18.507 tokens"
```

Dezenove estrelas para responder **"responda apenas OK"**. O preço não vem da
pergunta, vem do tamanho do prompt: as 91 definições de ferramenta entram em
todo turno, independente de o pedido precisar de uma ou de nenhuma.

O modo **Comando** (`src/app/router/nasa-command/execute.ts`, 2.413 linhas)
resolve sem IA, por regex e normalização fonética — o arquivo tem tratamento
manual para `agendmentu`, `propposta`, `reuniãu`. Custa de 1★ a 8★ e só chama
IA no fallback, quando nenhum padrão casa.

A divisão atual não segue a complexidade do pedido; segue **em qual aba o
usuário digitou**. E os dois caminhos têm coberturas diferentes:

| Ação | Conversa (LLM) | Comando (regex) |
| --- | --- | --- |
| Criar proposta comercial | **não existe ferramenta** | sim, `execute.ts:332` |
| Ler proposta / gráfico / busca | sim | parcial |
| Entender frase não prevista | sim | não |

Ou seja: pedir "cria uma proposta para a Maria" na Conversa gasta 19★ e o Astro
não consegue; no Comando ele consegue, mas só se a frase casar com o padrão.

E quando consegue, devolve `url: "/forge?tab=proposals&id=..."` — link interno,
que o cliente final não abre. O link público já existe no schema
(`ForgeProposal.publicToken`, único, com default `cuid()`) e a rota pública
`/(public)/proposta/[token]` já está no ar. Ninguém liga os dois.

## 2. Objetivo

O Astro passa a escolher o caminho pela **intenção do pedido**, não pela aba: um
classificador barato resolve o que é ação direta, e o orquestrador completo fica
para o que exige dado múltiplo e pesquisa. Como piloto, criar uma proposta
comercial e devolver o link público funciona nos dois modos.

### Não-objetivos

- **Não** reescrever o orquestrador. Ele continua sendo o caminho de pedidos
  complexos, com as mesmas 91 ferramentas.
- **Não** remover a aba Comando nem o executor por regex. Ele segue como
  atalho de custo zero para as frases que já cobre; o classificador entra
  **depois** dele, antes do orquestrador.
- **Não** migrar as outras ações do executor neste PR. O piloto é a proposta.
- **Não** mexer em preço de Stars nem no catálogo. A economia aparece sozinha
  por gastar menos token.
- **Não** criar modelo, schema ou migration novos — tudo que o piloto precisa
  já existe no banco.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Existe um **registro único de ações** (`src/features/astro/actions/`), onde cada ação declara: chave, schema Zod dos campos, se exige confirmação, e o executor. |
| RF-2 | Toda ação do registro é exposta **nos dois caminhos**: como ferramenta do orquestrador e como alvo do classificador. Uma ação nova aparece nos dois sem código duplicado. |
| RF-3 | Antes de chamar o orquestrador, `/api/astro/chat` roda um **classificador de intenção** no nível FAST que devolve `{ action, fields, confidence }` ou `null`. |
| RF-4 | Com `confidence >= LIMIAR` e campos obrigatórios presentes, a ação executa **sem** o orquestrador. O usuário recebe a mesma resposta em cartão de sempre. |
| RF-5 | Com `confidence < LIMIAR`, campo faltando, ou `action = null`, cai no orquestrador completo — comportamento de hoje, sem regressão. |
| RF-6 | Ação `forge.create_proposal` no registro: cria `ForgeProposal`, resolve cliente e produto por nome, e devolve **o link público** `/(public)/proposta/[token]`. |
| RF-7 | O executor por regex (`execute.ts`) passa a chamar `forge.create_proposal` do registro em vez da sua própria cópia, e devolve o mesmo link público. |
| RF-8 | Criar proposta exige confirmação antes de gravar, pelo fluxo de `astro_confirmation` já existente (spec 0014). |
| RF-9 | O cartão de resposta traz o link público copiável e o link interno do Forge, rotulados. |
| RF-10 | A fala capturada pelo orb entra **no mesmo roteador** que o texto digitado — regex, classificador, orquestrador, nessa ordem. Não existe caminho de voz separado. |
| RF-11 | Ação que devolve `needs_input` pergunta o campo que falta por TTS e reabre a escuta, sem o usuário digitar. O ciclo repete até os campos obrigatórios estarem completos ou o usuário desistir. |
| RF-12 | A confirmação de escrita (RF-8) aceita "sim" / "confirma" / "pode criar" por voz, e "não" / "cancela" cancela. Qualquer outra resposta repete a pergunta uma vez e depois cancela. |
| RF-13 | Concluída a ação, o Astro lê em voz alta um resumo curto e **não** lê a URL caractere a caractere: fala "o link está no cartão" e o cartão mostra o link copiável. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Pedido resolvido pelo classificador consome **< 1.000 tokens** no total (hoje: 18.507 para qualquer pergunta). |
| RNF-2 | O classificador responde em < 1,5 s no p95; acima disso, cai para o orquestrador em vez de fazer o usuário esperar as duas etapas. |
| RNF-3 | Falha do classificador (timeout, erro do provedor, JSON inválido) **nunca** vira erro para o usuário: cai para o orquestrador. |
| RNF-4 | O registro de custo (`UsageEvent`, spec 0021) grava qual caminho atendeu, em `metadata.route` = `classifier` \| `orchestrator` \| `regex`. |
| RNF-5 | Voz **não** adiciona custo de IA: STT e TTS continuam sendo Web Speech API e Piper, nenhum dos dois passa por LLM. Um ciclo guiado inteiro resolvido por verbo consome **0 token**. |
| RNF-6 | O ciclo guiado por voz não fica escutando indefinidamente: cada turno respeita o `CAPTURE_TIMEOUT_MS` já usado hoje (8 s), e o microfone fecha ao fim da ação. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado "cria uma proposta para a Maria do produto Plano Básico", quando enviado na Conversa, então o Astro pede confirmação e, no "sim", cria a proposta e devolve o link público — sem chamar o orquestrador.
- [ ] **CA-2** — Dado o mesmo pedido, quando resolvido pelo classificador, então o `UsageEvent` do turno registra `totalTokens < 1000` e `metadata.route = "classifier"`.
- [ ] **CA-3** — Dado "compare o faturamento dos últimos 3 meses por produto e diga onde caímos", então o classificador devolve `null` e o orquestrador atende, como hoje.
- [ ] **CA-4** — Dado que o provedor de IA falha na etapa de classificação, então o pedido é atendido pelo orquestrador e o usuário não vê erro.
- [ ] **CA-5** — Dado "cria uma proposta", sem cliente, então o Astro pergunta o cliente em vez de criar com campo vazio.
- [ ] **CA-6** — Dada a proposta criada por qualquer um dos três caminhos, quando aberto o link público em aba anônima, então a proposta renderiza.
- [ ] **CA-7** — Dado o mesmo comando na aba Comando, então o resultado e o link são idênticos aos da Conversa.
- [ ] **CA-8** — Dada uma ação nova adicionada ao registro, então ela aparece nos dois caminhos sem edição em `execute.ts` nem no catálogo de ferramentas.
- [ ] **CA-9** — Dado o usuário falando "crie uma proposta para a Maria", quando o ciclo termina no "sim" falado, então a proposta é criada **sem nenhuma digitação** e o `UsageEvent` do ciclo inteiro registra `totalTokens = 0`.
- [ ] **CA-10** — Dado "crie uma proposta" falado sem cliente, então o Astro pergunta o cliente por voz, reabre a escuta e completa a ação com a resposta falada.
- [ ] **CA-11** — Dada a pergunta de confirmação, quando o usuário responde algo que não é sim nem não, então o Astro repete a pergunta uma vez e, na segunda resposta inválida, cancela sem gravar.
- [ ] **CA-12** — Dada a mesma frase digitada e falada, então o caminho escolhido e o resultado são idênticos — a origem da entrada não muda o roteamento.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Classificador com alta confiança na ação errada | Confirmação antes de gravar (RF-8) é a rede. O usuário vê o que vai ser criado e cancela. |
| CB-2 | Dois clientes com o mesmo nome | Não escolhe por conta própria: devolve a lista e pergunta qual. |
| CB-3 | Cliente não existe | Pergunta se cria o contato junto. Não cria em silêncio. |
| CB-4 | Pedido misto — "cria a proposta e me diz como fechamos o mês" | Confiança baixa por ter duas intenções: cai no orquestrador, que sabe encadear. |
| CB-5 | Saldo de Stars insuficiente | Mesmo tratamento de hoje: 402 antes de chamar qualquer IA. |
| CB-6 | Classificador devolve JSON malformado | Tratado como `null` (RNF-3), sem log de payload do usuário. |
| CB-7 | Confirmação expira (TTL de 30 min no chat) | Proposta não é criada; o Astro avisa que o pedido expirou. |
| CB-8 | Usuário sem permissão no Forge | Barrado no executor da ação, não no classificador — a permissão é do domínio. |
| CB-9 | `publicToken` de proposta cancelada | A rota pública decide; esta spec não muda esse comportamento. |
| CB-10 | Org com chave de IA própria (BYO) | O classificador usa a mesma resolução de chave do orquestrador (roteador da Fase 4, PR #400). |
| CB-11 | STT transcreve errado o nome do cliente ("Maria" → "Mariah") | A busca por nome já é difusa e devolve candidatos; com mais de um, pergunta qual (CB-2). A confirmação mostra o nome resolvido, não o transcrito. |
| CB-12 | Ruído dispara a escuta e transcreve frase sem sentido | Classificador devolve `null` → cairia no orquestrador e gastaria 19★ por um ruído. **Por isso** entrada de voz com confiança baixa pede confirmação falada em vez de escalar sozinha. |
| CB-13 | Usuário fala durante a resposta do TTS | A pausa da wake word durante o TTS já existe hoje e é mantida: o Astro não captura a própria voz. |
| CB-14 | Safari / iOS | A Web Speech API é instável ali, com desconexões frequentes — limitação já documentada em `use-wake-word.ts`. A voz degrada para o campo de texto; o roteamento não muda. |
| CB-15 | Microfone negado ou indisponível | Fluxo atual do `mic-permission-guide` é mantido. Nada da ação é perdido: o que já foi coletado vira o formulário do `needs_input`. |
| CB-16 | Usuário abandona o ciclo no meio | Timeout de captura fecha o microfone e a ação é descartada sem gravar. Nada de pendência em aberto. |

## 6. Decisões de design

### D-1 — Classificador barato antes do orquestrador, não regex ampliado

- **Escolha**: uma chamada curta no nível FAST que só escolhe a ação e extrai
  campos. A execução é código determinístico, sem ferramentas no prompt.
- **Alternativas descartadas**:
  - *Ampliar o executor por regex para cobrir todas as ações* — custo zero de
    IA, mas só entende frase prevista. As 2.413 linhas atuais, com variantes
    fonéticas escritas à mão, são a prova do custo de manutenção desse caminho.
  - *Deixar o orquestrador decidir* — ele já gastou o turno quando decide.
- **Consequência**: "sem IA" vira "**sem orquestrador**". O pedido simples ainda
  passa por um modelo, mas por um prompt de centenas de tokens em vez de 92 KB.

### D-2 — Registro único de ações, consumido pelos três caminhos

- **Escolha**: a ação é declarada uma vez e exposta como ferramenta do
  orquestrador, alvo do classificador e destino do regex.
- **Alternativas descartadas**: *manter as implementações separadas* — é o que
  produziu o estado de hoje, em que criar proposta existe num caminho e não no
  outro, e o link sai errado só num deles.
- **Consequência**: ação nova entra em um lugar só (CA-8). O executor por regex
  perde a cópia própria de criação de proposta.

### D-3 — O link devolvido é o público

- **Escolha**: `/(public)/proposta/[token]`, usando o `publicToken` que o
  modelo já gera sozinho. O link interno do Forge vai junto, rotulado.
- **Alternativas descartadas**: *só o link interno* — é o comportamento atual e
  não serve para o que o pedido pede, que é mandar para o cliente.
- **Consequência**: quem receber o link abre a proposta sem login. Isso já é
  verdade para toda proposta hoje; a mudança é o Astro passar a entregar o link
  certo.

### D-4 — Confirmação continua obrigatória para escrita

- **Escolha**: reusar `astro_confirmation` da spec 0014.
- **Alternativas descartadas**: *criar direto quando a confiança for alta* —
  trocaria a rede de proteção por um número que o modelo estima sobre si mesmo.
- **Consequência**: um passo a mais no caminho feliz, e é ele que torna CB-1
  aceitável.

### D-5 — Voz é uma entrada a mais no mesmo roteador, não um caminho próprio

- **Escolha**: o orb continua só capturando a fala; a string transcrita entra
  exatamente onde entra o texto digitado. Regex → classificador → orquestrador.
- **Alternativas descartadas**:
  - *Um interpretador de voz separado* — seriam duas gramáticas para manter, e
    a divergência entre elas viraria "funciona falando, não funciona digitando".
  - *Mandar toda fala direto ao orquestrador*, que é o comportamento de hoje —
    é o pior par possível: a voz convida a pedidos curtos e frequentes, que são
    justamente os que não precisam de orquestrador e custam 19★ cada.
- **Consequência**: a voz herda de graça toda ação nova do registro. E o
  argumento de custo fica mais forte do que no texto: um ciclo falado inteiro
  resolvido por verbo custa **zero token**, porque STT e TTS não passam por LLM.

### D-6 — Entrada por voz com baixa confiança confirma, não escala

- **Escolha**: quando a fala não casa com verbo nem atinge o limiar do
  classificador, o Astro pergunta o que entendeu em vez de mandar para o
  orquestrador.
- **Alternativas descartadas**: *escalar como no texto* — texto é deliberado,
  fala pega ruído de sala. Escalar ruído custa 19★ por acidente (CB-12).
- **Consequência**: um turno a mais no caso ambíguo, e o usuário sabe o que o
  Astro ouviu antes de qualquer coisa acontecer.

## 7. Impacto

- [ ] Schema / migration — **nada**. `publicToken` e a rota pública já existem.
- [x] Procedures oRPC — `nasa-command/execute` muda o `url` que devolve para proposta.
- [ ] Realtime
- [ ] Automações (Inngest)
- [ ] Env vars novas — o limiar de confiança fica em constante versionada, não em env.
- [x] Breaking change — o `url` de proposta no Comando deixa de ser o interno. Quem consumia aquele formato precisa saber.
- [x] Documentação obrigatória — atualizar `docs/BILLING_ARCHITECTURE.md` (caminho novo no registro de custo) e este arquivo.

## 8. Plano de testes

> Regra 20: não há runner instalado. Até haver, o aceite é **declarado** e
> verificado por script repetível, como fizeram as specs 0020 e 0021.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-5, CA-7 | manual | Enviar os pedidos nos dois modos e conferir cartão, confirmação e link |
| CA-2 | script | `scripts/verify-astro-routing.ts` — lê o `UsageEvent` do turno e checa `totalTokens` e `metadata.route` |
| CA-3, CA-4 | script | Mesmo script, forçando `null` e erro no classificador |
| CA-6 | manual | Abrir o link em aba anônima |
| CA-8 | script | Registrar ação de teste e afirmar que aparece nas duas superfícies |
| CA-9, CA-10, CA-11 | manual | Ciclo falado do início ao fim, em Chrome, com o microfone real |
| CA-9 (custo) | script | Mesmo `verify-astro-routing.ts`: afirmar `totalTokens = 0` no ciclo resolvido por verbo |
| CA-12 | manual | Mesma frase digitada e falada; comparar `metadata.route` dos dois |

## 9. Riscos e rollback

**Risco principal — o classificador acertar a ação errada com confiança alta.**
Mitigado por D-4: nada é gravado sem confirmação do usuário. O pior caso é um
cartão de confirmação errado, que se cancela.

**Risco de custo invertido.** Pedido complexo passa a pagar classificação *e*
orquestração. Pelos números de hoje isso adiciona ~0,2★ sobre 19★ — ~1%. Aceito,
mas medir em produção antes de espalhar para outras ações.

**Risco de voz — ruído virando ação.** Mitigado em duas camadas: confirmação
falada antes de qualquer escrita (D-4) e não-escalonamento de fala ambígua
(D-6). O pior caso é o Astro perguntar algo que ninguém pediu.

**Dependência de navegador.** A Web Speech API é instável em Safari e iOS, o que
já está documentado em `use-wake-word.ts`. A voz é um atalho, nunca o único
caminho: tudo que se faz falando se faz digitando (CB-14).

**Rollback**: constante `ASTRO_INTENT_ROUTING` desligada faz todo pedido ir
direto ao orquestrador, que é o comportamento atual. Sem migration, sem dado
reescrito — nada a desfazer no banco. O registro de ações e o link público
podem ficar, porque são aditivos.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | Criada |
| 2026-09-24 | Weydson | Entrada por voz: RF-10 a RF-13, RNF-5/6, CA-9 a CA-12, CB-11 a CB-16, D-5 e D-6 |
