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

## Resgate (4 canais)
| Canal | Onde | Fluxo |
| --- | --- | --- |
| Consultor | Detalhes do lead → aba Produtos/Serviços | Aprovado na hora (humano registrou) |
| Chat | `/tracking-chat` → botão **+** → STAR FRIENDS | Aprovado na hora; a confirmação vai para o campo de mensagem |
| Astro | tools `get_star_friends_balance` e `request_star_friends_redemption` | Fica **PENDENTE** |
| Portal | `/pedido/[token]` → card STAR FRIENDS | Fica **PENDENTE** |

**Ciclo de um resgate:** PENDENTE → APROVADO → ENTREGUE.
- **Aprovar** debita as stars e baixa o estoque, numa transação serializável.
- **Recusar** só vale enquanto está pendente e exige motivo.
- **Cancelar um resgate aprovado** devolve as stars por `REVERSAL` e repõe o estoque.

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
