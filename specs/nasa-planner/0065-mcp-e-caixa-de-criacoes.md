---
id: 0065
titulo: MCP do ÓRBITA para IAs externas e Caixa de criações no Planner
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0065 — MCP do ÓRBITA para IAs externas e Caixa de criações no Planner

## 1. Contexto

Fase C, etapa 1, do roteiro de conteúdo (0063 Kit + Astro; 0064 WhatsApp). O usuário quer aprovar conteúdo criado por Claude, ChatGPT ou qualquer IA generativa. Hoje não há porta de entrada: nenhuma IA externa lê o Kit da Marca nem deixa rascunho no Planner, e o upload manual não guarda de onde veio a criação.

## 2. Objetivo

Uma IA externa (Claude Code e qualquer cliente MCP) conecta com uma chave da empresa, lê kit/calendário/horários e deixa rascunhos; criações de outras IAs entram por upload com a origem marcada; tudo cai na Caixa de criações para revisão humana.

### Não-objetivos

- Aprovar, programar ou publicar pela IA externa (sempre humano).
- OAuth do MCP (chave Bearer por empresa nesta fase).
- Vídeos por Remotion (etapa 2 — spec 0066: renderizados no Claude Code do cliente, sem AWS).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Chave de acesso para IA externa (`ExternalAiAccessToken`): rótulo, empresas permitidas, criada por um usuário; mostrada uma vez (`orb_live_…`), guardada só o hash; revogável; registra último uso. |
| RF-2 | Endpoint `/api/mcp` (MCP Streamable HTTP, sem estado) autenticado por `Authorization: Bearer`. Cada chamada confere a chave, a empresa permitida e a permissão do Planner do dono da chave na empresa. |
| RF-3 | Tools: `list_clients`, `get_brand_kit`, `list_calendar`, `list_open_slots`, `create_draft`, `attach_media` (URL pública), `request_upload_url` (R2), `submit_for_approval`, `get_review_feedback`. Sem aprovar/programar/publicar. |
| RF-4 | Rascunho criado pelo MCP: `source = MCP`, `sourceActorLabel` = rótulo da chave (ex.: "Claude Code"). |
| RF-5 | Satélites → "IA externa": gerar chave (escolhendo empresas), ver comando pronto do Claude Code, lista de chaves ativas com último uso e revogar; baixar a skill `orbita-planner`. |
| RF-6 | Planner → aba "Criações" no painel lateral: rascunhos vindos de IA (MCP, Astro, WhatsApp ou com origem marcada), com filtro por origem, "Revisar" (abre o criador) e "Descartar". |
| RF-7 | Upload de criação de outra IA na Caixa: imagem/vídeo + origem (ChatGPT, Gemini, Midjourney, outra) + formato → rascunho com `sourceActorLabel`. |
| RF-8 | Skill `orbita-planner` (Claude Code) com o passo a passo: ler kit → horários livres → criar rascunho → anexar mídia → enviar para aprovação → ler ajustes. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Chave nunca em texto puro no banco (SHA-256); comparação por hash. |
| RNF-2 | Dono da chave saiu da empresa ou perdeu a permissão → a chamada é recusada. |

## 4. Critérios de aceite

- [x] **CA-1** — Gerar chave mostra o comando do Claude Code com a chave uma única vez.
- [x] **CA-2** — `tools/list` no `/api/mcp` com a chave devolve as 9 tools; sem chave/chave revogada → 401.
- [x] **CA-3** — `create_draft` + `attach_media` criam rascunho com origem "Claude Code" que aparece na aba Criações.
- [x] **CA-4** — Upload na Caixa com origem "ChatGPT" cria rascunho marcado.
- [x] **CA-5** — Nenhuma tool aprova, programa ou publica.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Chave pede empresa fora da lista | Erro "empresa não liberada para esta chave". |
| CB-2 | Kit incompleto | `get_brand_kit` devolve o que falta; criar rascunho continua permitido (a IA externa traz a própria arte). |
| CB-3 | R2 indisponível (dev) | `request_upload_url` falha com mensagem; `attach_media` por URL pública segue funcionando. |

## 6. Decisões de design

### D-1 — Chave Bearer por empresa, não OAuth
É o que o Claude Code aceita com um comando (`--header`). OAuth do MCP fica para depois.

### D-2 — Sem estado no MCP
Servidor e transporte novos por requisição (`WebStandardStreamableHTTPServerTransport`, JSON): cabe em rota do Next e em várias réplicas, sem sessão em memória.

### D-3 — Caixa = filtro, não tabela nova
Criação de IA é um rascunho com origem; a Caixa filtra por `source`/`sourceActorLabel`. Revisão e aprovação são as mesmas do Planner.

## 7. Plano de implementação

- Migration `external_ai_access_tokens`.
- `src/features/external-ai/server/access-tokens.ts` (gerar, verificar, revogar) + router `externalAi.*` + hooks + tela em Satélites.
- `src/features/external-ai/server/mcp/` (tools) + `src/app/api/mcp/route.ts`.
- `nasaPlanner.creations.*` (listar, descartar, upload) + aba "Criações" no painel lateral.
- `public/skills/orbita-planner/SKILL.md`.
- Docs: `docs/nasa-planner-overview.md`.

## 8. Changelog

- 2026-10-04 — criada e implementada. Testado: chave gerada pela tela (comando do Claude Code com a chave uma vez); `initialize` + `tools/list` (9 tools); fluxo list_clients → get_brand_kit (marca ÓRBITA, #orbitahub, logos com URL) → list_open_slots → create_draft → attach_media → submit_for_approval (checklist 5 itens; aviso no WhatsApp do aprovador) → get_review_feedback; empresa fora da chave recusada; sem chave 401; revogada 200 → 401; aba Criações mostra "Claude Code", "Astro" e "ChatGPT" (upload).
- 2026-10-04 — Ajustes do teste: empresa padrão do upload vazia (clientes chegam depois da 1ª renderização); 5 abas no painel de 300 px viraram rolagem horizontal com a aba ativa visível; guia `planner.external-ai` e âncoras `externalAiGenerateKey`/`plannerCreationsTab`.
