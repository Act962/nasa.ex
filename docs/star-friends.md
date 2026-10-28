# STAR FRIENDS — programa de fidelidade

> Fonte de verdade do app STAR FRIENDS. Código em `src/features/star-friends/`, router `starFriends` (`src/app/router/star-friends/`).

## Regra de negócio
- **Cada compra paga** gera `starsPerPurchase` (padrão 1) stars para o cliente, desde que a compra atinja o valor mínimo configurado. Contam:
  - **Catálogo online:** em `confirmCatalogOrderPayment`.
  - **Forge:** quando a proposta passa a `PAGA`, em `router/forge/proposals.ts`.
- **Cliente = telefone na org** (`LoyaltyMember`). O mesmo cliente em vários trackings tem um único saldo.
- **Saldo = soma do extrato** (`LoyaltyLedgerEntry`). O extrato é só-inclusão: nada é editado nem apagado, e correção se faz com lançamento novo (ajuste ou estorno).
- **Idempotência:** `@@unique([source, sourceId, type])`. Webhook, polling e reprocessamento não creditam a mesma compra duas vezes.
- **Validade:** com `starsExpireDays` definido, o cron diário `star-friends-expire-stars` lança um `EXPIRE` por compra vencida. O valor expirado nunca passa do saldo atual.

## Níveis e "comprou X, ganhou Y" (spec 0041)

- **Níveis:** Terra (fase 1), Lua (fase 2) e Galaxy (fase 3, premium). Contam as **⭐ da vida toda**: soma de `EARN`, `ADJUST_CREDIT` e `ADJUST_DEBIT`. Trocas, estornos e expiração não contam, então trocar prêmio nunca rebaixa. Limites em `LoyaltyProgram.moonMinStars` (padrão 10) e `galaxyMinStars` (padrão 30), com texto de vantagens por nível (`earthPerks`, `moonPerks`, `galaxyPerks`). Regras puras em `utils/tiers.ts`.
- **"Comprou X, ganhou Y":** é um prêmio com custo X ⭐. Com 1 ⭐ por compra (padrão de programas novos), X ⭐ = X compras. O portal mostra cada prêmio como cartão de carimbos.
- **Nível mínimo do prêmio:** `LoyaltyReward.minTier`. Abaixo do nível, o prêmio aparece bloqueado e `requestRedemption` recusa.
- **Painel:** `/star-friends` → aba **Níveis e regras** (limites, vantagens e regras) e **Cartões e prêmios** (antiga Lista de troca).
- **Visão geral:** faixa azul com os números, cards dos níveis com quantos clientes há em cada um, últimas movimentações, grade de cartões e prêmios, participantes e resgates pendentes com as ações.
- **Excluir prêmio:** `starFriends.rewards.delete` (permissão Excluir). Prêmio com resgate no histórico vira inativo em vez de ser apagado.
- **Área do cliente:** `/pedido/<token>` vira app com rodapé Ofertas, Catálogo, Home, Chat, Mais; jornada espacial Terra → Lua → Galaxy. Ver `docs/nerp-catalog-orbita.md`.

## Resgate (4 canais)
| Canal | Onde | Fluxo |
| --- | --- | --- |
| Consultor | Detalhes do lead → aba Produtos/Serviços, ou `/tracking-chat` → Detalhes do lead → **Star Friend** | Aprovado na hora (humano registrou) |
| Chat | `/tracking-chat` → botão **+** → STAR FRIENDS | Aprovado na hora; a confirmação vai para o campo de mensagem |
| Astro | tools `get_star_friends_balance` e `request_star_friends_redemption` | Fica **PENDENTE** |
| Portal | `/pedido/[token]` → card STAR FRIENDS | Fica **PENDENTE** |

**Ciclo de um resgate:** PENDENTE → APROVADO → ENTREGUE.
- **Aprovar** debita as stars e baixa o estoque, numa transação serializável.
- **Recusar** só vale enquanto está pendente e exige motivo.
- **Cancelar um resgate aprovado** devolve as stars por `REVERSAL` e repõe o estoque.
- **Decidir resgates no lead:** o card do lead (aba Produtos/Serviços e botão Star Friend do chat) mostra os resgates do cliente com canal e status, e as ações Aprovar/Recusar, Marcar como entregue e Cancelar e estornar (`RedemptionActions`, o mesmo componente da fila Resgates).
- **Aviso ao cliente:** resgate pedido pelo Portal ou pelo Astro gera uma mensagem na conversa do cliente a cada decisão (aprovado, entregue, recusado, cancelado), via `notifyRedemptionCustomer` → `deliverTextToLead` (portal do pedido ou WhatsApp). Best-effort, depois do commit. Consultor e Chat não recebem aviso automático: o atendente já está falando com o cliente.

## Auditoria
Cada lançamento guarda:
- **Autor:** `actorType` (Usuário, Automático, Astro ou Cliente), `actorUserId` e `actorName`.
- **Data e hora.**
- **Itens:** `itemsSnapshot` (itens da compra ou o prêmio trocado).
- **Motivo:** obrigatório nos ajustes manuais, recusas e cancelamentos.

Toda ação também vai para o `SystemActivityLog` (`appSlug star-friends`) e para a Jornada do lead. A aba **Histórico** filtra por usuário, tipo e período e exporta CSV.

## App
- **Loja de Apps:** entrada `star-friends` em `features/apps/components/apps-data.ts` e item de menu `star-friends`.
- **Instalação:** `starFriends.install`, que usa o `installApp()`, grava `WorkspaceIntegration` e debita o custo do `AppStarCost`, se houver.
- **Página `/star-friends`:** abas Visão geral, Resgates, Lista de troca, Participantes, Histórico e Configurações.
- O programa só pontua com o app **instalado** e o programa **ativo**.

## Modelos
`LoyaltyProgram`, `LoyaltyReward`, `LoyaltyMember`, `LoyaltyLedgerEntry` e `LoyaltyRedemption`, criados na migration `20260926150000_star_friends_loyalty`. O prefixo `Loyalty*` evita colisão com a moeda da plataforma ("Stars": `StarTransaction`, `starsBalance`…).

## Permissões (Configurações → Permissões)
O app aparece na matriz como **🌟 STAR FRIENDS**. A regra vale no servidor (`requireAppPermission` / `hasAppPermission` em `src/features/permissions/`), e a tela só esconde os botões.

| Ação | Libera |
| --- | --- |
| Ver | Página, saldos, participantes, histórico e o card no lead |
| Criar | Resgatar pelo consultor ou pelo chat e lançar stars |
| Editar | Instalar, configurar regras e editar a lista de troca |
| Excluir | Retirar stars e cancelar resgates aprovados (estorno) |
| Aprovar (ação especial) | Aprovar, recusar e marcar como entregues os resgates pendentes |

O Master sempre tem tudo. Os padrões dos outros papéis estão em `DEFAULT_PERMISSIONS`, no arquivo `features/permissions/lib/app-permission-catalog.ts`.

## Campanha de sorteio por cupom (spec 0102)

Aba **Campanha** do app. O cliente manda a foto do cupom pelo WhatsApp e ganha números da sorte; a empresa sorteia depois de uma varredura de duplicados.

**Regra**: `números = floor((sobra + total do cupom) / valor por número)`. A sobra fica no cadastro do cliente e soma no próximo cupom. Cada número rende 1 star no extrato (fonte `CAMPAIGN_RECEIPT`) quando o programa está ativo.

**Conversa** (regras fixas, sem modelo decidindo): a opção de menu `camp:start` abre a campanha.

| Quem | O que vê |
| --- | --- |
| Cliente novo | Pede o nome → resumo das regras + link, com "Aceito" / "Não aceito" → pede a foto do cupom |
| Cliente cadastrado | "Cadastrar novo cupom", "Ver meus pontos", "Ver meus códigos". Com a campanha aberta, a foto ou PDF que ele mandar já vale como cupom, sem o clique |

"Meus pontos" e "meus códigos" pedem o número cadastrado. Ele só é comparado com o número de quem escreve; diferente, a resposta é "Você não está acessando pelo dispositivo que se cadastrou na promoção." Nenhuma consulta usa o número digitado.

**Cupom repetido**: recusado na hora por mesmo arquivo (`sha256`), mesma chave de acesso (44 dígitos) ou mesma impressão digital (CNPJ + número + dia + total), entre quaisquer clientes. Leitura incompleta é aceita com alerta. A **varredura** trata como a mesma compra o mesmo número de cupom, ou o mesmo CNPJ + dia + total (a hora só separa quando foi lida nos dois e difere em mais de 2 minutos), mantém o mais antigo e anula os números dos demais; depois confere se o cliente não ficou com mais números do que as compras válidas dão. O **sorteio** só roda com varredura feita depois do último cupom e grava a semente. A campanha tem uma quantidade de prêmios: sai um número para cada prêmio, no máximo um por cliente, com a ordem gravada em `LoyaltyLuckyNumber.drawPosition`.

A varredura anula números, mas não estorna as stars já creditadas por eles.

**Leitura do cupom**: `gpt-4o` na OpenAI (os modelos menores trocavam dígitos do CNPJ na mesma foto). CNPJ e chave de acesso só valem com o dígito verificador certo; senão contam como não lidos. Ano da compra lido errado é corrigido para o ano da campanha, com alerta, quando o dia e o mês caem no período.

**Conferência manual** (RF-15): o cupom que a leitura não resolveu (valor total não lido, ou IA indisponível) fica com status `PENDING_REVIEW` em vez de ser recusado, e o cliente é avisado de que foi recebido. Na aba Campanha, filtro **Em conferência**: quem tem a permissão de "Aprovar" informa o valor total (data e número opcionais) e aprova, ou recusa com motivo. A aprovação confere período e repetição, gera os números e zera a varredura (o sorteio passa a exigir outra). O sorteio não roda com cupom em conferência. O cliente é avisado do resultado na conversa só com a janela de 24 h aberta. Código em `lib/campaign/review-receipt.ts`; o cálculo de números e stars é compartilhado em `lib/campaign/grant-lucky-numbers.ts`.

O limite diário conta cupons aceitos e em conferência; recusados e repetidos não contam, mas há um teto de 4 tentativas por cupom permitido.

**Opções de menu com resposta fixa** (aba "Botões" do Chatbot IA, campo "o que a opção faz"): abrir a campanha, ofertas (stories do Instagram cadastrado), Instagram e endereço (Localização da empresa).

| Arquivo | Papel |
| --- | --- |
| `features/star-friends/utils/campaign.ts` | Regras puras: cálculo, impressão digital, varredura, comparação de telefone |
| `features/star-friends/lib/campaign/extract-receipt.ts` | Leitura do cupom por IA (só transcreve) |
| `features/star-friends/lib/campaign/register-receipt.ts` | Valida, barra repetido e grava cupom, números e stars |
| `features/star-friends/lib/campaign/sweep-duplicates.ts`, `draw.ts` | Varredura e sorteio |
| `features/tracking-chat-ai/lib/campaign-handler.ts` | Conversa da campanha |
| `features/tracking-chat-ai/lib/store-info-handler.ts` | Ofertas, Instagram e endereço |
| `app/router/star-friends/campaign.ts` | `starFriends.campaign.{get,upsert,receipts,exportNumbers,sweep,draw}` |
| `features/pages/lib/templates/campanha-sorteio.ts` | Modelo de página do regulamento |

Permissões: ver cupons e números = "Ver"; configurar = "Editar"; varredura e sorteio = "Aprovar". Conferência das regras: `pnpm tsx scripts/star-friends-campaign-check.ts`.

## Changelog

- **2026-10-13** — Campanha com vários prêmios, um por pessoa; corrigida a data de fim que andava um dia a cada salvamento.
- **2026-10-13** — Campanha de sorteio por cupom pelo WhatsApp: cadastro com aceite, leitura do cupom, bloqueio de repetido, varredura e sorteio (spec 0102).
- **2026-09-29** — Níveis Terra/Lua/Galaxy, nível mínimo por prêmio, aba Níveis e regras e área do cliente no portal (spec 0041).
- **2026-09-29** — Botão Star Friend dos Detalhes do lead no chat deixa de ser placeholder: mostra o card completo e estados de não instalado, pausado e sem permissão; resgates decididos direto no lead.
- **2026-09-29** — Aviso automático ao cliente nas decisões de resgate pedido pelo Portal ou pelo Astro. Validado em teste ponta a ponta local (Gotham): 3 compras pagas → 10 stars → troca pela sacola no portal → aprovação e entrega.
