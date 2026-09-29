import "server-only";
import { seedSampleAgenda } from "./agenda";
import { seedSampleForge } from "./forge";
import { seedSampleForm } from "./form";
import { seedSampleLinnker } from "./linnker";
import { seedSampleNBox } from "./nbox";
import { seedSampleNasaPage } from "./pages";
import { seedSamplePayment } from "./payment";
import { seedSamplePlanner } from "./planner";
import { seedSampleRouteCourse } from "./route";
import { seedSampleSpaceStation } from "./space-station";
import { seedSampleStarFriends } from "./star-friends";
import type { SampleSeedContext } from "./types";
import { seedSampleWorkspace } from "./workspace";

export type { SampleSeedContext } from "./types";

export const SAMPLE_APP_SEEDERS: { app: string; seed: (context: SampleSeedContext) => Promise<void> }[] = [
  { app: "workspace", seed: seedSampleWorkspace },
  { app: "form", seed: seedSampleForm },
  { app: "agenda", seed: seedSampleAgenda },
  { app: "forge", seed: seedSampleForge },
  { app: "linnker", seed: seedSampleLinnker },
  { app: "nbox", seed: seedSampleNBox },
  { app: "pages", seed: seedSampleNasaPage },
  { app: "planner", seed: seedSamplePlanner },
  { app: "nasa-route", seed: seedSampleRouteCourse },
  { app: "payment", seed: seedSamplePayment },
  { app: "star-friends", seed: seedSampleStarFriends },
  { app: "space-station", seed: seedSampleSpaceStation },
];
