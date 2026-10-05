---
id: 0060
titulo: Disparo de WhatsApp pelo Planner e Reel/Story no Facebook
dominio: nasa-planner
status: implementada
autor: Weydson
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: leve
---

# 0060 — Disparo de WhatsApp pelo Planner e Reel/Story no Facebook

## 1. Contexto

O calendário de conteúdo não mostra os disparos de WhatsApp (Campanhas), e programar um disparo exige outro App preso à org ativa. Reel e Story ficaram só no Instagram na Fase 1.

## 2. Objetivo

Programar um disparo em massa da API Oficial a partir do calendário do Planner, para qualquer cliente com número oficial conectado, e ver todos os disparos no calendário ao lado dos posts. Publicar Reel e Story também na página do Facebook.

Fora do escopo: criar modelos (templates) — usa os aprovados; público por CSV; taxa de disparo (segue a regra das Campanhas).

## 3. Requisitos

- **RF-1** `clients.list` informa se o cliente tem número oficial (`WhatsAppInstance` META_CLOUD).
- **RF-2** Menu Criar → "Disparo WhatsApp" abre um assistente: cliente → número → modelo aprovado (com variáveis: nome do contato ou texto fixo) → público (leads do tracking do número, com filtro de temperatura e etapa) → data/hora.
- **RF-3** `nasaPlanner.broadcasts.createScheduled` cria a campanha na org do cliente (não na org ativa), adiciona os destinatários, grava o modelo e agenda — mesmas validações das Campanhas (`assertMetaCloudTracking`, `findTemplateMappingProblems`, `assertBroadcastSendable`, `assertBroadcastFeePaid`) e o mesmo evento `campanhas/broadcast.scheduled`.
- **RF-4** `nasaPlanner.calendar.broadcasts` lista disparos das orgs permitidas no período (agendados por `scheduledAt`; enviados por `startedAt`), e o calendário os mostra com ícone de WhatsApp, filtrável pelo tipo "Disparo".
- **RF-5** Permissão: criar disparo exige `canEdit` ou `canApprove` no Planner da org (equivale a programar).
- **RF-6** Reel e Story na página do Facebook: Reel por `/{page}/video_reels`, Story de foto por `/{page}/photo_stories`, Story de vídeo por `/{page}/video_stories` (upload por URL).

## 4. Critérios de aceite

- **CA-1** Cliente sem número oficial → "Disparo WhatsApp" aparece desativado com a explicação.
- **CA-2** Disparo programado pelo Planner aparece no calendário e na lista das Campanhas daquela org, com status Agendado.
- **CA-3** Modelo com 2 variáveis e só 1 configurada → bloqueia com a mensagem das Campanhas.
- **CA-4** Público vazio (nenhum lead com telefone) → bloqueia antes de agendar e não deixa campanha órfã agendada.
- **CA-5** Reel marcado para Instagram e Facebook publica nos dois; Story de foto e de vídeo publicam na página.

## 5. Casos de borda

- **CB-1** Taxa de disparo não paga → erro das Campanhas; a campanha fica em rascunho na org (aparece nas Campanhas para pagar e agendar).
- **CB-2** Usuário sem acesso ao Planner da org → FORBIDDEN.

## 9. Riscos e rollback

Sem schema novo. Rollback: esconder a opção no menu Criar; campanhas criadas seguem nas Campanhas.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-04 | Weydson | Criada (Fase 2) |
| 2026-10-04 | Weydson | Implementada; migration `20261004230000_planner_comments_link` aplicada. |
