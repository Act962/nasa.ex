---
id: 0044
titulo: Pedido do catálogo em tracking único, com etapas, tags e avisos padrão
dominio: trackings
status: aprovada
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: completa
---

# 0044 — Pedido do catálogo em tracking único, com etapas, tags e avisos padrão

## 1. Contexto

Teste de PIX real (pedido nº 30, 2026-09-29) mostrou dois defeitos do desenho com dois trackings (pedidos → logística):

- **Conversa escondida**: ao pagar, o lead do pedido é fechado como ganho e a conversa vai para "Finalizados"; o lead que avança na logística é outro, com conversa antiga.
- **Valor errado**: o lead reaproveitado na logística mantém o valor do pedido anterior (R$ 89,90 num pedido de R$ 5,00).

O dono pediu (2026-09-29):

- Tracking "Separação e Entrega" com as colunas padrão **Novo Pedido → Confirmado → Pagamento confirmado → Separado → Entregue**.
- Cada coluna com uma tag de mesmo nome; ao mudar de coluna, a tag da etapa anterior sai.
- Mudanças visíveis na jornada do lead e no painel do pedido.
- Avisos animados na página do pedido e no WhatsApp:
  - "Você ganhou 1 star! — Acompanhe suas Stars e troque em brindes";
  - "Pagamento confirmado";
  - "Pedido enviado para separação";
  - "Pedido em rota de entrega" ou "Pedido separado e pronto para você recolher", conforme a opção do cliente.

Decisões do dono:

- **Tracking único:** o pedido vive inteiro no Separação e Entrega.
- **Alcance:** empresas novas nascem com o padrão; nas empresas atuais há um botão "Aplicar padrão do sistema".
- **Tags:** só as tags de etapa saem ao mudar de coluna.

## 2. Objetivo

Um pedido = um lead = uma conversa, andando por colunas conhecidas pelo sistema. Cada etapa atualiza a tag, a jornada, o painel do cliente e avisa o cliente.

### Não-objetivos

- Mudar o contrato com o NERP. Retirada × entrega continua vindo em texto livre (`delivery.method`).
- Migrar pedidos já existentes para o tracking único.
- Mensagem de "Pedido entregue". O dono não pediu; a etapa só atualiza o painel.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Coluna com **chave de sistema** (`Status.systemKey`): `catalog.new`, `catalog.confirmed`, `catalog.paid`, `catalog.separated`, `catalog.delivered`. Renomear a coluna não quebra o fluxo. |
| RF-2 | Tag de etapa por coluna (SYSTEM, `trackingId` = o tracking), com o nome da coluna. |
| RF-3 | Empresa nova: o tracking "Entrega e Separação" da 0042 nasce com as 5 colunas + chaves + tags (substitui as colunas atuais dele). |
| RF-4 | Empresa atual: o botão "Aplicar padrão do sistema" (integração NERP) cria no tracking de logística escolhido as colunas e tags que faltarem (reaproveita a coluna de mesmo nome, não apaga nada). Aponta "Onde o pedido chega" para `catalog.new` e "Depois do pagamento" para `catalog.paid` **no mesmo tracking**. |
| RF-5 | Pedido chega na coluna `catalog.new`. Cliente recorrente reabre o próprio lead (com a mesma conversa) e o valor passa a ser o do pedido novo. |
| RF-6 | O cliente gera PIX ou link → o lead vai para `catalog.confirmed`, se ainda estiver antes dela. |
| RF-7 | Pagamento confirmado → o lead vai para `catalog.paid`; avisos "Pagamento confirmado" + "Você ganhou 1 star!" (só se ganhou) + "Pedido enviado para separação". |
| RF-8 | Lead entra em `catalog.separated` (arrastado pela equipe) → aviso "Pedido em rota de entrega" (entrega) ou "Pedido separado e pronto para você recolher" (quando `delivery.method` casa com /retir/i). |
| RF-9 | Lead entra em `catalog.delivered` → o pedido fica DELIVERED. |
| RF-10 | Em toda entrada numa coluna com chave de catálogo: entra a tag da etapa, saem as outras tags de etapa, e a jornada registra tag adicionada/removida. As demais tags ficam. |
| RF-11 | O gatilho de etapa reage a todos os caminhos de mudança de coluna: arrastar no board, detalhe do lead, lote, `moveLeadToStage` (pagamento) e ferramentas do Astro/IA. |
| RF-12 | Aviso = mensagem na conversa (aparece no chat do Órbita e na página do pedido) + WhatsApp quando houver instância. Sem instância, não falha: fica só no portal. |
| RF-13 | A página do pedido mostra a linha do tempo das 5 etapas pela coluna do lead e anima cada aviso novo uma vez (o leiaute aprovado). |

## 4. Critérios de aceite

- [ ] **CA-1** — Empresa nova: "Entrega e Separação" tem as 5 colunas com chave e as 5 tags de etapa.
- [ ] **CA-2** — Botão na GOTHAN: o tracking escolhido ganha as colunas e tags que faltam; nada é apagado; a configuração passa a apontar para ele.
- [ ] **CA-3** — Pedido novo cai em "Novo Pedido" com a tag "Novo Pedido"; cliente recorrente reabre o mesmo lead com o valor novo.
- [ ] **CA-4** — Gerar PIX move para "Confirmado" e troca a tag.
- [ ] **CA-5** — Pagar move para "Pagamento confirmado"; a conversa continua na lista principal do chat; chegam os 3 avisos (ou 2, sem star) no portal e no WhatsApp.
- [ ] **CA-6** — Arrastar para "Separado" manda o aviso de entrega ou de retirada, conforme o pedido.
- [ ] **CA-7** — A jornada do lead mostra as trocas de tag de etapa.
- [ ] **CA-8** — Tracking sem as chaves (empresas que não aplicaram o padrão) continua no fluxo atual de dois trackings.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Equipe arrasta de volta para uma coluna anterior | Troca a tag; **não** reenvia avisos já enviados (um aviso por pedido e etapa). |
| CB-2 | Loja apaga uma coluna com chave | A etapa correspondente é pulada; o resto segue. |
| CB-3 | Lead sem pedido de catálogo aberto entra numa coluna com chave | Troca a tag; nenhum aviso. |
| CB-4 | Sem instância de WhatsApp | O aviso fica no chat e no portal; nenhum erro. |
| CB-5 | `delivery.method` vazio | Tratado como entrega. |

## 6. Decisões de design

### D-1 — Chave de sistema na coluna (migration aditiva)

`Status.systemKey String?` + `@@unique([trackingId, systemKey])`. Descartados:

- **Achar a coluna pelo nome:** quebra quando a loja renomeia.
- **Mapa em JSON na integração:** não serve às empresas novas sem NERP, e duplica a verdade.

### D-2 — Um gatilho só, chamado por todos os caminhos

`handleCatalogStageEntry({ leadId, statusId })` em `features/nerp-catalog/lib/stage-flow.ts`:

- Assinado no `eventBus` `lead.status_changed` (cobre arrastar, detalhe, lote e formulário).
- `moveLeadToStage`, as ferramentas do Astro/IA e o executor de automação passaram a publicar o mesmo evento (`publishLeadStatusChanged`). Chamado direto só onde não há mudança de coluna (pedido chegando; pagamento com o lead já em "Pagamento confirmado").
- Roda **depois** do commit, best-effort (Regra 18).

### D-3 — Aviso como mensagem com `metadata.kind = "catalog_order_notice"`

A página do pedido já busca as mensagens a cada 4 s. Ela anima as mensagens desse tipo que ainda não viu (ids guardados no navegador), sem rota nova. O aviso sai por `sendOrderNotice`: grava a mensagem sempre e manda no WhatsApp quando a instância é por QR Code (a API oficial recusa texto livre sem o cliente ter escrito antes). O aviso repetido é evitado por `metadata.noticeKey` (`<pedido>:<tipo>`). `deliverTextToLead` também deixou de falhar sem instância.

## 7. Migration

```prisma
model Status {
  systemKey String? @map("system_key")
  @@unique([trackingId, systemKey])
}
```

Aditiva, sem backfill. Aplicada só com autorização, seguida do ritual da Regra 11.

## 8. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Aprovada (spec, leiaute dos avisos e migration) e implementada. |
| 2026-09-29 | Weydson | Criada a partir do teste de PIX real e das decisões do dono (tracking único, novas + botão, só tags de etapa). |
