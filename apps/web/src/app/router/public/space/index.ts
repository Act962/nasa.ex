import { getSpace } from "./get-space";
import { getOrgChart } from "./get-org-chart";
import { getCrew } from "./get-crew";
import { getUserProfileCard } from "./get-user-profile-card";
import { getPost } from "./get-post";
import { listSpaceActions } from "./list-space-actions";
import { listRanking } from "./list-ranking";
import { listPosts } from "./list-posts";
import { listReviews } from "./list-reviews";
import { listFollowers } from "./list-followers";
import { listPublicNBox } from "./list-public-nbox";
import { listProjects } from "./list-projects";
import { listForms } from "./list-forms";
import { listLinnker } from "./list-linnker";
import { listActiveIntegrations } from "./list-active-integrations";
import { toggleFollow } from "./toggle-follow";
import { submitReview } from "./submit-review";
import { submitPostComment } from "./submit-post-comment";
import { sendStar } from "./send-star";

export const spaceRouter = {
  getSpace,
  getOrgChart,
  getCrew,
  getUserProfileCard,
  getPost,
  listSpaceActions,
  listRanking,
  listPosts,
  listReviews,
  listFollowers,
  listPublicNBox,
  listProjects,
  listForms,
  listLinnker,
  listActiveIntegrations,
  toggleFollow,
  submitReview,
  submitPostComment,
  sendStar,
};
