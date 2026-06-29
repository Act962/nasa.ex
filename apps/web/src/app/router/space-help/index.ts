import { listCategories } from "./routes/list-categories";
import { getFeature } from "./routes/get-feature";
import { listTracks } from "./routes/list-tracks";
import { getTrack } from "./routes/get-track";
import { listUserBadges } from "./routes/list-user-badges";
import { listBadges } from "./routes/list-badges";
import { markLessonComplete } from "./routes/mark-lesson-complete";
import { upsertCategory } from "./routes/upsert-category";
import { upsertFeature } from "./routes/upsert-feature";
import { upsertStep } from "./routes/upsert-step";
import { upsertTrack } from "./routes/upsert-track";
import { upsertLesson } from "./routes/upsert-lesson";
import { upsertBadge } from "./routes/upsert-badge";
import { setYoutubeUrl } from "./routes/set-youtube-url";
import { setStepScreenshot } from "./routes/set-step-screenshot";
import { checkModerator } from "./routes/check-moderator";
import { getSetupProgress } from "./routes/get-setup-progress";
import { claimSetupReward } from "./routes/claim-setup-reward";
import { adminListCategories } from "./routes/admin-list-categories";
import { adminGetCategory } from "./routes/admin-get-category";
import { adminGetFeature } from "./routes/admin-get-feature";
import { adminListTracks } from "./routes/admin-list-tracks";
import { adminGetTrack } from "./routes/admin-get-track";
import { adminListBadges } from "./routes/admin-list-badges";
import { adminStats } from "./routes/admin-stats";
import { deleteCategory } from "./routes/delete-category";
import { deleteFeature } from "./routes/delete-feature";
import { deleteStep } from "./routes/delete-step";
import { deleteTrack } from "./routes/delete-track";
import { deleteLesson } from "./routes/delete-lesson";
import { deleteBadge } from "./routes/delete-badge";

export const spaceHelpRouter = {
  listCategories,
  getFeature,
  listTracks,
  getTrack,
  listUserBadges,
  listBadges,
  markLessonComplete,
  upsertCategory,
  upsertFeature,
  upsertStep,
  upsertTrack,
  upsertLesson,
  upsertBadge,
  setYoutubeUrl,
  setStepScreenshot,
  checkModerator,
  getSetupProgress,
  claimSetupReward,
  // Admin-only (requireModerator + isSystemAdmin)
  adminListCategories,
  adminGetCategory,
  adminGetFeature,
  adminListTracks,
  adminGetTrack,
  adminListBadges,
  adminStats,
  deleteCategory,
  deleteFeature,
  deleteStep,
  deleteTrack,
  deleteLesson,
  deleteBadge,
};
