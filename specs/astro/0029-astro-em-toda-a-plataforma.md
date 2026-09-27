---
id: 0029
titulo: ASTRO em toda a plataforma — alertas proativos, widget central e botões nos apps
dominio: astro
status: aprovada
autor: Weydson
criada: 2026-09-25
atualizada: 2026-09-25
branch: feature/W-astro-commander-20260925
pr:
peso: completa
---

# 0029 — ASTRO em toda a plataforma

Relacionadas:
- [0028](0028-astro-commander.md): Commander e aprovações.
- [0022](../notifications/0022-web-push-notification-service.md): Web Push.
- [0015](0015-astro-widget-flutuante.md): widget flutuante.

---

## 1. Contexto

O ASTRO já executa comandos, mas o usuário não percebe que ele está por trás das automações e da inteligência do ÓRBITA. Três lacunas:

1. **Alertas importantes não existem ou não falam como ASTRO.**
   - Não existem: lead 5 min sem resposta, despesa vencendo hoje, contrato vencendo.
   - Existem, mas chegam como notificação genérica do sino: mensagem nova, tarefa vencendo, Stars acabando.
2. **O widget é só chat.** Não há uma visão de alertas, oportunidades e atalhos.
3. **Os apps não chamam o ASTRO.** Não há "Criar comando" nas telas. O ícone do Instagram no chat nem sabe se o Instagram está conectado.

## 2. Objetivo

O ASTRO passa a ser a voz de todos os alertas e automações da plataforma. Ele avisa na hora o que importa, com ação rápida, e está disponível dentro de cada app para criar comandos.

### Não-objetivos

- **Mudar a lógica de qualquer IA existente.** A fase 5 troca só rótulo e marca.
- **Mandar mensagem ao lead.** Alertas são internos, para a equipe. Nenhuma mudança em instância, envio ou provider de WhatsApp.
- **Alertas gerados por LLM.** A fala vem de template; não gasta Stars.
- **Substituir o sino.** O sino continua existindo; o widget é outra vitrine da mesma notificação.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Catálogo único de falas do ASTRO por tipo de alerta: fala em primeira pessoa, prioridade (`urgent`/`important`/`info`) e ações rápidas (`prompt` ou `href`). |
| RF-2 | Toda notificação chega com a fala do ASTRO: calculada na leitura (campo `astro` da lista do sino) e no envio (payload `alert:new` do Pusher), a partir do tipo e dos dados do alerta. Nada novo é gravado no banco; o sino segue igual. |
| RF-3 | **Lead chamando:** mensagem inbound gera alerta ao responsável do lead; sem responsável, a owner/admin. Evento próprio `chat.lead_calling`, com várias mensagens seguidas contando como uma chamada (janela de 30 min). |
| RF-4 | **Lead esperando:** conversa com a última mensagem inbound há ≥5 min, sem resposta humana depois, gera **um** alerta por espera. |
| RF-5 | **Despesa vence hoje:** lançamento a pagar vencendo hoje e ainda pendente gera alerta às 08:00 e às 15:00 (São Paulo). |
| RF-6 | **Contrato vencendo:** contrato ou proposta vencendo em até 7 dias e no dia gera alerta diário às 08:00. |
| RF-7 | **Tarefa vencendo hoje** (`action.due_soon`) e **Stars acabando** (`STARS_ALERT`) ganham fala do ASTRO. Nenhuma regra padrão nova para `action.due_soon`: orgs que já têm a sua receberiam em dobro. |
| RF-8 | O alerta só chega a quem tem acesso ao dado: financeiro só para quem vê o financeiro, contrato só para quem vê o forge. |
| RF-9 | **Widget com abas Início e Conversa.** Início traz, de cima para baixo: saudação, aprovações, alertas com ação rápida, atalhos por tela e "Criar comando". O widget abre em Início quando há alerta não lido ou aprovação pendente. |
| RF-10 | **Orb pulsa:** ao chegar um alerta, mostra "Astro está enviando uma notificação…", depois o balão com a fala e o badge. Enquanto responde no chat, o balão mostra "Astro respondendo…". |
| RF-11 | **Voz:** o alerta `urgent`/`important` é falado **só** se a saída de voz estiver ligada. |
| RF-12 | **Botão "Criar comando"** com a marca do ASTRO em `/contatos`, tracking-chat, kanban, workspace e nas telas que usam `HeaderTracking`. Abre o dialog com exemplos da área. |
| RF-13 | **Instagram:** sem Instagram conectado ao Comments, o ícone fica em cinza e o clique abre um popup que leva a `/comments?tab=integracoes`. Conectado, funciona como hoje. |
| RF-14 | **"Por ASTRO"** nas superfícies de IA dos apps. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Detectores são queries indexadas, sem LLM. |
| RNF-2 | Dedupe por entidade via `AlertDispatch`: o mesmo alerta não repete a cada cron. |
| RNF-3 | Dispatch sempre fora de `$transaction` (regra 18). |
| RNF-4 | O sino atualiza em tempo real (hoje a queryKey não bate e depende do polling de 30 s). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma mensagem inbound de um lead com responsável, então o responsável recebe um alerta com a fala do ASTRO, o orb pulsa e aparece um card em Início.
- [ ] **CA-2** — Dada uma conversa com inbound há 5 min sem resposta, então chega **um** alerta. O cron seguinte não repete. Um novo inbound após resposta gera novo alerta.
- [ ] **CA-3** — Dada uma despesa a pagar vencendo hoje e pendente, então às 08:00 chega alerta a owner/admin e **não** chega a um membro sem acesso ao financeiro. Paga antes das 15:00, então às 15:00 não há alerta.
- [ ] **CA-4** — Dado um contrato vencendo em 7 dias, então chega alerta diário até o vencimento, sem duplicar no mesmo dia.
- [ ] **CA-5** — Com a saída de voz ligada, alerta `urgent` é falado; desligada, só visual.
- [ ] **CA-6** — Com alerta não lido, o widget abre em Início; sem nada pendente, abre na Conversa.
- [ ] **CA-7** — O botão de ação rápida "Me manda o boleto" abre a Conversa com o pedido já enviado.
- [ ] **CA-8** — O botão "Criar comando" aparece nas telas listadas e abre o dialog com exemplos daquela área.
- [ ] **CA-9** — Org sem Instagram vê o ícone cinza; o clique abre o popup e leva a `/comments?tab=integracoes`. Org conectada vê colorido e o filtro funciona.
- [ ] **CA-10** — O sino atualiza sem esperar 30 s quando chega `alert:new`.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead sem responsável | Alerta vai a owner/admin da org. |
| CB-2 | Conversa respondida por IA/automação, não por humano | **Zera a espera.** O lead foi atendido; o dado disponível (`Lead.lastOutboundAt`) não distingue humano de IA. Ver changelog. |
| CB-3 | Lead manda várias mensagens seguidas | Um alerta por espera, contado da **primeira** inbound sem resposta. |
| CB-4 | Org com muitas conversas (rajada) | Limite por execução do cron; o resto entra na rodada seguinte, sem perder. |
| CB-5 | Despesa paga entre 08:00 e 15:00 | O alerta das 15:00 não dispara. |
| CB-6 | Fuso da org diferente de São Paulo | Não existe fuso por organização no schema. "Hoje" e os horários 08:00/15:00 usam São Paulo. Ver changelog. |
| CB-7 | Org desligou a regra padrão | Nenhum alerta daquele tipo. |
| CB-8 | Usuário sem permissão ao dado | Não recebe, nem pelo sino, nem pelo widget. |
| CB-9 | Navegador bloqueia áudio (sem gesto do usuário) | Fica só o visual; nenhum erro. |
| CB-10 | Comments conectado, mas com status `NEEDS_RECONNECT` | Ícone em cinza e popup pedindo reconexão. |

## 6. Decisões de design

### D-1 — Fala por template, não por LLM
- **Escolha:** catálogo de templates por tipo de alerta.
- **Descartado:** gerar a fala com IA. Custo em Stars por alerta, latência e risco de a fala divergir do dado.

### D-2 — Reusar o motor de alertas, não criar outro
- **Escolha:** novos eventTypes no `alert-catalog` + `AlertRule` globais padrão.
- **Descartado:** notificação direta de cada cron. Perderia dedupe, cooldown e a opção de a org desligar.

### D-3 — Widget em duas abas, sem trocar o chat
- **Escolha:** abas Início e Conversa no header.
- **Descartado:** alertas misturados às mensagens do chat. Poluiria a conversa e a sessão salva.

### D-4 — Voz só com a saída de voz ligada
- **Escolha:** decisão do usuário. Visual sempre; voz opcional e só para prioridade alta.

### D-5 — Destino por responsável + admins, filtrado por permissão
- **Escolha:** decisão do usuário.
- **Descartado:** todos da org. Geraria ruído e exporia dado financeiro.

## 7. Impacto

- [ ] Schema: nenhum model novo. `AlertRule` globais padrão são semeadas por script idempotente.
- [x] Automações (Inngest): crons `detect-lead-waiting`, `detect-expenses-due-today` e `detect-contracts-expiring`.
- [x] Catálogo de alertas: eventTypes `chat.lead_calling`, `chat.lead_waiting`, `payment.expense_due_today` e `forge.contract_expiring`; categoria `payment` e app `financeiro`; audiência `lead_responsible_or_admins`.
- [x] Regras globais padrão: `scripts/seed-astro-alert-rules.ts` (idempotente, só grava com `--apply`). Enquanto não rodar, os crons não disparam nada.
- [x] Notificações: tipos novos em `NOTIF_TYPES` e `metadata.astro`.
- [x] Realtime: reusa `alert:new`.
- [ ] Env vars novas: nenhuma.

## 8. Plano de testes

Sem runner de teste (CLAUDE.md, item 20). Verificação manual registrada no PR:

| Critério | Como verificar |
| --- | --- |
| CA-1, CA-2 | Mensagem inbound de teste; esperar 5 min; conferir alerta único. |
| CA-3, CA-4 | Criar lançamento e contrato de teste; disparar o cron pelo Inngest dev. |
| CA-5, CA-6, CA-7 | Navegador: alternar a saída de voz, abrir e fechar o widget. |
| CA-8, CA-9 | Navegar pelas telas; org com e sem Instagram. |
| CA-10 | Disparar alerta e observar o sino. |

## 9. Riscos e rollback

- **Ruído:** mitigado por dedupe, cooldown e regras desligáveis. Rollback: desativar as `AlertRule` padrão, sem deploy.
- **Carga dos crons:** queries indexadas com limite por execução. Rollback: desligar a função no Inngest.
- **Nenhuma migration destrutiva.** Tudo é aditivo.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-25 | Weydson | Criada a partir do plano aprovado |
| 2026-09-25 | Weydson | Implementação: CB-2 passa a zerar a espera com qualquer resposta (dado disponível não distingue humano de IA); CB-6 usa São Paulo (sem fuso por org no schema); evento novo `chat.lead_calling` para não mudar o dedupe de `chat.message_received`; `action.due_soon` sem regra padrão; destino financeiro/contratos limitado a owner/admin (mais restrito que "quem tem acesso ao financeiro", que fica para depois). RF-14 aplicado em Workflows e Insights; trafeGO já dizia "Astro". |
| 2026-09-26 | Weydson | Correção (bateria F9-01): o motor comparava `waitingMinutes` da regra com o do payload por igualdade, então `chat.lead_waiting` só alertava com espera de exatamente 5 min. Evento ganhou `detectorOnlyParams`: limiar aplicado pelo detector, ignorado no casamento de params. Detectores dos 3 crons extraídos para `features/alerts/lib/detectors/` com escopo opcional por org (usado pela bateria). |
