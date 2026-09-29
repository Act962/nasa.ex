---
id: 0041
titulo: Níveis Terra/Lua/Galaxy, "comprou X, ganhou Y" e área do cliente do STAR FRIENDS
dominio: stars
status: aprovada
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: completa
---

# 0041 — Níveis, cartões de compra e área do cliente do STAR FRIENDS

## 1. Contexto

O STAR FRIENDS (PR 415) dá stars por compra paga e deixa o cliente trocar por prêmios na página do pedido (`/pedido/<token>`). Essa página é um painel simples (andamento, itens, chat) e o programa não tem progressão: o cliente não vê para onde está indo nem por que voltar a comprar. O dono pediu, com leiaute aprovado em 2026-09-29:

- níveis de cliente **Terra** (fase 1), **Lua** (fase 2) e **Galaxy** (fase 3, premium);
- regra "comprou X, ganhou Y": cada compra paga vale 1 ⭐; completou X, troca pelo prêmio Y;
- a página do pedido com cara de app: rodapé Ofertas, Catálogo, Home, Chat, Mais;
- a jornada espacial do Disparo em Massa mostrando a subida de nível;
- tudo configurável em `/star-friends`.

## 2. Objetivo

O cliente do catálogo acompanha, na página do pedido, o nível, as ⭐ e os cartões de prêmio, e a loja configura níveis e regras em `/star-friends`.

### Não-objetivos

- Editar dados do cliente pelo portal (nome, endereço, preferência de avisos): o "Mais" mostra, não edita.
- Promoções da loja vindas do NERP dentro do portal: "Ofertas" lista prêmios e leva ao catálogo.
- Vantagem automática por nível (ex.: frete grátis aplicado no checkout): o nível libera prêmios; benefício de preço fica para outra spec.
- Rebaixar nível ou expirar nível.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Níveis fixos Terra, Lua e Galaxy. A loja configura quantas ⭐ da vida toda liberam Lua e Galaxy (padrão 10 e 30) e um texto de vantagens por nível. |
| RF-2 | "⭐ da vida toda" = soma dos lançamentos EARN, ADJUST_CREDIT e ADJUST_DEBIT. Trocas (REDEEM), estornos (REVERSAL) e expiração (EXPIRE) não contam. |
| RF-3 | Cada prêmio tem um nível mínimo (Terra, Lua ou Galaxy). Abaixo do nível, o prêmio aparece bloqueado no portal e o servidor recusa o resgate. |
| RF-4 | "Comprou X, ganhou Y" é um prêmio com custo X ⭐ exibido como cartão de carimbos (X casas, ⭐ preenchidas até o saldo). Programas novos nascem com 1 ⭐ por compra. |
| RF-5 | `/star-friends` ganha a aba "Níveis e regras": limites e vantagens dos níveis e a lista de regras (prêmio, X compras, nível mínimo). |
| RF-6 | `/pedido/<token>` vira área do cliente com rodapé Ofertas, Catálogo, Home, Chat, Mais. Catálogo abre `catalogUrl` do pedido. |
| RF-7 | Home: card do nível (⭐ da vida toda, próximo nível, barra), pedido atual (andamento, pagamento), cartões de carimbo e atalho para a jornada. |
| RF-8 | Jornada: componente `SpaceJourney` com Terra → Lua → Galaxy; o foguete fica na parada correspondente às ⭐ da vida toda e o chip mostra as ⭐ reais. |
| RF-9 | Mais: Como funciona (com os limites dos níveis), Meus pedidos (pedidos do mesmo cliente com link), Histórico de ⭐, Minhas trocas, Meus dados (leitura), Regulamento e Ajuda. |
| RF-10 | Detalhes do lead (card STAR FRIENDS) mostram o nível do cliente. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nível calculado na leitura, a partir do extrato: nenhum campo acumulado que possa divergir. |
| RNF-2 | Portal usável em celular (largura 360px) sem rolagem horizontal. |
| RNF-3 | Migration só aditiva (colunas com default e enum novo). |

## 4. Critérios de aceite

- [ ] **CA-1** — Cliente com 3 ⭐ da vida toda e limites 10/30 aparece como Terra, "3 de 10".
- [ ] **CA-2** — Cliente que trocou 5 ⭐ continua no mesmo nível (a troca não reduz as ⭐ da vida toda).
- [ ] **CA-3** — Prêmio com nível mínimo Lua aparece bloqueado para cliente Terra, e o resgate pelo portal devolve erro.
- [ ] **CA-4** — Prêmio de 5 ⭐ aparece como cartão de 5 casas com as ⭐ do saldo preenchidas.
- [ ] **CA-5** — Salvar limites com Galaxy ≤ Lua é recusado.
- [ ] **CA-6** — O rodapé do portal troca de tela sem recarregar a página, e Catálogo abre a loja do NERP.
- [ ] **CA-7** — Meus pedidos lista os outros pedidos do mesmo cliente na mesma loja, com link para cada um.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Programa não instalado ou pausado | Portal esconde nível e prêmios; pedido e chat continuam. |
| CB-2 | Lead sem telefone (sem membro) | 0 ⭐, Terra; prêmios aparecem, resgate desabilitado. |
| CB-3 | Loja muda limites depois que clientes já subiram | Nível recalculado na leitura com os novos limites (pode subir ou descer). |
| CB-4 | Retirada manual (ADJUST_DEBIT) | Reduz as ⭐ da vida toda: é correção de lançamento errado. |
| CB-5 | Pedido sem `catalogUrl` | Botão Catálogo desabilitado. |
| CB-6 | Prêmio sem estoque | Cartão mostra "Esgotado", resgate desabilitado. |

## 6. Decisões de design

### D-1 — Nível pelas ⭐ da vida toda, não pelo saldo

Nível por saldo puniria quem troca prêmios. Pelas ⭐ ganhas, trocar nunca rebaixa. Descartado: número de compras (não reflete lançamentos manuais) e valor em R$ (o dono escolheu ⭐).

### D-2 — "Comprou X, ganhou Y" é prêmio, não tabela nova

Com 1 ⭐ por compra, "X compras" é exatamente "X ⭐". Reaproveita resgate, aprovação, estoque, aviso ao cliente e auditoria já existentes. Descartado: modelo de cartão com contador próprio, que duplicaria o extrato.

### D-3 — Níveis fixos em colunas do programa

Três níveis nomeados (Terra/Lua/Galaxy) com limites em `LoyaltyProgram`. Descartado: tabela de níveis dinâmica, que não foi pedida e complica a jornada espacial.

### D-4 — Área do cliente numa rota só, com abas no cliente

O rodapé troca a tela por estado local, sem novas rotas públicas: o token do pedido continua sendo a única autorização.

## 7. Modelo de dados

- `enum LoyaltyTier { EARTH MOON GALAXY }`.
- `LoyaltyProgram`: `moonMinStars Int @default(10)`, `galaxyMinStars Int @default(30)`, `earthPerks String?`, `moonPerks String?`, `galaxyPerks String?`.
- `LoyaltyReward`: `minTier LoyaltyTier @default(EARTH)`.
- Migration `20260929120000_star_friends_tiers`.

## 8. Arquivos

- `src/features/star-friends/utils/tiers.ts` — `lifetimeStarsFrom`, `resolveTier`, `nextTierProgress` (puro).
- `src/features/star-friends/lib/members.ts` — `getMemberLifetimeStars`.
- `src/app/router/public/catalog-order/star-friends.ts` — nível, histórico, trocas e pedidos do cliente.
- `src/features/nerp-catalog/components/order-portal/*` — área do cliente com rodapé.
- `src/features/star-friends/components/tiers-and-rules.tsx` — aba "Níveis e regras".

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Criada a partir do leiaute aprovado. |
