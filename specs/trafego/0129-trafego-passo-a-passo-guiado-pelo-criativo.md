---
id: 0129
titulo: Passo a passo do /trafego guiado pelo criativo e pelos números da conta
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-10-31
atualizada: 2026-10-31
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0129 — Passo a passo do /trafego guiado pelo criativo e pelos números da conta

## 1. Contexto

O passo a passo do `/trafego` pergunta canal, tipo, objetivo, negócio, público, prazo e verba. Só depois, para
quem já é cliente, pede o criativo (spec 0126). Problemas vistos com clientes reais:

- **O cliente escolhe antes de saber.** Ele marca objetivo e público sem ter visto o próprio anúncio. Um cliente
  da Tércio marcou "Reconhecimento" para um vídeo que pede conversa no WhatsApp: o anúncio foi otimizado para
  alcance e quase não gerou conversa.
- **O cliente não sabe o que deixa o anúncio pior.** Texto longo demais antes do "Ver mais", pergunta sobre
  doença ("Você tem catarata?", que a Meta proíbe por política de atributos pessoais), público pequeno demais,
  verba que não paga nem uma conversa por dia. Ele só descobre depois, pela nota da spec 0128.
- **A conta já sabe o que funciona e ninguém usa isso na hora de criar.** A conta de anúncios do cliente tem o
  histórico de quais anúncios trouxeram conversa barata, para qual idade e com qual texto. Hoje esse dado só
  aparece no painel, depois que a campanha está no ar.
- **O cliente não escreve bem o que quer.** Pedir uma frase livre ("o que você quer anunciar?") não funciona:
  a resposta vem curta e vaga. O passo a passo com opções prontas é o formato certo; falta inteligência nele.

## 2. Objetivo

Para quem já é cliente e tem a conta da Meta conectada, o passo a passo **começa pelo criativo** (link do
post ou arquivo). O Astro olha o criativo **e os números da conta toda** e, a partir daí:

1. **Preenche** os passos seguintes com uma sugestão (objetivo, público, texto, título, verba), cada uma com
   um "por quê" de uma linha.
2. **Avisa em cada campo**, na hora, quando o cliente escolhe algo que baixa a qualidade do anúncio, com o que
   fazer no lugar.
3. **Barra** só o que a Meta reprova com certeza (política). O resto é aviso: a decisão é do cliente.

O formato continua o mesmo: telas com opções prontas, sem conversa livre.

### Não-objetivos

- **Publicar direto na Meta a partir do `/trafego`.** O passo a passo continua gerando o pedido; a campanha na
  Meta continua sendo montada no painel ("Publicar e editar", spec 0124). Juntar os dois é a fase 2 (ver §9).
- **Criar o anúncio pelo MCP da Meta.** O MCP (spec 0125) segue para leitura e para a equipe. Criar por ele
  passaria por fora das travas do Órbita (tudo nasce pausado, só WhatsApp, limite de anúncios, políticas).
- **Mudar o fluxo de quem ainda não é cliente.** Sem conta conectada não há números para ler; esse fluxo segue
  como hoje.
- **Gerar imagem ou vídeo por IA** (mesmo motivo da spec 0128).

## 3. Requisitos

### Funcionais

- **RF-1 — Criativo primeiro.** Para membro logado com `META_ADS` e conta Meta conectada (`canRead`), a tela
  "Criativo" vem logo depois do canal. Sem conta conectada, ela fica onde está hoje (depois de Prazo).
- **RF-2 — Pular é permitido.** "Enviar depois" segue existindo. Sem criativo, o Astro orienta só pelos números
  da conta, e os passos seguintes vêm sem pré-preenchimento do criativo.
- **RF-3 — Contexto da conta.** Antes da orientação, o servidor monta um resumo da conta dos últimos 90 dias:
  - média por anúncio (conversas, custo por conversa, CTR, CPC, CPM), no total e por objetivo (reaproveita
    `readAccountBenchmarks`);
  - os 5 anúncios com menor custo por conversa (com pelo menos 3 conversas), com texto, título e tipo de mídia;
  - as faixas de idade e o gênero com menor custo por conversa (quebra `age,gender`);
  - os objetivos usados e o custo por conversa de cada um;
  - os anúncios reprovados nos últimos 90 dias e o motivo, quando a Meta informa.
- **RF-4 — Orientação do Astro.** Uma chamada só, com os quadros do criativo e o resumo da RF-3, devolve:
  - a análise do criativo que já existe (spec 0126; não é cobrada duas vezes);
  - objetivo sugerido (entre os do `/trafego`) e o porquê;
  - público sugerido: faixa de idade, gênero e interesses, em chips (os mesmos do passo Negócio);
  - **duas opções** de texto e título, no tom dos anúncios que mais deram certo na conta;
  - verba diária sugerida, em faixa (mínima e recomendada), calculada pelo custo por conversa da conta;
  - até 3 alertas sobre o criativo, cada um com o que fazer.
- **RF-5 — Sugestão marcada, nunca escondida.** Campo preenchido pelo Astro mostra o selo "Sugerido pelo Astro" e
  o porquê em uma linha. O cliente troca à vontade; ao trocar, o selo some.
- **RF-6 — Avisos por campo, na hora.** Regras fixas, sem IA a cada tecla (lib pura,
  `lib/wizard-guardrails.ts`), cada uma com nível (`ok`, `atenção`, `bloqueado`) e frase de correção:
  - texto com mais de 125 caracteres antes do "Ver mais": atenção;
  - texto que o pré-filtro de políticas (`lib/ad-policies`) marca: atenção ou bloqueado, como hoje;
  - pergunta ou afirmação sobre condição pessoal ("você tem…", "para quem sofre de…"): atenção, com a frase
    reescrita na terceira pessoa;
  - objetivo diferente de mensagens com destino WhatsApp: atenção ("este criativo pede conversa");
  - verba diária menor que o custo por conversa médio da conta: atenção ("pode não trazer nenhuma conversa por
    dia"); menor que o mínimo da Meta para a moeda: bloqueado;
  - público com faixa de idade menor que 10 anos, ou com mais de 6 interesses somados: atenção (público estreito
    sobe o custo);
  - criativo com nota do Astro abaixo de 50 ou veredito "risk": atenção no passo de revisão.
- **RF-7 — Resumo antes de pagar.** A tela de investimento mostra os avisos que ficaram abertos, em lista, com
  "Corrigir" levando ao passo do campo. Aviso aberto não impede de seguir; bloqueado impede.
- **RF-8 — A orientação vai para o pedido.** O que o Astro sugeriu e o que o cliente escolheu vão no briefing do
  pedido (no rascunho do criativo, como já acontece com o texto). A equipe vê no admin e o "Publicar e editar"
  usa como valor inicial.

### Não-funcionais

- **RNF-1 — Tempo.** A orientação sai em até ~15 s. Enquanto isso, o cliente pode seguir: os campos são
  preenchidos quando a resposta chega, só se ele ainda não tiver mexido neles.
- **RNF-2 — Custo.** A orientação custa as mesmas 5 Stars da análise do criativo, que ela substitui. O resumo da
  conta usa o cache de 15 min que já existe e não cobra Stars.
- **RNF-3 — Sem estado novo no servidor.** Sem tabela nova, sem cron e sem função Inngest.

## 4. Critérios de aceite

- **CA-1** — Membro com Meta conectada que abre `/trafego?nova=1` e escolhe Meta Ads vê a tela Criativo como
  segunda tela.
- **CA-2** — Membro sem Meta conectada vê a mesma ordem de hoje.
- **CA-3** — Depois de enviar um vídeo, os passos de objetivo, público, texto e verba vêm preenchidos, cada um
  com o selo "Sugerido pelo Astro" e o porquê.
- **CA-4** — Campo que o cliente já mexeu não é sobrescrito quando a orientação chega depois.
- **CA-5** — O texto "Você tem catarata? Agende sua cirurgia" mostra atenção com a versão em terceira pessoa.
- **CA-6** — Verba diária de R$ 5 numa conta com custo por conversa médio de R$ 8 mostra atenção com o valor
  mínimo sugerido.
- **CA-7** — Objetivo "Reconhecimento" com canal WhatsApp mostra atenção.
- **CA-8** — Política bloqueada impede de seguir; atenção não impede.
- **CA-9** — A tela de investimento lista os avisos abertos, e "Corrigir" leva ao passo certo.
- **CA-10** — Conta sem nenhum anúncio com gasto: a orientação vem só do criativo, com o aviso "sua conta ainda
  não tem histórico", e a verba sugerida usa a faixa padrão do `/trafego`.
- **CA-11** — Usuário de outra organização não consegue pedir orientação com a conta de anúncios de uma org que
  não é a dele.
- **CA-12** — Sem saldo de Stars, o criativo segue sem orientação e o passo a passo funciona como hoje.

## 5. Casos de borda

- **CB-1 — Token expirado ou sem permissão.** O resumo da conta falha: a orientação segue só com o criativo e
  diz "não consegui ler sua conta agora". Nada trava.
- **CB-2 — Conta grande.** Mais de 500 anúncios no período: o resumo usa as páginas que couberem no limite já
  usado (5 páginas) e diz que é uma amostra.
- **CB-3 — Vídeo que o navegador não decodifica.** Segue a regra da spec 0126: só o técnico, sem IA e sem
  Stars; a orientação usa só os números da conta.
- **CB-4 — Cliente volta e troca o criativo.** Nova orientação; campos que ele já mexeu ficam como estão.
- **CB-5 — Interesse sugerido que não existe na Meta.** Os interesses são chips do passo Negócio, em texto
  livre, e só viram segmentação de verdade no "Publicar e editar", que já busca o interesse na Meta. Nesta spec
  nada sobe para a Meta.
- **CB-6 — Moeda diferente de BRL.** O mínimo da Meta vem de `min_daily_budget` da conta, já lido no "Testar
  conexão"; sem ele, usa o mínimo do `/trafego`.

## 6. Decisões de design

### D-1 — O passo a passo continua sendo o formato

O cliente não escreve bem o que quer; ele reconhece a opção certa quando ela aparece. Opções prontas,
pré-marcadas pelo Astro, dão o melhor dos dois.

### D-2 — Avisos por regra fixa, IA uma vez só

A IA roda uma vez, quando o criativo chega. Os avisos por campo são regras puras: mesma entrada, mesmo aviso, sem
custo por tecla e testáveis no script de QA.

### D-3 — Resumo da conta pronto no servidor, não leitura livre pela IA

O servidor monta o resumo com o que já lê (insights, cache de 15 min) e manda para a IA em texto. A IA não chama
a Meta. Isso mantém o custo previsível e o dado limitado à conta da org de quem pede.

### D-4 — Avisar, não proibir

Só a política reprovada e a verba abaixo do mínimo da Meta barram. Todo o resto é conselho: quem paga decide.

## 7. Impacto

- **Schema:** nenhum. O que o Astro sugeriu vai no `creativeDraft` do briefing (Json de rascunho que já existe),
  ganhando `guidance` (sugestões e avisos aceitos).
- **Procedures:** `trafego.creativeReview.analyze` ganha o modo "orientação" (recebe o contexto do passo a
  passo e devolve a RF-4). Nenhuma procedure nova.
- **Libs novas:** `server/lib/account-context.ts` (resumo da RF-3) e `lib/wizard-guardrails.ts` (RF-6).
- **Telas:** `trafego-landing.tsx` (ordem das telas e pré-preenchimento), `creative-step.tsx`, passos de
  objetivo, negócio e investimento (avisos e selo).
- **Inngest:** nenhuma função nova.
- **Docs:** `docs/trafego-overview.md` e o guia do Astro do trafeGO (regra 21).

### Segurança de dados

- O resumo da conta só é montado com a integração Meta da **org do usuário logado**; o id da conta nunca vem do
  navegador.
- O que vai para a IA: números agregados e os textos dos anúncios da própria conta. Nenhum dado de lead.
- A chave do cache leva a org e a conta, como hoje.

### Regras da Meta

- Política de atributos pessoais (saúde, finanças, religião etc.): o texto não pode afirmar ou perguntar sobre
  condição da pessoa. É a regra mais comum de reprovação em clínicas e entra no RF-6.
- Mínimo de verba por moeda vem da própria conta (`min_daily_budget`).
- Nada é publicado nesta spec; a publicação segue com as travas da spec 0124.

## 8. Plano de testes

- `scripts/trafego-0129-qa-check.ts`: um caso por regra do RF-6, citando CA-5 a CA-8.
- Leitura real do resumo da conta Tércio (DEMO) por script só de leitura, conferindo com o Gerenciador.
- No navegador, logado como membro: CA-1, CA-3, CA-4 e CA-9.

## 9. Riscos e rollback

- **Sugestão ruim do Astro.** Mitigação: tudo é editável, com porquê visível, e os avisos fixos pegam o erro
  grave mesmo quando a sugestão erra.
- **Orientação lenta.** Mitigação: RNF-1, o cliente não espera.
- **Rollback:** a ordem das telas volta à de hoje removendo a condição da RF-1; os avisos são só leitura.
- **Fase 2 (fora desta spec):** o passo a passo do `/trafego` publicar direto na Meta, absorvendo o "Publicar e
  editar" para quem já tem conta conectada.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-31 | Weydson Lima (com Claude) | Criação. |
| 2026-10-31 | Weydson Lima (com Claude) | Aprovada e implementada. Divergências: (1) procedure nova `trafego.creativeReview.accountSummary` (só os números para verba e avisos, sem IA nem Stars), porque o cliente pode pular o criativo e a verba ainda precisa da conta; (2) a verba sugerida é regra fixa (`suggestBudget`: mínima = 1 conversa/dia, recomendada = 3), não sai da IA, e entra ao chegar no passo Investimento; (3) melhores anúncios exigem 5 conversas (3 dava ruído); (4) a regra de "mais de 6 interesses" saiu: na Meta interesses somam público, não estreitam; (5) com a Meta conectada, as telas de conta e perfil saem do caminho (já são conhecidas); (6) os textos dos anúncios vêm por filtro de id na lista de anúncios, porque a Meta descontinuou o parâmetro `ids`. |
| 2026-10-31 | Weydson Lima (com Claude) | Logado: o passo Contato some (nome e e-mail vêm da conta) e, se a conta não tiver telefone, só o WhatsApp é pedido na tela de Investimento (`wizard/account-phone-field.tsx`); o bloco "Usaremos os dados da sua conta" saiu. Prazo não pergunta "criativos e textos prontos?" quando o criativo e o texto vieram no passo Criativo. |
