# Jornada espacial — elementos de gamificação

> Catálogo visual e técnico do "game" de progresso da ÓRBITA: foguete subindo por planetas e asteroides, ganhando STARs a cada parada. Primeiro uso: assistente **Conectar número oficial** (Disparo em Massa, spec 0040). Leia antes de levar a jornada para outra página.

## 1. Ideia

Todo fluxo longo (configuração, onboarding, curso) vira uma **viagem**:

| Metáfora | Significado no produto |
|---|---|
| **Plataforma / primeiro planeta** | Ponto de partida (ex.: "Seu número") |
| **Planeta** | Uma **etapa** (fase) do fluxo |
| **Asteroide** | Um **passo** dentro da etapa |
| **Foguete** | Onde o usuário está agora |
| **Trilha tracejada** | Caminho: verde = percorrido, lilás = o que falta |
| **STARs** | Recompensa por parada visitada (+1 asteroide, +5 planeta) |
| **Combustível** | % concluído (barra no rodapé) |
| **Destino** | Último planeta, maior e com anel (ex.: "Número oficial!") |

O foguete sobe de **baixo para cima**, em zigue-zague, como no esboço original.

## 2. Referências de estilo

Links apenas (não copiar arte):

| Referência | O que tiramos dela |
|---|---|
| [EnCosmos — Learning app](https://dribbble.com/shots/8084446-EnCosmos-Learning-app) | Trilha tracejada curva ligando planetas numerados, fundo violeta profundo, foguete com rastro de fumaça, barra de "combustível" no rodapé |
| [Rocket Rush — Clicker](https://dribbble.com/shots/25256968-Rocket-Rush-Clicker) | Foguete claro com escotilha azul e chama azul; contador grande de moedas; "+1" subindo e sumindo a cada ganho |
| [Planet App Concept](https://dribbble.com/shots/15841356-Planet-App-Concept-Full-Version) | Planetas ilustrados flat com **faixas onduladas**, anéis e cores saturadas (laranja, lilás, verde-água) |
| [Gamified Crypto Staking — Discover Planets](https://dribbble.com/shots/25935887--Gamified-Crypto-Staking-UI-Discover-Planets) | Planetas com **crateras**, trilha verde no trecho feito e roxa no que falta, planeta futuro **bloqueado** (apagado), luas pequenas, brilhos ✦ |

## 3. Tokens visuais

| Token | Valor | Uso |
|---|---|---|
| Fundo | gradiente `#1b1640 → #231a52 → #0f0c29` | Painel (sempre escuro, também no tema claro) |
| Nebulosas | `fuchsia-500/20` e `sky-500/15`, `blur-3xl` | Brilhos de canto |
| Estrelas de fundo | pontos brancos 2–4 px, piscando (`animate-space-twinkle`) | 28 posições fixas (determinísticas, sem `Math.random` — evita erro de hidratação) |
| Trilha feita | `#34d399` (emerald-400), tracejado `4 5`, 2 px | |
| Trilha futura | `#a78bfa` a 45%, tracejado `4 5`, 1,5 px | |
| Parada bloqueada | `opacity-45 saturate-50` | Tudo depois do foguete |
| Parada feita | selo verde ✓ no planeta; asteroide a 60% | |
| Parada atual | planeta maior (42 px) + `animate-ping` verde | |
| STARs | ícone ⭐ `amber-400`, chip `bg-white/10` | |
| Combustível | barra `amber-400 → fuchsia-500 → emerald-400` | |

### Paletas de planeta (`PlanetPalette`)

`amber`, `violet`, `teal`, `rose`, `sky`, `lime` — cada uma com `light / base / dark / detail / ring`. Superfícies (`PlanetSurface`): `bands` (faixas onduladas) ou `craters` (crateras). Anel opcional (`hasRing`), desenhado em duas metades para passar **atrás e na frente** do planeta.

## 4. Componentes (`src/features/space-journey/`)

| Arquivo | Exporta | Props principais |
|---|---|---|
| `components/space-journey.tsx` | `SpaceJourney` | `stops: JourneyStop[]`, `currentIndex`, `title?`, `className?`, `starCount?` (saldo real no chip, no lugar do +1/+5 por parada), `fuelLabel?` (texto da barra) — painel completo (fundo, trilha, paradas, foguete, STARs, combustível) |
| `components/planet.tsx` | `Planet` | `palette`, `surface`, `hasRing`, `size` — SVG puro, reutilizável fora da jornada (cards, selos, vazios) |
| `components/rocket.tsx` | `Rocket` | `size` — casco claro, bico vermelho, escotilha azul, aletas laranja, chama animada |
| `components/asteroid.tsx` | `Asteroid` | `size` |
| `lib/journey-layout.ts` | `layoutJourney`, `buildTrailPath`, `headingDegrees`, `starsCollected`, `STARS_PER_PLANET`, `STARS_PER_ASTEROID`, tipos | Geometria pura, sem React |
| `index.ts` | barril | Importe sempre de `@/features/space-journey` |

```ts
interface JourneyStop {
  id: string;
  kind: "planet" | "asteroid";
  label?: string;          // planeta: texto ao lado; asteroide: tooltip
  palette?: PlanetPalette;
  surface?: PlanetSurface;
  hasRing?: boolean;
  isDestination?: boolean; // último planeta, maior
}
```

**Layout:** `layoutJourney(stops)` distribui as paradas de baixo (margem 14%) para cima (margem 11%). Planetas pesam 4× mais que asteroides no espaçamento, para rótulos não se atropelarem; o zigue-zague é um seno sobre esse peso. Coordenadas arredondadas a 2 casas (servidor e navegador precisam gerar o mesmo HTML).

**Foguete:** fica na parada `currentIndex`, com `transition` de 700 ms ao mudar; gira para apontar a próxima parada (`headingDegrees`, corrigido pela proporção real do painel via `ResizeObserver`).

**STARs:** `starsCollected(stops, currentIndex)` soma as paradas já visitadas. Quando o total sobe, aparece "+N" subindo e sumindo (`animate-star-gain`).

## 5. Animações (`src/app/globals.css`)

| Classe | Efeito | Duração |
|---|---|---|
| `animate-rocket-flame` | chama pulsando (escala Y) | 0,18 s, infinito |
| `animate-rocket-hover` | foguete flutuando 4 px | 2,4 s, infinito |
| `animate-space-twinkle` | estrelas piscando | 3 s, infinito, atrasos variados |
| `animate-star-gain` | "+N" sobe 22 px e some | 1,4 s, uma vez |

Todas respeitam `prefers-reduced-motion` (as infinitas param).

## 6. Primeiro uso — Conectar número oficial

- `src/features/campanhas/lib/connect-journey.ts` → `buildConnectJourneyStops(guideSteps, cardItemIds)`: "Seu número" → uma parada por passo do guia da Meta (planeta no 1º passo de cada fase, com paleta fixa por fase) → "Cartão na Meta" → destino "Número oficial!".
- O total de paradas é igual ao da barra "Sua configuração", e `currentIndex = overallDone` — o foguete e a barra andam juntos.
- Painel à direita do assistente, só em telas `lg` (220 px, `sticky`, altura do diálogo). O diálogo cresce para `lg:max-w-5xl`.

## 7. Regras para novos usos

1. **Uma parada = uma ação real concluída.** Não criar parada decorativa; o foguete precisa refletir progresso verdadeiro (salvo no banco quando o fluxo for retomável).
2. **Planetas = etapas com nome curto** (até ~25 caracteres; o rótulo quebra em 3 linhas no máximo).
3. **Entre 5 e ~40 paradas.** Mais que isso, agrupe passos (um asteroide por grupo).
4. **Sempre com alternativa textual**: a jornada complementa a barra/lista de passos, não a substitui (leitores de tela e celular).
5. **Painel sempre escuro**, mesmo no tema claro — é "espaço".
6. **Importar só pelo barril** `@/features/space-journey`; a lógica de montar as paradas mora na feature que usa (como `connect-journey.ts`).

## 8. STARs: visual × saldo real

Hoje as STARs da jornada são **só visuais** (não entram no saldo da organização). STARs são moeda da plataforma (`docs/STARS_OVERVIEW.md`), então creditar de verdade é decisão de produto/custo. Caminhos possíveis:

- creditar **Space Points** (feature `space-point`, evento `user/action.tracked`) — reputação, não dinheiro;
- creditar poucas STARs reais só ao **chegar ao destino** (uma vez por organização, idempotente por `trackingId`);
- manter visual.

Até decidir, o texto da interface não deve prometer que as STARs vão para o saldo.

## 9. Próximos lugares candidatos

| Onde | Planetas | Asteroides |
|---|---|---|
| Onboarding da organização | Perfil, Funil, WhatsApp, Equipe, 1º lead | Campos de cada etapa |
| Space Help / trilhas Academy | Módulos | Aulas |
| NASA Route (cursos) | Módulos do curso | Aulas |
| Área do cliente do catálogo (`/pedido`) | Terra, Lua, Galaxy | 1 por ⭐ da vida toda (✅ spec 0041) |
| Configuração de tracking | Status, automações, integrações | Itens de cada uma |
| Estados vazios | `Planet` sozinho como ilustração | — |

**Pendências do componente:** versão compacta horizontal para celular; rastro de fumaça (bolinhas brancas, referência EnCosmos) ao decolar; luas pequenas orbitando o planeta atual; som opcional ao ganhar STARs.

## Changelog

- **2026-09-29** — `starCount` e `fuelLabel`; segundo uso: jornada Terra → Lua → Galaxy do STAR FRIENDS no portal do pedido (spec 0041).
- **2026-09-28** — Criação: `SpaceJourney`, `Planet`, `Rocket`, `Asteroid`, geometria e animações; primeiro uso no assistente Conectar número oficial (spec 0040, RF-16).
