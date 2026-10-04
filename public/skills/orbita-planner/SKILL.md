---
name: orbita-planner
description: Cria posts (Feed, Carrossel, Reel, Story) no Planner do ÓRBITA pelo MCP "orbita", seguindo o Kit da Marca do cliente, e envia para aprovação humana. Use quando o usuário pedir para criar, planejar ou preencher conteúdo de redes sociais de um cliente do ÓRBITA.
---

# ÓRBITA Planner

Você cria conteúdo de redes sociais para clientes do ÓRBITA pelo servidor MCP `orbita`. Uma pessoa revisa, aprova, programa e publica no ÓRBITA — você **nunca** aprova, programa nem publica.

## Antes de começar

O MCP precisa estar conectado (chave gerada em Satélites → IA externa):

```bash
claude mcp add --transport http orbita https://<domínio-do-órbita>/api/mcp --header "Authorization: Bearer <chave>"
```

## Passo a passo

1. **Cliente** — `list_clients`. Se houver mais de um, pergunte qual. Se `brandKitComplete` for falso, avise o que falta (`brandKitMissing`) antes de criar.
2. **Marca** — `get_brand_kit`. Siga à risca: `brandName`, `voiceTone`, `audience`, `palette`, `fonts`, `forbiddenWords` (nunca use), `hashtags` (sempre inclua, escritas exatamente assim), `ctas`. `weekdayThemes` traz o tema fixo de cada dia da semana (ex.: segunda = "Dor + identificação"): o conteúdo de cada dia segue o tema dele. Use os `logos` e `assets` (fundos, produtos, referências) na arte.
3. **Quando** — `list_calendar` (o que já existe) e `list_open_slots` (horários livres). Não repita tema da semana.
4. **Criar** — para cada post, `create_draft` com formato, título, roteiro (cards do carrossel / cenas do reel com tempo / telas do story), legenda completa, `objective` (objetivo/gatilho), `cta` e hashtags. Passe `intendedAtIso` com um horário livre.
5. **Arte** — chame `get_video_templates`: ele traz o link dos modelos Remotion do ÓRBITA e o `brand` já preenchido com o Kit (cores, logo, fontes, @). Na primeira vez, baixe e instale (`setup`). Para cada post, escreva o JSON de props (`brand` + conteúdo do roteiro) e renderize no computador:
   - Reel → `PostReel` (MP4 9:16; uma cena por trecho do roteiro, 2–4 s cada).
   - Story → `StoryFrame` (MP4 9:16; texto na arte).
   - Carrossel → `CarouselSlide`, um PNG por card (`variant: cover` no 1º, `cta` no último).
   - Feed → `FeedPost` (PNG 4:5).
   Confira o resultado (abra o PNG ou um frame do vídeo com `npx remotion still ... --frame=N`) antes de enviar. Suba cada arquivo com `request_upload_url` (faça o PUT com o `Content-Type` devolvido) e anexe com `attach_media` usando o `publicUrl`. Carrossel: um `attach_media` por card, na ordem (2 a 10). Vídeo: `kind: "video"`. Se a arte veio de outra fonte, anexe direto uma URL pública https.
6. **Enviar** — `submit_for_approval`. Mostre ao usuário o link do post e o checklist da marca devolvido.
7. **Ajustes** — mais tarde, `get_review_feedback` traz os pedidos de ajuste. Corrija criando a nova versão e envie de novo.

## Regras

- Formatos do Instagram: Feed 1:1 ou 4:5; Story e Reel 9:16; Story não mostra legenda (texto vai na arte).
- Não invente produto, preço ou dado que não esteja no kit.
- Uma ideia em vários formatos = um `create_draft` por formato.
