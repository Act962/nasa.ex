// ── Público ─────────────────────────────────────────────────────────────
import { publicListByCompany } from "./routes/public-list-by-company";
import { publicGetCourse } from "./routes/public-get-course";
import { publicGetFreeLesson } from "./routes/public-get-free-lesson";
import { publicSearch } from "./routes/public-search";
import { publicGetCertificate } from "./routes/public-get-certificate";
import { getPendingPurchase } from "./routes/get-pending-purchase";
import { redeemCoursePurchase } from "./routes/redeem-course-purchase";

// ── Aluno ───────────────────────────────────────────────────────────────
import { listMyEnrollments } from "./routes/list-my-enrollments";
import { getCourseAsStudent } from "./routes/get-course-as-student";
import { purchaseCourse } from "./routes/purchase-course";
import { markLessonComplete } from "./routes/mark-lesson-complete";
import { listMyCertificates } from "./routes/list-my-certificates";
import { getEbookDownloadUrl } from "./routes/get-ebook-download-url";
import { getEventStreamUrl } from "./routes/get-event-stream-url";
import { getCommunityInvite } from "./routes/get-community-invite";
import { getSubscriptionStatus } from "./routes/get-subscription-status";

// ── Criador ─────────────────────────────────────────────────────────────
import { creatorListCourses } from "./routes/creator-list-courses";
import { creatorGetCourse } from "./routes/creator-get-course";
import { creatorUpsertCourse } from "./routes/creator-upsert-course";
import { creatorPublishCourse } from "./routes/creator-publish-course";
import { creatorDeleteCourse } from "./routes/creator-delete-course";
import { creatorUpsertModule } from "./routes/creator-upsert-module";
import { creatorUpsertLesson } from "./routes/creator-upsert-lesson";
import { creatorReorderLessons } from "./routes/creator-reorder-lessons";
import { creatorListSales } from "./routes/creator-list-sales";
import { creatorListStudents } from "./routes/creator-list-students";

// ── Plans (criador) ─────────────────────────────────────────────────────
import { creatorListPlans } from "./routes/creator-list-plans";
import { creatorUpsertPlan } from "./routes/creator-upsert-plan";
import { creatorDeletePlan } from "./routes/creator-delete-plan";
import { creatorSetPlanLessons } from "./routes/creator-set-plan-lessons";
import { creatorUpsertPlanAttachment } from "./routes/creator-upsert-plan-attachment";
import { creatorDeletePlanAttachment } from "./routes/creator-delete-plan-attachment";

// ── Free Access ─────────────────────────────────────────────────────────
import { freeAccessList } from "./routes/free-access-list";
import { freeAccessGrant } from "./routes/free-access-grant";
import { freeAccessRevoke } from "./routes/free-access-revoke";

export const nasaRouteRouter = {
  // público
  publicListByCompany,
  publicGetCourse,
  publicGetFreeLesson,
  publicSearch,
  publicGetCertificate,
  getPendingPurchase,
  redeemCoursePurchase,
  // aluno
  listMyEnrollments,
  getCourseAsStudent,
  purchaseCourse,
  markLessonComplete,
  listMyCertificates,
  getEbookDownloadUrl,
  getEventStreamUrl,
  getCommunityInvite,
  getSubscriptionStatus,
  // criador
  creatorListCourses,
  creatorGetCourse,
  creatorUpsertCourse,
  creatorPublishCourse,
  creatorDeleteCourse,
  creatorUpsertModule,
  creatorUpsertLesson,
  creatorReorderLessons,
  creatorListSales,
  creatorListStudents,
  // plans (criador)
  creatorListPlans,
  creatorUpsertPlan,
  creatorDeletePlan,
  creatorSetPlanLessons,
  creatorUpsertPlanAttachment,
  creatorDeletePlanAttachment,
  // free access
  freeAccessList,
  freeAccessGrant,
  freeAccessRevoke,
};
