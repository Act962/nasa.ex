---
id: 0035
titulo: Auditar Lead — métricas de comportamento e atendimento por lead
dominio: leads
status: aprovada
autor: Weydson
criada: 2026-09-26
atualizada: 2026-09-26
branch: feature/W-astro-commander-20260925
pr:
peso: completa
---

# 0035 — Auditar Lead

## 1. Contexto

O atendente não tinha como ver, sem sair da conversa, quanto um lead vale e como ele está sendo atendido. Os dados existiam espalhados (temperatura manual, horários das mensagens, propostas pagas, histórico de ganho/perda), mas nenhum score por lead, nenhuma tabela de métricas e nenhum filtro de campanha por comportamento.

## 2. Objetivo

Nove métricas por lead, salvas numa tabela própria, visíveis na lateral do chat e em `/contatos`, alimentadas pelo atendimento e usáveis como filtro de campanhas.

### Não-objetivos

- Backfill em massa dos leads antigos: eles mostram o botão "Auditar Lead" e calculam sob demanda.
- Vendas do NERP: não há vínculo local entre lead e venda do NERP.
- Atribuir tempo de resposta a cada atendente: a mensagem enviada não guarda o usuário.

## 3. Requisitos

### Funcionais

| ID | Requisito |
|---|---|
| RF-1 | Tabela 1:1 `lead_metrics` com: potencial de compra (0–100), interesse (LOW/MEDIUM/HIGH), compras, interações/mês, tempo médio de atendimento (s), perda de interação (%), tempo médio de resposta (s), qualidade (%), resolução (%), origem (COMPUTED/AI), confiança (0–100), justificativa da IA e datas. |
| RF-2 | Cálculo em código sobre os últimos 90 dias, com as definições da seção 6 (D-2). |
| RF-3 | "Auditar Lead" calcula e grava. Com confiança < 40 e ao menos 5 mensagens, a IA (modelo FAST, `generateObject`) estima potencial e interesse lendo as últimas 30 mensagens, cobrando a ação `lead_audit_ai` (2★). Sem saldo ou com falha da IA, fica o resultado do código e um aviso. |
| RF-4 | Lead criado a partir de 26/09/2026 ou já auditado é recalculado sozinho (Inngest `lead/metrics.recompute`, debounce de 2 min por lead) após mensagem de entrada ou saída, proposta paga e atendimento finalizado. Cron diário às 04:00 recalcula os com atividade nos últimos 60 dias. |
| RF-5 | Recálculo automático não apaga a estimativa da IA enquanto a confiança do código seguir baixa. |
| RF-6 | Lateral do chat: anel de potencial no avatar, chips compactos (6 de comportamento em cima, 3 de atendimento embaixo) abaixo do nome e dos ícones, e o botão "Auditar Lead" que só abre/fecha os cartões detalhados, posicionados acima dos atalhos. Lead sem métricas mostra só o botão. |
| RF-7 | `/contatos/[leadId]`: o mesmo bloco (chips, botão e detalhes) no painel do lead. |
| RF-8 | Campanhas (aba Leads e base de Contatos): filtro "Comportamento" por interesse, potencial mínimo e perda máxima. Com o filtro ativo, lead sem métricas fica fora, e a tela avisa. |
| RF-9 | Leitura e auditoria só para lead da org de quem pede. |
| RF-10 | Anel do avatar = **temperatura calculada** (0–100%), não o potencial: Frio < 25, Morno 25–49, Quente 50–74, Quentíssimo ≥ 75, com a cor da faixa (azul → vermelho) e o rótulo abaixo do nome. O potencial de compra aparece só no cartão. |

### Não-funcionais

| ID | Requisito |
|---|---|
| RNF-1 | Cálculo sem transação e gravação fora de `$transaction` (Regra 18). |
| RNF-2 | Pedido de recálculo é best-effort: falha no Inngest nunca derruba o recebimento de mensagem. |

## 4. Critérios de aceite

- [x] **CA-1** (RF-3, RF-6) — Clicar em "Auditar Lead" num lead com conversa preenche as métricas, e a lateral passa a mostrar anel, chips e cartões. Verificado no chat com o lead Manoel.
- [ ] **CA-2** (RF-2) — Os valores batem com consultas diretas: mensagens de 30 dias, rajadas sem resposta em 24 h, propostas PAGA.
- [ ] **CA-3** (RF-3) — Lead sem sinais e com conversa usa a IA e mostra "estimados pelo ASTRO"; sem saldo, mostra o aviso e o resultado do código.
- [ ] **CA-4** (RF-4) — Mensagem nova de um lead criado depois da data de corte recalcula as métricas em até ~2 min.
- [ ] **CA-5** (RF-8) — Filtrar interesse Alto numa campanha adiciona só leads auditados nessa faixa.
- [ ] **CA-6** (RF-9) — Auditar lead de outra org devolve NOT_FOUND.

## 5. Casos de borda

- Lead sem conversa: métricas de tempo ficam vazias ("—"), perda 0%, confiança baixa, sem IA (não há mensagens).
- Rajada ainda dentro das 24 h não conta como perdida.
- Resolução sem ciclos encerrados fica vazia ("—").
- Mais de 3 000 mensagens em 90 dias: o cálculo lê as 3 000 primeiras da janela.

## 6. Decisões de design

### D-1 — Tabela 1:1 em vez de colunas no `Lead`
Recalcular é sobrescrever uma linha; o `Lead` não cresce, e os índices dos filtros ficam na tabela de métricas.

### D-2 — Definições (contrato das métricas)
- **Rajada**: mensagens do lead; um silêncio de mais de 4 h, ou uma resposta da equipe, abre rajada nova.
- **Interações/mês**: mensagens de entrada e saída dos últimos 30 dias.
- **Tempo de resposta**: média de (1ª resposta da equipe − início da rajada).
- **Tempo de atendimento**: média de (última resposta da equipe na rajada − início da rajada).
- **Perda de interação**: rajadas sem resposta em 24 h ÷ rajadas vencidas.
- **Qualidade**: rajadas respondidas dentro do SLA da etapa (`Status.slaHours`, padrão 1 h) ÷ rajadas respondidas.
- **Resolução**: (ganhos no histórico + atendimento finalizado) ÷ (isso + perdas).
- **Compras**: o maior entre propostas PAGA do lead e ganhos no histórico.
- **Potencial**: temperatura (5/15/25/30) + engajamento de 30 dias (até 25; ¼ se o lead não escreveu) + proposta aberta ou visualizada (20) + compras (5 cada, até 15) − perda (até 10), limitado a 0–100.
- **Interesse**: Alto ≥ 70, Médio 40–69, Baixo < 40.
- **Confiança**: 100 − 40 (menos de 5 mensagens) − 20 (sem proposta nem compra) − 20 (lead não escreveu em 30 dias).

### D-2b — Temperatura calculada (anel do avatar)
Calculada na tela a partir das métricas salvas, sem coluna nova: recência da última mensagem do lead (hoje 25, ≤3 dias 18, ≤7 dias 10, ≤30 dias 4) + interações do mês (1 por mensagem, até 20) + aquecimento pela chegada (≤2 dias 15, ≤7 dias 10, ≤30 dias 5) + tempo de resposta (≤5 min 15, ≤30 min 10, ≤2 h 5) + qualidade × 0,15 + resolução × 0,10. Mede quão vivo está o relacionamento agora; o potencial mede a chance de fechar negócio. Código: `lead-audit/lead-heat.ts`.

### D-3 — IA só em último caso
Só com confiança < 40 e conversa suficiente, e só para potencial e interesse. Tempos e taxas vêm sempre dos dados.

## 7. Impacto

- `prisma/schema.prisma` + migração `20260926200000_lead_metrics` (aplicada no Neon via `db execute` + `migrate resolve`).
- `src/features/leads/lib/metrics/` — cálculo, IA, gravação, pedido de recálculo.
- `src/app/router/leads/metrics.ts` — `leads.getMetrics`, `leads.auditLead`; `leads.get` inclui `metrics`.
- `src/inngest/functions/leads/recompute-lead-metrics.ts` — evento e cron.
- Gatilhos: `incoming-message-pipeline.ts`, `forge/proposals.ts` (PAGA), `rodizio/finish-lead.ts`.
- UI: `src/features/leads/components/lead-audit/`, lateral do chat, `LeadInfo`, campanhas (`lead-metrics-filter.tsx`).
- `src/data/star-rules.ts` — `lead_audit_ai` (o preço precisa ser semeado no catálogo de Stars; sem isso a ação sai grátis e aparece em "ações sem preço").

## 8. Plano de testes

Sem runner de testes no projeto (Regra 20): verificação manual no chat e em `/contatos`, conferência dos números contra consultas diretas na org ASTRO QA, e o filtro de campanha.

## 9. Riscos e rollback

Migração aditiva (tabela e enums novos); rollback do código não exige desfazê-la. Os gatilhos são best-effort. Para desligar a automação, remover as duas funções do registro do Inngest.

## 10. Changelog da spec

| Data | Autor | Mudança |
|---|---|---|
| 2026-09-26 | Weydson | Criada e aprovada (plano aprovado no chat). Implementada no mesmo dia; CA-1 verificado. |
| 2026-09-26 | Weydson | Anel do avatar passa a mostrar a temperatura calculada (RF-10, D-2b); chips compactos removidos da lateral, ficam só os cartões; largura da lateral igual à da lista de conversas. |
