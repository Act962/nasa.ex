---
id: 0063
titulo: Kit da Marca, conteúdo em vários formatos com o Astro e Astro conhecendo o Planner
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0063 — Kit da Marca, conteúdo em vários formatos com o Astro e Astro conhecendo o Planner

## 1. Contexto

A identidade da marca está espalhada: `Organization` (logo, variantes, paleta, fontes, voz), `NasaPlanner` (frases, palavras proibidas, hashtags, CTAs), campanhas e N-Box. Não há lugar para fundos, produtos/serviços, materiais ou posts de referência, e nenhuma IA recebe isso inteiro. A geração atual do Planner usa Pollinations/DALL-E/Ideogram/Flux, que o usuário vetou por má experiência. O Astro não tem nenhuma ferramenta do Planner. É a Fase A do roteiro de criação de conteúdo (Fase B: WhatsApp; Fase C: Caixa de criações + MCP + Remotion).

## 2. Objetivo

Cada cliente tem um Kit da Marca completo num lugar só; o criador gera, com a IA do Astro, um roteiro por formato a partir de uma ideia — só com o kit completo — e o Astro lê e opera o Planner com confirmação.

### Não-objetivos

- Gerar imagem ou vídeo com IA (a arte sai do kit ou de upload; modelo de imagem fica para decisão futura).
- Pollinations, DALL-E, Ideogram, Flux (vetados).
- WhatsApp, MCP, Remotion (Fases B e C).
- Upload de arquivo de fonte (só Google Fonts nesta fase).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Tela **Kit da Marca** (`/nasa-planner/kit`) por cliente (orgs do usuário com permissão no Planner): logos (colorida, preta, branca, ícone, horizontal), cores, fundos, tipografia, voz (tom, público/posicionamento, frases, palavras proibidas, hashtags, CTAs), produtos e serviços, sites/releases/materiais, posts de referência. |
| RF-2 | Medidor de completude com 9 itens e o que falta: logo colorida · logos branca e preta · 2+ cores · fonte de título · tom de voz · público ou posicionamento · 1+ produto/serviço · site ou material · 1+ post de referência. |
| RF-3 | Dados reaproveitam o que existe: logos em `Organization.brandLogoUrl` + `brandLogoVariants` (`{color, black, white, icon, horizontal}`), paleta/fontes/voz em `Organization`, frases/proibidas/hashtags/CTAs no planner padrão da org. Fundos, produtos, materiais e referências no novo `BrandKitAsset`. |
| RF-4 | Passo Roteiro: escolher **vários formatos**; cada formato vira um rascunho ligado à mesma ideia. |
| RF-5 | **Gerar com o Astro**: a partir da ideia, devolve por formato título, roteiro, legenda, hashtags, CTA e direção de arte usando o kit. Modelo pelo roteador do Astro (`resolvePrimaryModel`, Claude/GPT, chave da empresa ou da plataforma). Cobra `astro_prompt` só na chave da plataforma. |
| RF-6 | Kit incompleto: mensagem **"Kit da marca incompleto"**, lista do que falta, atalho "Completar kit" e botão de gerar **desligado**. O servidor também recusa. |
| RF-7 | Pacote `planner` do Astro — leitura: calendário, rascunhos, aprovações pendentes, números de um post, status do kit; escrita com confirmação: criar rascunho, programar post aprovado. |
| RF-8 | Âncoras e guia do Astro para o Kit e o "Gerar com o Astro". |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Toda leitura/escrita do kit checa membro da org + permissão do Planner (`view`/`create`). |
| RNF-2 | Upload em produção pelo R2 (`/api/s3/upload`); em desenvolvimento, se o R2 recusar, cai no `/api/upload-local` (só imagem). |

## 4. Critérios de aceite

- [x] **CA-1** — Kit salva e recarrega logos, cores, fontes, voz, produtos, materiais e referências.
- [x] **CA-2** — Medidor mostra "N de 9" e o que falta, coerente com os dados.
- [x] **CA-3** — Kit incompleto: botão desligado, mensagem e atalho; chamada direta ao servidor recusa.
- [x] **CA-4** — Kit completo: gerar devolve um roteiro por formato escolhido; "Criar N rascunhos" cria os posts.
- [x] **CA-5** — Astro responde "o que está programado esta semana?" e cria rascunho com confirmação.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Sem nenhuma IA configurada (sem chave da empresa nem da plataforma) | Erro legível "Configure uma IA nos Satélites". |
| CB-2 | Sem saldo de Stars na chave da plataforma | Erro de saldo; nada é gerado. |
| CB-3 | Um formato só | Fluxo atual: cria o rascunho e segue para Criação. |
| CB-4 | Vários formatos | Cria todos, abre o primeiro, avisa quantos foram criados. |
| CB-5 | Usuário sem `create` na org | Kit somente leitura; gerar e criar recusados. |

## 6. Decisões de design

### D-1 — Reaproveitar campos existentes + uma tabela nova
Logos/paleta/fontes/voz já existem em `Organization` e são lidos por `buildBrandedContext`; duplicar quebraria esse consumidor. Só o que é lista de itens (fundos, produtos, materiais, referências) ganha `BrandKitAsset`.

### D-2 — Geração pela infraestrutura do Astro
`resolvePrimaryModel` respeita chave da empresa, ordem de provedores e modelos desligados (spec 0055); evita os provedores vetados e mantém um ponto de custo.

### D-3 — Completude decidida no servidor
O mesmo `computeBrandKitCompleteness` alimenta a tela, a trava do gerar e a ferramenta do Astro — a regra não pode divergir.

## 7. Plano de implementação

- Migration `brand_kit_assets` + enum `BrandKitAssetKind`.
- `src/features/nasa-planner/server/brand-kit/` — leitura/gravação do kit, completude, geração.
- Router `nasaPlanner.brandKit.{get,save,addAsset,removeAsset,generateScripts}`; hooks `use-planner-brand-kit.ts`.
- UI: `components/brand-kit/*`, página `/nasa-planner/kit`, passo Roteiro com formatos + painel do Astro.
- Astro: `src/features/astro/server/tools/planner/` + pack em `app-packs.ts`.
- Guias: âncoras `planner.brandKit*`, guia em `guides/planner.ts`.
- Docs: `docs/nasa-planner-overview.md`.

## 8. Changelog

- 2026-10-04 — criada e implementada. Conferido no navegador: Kit com medidor "0 de 9" e o que falta; Roteiro com vários formatos ("Criar 3 rascunhos"), aviso "Kit da marca incompleto" com botão desligado; servidor recusa a geração com kit incompleto. Depois, kit do ÓRBITA preenchido (logos do SVG oficial, paleta #009EF7/#05070D, Outfit/Inter, voz, produto, material, referência) → 9 de 9; geração de Feed+Carrossel+Reel pela UI (~9 s, gpt-4o-mini na chave da empresa) e "Criar 3 rascunhos" criou os 3 posts; Astro listou rascunhos/aprovações e status do kit e criou rascunho por cartão confirmado.
- 2026-10-04 — Ajustes do teste: (1) schema da geração com um campo fixo por formato (o modelo omitia `format`) e legenda obrigatória; (2) campo **Nome da marca** no kit (`NasaPlanner.brandName`) — o texto usava o nome da empresa; hashtags da marca exigidas literalmente; (3) Planner saiu de `UNREADABLE_APPS` (`astro/queries/platform.ts`), que respondia "ainda não consigo ler o Planner"; (4) triagem guiada (`classify-staged.ts`) devolve null para conteúdo de rede social sem "proposta/orçamento" — "cria um rascunho de reel" virava proposta do Forge; (5) tools aceitam ID de empresa inválido caindo na empresa atual (o modelo inventava o ID e recebia "sem permissão"); links absolutos; prompt proíbe "criei" antes da confirmação e horário inventado.
