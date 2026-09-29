---
id: 0042
titulo: Empresa nova com trackings, tags e tags automáticas padrão; link próprio de cada app
dominio: leads
status: aprovada
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: completa
---

# 0042 — Empresa pronta para uso e link de cadastro por app

## 1. Contexto

Uma empresa nova no Órbita nasce vazia: sem funil, sem tags, sem automação. O dono pediu (2026-09-29):

1. Toda empresa **nova** nasce com trackings de exemplo (Atendimento, Vendas, Entrega e Separação, Financeiro, Jurídico), com a descrição "Esse CRM foi criado como exemplo, você pode alterar seu nome, assim como as colunas", colunas e tags padrão.
2. Tags aplicadas sozinhas: compra no catálogo → "Catálogo"; mensagem do cliente → "Em atendimento"; demora na resposta ou nova mensagem sem resposta → "Aguard. atendimento"; canal de origem → "WhatsApp", "Instagram", "Facebook", "Chat do site".
3. Cada app tem um link próprio. Quem se cadastra por ele fica com o app como **principal** e cai direto nele. O "Copiar link" fica em `/apps`.

Decisões do dono: seguir as sugestões (quinto tracking = Vendas; colunas sugeridas; 15 min para "Aguard. atendimento"); aplicar **só nas empresas novas**.

## 2. Objetivo

Empresa nova já sai usável, com funis, tags e marcação automática; e cada app pode ser divulgado com um link que leva o cliente direto a ele.

### Não-objetivos

- Aplicar o padrão às empresas que já existem.
- Tela nova de configuração das tags automáticas: a loja desliga uma regra arquivando a tag padrão; regras extras continuam nos Gatilhos.
- Presets de agente de IA nos trackings de exemplo (os trackings criados pela tela seguem recebendo).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Ao criar empresa, criar 5 trackings com descrição padrão, colunas, motivos de ganho/perda e IA desligada; o criador é OWNER de todos. Sem cobrança de ⭐. |
| RF-2 | Ao criar empresa, criar as tags de empresa (`trackingId = null`, `type = SYSTEM`): Catálogo, Em atendimento, Aguard. atendimento, WhatsApp, Instagram, Facebook, Chat do site. |
| RF-3 | Mensagem do cliente (inbound) aplica a tag do canal e "Em atendimento". Se já havia mensagem do cliente sem resposta, aplica também "Aguard. atendimento". |
| RF-4 | 15 min após uma mensagem do cliente sem resposta, aplica "Aguard. atendimento". |
| RF-5 | Resposta do atendente remove "Aguard. atendimento". |
| RF-6 | Pedido do catálogo (lead de origem NERP_CATALOG) recebe "Catálogo". |
| RF-7 | Regra só atua se a empresa tem a tag padrão ativa (não arquivada), achada pelo slug. Tag já aplicada não é reaplicada (não redispara gatilhos LEAD_TAGGED). |
| RF-8 | `/app/<chave>`: logado → abre o app; sem sessão → cadastro com o app guardado em cookie (sobrevive ao login Google). |
| RF-9 | Ao criar a empresa com esse cookie, o app vira principal (`home:<chave>`) e o usuário é levado a ele. |
| RF-10 | Card de cada app em `/apps` tem "Copiar link". |

## 4. Critérios de aceite

- [ ] **CA-1** — Empresa criada pela tela tem 5 trackings com as colunas e a descrição padrão, e as 7 tags padrão.
- [ ] **CA-2** — Mensagem de cliente no chat do site em empresa nova aplica "Chat do site" e "Em atendimento".
- [ ] **CA-3** — Segunda mensagem sem resposta aplica "Aguard. atendimento"; resposta do atendente remove.
- [ ] **CA-4** — Empresa antiga (sem tags padrão) não recebe nenhuma tag automática.
- [ ] **CA-5** — `/app/campanhas` sem sessão leva ao cadastro; após criar a empresa, Campanhas é o app principal e abre direto.
- [ ] **CA-6** — `/app/campanhas` logado abre `/campanhas` sem mudar o app principal.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Seed falha no meio | Empresa continua criada; erro só no log (best-effort, depois do commit). |
| CB-2 | Loja arquiva "Em atendimento" | Regra para de aplicar essa tag; as outras seguem. |
| CB-3 | Chave de app inexistente em `/app/<chave>` | Vai para `/apps` (logado) ou cadastro normal. |
| CB-4 | Cookie de app e usuário que já tem empresa | Cookie só é consumido na criação de empresa; nada muda para quem já tem. |
| CB-5 | Instagram/Facebook (webhooks próprios) | Aplicam as mesmas regras de inbound. |
| CB-6 | Empresa criada fora do cadastro (resgate do trafeGO, compra de curso NASA Route, calendário público) | Não recebe o padrão: esses fluxos criam empresa com escopo de um app só e não passam por `afterCreateOrganization`. |
| CB-7 | Resposta enviada pelo portal do pedido (sem WhatsApp) | Não passa pelo pipeline de mensagens; "Aguard. atendimento" só sai na próxima resposta que passar por ele. |

## 6. Decisões de design

### D-1 — Tags automáticas no código, ligadas às tags padrão

A regra vive no pipeline de mensagens e só atua quando a empresa tem a tag padrão (slug fixo, tipo SYSTEM). Descartado: gatilhos de workflow por tracking — o gatilho "mensagem recebida" só existe para WhatsApp em modo agente, não há gatilho de tempo sem resposta (LAST_INBOUND_TIMEOUT foi removido) e seriam 5 trackings × 4 workflows por empresa.

### D-2 — Só empresas novas

Empresas antigas não têm as tags padrão, então as regras não as afetam, sem precisar de flag.

### D-3 — Cookie `nasa_app` para o link de app

Mesmo padrão do `?ref=` (a rota `/app/<chave>` grava o cookie): atravessa o login Google e a criação da empresa sem depender de parâmetro de URL.

## 7. Arquivos

- `src/features/org-defaults/lib/default-org-template.ts` — trackings, colunas e tags padrão (dados).
- `src/features/org-defaults/lib/seed-new-organization.ts` — cria o padrão (chamado em `afterCreateOrganization`).
- `src/features/org-defaults/lib/auto-tags.ts` — regras de tag automática.
- `src/inngest/functions/org-defaults/await-reply-tag.ts` — checagem de 15 min.
- `src/app/(public)/app/[appKey]/route.ts`, `src/features/apps/lib/app-signup-link.ts`, `form-create-org.tsx`, `app-card.tsx` — link de app.

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Criada com as decisões do dono (sugestões aceitas, só empresas novas). |
