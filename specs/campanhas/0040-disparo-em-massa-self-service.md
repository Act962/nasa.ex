---
id: 0040
titulo: Disparo em Massa self-service — número oficial, custos, taxa e subida de volume
dominio: campanhas
status: em-revisao
autor: Weydson
criada: 2026-09-27
atualizada: 2026-09-27
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: completa
---

# 0040 — Disparo em Massa self-service

## 1. Contexto

Para usar o Disparo em Massa, a equipe hoje compra o chip na Salvy e configura tudo à mão no
painel da Meta — complexo até para a equipe. O Embedded Signup já existe no código
(`onboard.ts`), mas fica escondido: sem as envs públicas, exige criar a instância antes e divide
a tela com um formulário manual de 5 campos. Campanhas não estimam nem cobram nada, e o custo
exibido no analytics vem de `conversation_analytics`, aposentado desde a cobrança por mensagem
(jul/2025).

## 2. Objetivo

O dono da org conecta o número oficial, cadastra o cartão na Meta, entende custos e limites, paga
a taxa ÓRBITA e dispara — sozinho, com ajuda da equipe a um clique.

### Não-objetivos

- Créditos de mensagens na ÓRBITA (linha de crédito): depende de sermos Solution Partner.
- Programa STARS FRIENDS: vem de outra branch; aqui só o modelo de mensagem e o link.
- Aprovação da Meta (App Review, Tech Provider): processo fora do código, com checklist no doc.

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | **Antes de começar**: cartões com as regras da Meta (quem cobra, o que é grátis, Utilidade × Marketing, opt-in, qualidade, BRL, subida de volume) e **simulador**: contatos × categoria → custo Meta + taxa ÓRBITA + dias necessários no limite atual, com a economia de Utilidade. |
| RF-2 | **Recomendação de Utilidade** com modelo pronto de template (saldo STARS FRIENDS) e botão para o In-Chat da org (`/whatsapp/{slug}`); aviso de que texto promocional vira Marketing. |
| RF-3 | **Assistente "Conectar número oficial"**: número (trazer ou comprar Salvy) → Meta (Embedded Signup) → cartão (Billing Hub) → pronto (nome, qualidade, limite). Animado, com copiar e colar e imagens com o ponto onde colar. |
| RF-4 | Embedded Signup cria a instância `META_CLOUD` se não existir e grava o `business_id`. Formulário manual vira "Configuração avançada (suporte)", fechado. |
| RF-5 | **Comprar número Salvy**: cria o número virtual pela conta ÓRBITA, cobra Stars mensais (catálogo `AppStarCost`, slug `salvy-number`; sem preço configurado não vende), e o SMS de verificação é consultado na API da Salvy a cada 4 s e aparece ao vivo no assistente. Sem Stars na renovação: `past_due` e cancelamento na Salvy após 3 dias. |
| RF-6 | **Taxa ÓRBITA por campanha**: percentual por faixa sobre o custo Meta estimado (faixas do admin; padrão 50→25%, mínimo R$ 19,90), paga em checkout (cartão Stripe ou PIX/boleto Asaas). Com a cobrança ligada (`BroadcastFeeSettings.enabled`), a campanha só dispara depois do pagamento, que é conferido na API do provedor e libera o disparo/agendamento. |
| RF-7 | **Subida de volume**: campanha maior que o limite diário (contatos únicos/24h do portfólio) é dividida em lotes diários automaticamente; o cliente vê o plano antes de pagar. |
| RF-8 | **Painel "Número e gastos"**: número, qualidade, nível de limite e o próximo (com o que a Meta exige), gasto do mês por categoria (`pricing_analytics`), atalhos para cartão e fatura. |
| RF-9 | **Pedir ajuda à equipe** em todo o fluxo: chamado preenchido com o contexto (`SupportTicket`) e WhatsApp da equipe. |
| RF-10 | Alerta quando a qualidade do número cai ou o limite é atingido. |
| RNF-1 | Valores de taxa e custo recalculados no servidor; nada vem do navegador. |
| RNF-2 | I/O (Meta, Salvy, Stripe, Asaas) fora de transação (Regra 18). |

## 4. Critérios de aceite

- [ ] **CA-1** — Simulador: 1.000 contatos em Marketing × Utilidade mostram os dois custos, a taxa da faixa e a economia; com limite 250, "4 dias".
- [ ] **CA-2** — `quoteBroadcastFee` aplica a faixa certa em cada limite e o mínimo em campanhas pequenas.
- [ ] **CA-3** — Embedded Signup sem instância cria a instância e grava `business_id`.
- [ ] **CA-4** — Com a cobrança ligada, campanha sem taxa paga não dispara; com pagamento confirmado na API do provedor, dispara. Desligada, nada muda.
- [ ] **CA-5** — Campanha de 600 contatos no nível 250 sai em 3 lotes diários.
- [ ] **CA-6** — SMS da Salvy aparece no assistente em até ~4 s (polling).
- [ ] **CA-7** — "Pedir ajuda" cria o chamado com o passo e o erro.

## 5. Decisões

- **D-1 — Cartão do cliente na Meta** (usuário, 2026-09-27); créditos na ÓRBITA só como Solution Partner.
- **D-2 — Número próprio ou Salvy** (usuário, 2026-09-27).
- **D-3 — Taxa por checkout por campanha**, faixas do /trafego (usuário, 2026-09-27); faixas configuráveis pelo admin, diferente do trafeGO que as tem fixas no código.
- **D-4 — API oficial direto**, sem MCP (usuário, 2026-09-27).
- **D-5 — Preços da Meta configuráveis** (env): a Meta não publica tabela por API.
- **D-6 — Lotes diários pelo limite do portfólio** (usuário, 2026-09-27: "um número novo nunca vai enviar para toda a base").
- **D-7 — Cobrança da taxa atrás de chave** (`BroadcastFeeSettings.enabled`, padrão desligada): quem já dispara em produção não é bloqueado no deploy; o admin liga quando o fluxo estiver validado.
- **D-8 — Confirmação por consulta, não por webhook**: Stripe e Asaas são relidos pela API (`confirmFee`, chamado pela tela ao voltar do checkout e a cada 8 s). Evita mexer nos webhooks compartilhados de Stripe/Asaas. SMS da Salvy também por consulta (webhook deles é Svix).

## 6. Referências Meta

- Pricing: developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Categorização de templates: .../whatsapp/templates/template-categorization
- Limites de mensagens: .../whatsapp/messaging-limits

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-27 | Weydson | Criada a partir do plano aprovado e das decisões D-1 a D-6. |
| 2026-09-27 | Weydson | D-7 (chave da taxa) e D-8 (confirmação por consulta); RF-5/RF-6, CA-4 e CA-6 ajustados à implementação. |
