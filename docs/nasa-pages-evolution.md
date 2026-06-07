# NASA Pages — Evolução pra builder de landings ricas

> Documento da evolução do `src/features/pages/` aplicada nesta PR. Cobre as 5 fases planejadas pra elevar o NASA Pages de "builder de elementos básicos" pra "construtor de landings completas estilo orbita.nasaex.com".

## TL;DR — o que mudou

| Antes | Depois |
|-|-|
| 13 ElementTypes (text, image, button, etc) | **26 ElementTypes** — átomos + 8 sections prontas + 4 blocos interativos + 1 data-bound |
| Sem templates | **4 templates de página** (Institucional, Captura, Evento, Produto) prontos pra clonar |
| Animações via `AnimationPreset` solto | **15 keyframes nomeadas** com classes CSS em `animations.css` |
| Sem design tokens | **`DesignTokens`** centralizado (cores, gradientes, fontes) na page |
| Sem data binding | **5 data sources** com mock + helper de resolução |

## Mapa de arquivos novos/alterados

### Tipos e core
- ✅ `types.ts` — adicionados 13 ElementTypes + `ElementCategory` + `DataSourceKind` + `DataBindingConfig` + `DesignTokens` + `ANIMATION_PRESET_IDS`
- ✅ `constants.ts` — `ELEMENT_TYPES` atualizado + `ELEMENT_TYPE_CATEGORIES` + `ELEMENT_TYPE_LABELS`
- ✅ `lib/element-factory.ts` — defaults pra cada novo tipo

### Renderers — Sections (Fase 1)
- 🆕 `components/elements/sections/types.ts` — helpers compartilhados (`primaryColor`, `bgColor`, etc)
- 🆕 `components/elements/sections/section-hero.tsx`
- 🆕 `components/elements/sections/section-features.tsx`
- 🆕 `components/elements/sections/section-pricing.tsx`
- 🆕 `components/elements/sections/section-cta.tsx`
- 🆕 `components/elements/sections/section-stats.tsx`
- 🆕 `components/elements/sections/section-testimonials.tsx`
- 🆕 `components/elements/sections/section-faq.tsx`
- 🆕 `components/elements/sections/section-logo-cloud.tsx`

### Renderers — Interativos (Fase 2)
- 🆕 `components/elements/interactive/index.tsx` — `MarqueeBlock`, `TabsBlock`, `AccordionBlock`, `CounterBlock`

### Renderers — Data binding (Fase 5)
- 🆕 `components/elements/data-bound.tsx` — `DataBoundBlock` com 4 layouts (grid/list/table/carousel)
- 🆕 `lib/data-sources.ts` — registry de fontes + mock + helpers

### Sistema de animações (Fase 4)
- 🆕 `lib/animations.css` — 15 keyframes + classes utilitárias `nasa-pages-anim-*`
- 🆕 `lib/animations.ts` — `animationClassName`, `animationStyle`, `resolveGradient`, `DEFAULT_GRADIENTS`

### Templates (Fase 3)
- 🆕 `lib/page-templates.ts` — 4 templates (institucional, captura, evento, produto) + `applyTemplate`
- 🆕 `components/template-gallery.tsx` — galeria UI pronta pra usar no wizard

### Integração existente
- ✅ `components/elements/element-renderer.tsx` — 13 cases novos + prop `tokens` opcional
- ✅ `components/public/public-page-view.tsx` — import de `animations.css`
- ✅ `components/builder/builder.tsx` — import de `animations.css`

## Como usar cada feature

### 1. Adicionar uma section ao canvas

```ts
import { createElement } from "@/features/pages/lib/element-factory";

const hero = createElement("section-hero", palette);
// → { id, type: "section-hero", x: 0, y: 0, w: 1200, h: 560,
//     badge, titleLine1, titleLine2, subtitle, primaryCta, ... }
```

User pode então editar cada prop via properties panel (já existe, suporta os campos novos via reflexão de `element[propName]`).

### 2. Aplicar um template de página

```tsx
import { TemplateGallery } from "@/features/pages/components/template-gallery";
import { applyTemplate } from "@/features/pages/lib/page-templates";

<TemplateGallery
  onSelect={(template) => {
    const result = applyTemplate(template.id);
    if (result) {
      // Substitui layout.main.elements pelos elementos do template
      // e seta tokens na page
      setLayout({
        ...layout,
        main: { ...layout.main, elements: result.elements },
        tokens: result.tokens,
      });
    }
  }}
  onStartBlank={() => createEmptyPage()}
/>
```

**Integração sugerida:** chamar antes da `Layers` step no `create-page-wizard.tsx`.

### 3. Bloco data-bound (dados reais)

```ts
const block = createElement("data-bound", palette);
block.binding = {
  source: "plans-list",  // ou "nasa-route-courses", "space-points-leaderboard"...
  limit: 4,
  layout: "grid",        // ou "list", "table", "carousel"
};
```

**Resolução real:** `lib/data-sources.ts` retorna mocks hoje. Próxima evolução: substituir `resolveDataSource()` por hooks oRPC reais (já tem stubs documentados nos comments).

### 4. Animações

Qualquer elemento aceita:
```ts
element.animation = {
  preset: "slide-up",       // qualquer AnimationPresetId
  trigger: "entrance",       // pra controle futuro
  durationMs: 700,           // override default
  delayMs: 100,
};
```

Aplicar no JSX (via helper):
```tsx
import { animationClassName, animationStyle } from "@/features/pages/lib/animations";

<div
  className={animationClassName(element.animation)}
  style={animationStyle(element.animation)}
>
  ...
</div>
```

### 5. Design tokens

```ts
layout.tokens = {
  colors: {
    primary: "#7C3AED",
    accent: "#a78bfa",
    bg: "#0f172a",
    fg: "#f8fafc",
    muted: "#94a3b8",
  },
  gradients: {
    hero: "linear-gradient(135deg, #7C3AED, #ec4899)",
  },
  fontFamily: "Inter",
  radiusBase: 12,
};
```

Sections consomem automaticamente via `primaryColor(element, tokens)` (fallback pro default se token ausente).

## Upload de imagens (logos, hero, slides)

Todos os uploaders do NASA Pages (`LogoUploader` na Navbar/Footer, `ImageUploaderField`, `HeroImageUploader`, `ImageProps`) chamam o helper único [`uploadImage()`](../src/features/pages/lib/upload-image.ts).

**Fluxo atual** (2026-06):

- `uploadImage(file)` → `POST /api/s3/upload-direct` (server-side PUT no R2, sem CORS).
- Resposta `{ key }` + `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` → URL pública `https://<bucket-host>/<key>`.
- Se a env var ou o endpoint falharem, joga erro (toast pro user). **Sem fallback local em `/uploads/`** — em prod o volume não justifica, e em dev força configurar R2 corretamente.

**Substituir depois (quando CORS no bucket R2 `nasa-ex` estiver configurado):**

- Trocar `uploadImage` pelo fluxo presigned-URL (`POST /api/s3/upload` → `PUT presignedUrl`), igual ao [`components/file-uploader/uploader.tsx`](../src/components/file-uploader/uploader.tsx) e aos uploaders das features `actions`, `tracking-chat`, `nasa-planner`.
- Vantagem: arquivo vai browser → R2 direto, sem passar pelo nosso server (poupa banda/RAM).
- Pendência rastreada em `CLOUDFLARE_R2_CORS_PENDING.md` (raiz) e no header de `src/app/api/s3/upload/route.ts`.

## Roadmap das próximas iterações

| Item | Status |
|-|-|
| Properties panel sub-painéis por section type (editor de lista de features, lista de plans) | ⚠️ Hoje usa reflection genérica — funciona mas UX bruta |
| Data sources reais via oRPC (não mock) | ⚠️ Mock por enquanto |
| Trocar `uploadImage` pelo fluxo presigned URL (após CORS no R2) | ⚠️ Hoje usa `/api/s3/upload-direct` server-side |
| Mais templates (5+) | Adicionar em `page-templates.ts` |
| Bloco `comparison-table` (vs concorrentes) | Não feito |
| Bloco `timeline` / `steps` | Não feito |
| Page-level dark/light auto | Não feito |
| Snap-to-grid + alignment guides no builder | Não feito |
| Undo/redo persistente | Não feito |

## Compatibilidade

- **100% aditivo** — nenhum ElementType existente foi alterado.
- Pages criadas antes desta PR continuam funcionando — o `default` no switch do renderer cuida do desconhecido (`return null`).
- Novos campos opcionais (`tokens` em `PageLayout`) — pages antigas sem token usam fallbacks dos sections.
