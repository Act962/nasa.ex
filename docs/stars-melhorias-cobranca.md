# Stars — Melhorias de Cobrança

> Documento de referência gerado em 2026-05-26.
> Mapeia lacunas no sistema de débito de Stars e isenções existentes para orientar próximas implementações.

---

## Contexto

O sistema de Stars (★) é a moeda interna premium da plataforma. Toda ação de valor — mensagens, automações, IA, criação de conteúdo — deveria debitar Stars da organização via `chargeStarsByAction` (por ação unitária) ou `debitStars` (débito direto no serviço).

A auditoria identificou dois grupos de problemas:

1. **Isenções não documentadas** — comportamentos onde a cobrança é suprimida sem aviso claro ao usuário
2. **Lacunas de implementação** — features que executam ações de valor mas nunca chamam nenhum charge

---

## Parte 1 — Isenções e Bypasses Existentes

### 1.1 Partner Infinity (`partnerLifetimeGranted = true`)

| | |
|---|---|
| **Arquivo** | `src/features/stars/lib/star-service.ts:560-569` |
| **Gatilho** | `Organization.partnerLifetimeGranted = true` (setado ao atingir tier INFINITY no programa de parceiros) |
| **O que isenta** | Plano mensal — a cobrança de assinatura é pulada; Stars do plano ainda são creditadas como "Cortesia NASA Partner Infinity" |
| **O que NÃO isenta** | `APP_CHARGE` (mensalidade de apps), `APP_SETUP` (instalação), e todos os charges por ação |
| **Melhoria sugerida** | Documentar explicitamente no painel do parceiro quais cobranças continuam ativas. Evitar confusão quando o saldo cai mesmo com isenção de plano. |

---

### 1.2 Regra Ausente ou Custo Zero

| | |
|---|---|
| **Arquivo** | `src/features/stars/lib/charge-by-action.ts:38-44` |
| **Gatilho** | `AppStarCost` não existe para o `appSlug`, ou `monthlyCost <= 0` |
| **Comportamento** | Retorna `{ success: true, skipped: true, cost: 0 }` — a ação prossegue sem cobrar |
| **Risco** | Se um admin deletar ou zerar acidentalmente uma regra, o serviço continua funcionando de graça sem nenhum log de aviso |
| **Melhoria sugerida** | Logar em `OrgActivityLog` sempre que `skipped: true` for retornado por ausência de regra (diferente de regra intencionalmente com custo 0). Permitir distinguir "gratuito por configuração" de "gratuito por omissão". |

---

### 1.3 Grace Period — Fallback no Chat AI

| | |
|---|---|
| **Arquivo** | `src/features/tracking-chat-ai/lib/agent.ts:59-74` |
| **Gatilho** | `starsGraceStartedAt` ativo + saldo total ≤ 0 |
| **Comportamento** | Em vez de chamar a IA, envia mensagem de fallback: "Em instantes um atendente humano retornará". Nenhum Star é debitado. |
| **Por que existe** | Evitar que a org seja cobrada quando não tem saldo para pagar |
| **Melhoria sugerida** | Exibir alerta proeminente no painel do operador quando o Chat AI estiver em modo fallback. Hoje o operador pode não saber que as respostas automáticas pararam. |

---

### 1.4 Conta Suspensa (`starsSuspendedAt`)

| | |
|---|---|
| **Arquivo** | `src/app/middlewares/require-stars.ts:33-42` |
| **Gatilho** | `starsSuspendedAt` setado (D15+ de grace period com saldo zero) |
| **Comportamento** | `requireStarsMiddleware` rejeita todas as procedures com `FORBIDDEN { code: "STARS_SUSPENDED" }` — nada roda, nada cobra |
| **Melhoria sugerida** | Nenhuma mudança na lógica; apenas garantir que o frontend trate `STARS_SUSPENDED` de forma amigável em todas as features, não só no Chat AI. |

---

### 1.5 Bonus Balance — Restrição ao NASA Route

| | |
|---|---|
| **Arquivo** | `src/features/stars/lib/star-service.ts:201` (`allowBonus = false` no `debitStars` de curso) |
| **Gatilho** | `starsBonusBalance` não pode ser usado para comprar cursos no NASA Route |
| **Comportamento** | `debitStars` chamado com `opts.allowBonus = false` usa apenas `starsBalance` |
| **Melhoria sugerida** | Exibir no `PriceStarsDisplay` (NASA Route) e no `StarsWidget` um aviso claro que Stars de bônus não são aceitos em cursos. Atualmente o usuário pode ver saldo total e tentar comprar sem entender a restrição. |

---

## Parte 2 — Lacunas de Implementação (Não Cobram e Deveriam)

### 2.1 🔴 Tracking Chat — Mensagens Manuais (WhatsApp sem IA)

| | |
|---|---|
| **Feature** | `src/features/tracking-chat/` |
| **Ação** | Mensagens WhatsApp enviadas manualmente pelo operador |
| **Status atual** | Sem nenhum charge |
| **Comparativo** | `tracking-chat-ai` cobra via `chargeStarsByAction` a cada mensagem da IA |
| **Impacto** | Alto — canal de maior volume na plataforma; operadores podem enviar centenas de mensagens por dia sem custo |
| **Implementação sugerida** | Chamar `chargeMessageOutbound(orgId, userId)` (já existe em `src/features/stars/lib/charge-message-outbound.ts`) nas procedures de envio de mensagem do tracking-chat. Criar `AppStarCost` com `appSlug = "tracking_chat_outbound"`. |

---

### 2.2 🔴 Workspace Executions — `send-message-participants`

| | |
|---|---|
| **Arquivo** | `src/features/workspace-executions/components/send-message-participants/executor.ts` |
| **Ação** | Envia mensagens WhatsApp para participantes de uma ação via automação (workflow) |
| **Status atual** | Sem charge — apenas o envio de e-mail cobra Stars |
| **Impacto** | Alto — um único workflow com loop de participantes pode disparar dezenas ou centenas de WhatsApps sem custo |
| **Implementação sugerida** | Adicionar `chargeMessageOutbound` por mensagem enviada, assim como o `send-email-participants` já faz para e-mail. |

---

### 2.3 🟡 Workspace Workflow — Criação e Execução

| | |
|---|---|
| **Arquivo** | `src/app/router/workspace-workflow/create.ts` |
| **Ação** | Criar e executar workflows de automação |
| **Status atual** | Sem charge em nenhuma etapa (create, update, execute) |
| **Impacto** | Médio — automações são feature premium; execuções complexas com branching e delays consomem recursos |
| **Implementação sugerida** | Cobrar `APP_SETUP` na criação do primeiro workflow (ou por workspace), e opcionalmente `chargeStarsByAction("workflow_execution")` por run que inclua steps pagos (mensagens, IA). |

---

### 2.4 🟡 Forge — Templates e Produtos

| | |
|---|---|
| **Arquivos** | `src/app/router/forge/templates.ts`, `src/app/router/forge/products.ts` |
| **Ação** | Criar e editar templates de proposta e produtos do catálogo |
| **Status atual** | Sem charge. Apenas criação e envio de proposta/contrato cobram |
| **Impacto** | Médio — templates são ativos reutilizáveis de alto valor |
| **Implementação sugerida** | Cobrar uma vez na criação do template (`chargeStarsByAction("forge_template_create")`). Produtos podem ter custo menor ou zero dependendo do modelo de negócio. |

---

### 2.5 🟡 NASA Route — Publicação de Curso

| | |
|---|---|
| **Arquivo** | `src/app/router/nasa-route/routes/creator-publish-course.ts` |
| **Ação** | Publicar ou republicar um curso na plataforma |
| **Status atual** | Sem charge. O upload de vídeo cobra Stars (por GB), mas a publicação em si não |
| **Impacto** | Médio — publicação torna o curso acessível externamente; é a ação de maior valor do criador |
| **Implementação sugerida** | Cobrar `chargeStarsByAction("nasa_route_publish_course")` na primeira publicação. Re-publicação pode ser gratuita. |

---

### 2.6 🟡 Conversation — Criação Manual

| | |
|---|---|
| **Arquivo** | `src/app/router/conversation/create.ts` |
| **Ação** | Criar nova conversa manualmente (sem ser via importação) |
| **Status atual** | Sem charge. A importação em massa de chats existentes cobra |
| **Impacto** | Médio — abre canal de comunicação direta; importação cobra mas criação não cria inconsistência |
| **Implementação sugerida** | `chargeStarsByAction("conversation_create")` com custo baixo ou alinhado ao custo de importação por unidade. |

---

### 2.7 🟡 Alerts — Criação de Regras

| | |
|---|---|
| **Arquivo** | `src/app/router/alerts/create-rule.ts` |
| **Ação** | Criar regras de alerta que disparam automações e notificações |
| **Status atual** | Sem charge |
| **Impacto** | Médio — cada regra pode gerar execuções recorrentes; cobrar na criação alinharia o custo ao valor entregue |
| **Implementação sugerida** | `chargeStarsByAction("alert_rule_create")` na criação. Alterações podem ser gratuitas. |

---

### 2.8 🟢 Space Station — Criação de Estação

| | |
|---|---|
| **Arquivo** | `src/app/router/space-station/create-station.ts` |
| **Ação** | Criar nova estação (perfil de usuário ou organização) |
| **Status atual** | Sem charge |
| **Impacto** | Baixo — feature usada com pouca frequência |
| **Implementação sugerida** | `APP_SETUP` via `installApp("space_station")` na criação, se fizer sentido como serviço mensal. |

---

### 2.9 🟢 Space Help — Criação de Conteúdo

| | |
|---|---|
| **Arquivos** | `src/app/router/space-help/routes/upsert-*.ts` |
| **Ação** | Criar categorias, tracks, lições, etapas, badges |
| **Status atual** | Sem charge |
| **Impacto** | Baixo — conteúdo interno de onboarding; pode não fazer sentido cobrar |
| **Implementação sugerida** | Avaliar se Space Help é feature interna (sem cobrança) ou exposta a clientes. Se exposta, cobrar `chargeStarsByAction("space_help_lesson_create")`. |

---

## Resumo Priorizado

| Prioridade | Feature | Arquivo-chave | Tipo de charge |
|:---:|---------|---------------|---------------|
| 🔴 1 | Tracking Chat — mensagens manuais | `src/features/tracking-chat/` | `chargeMessageOutbound` |
| 🔴 2 | Workspace Executions — `send-message-participants` | `src/features/workspace-executions/.../send-message-participants/executor.ts` | `chargeMessageOutbound` |
| 🟡 3 | Workspace Workflow — execução | `src/app/router/workspace-workflow/` | `chargeStarsByAction("workflow_execution")` |
| 🟡 4 | Forge — criação de template | `src/app/router/forge/templates.ts` | `chargeStarsByAction("forge_template_create")` |
| 🟡 5 | NASA Route — publicar curso | `src/app/router/nasa-route/routes/creator-publish-course.ts` | `chargeStarsByAction("nasa_route_publish_course")` |
| 🟡 6 | Conversation — criação | `src/app/router/conversation/create.ts` | `chargeStarsByAction("conversation_create")` |
| 🟡 7 | Alerts — criação de regra | `src/app/router/alerts/create-rule.ts` | `chargeStarsByAction("alert_rule_create")` |
| 🟢 8 | Space Station — criação | `src/app/router/space-station/create-station.ts` | `installApp("space_station")` |
| 🟢 9 | Space Help — criação de conteúdo | `src/app/router/space-help/routes/` | `chargeStarsByAction("space_help_lesson_create")` |

---

## Referências

- Serviço central de Stars: [`src/features/stars/lib/star-service.ts`](../src/features/stars/lib/star-service.ts)
- Charge por ação: [`src/features/stars/lib/charge-by-action.ts`](../src/features/stars/lib/charge-by-action.ts)
- Charge de mensagem outbound: [`src/features/stars/lib/charge-message-outbound.ts`](../src/features/stars/lib/charge-message-outbound.ts)
- Middleware de suspensão: [`src/app/middlewares/require-stars.ts`](../src/app/middlewares/require-stars.ts)
- Catálogo de custos (banco): modelo `AppStarCost` em [`prisma/schema.prisma`](../prisma/schema.prisma)
