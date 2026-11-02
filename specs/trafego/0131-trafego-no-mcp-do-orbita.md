---
id: 0131
titulo: trafeGO no MCP do ÓRBITA — a equipe trabalha os pedidos pela própria IA
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-11-02
atualizada: 2026-11-02
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0131 — trafeGO no MCP do ÓRBITA

## 1. Contexto

O ÓRBITA já tem um MCP para IAs externas (spec 0065): em Satélites → **IA externa**, a pessoa gera uma chave
(`orb_live_…`), escolhe as empresas e liga no Claude Code, ChatGPT ou outra IA. Hoje ele só tem ferramentas do
Planner.

No trafeGO, a gestora de tráfego precisa abrir o admin, entrar em cada pedido e ler briefing, criativo, texto,
orientação do Astro, números e recomendações para só então ir à Meta ajustar. Com a spec 0130 isso ficou num
prompt para colar no Claude — mas ainda exige abrir o admin pedido a pedido e copiar e colar nos dois sentidos.

O objetivo é que a gestora faça tudo **dentro da IA dela**: perguntar "o que tem para fazer hoje no trafeGO?",
ler o pedido inteiro, montar a campanha com o MCP da Meta que ela já tem na máquina e devolver a recomendação
ao cliente — sem abrir o painel.

## 2. Objetivo

O MCP do ÓRBITA ganha ferramentas do trafeGO para a **equipe**: listar o que precisa de ação em todas as
empresas, ler um pedido completo, ver os números dos anúncios, pegar o roteiro de publicação, enviar
recomendação para o cliente aprovar, registrar a campanha criada e anotar o que foi feito.

### Não-objetivos

- **O MCP do ÓRBITA não mexe na Meta.** Pausar, ativar, mudar verba e criar campanha continuam no MCP da Meta
  da gestora (ou no painel). O ÓRBITA só entrega os dados e recebe o resultado.
- **Aprovar pelo cliente.** Só o cliente aprova, no painel (spec 0130).
- **Ferramentas do trafeGO para clientes.** v1 é só para a equipe (admin do sistema).
- **Dinheiro**: nada de cobrança, complemento, estorno ou mudança de verba do pedido pelo MCP.

## 3. Requisitos

### Funcionais

- **RF-1 — Chave com escopo trafeGO.** Ao gerar a chave em IA externa, **admin do sistema** vê a opção
  "Incluir ferramentas do trafeGO (equipe)". A chave guarda os escopos (`planner`, `trafego`). Chaves antigas
  continuam só com `planner`. Quem não é admin do sistema não vê a opção.
- **RF-2 — Conferência a cada chamada.** Toda ferramenta do trafeGO confere, na hora, que a chave tem o
  escopo `trafego` **e** que o dono da chave **ainda é** admin do sistema. Perdeu o admin, a chave para de
  funcionar para o trafeGO na mesma hora (as do Planner seguem as regras delas).
- **RF-3 — Alcance.** As ferramentas do trafeGO veem os pedidos de **todas** as empresas, como o admin do
  trafeGO já vê. A lista de empresas da chave continua valendo só para o Planner.
- **RF-4 — Ferramentas de leitura:**
  - `trafego_list_orders` — pedidos com o que pede ação: código, empresa, status, "precisa de aprovação",
    aprovado e não publicado, sem criativo ou texto, dias parado. Filtros: status, "só o que precisa de ação",
    empresa. Até 50 por vez.
  - `trafego_get_order` — o pedido completo: briefing, público, verba e datas, criativos (link assinado de
    24 h), textos, mensagem inicial, orientação do Astro, conta e página da Meta da empresa, histórico visível
    e recomendações com o estado (pendente, aprovada, substituída).
  - `trafego_get_publish_brief` — o mesmo roteiro da spec 0130 (regras + dados + bloco de recomendações), para a
    IA montar a campanha com o MCP da Meta.
  - `trafego_get_ad_insights` — números por anúncio do pedido no período (os mesmos do painel), nota de
    qualidade e o diagnóstico de cada indicador ruim (spec 0128).
- **RF-5 — Ferramentas de escrita** (todas viram evento no histórico, com "via IA externa · <nome da chave>"):
  - `trafego_send_recommendation` — envia ao cliente para aprovar (mesma regra da spec 0130: substitui a
    anterior sem resposta e avisa por WhatsApp).
  - `trafego_link_meta_campaign` — grava o id da campanha criada na Meta no pedido (o mesmo "vincular campanha"
    do admin). Confere que a campanha existe na conta da empresa antes de gravar.
  - `trafego_add_team_note` — nota interna da equipe (não aparece para o cliente).
- **RF-6 — Instruções do servidor.** Quando a chave tem o escopo `trafego`, as instruções do MCP ganham o
  fluxo: `trafego_list_orders` → `trafego_get_order` → `trafego_get_publish_brief` → (MCP da Meta: criar
  pausado) → `trafego_link_meta_campaign` → `trafego_send_recommendation` → esperar aprovação → ativar na Meta.
- **RF-7 — Satélites.** A chave mostra "Planner" e/ou "trafeGO" na lista de chaves ativas.

### Não-funcionais

- **RNF-1 — Mesma chave, mesmo endereço.** Nada de servidor ou chave nova: o `/api/mcp` registra as
  ferramentas do trafeGO só para chave com o escopo.
- **RNF-2 — Respostas enxutas.** Listas com no máximo 50 itens e só os campos usados; números já calculados.
- **RNF-3 — Sem segredo na resposta.** Nunca token da Meta, chave de API ou dado de lead.
- **RNF-4 — Limite.** `takeRateLimit` por chave (120 chamadas por hora).

## 4. Critérios de aceite

- **CA-1** — Admin do sistema gera chave com trafeGO; a IA vê as ferramentas `trafego_*` no `tools/list`.
- **CA-2** — Chave sem o escopo (ou de quem não é admin) não vê nenhuma ferramenta `trafego_*`.
- **CA-3** — Dono da chave perde o admin do sistema: a próxima chamada `trafego_*` é recusada.
- **CA-4** — `trafego_list_orders` com "só o que precisa de ação" traz o pedido com recomendação pendente e o
  pedido sem criativo, de empresas diferentes.
- **CA-5** — `trafego_get_order` traz briefing, criativo com link, texto, mensagem inicial e orientação; nada
  de token.
- **CA-6** — `trafego_send_recommendation` faz o selo "Precisa de aprovação" aparecer no painel do cliente e o
  evento mostrar o nome da chave.
- **CA-7** — `trafego_link_meta_campaign` com id de campanha de outra conta é recusado.
- **CA-8** — `trafego_add_team_note` aparece no admin e **não** no painel do cliente.

## 5. Casos de borda

- **CB-1 — Empresa sem Meta conectada.** `trafego_get_order` diz "conta não conectada" e o roteiro lista o que
  falta; `trafego_get_ad_insights` explica que não há números.
- **CB-2 — Token da Meta vencido na empresa.** Insights devolvem a mensagem de reconectar, sem quebrar a lista.
- **CB-3 — Código digitado em minúsculas ou sem o prefixo.** Aceita `tg-0042` e `0042`.
- **CB-4 — Chave revogada no meio da conversa.** Próxima chamada é recusada (já é assim no MCP).

## 6. Decisões de design

### D-1 — Escopo explícito na chave, não "todo admin ganha tudo"

Uma chave do Planner que um admin entregou a uma IA para criar posts não pode, de repente, ler os pedidos de
todos os clientes do trafeGO. O escopo é escolhido ao gerar a chave. Custa uma coluna (`scopes`, lista de texto,
padrão `{planner}`).

### D-2 — O ÓRBITA não chama a Meta pelo MCP dele

A escrita na Meta fica com o MCP da Meta da gestora, que já pede confirmação e usa a conta dela. Duplicar isso
no ÓRBITA criaria um segundo caminho de gasto de dinheiro. A exceção é a leitura de números, que reaproveita o
que o painel já lê, e a conferência do id da campanha (RF-5).

### D-3 — Reaproveitar, não reescrever

`trafego_get_publish_brief` usa `buildPublishPrompt` (spec 0130); `trafego_send_recommendation` usa a mesma
função do admin; `trafego_get_ad_insights` usa `getOrderAdsPerformance` (spec 0126/0128);
`trafego_link_meta_campaign` usa o vínculo do admin. As ferramentas são uma porta nova para regras que já
existem.

## 7. Impacto

- **Schema:** coluna `scopes text[] default '{planner}'` em `external_ai_access_tokens`. Sem tabela nova.
- **Código:**
  - `src/features/external-ai/server/mcp/trafego-mcp-tools.ts` (ferramentas novas);
  - `src/app/api/mcp/route.ts` (registra por escopo e ajusta as instruções);
  - `access-tokens.ts` (escopos na criação e na autenticação);
  - extração das funções do admin (`sendForApproval`, `linkMetaCampaign`, montagem do prompt) para
    `src/features/trafego/server/lib/` — as procedures e o MCP chamam a mesma função;
  - Satélites → IA externa: opção do escopo e selo na lista.
- **Docs:** `docs/trafego-playbook-gestor.md` (como ligar e usar) e `docs/trafego-overview.md`.

### Segurança de dados

- Só admin do sistema cria e usa o escopo, conferido a cada chamada (RF-2).
- A chave guarda só o hash (como hoje); revogar corta na hora.
- Respostas sem token, chave de API ou dado de lead (RNF-3). Links de criativo assinados e com prazo.
- Toda escrita fica no histórico do pedido com o nome da chave (RF-5).

### Regras da Meta

- Nada é publicado ou ativado pelo ÓRBITA. O roteiro manda criar pausado e ativar só depois da aprovação do
  cliente.

## 8. Plano de testes

- `scripts/trafego-0131-qa-check.ts`: regras puras de "precisa de ação" e da normalização do código (CB-3).
- Chamada real ao `/api/mcp` com chave de teste (com e sem escopo): CA-1, CA-2, CA-4, CA-5.
- Navegador: CA-6 e CA-8.

## 9. Riscos e rollback

- **Chave vazada com escopo trafeGO** lê dados de todos os clientes do trafeGO. Mitigação: só admin do sistema,
  aviso claro na tela ao marcar, revogação imediata e `lastUsedAt` visível.
- **IA escreve recomendação errada para o cliente.** Mitigação: o cliente ainda precisa aprovar; a nota interna
  serve para rascunho antes de enviar.
- **Rollback:** sem o escopo na chave, nenhuma ferramenta aparece. A coluna tem padrão e não muda chaves antigas.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-02 | Weydson Lima (com Claude) | Criação. |
| 2026-11-02 | Weydson Lima (com Claude) | Implementada. `trafego-mcp-tools.ts` (7 ferramentas), `lib/team-actions.ts` (o que precisa de ação, código do pedido), `server/lib/order-publish.ts` (roteiro e recomendação extraídos do admin: admin e MCP usam a mesma função), `server/lib/link-meta-campaign.ts` (confere a campanha na conta da empresa). Divergências: (1) o nome da chave não aparece para o cliente: a recomendação tem o título de sempre e a origem fica numa nota interna; (2) o vínculo pelo MCP só funciona para empresa com a Meta conectada nos Satélites (o vínculo antigo pela agência continua no admin). Migration `20261102120000_trafego_approval_and_ai_token_scopes` (junto com a da 0130). |
