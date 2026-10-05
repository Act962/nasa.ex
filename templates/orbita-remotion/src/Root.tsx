import { Composition, Still } from "remotion";
import { DEFAULT_BRAND } from "./brand";
import { PostReel, REEL_FPS, calculateReelMetadata, type PostReelProps } from "./compositions/PostReel";
import { StoryFrame, type StoryFrameProps } from "./compositions/StoryFrame";
import { CarouselSlide, type CarouselSlideProps } from "./compositions/CarouselSlide";
import { FeedPost, type FeedPostProps } from "./compositions/FeedPost";

const reelDefaults: PostReelProps = {
  brand: DEFAULT_BRAND,
  scenes: [
    { headline: "Seu conteúdo com a *cara* da sua marca", durationSec: 3 },
    { headline: "Monte o Kit uma vez", body: "Logo, cores, fontes e voz num lugar só.", durationSec: 3 },
    { headline: "O Astro cria, *você aprova*", durationSec: 3 },
  ],
  cta: "Comece hoje no Planner",
  hashtags: ["#orbitahub"],
};

const storyDefaults: StoryFrameProps = { brand: DEFAULT_BRAND, headline: "Novo no *Planner*", body: "Crie, aprove e programe em uma tela.", cta: "Toque no link", durationSec: 6 };
const slideDefaults: CarouselSlideProps = { brand: DEFAULT_BRAND, index: 1, total: 5, headline: "Kit da Marca em *5 passos*", variant: "cover" };
const feedDefaults: FeedPostProps = { brand: DEFAULT_BRAND, headline: "Tudo num *lugar só*", body: "Leads, conteúdo e atendimento.", cta: "Saiba mais" };

export function Root() {
  return (
    <>
      <Composition id="PostReel" component={PostReel} width={1080} height={1920} fps={REEL_FPS} durationInFrames={360} defaultProps={reelDefaults} calculateMetadata={calculateReelMetadata} />
      <Composition
        id="StoryFrame"
        component={StoryFrame}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={180}
        defaultProps={storyDefaults}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.round((props.durationSec ?? 6) * 30) })}
      />
      <Still id="CarouselSlide" component={CarouselSlide} width={1080} height={1350} defaultProps={slideDefaults} />
      <Still id="FeedPost" component={FeedPost} width={1080} height={1350} defaultProps={feedDefaults} />
    </>
  );
}
