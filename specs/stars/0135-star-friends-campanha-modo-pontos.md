---
id: 0135
titulo: Campanha por cupom no modo pontos (sem sorteio) no STAR FRIENDS
dominio: stars
status: aprovada
autor: Weydson
criada: 2026-11-09
atualizada: 2026-11-09
branch: feature/W-star-friends-modo-pontos-20261109
pr:
peso: completa
---

# 0135 — Campanha por cupom no modo pontos (sem sorteio)

## 1. Contexto

A SEMPRE MIX (loja física do grupo DISTRIELO, Teresina) quer o programa de fidelidade **"Sempre +"**: o cliente compra no balcão, manda a foto do cupom fiscal pelo WhatsApp e junta ⭐ para trocar por prêmios. O STAR FRIENDS já está instalado na org, com o nome "Sempre +", **desligado**.

Hoje o STAR FRIENDS só credita ⭐ de pedido pago no catálogo do ÓRBITA e de proposta paga no Forge. Compra no balcão não pontua.

A campanha por cupom da [spec 0102](0102-star-friends-campanha-de-sorteio.md) já faz quase tudo o que o "Sempre +" precisa:
- lê o cupom por IA;
- barra cupom repetido e confere o CNPJ do emissor;
- guarda a sobra de valor para o próximo cupom;
- credita 1 ⭐ por número no extrato (fonte `CAMPAIGN_RECEIPT`);
- manda cupom ilegível para conferência manual.

Mas ela foi feita para **sorteio**, e o cliente recebe isso escrito:
- "Seus números da sorte 🎟️" e "os cupons passam por uma conferência antes do sorteio. Boa sorte!" (`campaign-handler.ts`, `review-receipt.ts`);
- o botão "Ver meus códigos" e a linha "Números da sorte" em "Ver meus pontos";
- no painel: "Valor por número da sorte", "Quantidade de prêmios" e o botão "Sortear" (`campaign-form.tsx`, `campaign-manager.tsx`).

Ligar a campanha como está para a SEMPRE MIX traria dois problemas:
1. **Confunde:** o cliente entra num programa de pontos e recebe mensagem de sorteio.
2. **Risco legal:** anunciar sorteio sem a autorização prévia exigida pela Lei 5.768/71 (SPA/Ministério da Fazenda). Programa de pontos trocados por prêmio, sem sorteio, não precisa dessa autorização.

**Pendência conhecida (0102, P-2):** a varredura (`sweep-duplicates.ts`) anula os números de um cupom repetido (`VOIDED`), mas **não estorna as ⭐** que eles renderam. No sorteio, o João manteve assim de propósito (0134, D-5), porque o número anulado não concorre e a fraude se resolve com "Anular cupom". No modo pontos, a ⭐ é o próprio prêmio: quem fraudar mantém as ⭐.

## 2. Objetivo

Uma empresa liga uma campanha por cupom no **modo pontos**. O cliente manda o cupom pelo WhatsApp e só vê ⭐ e prêmios, nunca número da sorte nem sorteio. No modo pontos, cupom anulado na varredura tem as ⭐ estornadas.

### Não-objetivos

- **Ponto no balcão sem foto** (PDV/NERP mandando a venda direto): é outro projeto. Este usa o cupom que já existe.
- **Cadastro dos prêmios da SEMPRE MIX:** depende do Carlos e usa a tela "Cartões e prêmios" que já existe.
- **Campanha de pontos e de sorteio ativas ao mesmo tempo na mesma empresa:** a regra de uma campanha ativa por vez continua (0102).
- **Trocar o modo de uma campanha que já tem cupom:** o modo fica fixo depois do primeiro cupom (D-2).
- **Mudar o fluxo de sorteio (0102 e 0134) para quem já usa** (Mercadinho Preço Baixo): o padrão continua sorteio.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `LoyaltyCampaign` ganha o modo: **sorteio** (padrão, comportamento de hoje) ou **pontos**. |
| RF-2 | No modo pontos, a conta é a mesma: `⭐ = floor((sobra + total do cupom) / valor por ⭐)`. O campo "valor por número" passa a se chamar "Valor por ⭐" na tela. |
| RF-3 | No modo pontos, a resposta ao cupom aceito diz quantas ⭐ ele rendeu, o saldo de ⭐ e quanto falta para a próxima. Sem código, sem 🎟️, sem "sorteio" nem "boa sorte". |
| RF-4 | No modo pontos, o menu do participante tem "Cadastrar novo cupom", "Ver meus pontos" e "Ver prêmios". "Ver meus códigos" não aparece; o clique antigo nele cai em "Ver meus pontos". |
| RF-5 | "Ver meus pontos" (modo pontos): compras cadastradas, saldo de ⭐, quanto falta para a próxima ⭐ e nível (Terra/Lua/Galaxy). Sem a linha "Números da sorte". |
| RF-6 | "Ver prêmios" lista os prêmios ativos do programa (nome e custo em ⭐) e diz que a troca é feita na loja. Sem prêmio cadastrado: "Os prêmios estão sendo preparados. Continue juntando suas ⭐!". |
| RF-7 | O aviso de conferência manual aprovada (`review-receipt.ts`) segue o modo: no modo pontos fala em ⭐. |
| RF-8 | No painel, no modo pontos, somem "Quantidade de prêmios", "Varredura antes de sortear" como condição e o botão "Sortear". A varredura continua disponível, como faxina de fraude. |
| RF-9 | O sorteio (`starFriends.campaign.drawNext`, spec 0134) recusa campanha no modo pontos. |
| RF-10 | **Estorno na varredura (só no modo pontos):** cada número anulado pela varredura gera o estorno de 1 ⭐ no extrato (`REVERSAL` negativo, fonte `CAMPAIGN_RECEIPT`; `sourceId` do cupom anulado, ou do próprio número quando só ele sai por excesso, para não colidir com um "Anular cupom" feito depois), na mesma transação que anula. Como no "Anular cupom" da spec 0134 (CB-6), o estorno entra mesmo que o saldo fique negativo; o resgate já feito não é desfeito. No sorteio, a varredura continua sem estornar (decisão D-5 da 0134). |
| RF-11 | O texto que puxa a campanha pela conversa (`ASKS_FOR_CAMPAIGN`) também reconhece, no modo pontos, "pontos", "fidelidade", "estrelas" e o nome do programa (ex.: "Sempre +"). |
| RF-12 | O resumo de regras padrão do formulário muda com o modo; no modo pontos: "A cada R$ X em compras você ganha 1 ⭐. Envie a foto do cupom por aqui. Cada cupom vale uma vez só. Junte ⭐ e troque por prêmios na loja." |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma mensagem do modo pontos contém "sorte", "sorteio", "sortear" ou "🎟️" (teste varre os textos). |
| RNF-2 | Campanha existente sem o campo novo se comporta como hoje: `mode` padrão `RAFFLE` na migration. |
| RNF-3 | O estorno do RF-10 é idempotente: rodar a varredura duas vezes não estorna duas vezes (`@@unique([source, sourceId, type])` do extrato). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma campanha no modo pontos com R$ 30 por ⭐, quando o cliente manda um cupom de R$ 75, então recebe "2 ⭐", o saldo e "faltam R$ 15,00 para a próxima ⭐", sem nenhum código.
- [ ] **CA-2** — Dado o modo pontos, quando o cliente pede "Ver meus pontos", então a resposta não tem a linha "Números da sorte" e mostra saldo e nível.
- [ ] **CA-3** — Dado o modo pontos, o menu do participante não tem "Ver meus códigos"; um clique antigo em "Ver meus códigos" responde como "Ver meus pontos".
- [ ] **CA-4** — Dado o modo pontos, quando o cliente toca em "Ver prêmios", então vê os prêmios ativos com custo em ⭐; sem prêmio, vê a mensagem do RF-6.
- [ ] **CA-5** — Dado o modo pontos, quando alguém chama o sorteio (`campaign.drawNext`), então recebe erro "Campanha de pontos não tem sorteio".
- [ ] **CA-6** — Dados dois cupons do mesmo CNPJ, dia e total aceitos para clientes diferentes, quando a varredura roda, então o mais novo tem os números anulados e o cliente perde as ⭐ correspondentes no extrato (`REVERSAL`); rodar de novo não estorna outra vez.
- [ ] **CA-7** — Dado que o cliente já trocou as ⭐ de um cupom depois anulado, quando a varredura roda no modo pontos, então o estorno entra e o saldo pode ficar negativo; o resgate feito não é desfeito. Numa campanha de sorteio, a varredura não estorna.
- [ ] **CA-8** — Dada a campanha de sorteio do Mercadinho Preço Baixo (criada antes desta mudança), quando o cliente manda um cupom, então tudo acontece como antes: números da sorte, sorteio e textos iguais.
- [ ] **CA-9** — Dado o modo pontos, nenhuma mensagem enviada ao cliente contém "sorte", "sorteio", "sortear" ou "🎟️" (RNF-1).
- [ ] **CA-10** — Dada uma campanha que já tem cupom, quando alguém tenta trocar o modo, então o servidor recusa.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Programa STAR FRIENDS desligado com campanha de pontos ativa | A campanha não pode ser ativada no modo pontos com o programa desligado (sem programa não há ⭐). O painel avisa. |
| CB-2 | Cupom de valor menor que o "valor por ⭐" | Não rende ⭐; a sobra é guardada e a resposta diz quanto falta (a regra de sobra da 0102). |
| CB-3 | Cupom de outro CNPJ (`issuerDocuments`) | Recusado como hoje. Para a SEMPRE MIX, só o CNPJ 01.034.311/0002-15. |
| CB-4 | Cupom em conferência manual | A resposta não promete ⭐; diz que o cupom está em conferência. As ⭐ só entram na aprovação (RF-7). |
| CB-5 | ⭐ vencidas (`starsExpireDays`) e depois cupom anulado | O estorno entra igual (RF-10); o saldo pode ficar negativo, como no "Anular cupom". |
| CB-6 | Cliente escreve "Quero participar do Sempre +" (texto pronto do Linnker) | Abre a campanha (RF-11): pede o nome, mostra as regras e pede o aceite. |
| CB-7 | Clique em "Ver meus códigos" de uma mensagem antiga | Cai em "Ver meus pontos" (RF-4). |
| CB-8 | Varredura em campanha de sorteio que já foi sorteada | Não muda: a 0102 já trava alteração depois do sorteio. |
| CB-9 | Duas varreduras simultâneas | A unicidade do extrato impede estorno em dobro (RNF-3). |

## 6. Decisões de design

### D-1 — Modo na própria campanha, não uma campanha nova

- **Escolha**: coluna `mode` (`RAFFLE` | `POINTS`) em `LoyaltyCampaign`, padrão `RAFFLE`. O modo pontos reaproveita leitura, bloqueio de repetido, sobra, conferência e extrato.
- **Alternativas descartadas**:
  - *Tabela nova para fidelidade por cupom*: duplicaria toda a 0102.
  - *Deduzir o modo de `prizeCount = 0`*: um número mágico, e `prizeCount` tem mínimo 1 por regra.
  - *Só mudar os textos da SEMPRE MIX*: seria um `if` por cliente, que a S3 do CLAUDE.md proíbe.
- **Consequência**: uma coluna de enum. Os números (`LoyaltyLuckyNumber`) continuam sendo gerados no modo pontos, porque a varredura usa cada número como unidade de anulação. Eles só não são mostrados.

### D-2 — Modo fixo depois do primeiro cupom

- **Escolha**: trocar o modo só enquanto a campanha não tem cupom.
- **Alternativa descartada**: livre a qualquer momento. Uma campanha de sorteio virar pontos no meio esconderia números da sorte já comunicados ao cliente.

### D-3 — Estorno na varredura só no modo pontos

- **Escolha**: no modo pontos, a varredura estorna as ⭐ dos números que anula, na mesma transação (só escritas de banco, Regra 18). Saldo negativo segue a regra do "Anular cupom" (0134, CB-6).
- **Alternativa descartada**: estornar nos dois modos. Em 06/11/2026 o João decidiu que, no sorteio, a varredura continua sem estornar (0134, D-5); a fraude no sorteio se resolve com "Anular cupom". No modo pontos, a ⭐ é o próprio prêmio, então a varredura precisa estornar.
- **Consequência**: a pendência P-2 da 0102 fica resolvida para o modo pontos; no sorteio continua aberta, por decisão.

## 7. Impacto

- [x] **Schema / migration:** enum `LoyaltyCampaignMode` e coluna `mode` em `loyalty_campaigns`, `NOT NULL DEFAULT 'RAFFLE'`. Aditiva.
- [x] **Procedures oRPC:**
  - `starFriends.campaign.upsert`: aceita `mode` e recusa a troca com cupom (CA-10).
  - `campaign.get`: devolve `mode`.
  - `campaign.drawNext`: recusa o modo pontos.
- [ ] Realtime.
- [ ] **Automações (Inngest):** nenhuma função nova. O estorno roda dentro da varredura, que já existe.
- [ ] Env vars.
- [ ] **Breaking change:** nenhum. O padrão é o comportamento atual.
- [x] **Documentação:** `docs/star-friends.md`, na seção da campanha e no changelog.

**Arquivos:**
- `prisma/schema.prisma` e a migration;
- `features/star-friends/utils/campaign-messages.ts` (novo: textos por modo, regras puras);
- `tracking-chat-ai/lib/campaign-replies.ts` (novo: respostas por modo, separadas do atendimento);
- `components/campaign-points-panel.tsx` (novo) e `campaign-live-draw.tsx` (bloqueio no modo pontos);
- `lib/campaign/{register-receipt,review-receipt,sweep-duplicates,draw}.ts`;
- `tracking-chat-ai/lib/campaign-handler.ts`;
- `components/{campaign-form,campaign-manager}.tsx`;
- `router/star-friends/campaign.ts`;
- `scripts/star-friends-campaign-check.ts` (casos novos com os ids de CA).

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3, CA-9 | automatizado | `scripts/star-friends-campaign-check.ts`: textos por modo (funções puras em `utils/campaign.ts`) e varredura de palavras proibidas |
| CA-6, CA-7 | automatizado | caso novo no script: varredura com cupom repetido gera `REVERSAL`, segunda varredura não duplica, saldo nunca negativo |
| CA-5, CA-10 | manual | painel e chamada oRPC em dev |
| CA-4, CB-6 | manual | conversa real num número de teste com a campanha de pontos ativa |
| CA-8 | manual | campanha de sorteio existente em dev: mandar cupom e conferir que os textos não mudaram |

## 9. Riscos e rollback

- **Migration:** aditiva, com padrão. Reverter o código deixa a coluna sem uso. Remover a coluna fica para outra migration, só se o modo for abandonado.
- **Regras da Meta (WhatsApp):**
  - as respostas são dentro da janela de 24 h aberta pelo cliente, como na 0102;
  - nada é enviado fora dela sem template aprovado;
  - nenhuma mensagem nova em massa.
- **Segurança de dados:** nada novo sai para o cliente. "Ver meus pontos" continua exigindo o número cadastrado igual ao de quem escreve (regra da 0102). Fotos de cupom seguem visíveis só para quem tem permissão "Ver" no app.
- **Dependências para a SEMPRE MIX usar:**
  - WhatsApp conectado à org (a API oficial depende do acesso Meta);
  - prêmios cadastrados pelo Carlos;
  - programa "Sempre +" ligado.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-09 | Weydson (Claude) | Criada a partir do pedido do "Sempre +" da SEMPRE MIX. |
| 2026-11-09 | Weydson | Aprovada para implementação. |
| 2026-11-09 | Weydson (Claude) | Renumerada de 0134 para 0135 (a 0134 é o sorteio ao vivo). Estorno na varredura restrito ao modo pontos e saldo negativo alinhado à 0134 (D-5 e CB-6 do João). Sorteio agora é `drawNext`. |
