export type StepAnnotationMarker = "rocket-right" | "rocket-left" | "arrow";

export interface StepAnnotation {
  x: number;
  y: number;
  angle: number;
  label: string;
  marker?: StepAnnotationMarker;
}

export interface SpaceHelpCategoryLite {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  appId: string | null;
  order: number;
  features: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    youtubeUrl: string | null;
    order: number;
    _count: { steps: number };
  }>;
}

export interface SpaceHelpFeatureFull {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  youtubeUrl: string | null;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    screenshotUrl: string | null;
    annotations: StepAnnotation[] | null;
    order: number;
  }>;
}

export interface SpaceHelpTrackCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  level: string;
  durationMin: number | null;
  rewardStars: number;
  rewardSpacePoints: number;
  rewardBadge: { id: string; name: string; iconUrl: string | null; color: string | null } | null;
  lessonCount: number;
  completedLessonCount: number;
  completedAt: Date | string | null;
}
