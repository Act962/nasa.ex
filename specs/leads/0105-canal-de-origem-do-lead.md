# 0105 — Canal de origem do lead, com nome e ícone

- **Status:** aprovada (Weydson, 2026-10-15)
- **Peso:** leve
- **Domínio:** leads

## 1. Contexto

A Jornada do lead mostra "origem whatsapp" (nome técnico do enum, sem ícone). O cadastro não guarda o canal com detalhe:
Facebook e Linnker nascem como `OTHER`, e comentário de post e direct do Instagram nascem ambos como `INSTAGRAM`.

## 2. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | `LeadSource` ganha `FACEBOOK`, `LINNKER` e `INSTAGRAM_COMMENT` (migration aditiva: `ALTER TYPE ... ADD VALUE`). `INSTAGRAM` passa a ser o Direct. |
| RF-2 | Cada entrada grava o seu canal: webhook do Facebook → `FACEBOOK`; Linnker (leitura e captura) → `LINNKER`; comentário de post do Instagram → `INSTAGRAM_COMMENT`; mensagem direta → `INSTAGRAM`. |
| RF-3 | Uma lista única de canal → nome e ícone (`features/leads/lib/lead-channel.ts`), usada na Jornada e nos rótulos do card. Nomes: Catálogo online, Linnker, Instagram post, Instagram Direct, Facebook, Site, WhatsApp, Formulário, Agenda, Anúncio da Meta, e os demais do enum. |
| RF-4 | Lead antigo é deduzido do que já existe: `OTHER` com conversa do Facebook → Facebook; `OTHER` com leitura do Linnker → Linnker; com `ctwaClid`/`metaAdId` → Anúncio da Meta (o canal da conversa vira detalhe). Sem pista, o rótulo do enum. |

## 3. Critérios de aceite

- **CA-1** — Lead do Catálogo online mostra "Catálogo online" com o ícone de sacola na Jornada.
- **CA-2** — Lead novo do Facebook nasce com `FACEBOOK`; um antigo (`OTHER` com conversa do Facebook) também aparece como Facebook.
- **CA-3** — Comentário de post cria lead `INSTAGRAM_COMMENT` ("Instagram post"); direct cria `INSTAGRAM` ("Instagram Direct").
- **CA-4** — Lead com `ctwaClid` mostra "Anúncio da Meta".

## 4. Segurança de dados

Só rótulo e ícone sobre dados que a pessoa já vê na Jornada; nenhuma consulta nova fora do lead e da conversa dele.

## 5. Impacto

Filtros e relatórios que tratam `OTHER`/`INSTAGRAM` passam a ver os canais novos separados (Insights ganha os rótulos). Lead antigo não é alterado no banco.

## 6. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-15 | Claude | Criação, aprovada pelo Weydson. |
