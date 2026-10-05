---
id: 0066
titulo: Modelos de vídeo e arte (Remotion) renderizados pelo Claude Code do cliente
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: leve
---

# 0066 — Modelos de vídeo e arte renderizados pelo Claude Code do cliente

## 1. Contexto

Fase C, etapa 2 (etapa 1 = spec 0065). A ideia inicial era renderizar no servidor com Remotion Lambda (AWS). Decisão do usuário: **sem AWS**. Quem cria é o Claude Code do cliente, que renderiza na própria máquina e entrega pelo MCP — o ÓRBITA só guarda, mostra na Caixa de criações e publica depois da aprovação humana.

## 2. Objetivo

O Claude Code baixa um pacote de modelos Remotion, preenche com o Kit da Marca (cores, logo, fontes, nome, @, hashtags, CTA), renderiza Reel/Story/cards de carrossel/post de feed e anexa ao rascunho pelo MCP.

### Não-objetivos

- Botão "Gerar vídeo" dentro do ÓRBITA (exigiria render no servidor — Lambda fica para depois).
- Geração de imagem por IA (herdado da 0063).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Pacote `orbita-remotion` (fonte em `templates/orbita-remotion/`, zip em `public/skills/orbita-planner/orbita-remotion.zip`): composições `PostReel` (9:16, cenas com tempo), `StoryFrame` (9:16), `CarouselSlide` (4:5) e `FeedPost` (4:5), todas por props (`brand` + conteúdo). Fonte do Kit carregada do Google Fonts quando existir. |
| RF-2 | Tool MCP `get_video_templates(organizationId)`: link do pacote, comandos de render e `brand` já preenchido com o Kit (URLs absolutas). |
| RF-3 | Skill `orbita-planner` ensina o fluxo: kit → modelo → render → `request_upload_url` → `attach_media` → `submit_for_approval`. |
| RF-4 | Satélites → IA externa: link "Baixar modelos de vídeo". |
| RF-5 | Dev sem R2 (`EXTERNAL_AI_LOCAL_UPLOADS=true`, nunca em produção): `request_upload_url` devolve um PUT assinado (HMAC, 1 h) para `/api/mcp/upload`, que grava em `public/uploads/external-ai/`. |

## 4. Critérios de aceite

- [x] **CA-1** — `get_video_templates` devolve `brand` com nome, cores, logo absoluto e fontes do Kit do cliente.
- [x] **CA-2** — `PostReel` e `CarouselSlide` renderizam com as props do Kit (MP4 9:16 e PNG 4:5).
- [x] **CA-3** — Vídeo renderizado sobe pelo `request_upload_url`, é anexado ao Reel com `attach_media` e aparece na Caixa de criações; `submit_for_approval` manda para aprovação.
- [x] **CA-4** — Upload local recusa assinatura errada/expirada e não existe em produção.

## 5. Decisões

- **D-1 — Render no cliente, não no servidor.** Sem conta AWS, sem custo de render para o ÓRBITA e sem memória extra na VPS. Custo: depende do computador de quem cria (render lento em máquina fraca).
- **D-2 — Pacote separado do `~/orbita-video`.** O projeto de vídeo comercial tem cenas específicas da ÓRBITA; o pacote é genérico por marca, enxuto (sem three.js) para instalar rápido.
- **D-3 — Licença do Remotion.** Gratuita para indivíduos e empresas de até 3 pessoas; acima disso a empresa que renderiza precisa de licença. Avisado no README do pacote.

## 6. Changelog

- 2026-10-04 — criada e implementada (substitui o plano de Remotion Lambda da 0065).
