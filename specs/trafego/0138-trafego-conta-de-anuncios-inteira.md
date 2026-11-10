---
id: 0138
titulo: Conta de anúncios inteira no painel do trafeGO
dominio: trafego
status: em-revisao
autor: João Gabriel
criada: 2026-11-10
atualizada: 2026-11-10
branch: feature/trafego-visao-completa-meta-20261110
pr:
peso: leve
---

# 0138 — Conta de anúncios inteira no painel do trafeGO

## 1. Contexto

O painel do cliente (`/trafego/painel`) só mostra campanhas ligadas a um pedido (`TG-NNNN` no nome
ou id vinculado). Quem já anunciava antes, ou cria campanha direto no Gerenciador, não vê o resto da
conta, mesmo com a Meta conectada nos Satélites (spec 0122).

## 2. Objetivo

Uma visão "Toda a conta de anúncios" (`/trafego/painel/conta`) com todas as campanhas da conta da
org, conjuntos e anúncios, e os números do Gerenciador.

### Não-objetivos

- Editar, pausar ou criar campanha por esta tela (continua pelo pedido, spec 0124).
- Gravar números no banco: só leitura ao vivo com o cache de 15 min da 0122.
- Trocar de conta de anúncios: vale a conta configurada na integração da org.

## 3. Requisitos

- **RF-1** Abas "Pedidos do trafeGO" e "Toda a conta de anúncios" no topo do painel (somem no preview).
- **RF-2** Período: hoje, 7, 30 e 90 dias, no fuso da conta, ou personalizado no calendário (shadcn, como
  o filtro do Workspace), até 37 meses para trás; data futura vira hoje.
- **RF-3** Números da conta no período (investido, conversas, custo por conversa, alcance,
  impressões, cliques, CTR, CPM, frequência), gráfico diário e quem foi alcançado (idade, gênero,
  plataforma).
- **RF-7** A lista vem inteira do servidor (a Meta pagina por cursor e o servidor segue os cursores, com
  cache); a tela mostra 20 campanhas e "Ver mais" libera mais 20. Filtro, busca e período voltam ao início.
- **RF-8** Custo sem base (sem conversa, clique ou impressão) aparece como "—" e não ganha seta.
- **RF-4** Campanhas: ativas, pausadas e em análise pela estrutura; arquivadas e excluídas só quando
  gastaram no período. Status, objetivo, orçamento e números; selo e link quando a campanha é de um
  pedido da org. Filtros (com resultado no período, no ar, pausadas, todas) e busca por nome.
- **RF-5** Ao abrir a campanha: conjuntos (status e números somados dos anúncios) e anúncios com a
  mesma tabela do pedido (prévia, status, números, setas contra a média, nota para quem já vê a nota).
- **RF-6** Sem integração: convite para conectar. Erro da Meta: a mensagem da 0122.

## 4. Segurança

- Só a integração Meta da org de quem pede (`resolveOrderMetaAccess`), como o resto do painel.
- O id da campanha vem do navegador: a árvore só vale se `account_id` for o da conta da integração.
- Sem correção pelo Astro nesta tela (depende de pedido).

## 5. Critérios de aceite

- **CA-1** Org com Meta conectada vê campanhas criadas fora do trafeGO.
- **CA-2** Campanha `TG-0002 — …` aparece com o selo do pedido e o link abre o pedido.
- **CA-3** Pedir o detalhe de uma campanha de outra conta devolve "não é da conta conectada".
- **CA-4** Org sem integração vê o convite, sem chamar a Meta.

## 6. Custo

Sem tabela, migration, env, cron ou função do Inngest. Abrir a tela: 4 chamadas à Meta por org e
período a cada 15 min; abrir uma campanha: 1 árvore + 1 Insights (a média da conta é compartilhada
com o detalhe do pedido).

## Changelog

| Data | Mudança |
| --- | --- |
| 2026-11-10 | Criada junto com a implementação. |
| 2026-11-10 | Período personalizado (RF-2) com `AccountPeriodPicker`; trocar o período mantém a tela até o novo chegar. |
| 2026-11-10 | Testada com a conta de um cliente real (cópia local de produção): RF-7 "Ver mais" e RF-8 custo sem base; "Unknown" traduzido. |
