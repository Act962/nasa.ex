import type { TourAdvanceOn, TourFinish, TourPosition } from "@/features/tour/types";
import type { GuideAnchorKey } from "./anchors";

export interface GuideStep {
  anchor: GuideAnchorKey;
  title: string;
  message: string;
  position: TourPosition;
  advanceOn: TourAdvanceOn;
  /** Rota a abrir quando o usuário não está nela. */
  route?: string;
  /** Regex da rota atual que torna o passo desnecessário. */
  skipWhenPath?: string;
  padding?: number;
}

export interface GuideDef {
  key: string;
  app: "tracking";
  title: string;
  summary: string;
  /** Assunto do pedido, já sem acento e em minúsculas. */
  topicPattern: RegExp;
  spaceHelp?: { categorySlug: string; featureSlug: string };
  steps: GuideStep[];
  finish: TourFinish;
}
