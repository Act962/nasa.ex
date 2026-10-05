# orbita-remotion — modelos de vídeo e arte do ÓRBITA

Modelos [Remotion](https://www.remotion.dev) preenchidos pelo Kit da Marca do cliente. Renderizam no seu computador e vão para o Planner do ÓRBITA pelo MCP (skill `orbita-planner`).

## Instalar

```bash
npm install        # ou pnpm install
```

Precisa de Node 18+. O Remotion baixa o Chrome headless na primeira renderização.

## Modelos

| Composição | Formato | Uso | Comando |
| --- | --- | --- | --- |
| `PostReel` | MP4 1080×1920 | Reel com cenas (`scenes[]`, cada uma com `headline`, `body`, `durationSec`, `mediaUrl`) e cartão final com CTA | `npx remotion render PostReel out/reel.mp4 --props=props/reel.json` |
| `StoryFrame` | MP4 1080×1920 | Story (texto na arte; rodapé livre para o link) | `npx remotion render StoryFrame out/story.mp4 --props=props/story.json` |
| `CarouselSlide` | PNG 1080×1350 | Um card de carrossel (`index`, `total`, `variant`: cover/content/cta) | `npx remotion still CarouselSlide out/card-1.png --props=props/carousel-slide.json` |
| `FeedPost` | PNG 1080×1350 | Post de imagem única | `npx remotion still FeedPost out/feed.png --props=props/feed.json` |

- `brand` vem pronto da tool MCP `get_video_templates` (cores, logo, fontes, nome, @).
- Palavra entre asteriscos no título (`*assim*`) fica na cor de destaque da marca.
- `mediaUrl` (imagem ou vídeo https) entra como fundo, com a cor da marca por cima.
- `npm run studio` abre o editor visual para conferir antes de renderizar.

## Licença do Remotion

Gratuito para pessoas e empresas de até 3 funcionários. Empresas maiores precisam de licença: https://www.remotion.dev/license
