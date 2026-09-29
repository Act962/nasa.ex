import { inngest } from "@/inngest/client";
import { expireDueStars } from "@/features/star-friends/lib/expire";

export const starFriendsExpireStars = inngest.createFunction(
  { id: "star-friends-expire-stars", retries: 2 },
  { cron: "TZ=America/Fortaleza 15 3 * * *" },
  async ({ step }) => step.run("expire-due-stars", () => expireDueStars()),
);
