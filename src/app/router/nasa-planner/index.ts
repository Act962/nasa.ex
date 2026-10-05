import { listPlanners } from "./list-planners";
import { getPlanner } from "./get-planner";
import { createPlanner } from "./create-planner";
import { updatePlanner } from "./update-planner";
import { deletePlanner } from "./delete-planner";
import { getPosts } from "./get-posts";
import { getPost } from "./get-post";
import { createPost } from "./create-post";
import { updatePost } from "./update-post";
import { deletePost } from "./delete-post";
import { generatePost } from "./generate-post";
import { listMindMaps } from "./list-mind-maps";
import { getMindMap } from "./get-mind-map";
import { createMindMap } from "./create-mind-map";
import { updateMindMap } from "./update-mind-map";
import { deleteMindMap } from "./delete-mind-map";
import { listCards } from "./list-cards";
import { createCard } from "./create-card";
import { updateCard } from "./update-card";
import { deleteCard } from "./delete-card";
import { createCalendarShare } from "./create-calendar-share";
import { getCalendarShare } from "./get-calendar-share";
import { createCampaign } from "./create-campaign";
import { listCampaigns } from "./list-campaigns";
import { getCampaign } from "./get-campaign";
import { updateCampaign } from "./update-campaign";
import { deleteCampaign } from "./delete-campaign";
import { createCampaignEvent } from "./create-campaign-event";
import { updateCampaignEvent } from "./update-campaign-event";
import { deleteCampaignEvent } from "./delete-campaign-event";
import { createCampaignTask } from "./create-campaign-task";
import { updateCampaignTask } from "./update-campaign-task";
import { createCampaignBrandAsset } from "./create-campaign-brand-asset";
import { deleteCampaignBrandAsset } from "./delete-campaign-brand-asset";
import { getCampaignCalendar } from "./get-campaign-calendar";
import { getPublicCalendar } from "./get-public-calendar";
import { generateCampaignBrief } from "./generate-campaign-brief";
import { generateImageFromPrompt } from "./generate-image-from-prompt";
import { uploadPostImage } from "./upload-post-image";
import { updatePostSlide } from "./update-post-slide";
import { createPostFromAction } from "./create-post-from-action";
import { attachVideo } from "./attach-video";
import { addVideoClip } from "./add-video-clip";
import { saveEditedVideo } from "./save-edited-video";
import { generateVideoClip } from "./generate-video-clip";
import { generateImageFromReference } from "./generate-image-from-reference";
import { transcribeVideo } from "./transcribe-video";
import { removePostMedia } from "./remove-post-media";
import { removePostSlide } from "./remove-post-slide";
import { addSlidesBatch } from "./add-slides-batch";
import { syncPostMetrics } from "./sync-post-metrics";
import { generatePostImage } from "./generate-post-image";
import {
  listCalendarDrafts,
  listCalendarMoments,
  listCalendarPosts,
  listCalendarSlots,
  listPlannerClients,
} from "./v2/calendar";
import { approve, comment, listReviews, requestChanges, submitForApproval } from "./v2/approval";
import { listAccounts, postMetrics, publishNow, retryPublish, schedule, unschedule } from "./v2/publishing";
import {
  addPlannerBrandKitAsset,
  createPlannerBrandKit,
  deletePlannerBrandKit,
  generateScriptsWithAstro,
  getPlannerBrandKit,
  listPlannerBrandKits,
  removePlannerBrandKitAsset,
  renamePlannerBrandKit,
  savePlannerBrandKit,
  setPlannerAccountBrandKit,
} from "./v2/brand-kit";
import { discardCreation, importCreation, listCreations } from "./v2/creations";
import { getPlannerDashboard, listBoardPosts } from "./v2/board";
import { parseWeeklyScriptText } from "./v2/weekly-script";
import { deletePostComment, editOwnPostComment, listPostComments, replyToPostComment, setPostCommentHidden } from "./v2/post-comments";
import {
  createClientPost,
  deletePillar,
  deleteSlot,
  getGoals,
  listPillars,
  listWeekdayThemes,
  setApprovalRequired,
  setGoal,
  setWeekdayTheme,
  upsertPillar,
  upsertSlot,
} from "./v2/planning";
import {
  createScheduledBroadcastForClient,
  getPostComments,
  listBroadcastsInRange,
  listBroadcastTemplates,
  savePostComments,
} from "./v2/integrations";

export const nasaPlannerRouter = {
  planners: {
    list: listPlanners,
    get: getPlanner,
    create: createPlanner,
    update: updatePlanner,
    delete: deletePlanner,
  },
  creations: {
    list: listCreations,
    discard: discardCreation,
    import: importCreation,
  },
  brandKit: {
    list: listPlannerBrandKits,
    get: getPlannerBrandKit,
    create: createPlannerBrandKit,
    rename: renamePlannerBrandKit,
    delete: deletePlannerBrandKit,
    setAccountKit: setPlannerAccountBrandKit,
    save: savePlannerBrandKit,
    addAsset: addPlannerBrandKitAsset,
    removeAsset: removePlannerBrandKitAsset,
    generateScripts: generateScriptsWithAstro,
  },
  posts: {
    getMany: getPosts,
    getOne: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
    generate: generatePost,
    approve,
    // Planner v2 (spec 0057): programar/publicar passam pelo fluxo único; `publish` virou "publicar agora" assíncrono.
    schedule,
    unschedule,
    publish: publishNow,
    publishNow,
    retryPublish,
    metrics: postMetrics,
    instagramComments: {
      list: listPostComments,
      reply: replyToPostComment,
      setHidden: setPostCommentHidden,
      delete: deletePostComment,
      editOwn: editOwnPostComment,
    },
    createForClient: createClientPost,
    generateImage: generateImageFromPrompt,
    uploadImage: uploadPostImage,
    updateSlide: updatePostSlide,
    createFromAction: createPostFromAction,
    attachVideo: attachVideo,
    addVideoClip: addVideoClip,
    saveEditedVideo: saveEditedVideo,
    generateVideoClip: generateVideoClip,
    scheduleReal: schedule,
    generateImageFromReference: generateImageFromReference,
    transcribeVideo: transcribeVideo,
    removeMedia: removePostMedia,
    removeSlide: removePostSlide,
    addSlidesBatch: addSlidesBatch,
    syncMetrics: syncPostMetrics,
    // NASA Planner 2.0: geração com seleção de modelo + ref image (Ideogram/DALL-E/Pollinations)
    generatePostImage: generatePostImage,
  },
  mindMaps: {
    list: listMindMaps,
    get: getMindMap,
    create: createMindMap,
    update: updateMindMap,
    delete: deleteMindMap,
  },
  cards: {
    list: listCards,
    create: createCard,
    update: updateCard,
    delete: deleteCard,
  },
  calendar: {
    share: createCalendarShare,
    getShare: getCalendarShare,
    // Planner v2 (spec 0058): calendário multi-cliente
    posts: listCalendarPosts,
    drafts: listCalendarDrafts,
    slots: listCalendarSlots,
    moments: listCalendarMoments,
    broadcasts: listBroadcastsInRange,
    board: listBoardPosts,
  },
  dashboard: {
    summary: getPlannerDashboard,
  },
  comments: {
    get: getPostComments,
    save: savePostComments,
  },
  broadcasts: {
    templates: listBroadcastTemplates,
    createScheduled: createScheduledBroadcastForClient,
  },
  clients: {
    list: listPlannerClients,
  },
  publishAccounts: {
    list: listAccounts,
  },
  approval: {
    submit: submitForApproval,
    requestChanges,
    approve,
    comment,
    listReviews,
  },
  planning: {
    getGoals,
    setGoal,
    upsertSlot,
    deleteSlot,
    listPillars,
    upsertPillar,
    deletePillar,
    setApprovalRequired,
    listWeekdayThemes,
    setWeekdayTheme,
    parseWeeklyScript: parseWeeklyScriptText,
  },
  campaigns: {
    list: listCampaigns,
    get: getCampaign,
    create: createCampaign,
    update: updateCampaign,
    delete: deleteCampaign,
    generateBrief: generateCampaignBrief,
  },
  campaignEvents: {
    create: createCampaignEvent,
    update: updateCampaignEvent,
    delete: deleteCampaignEvent,
  },
  campaignTasks: {
    create: createCampaignTask,
    update: updateCampaignTask,
  },
  campaignBrandAssets: {
    create: createCampaignBrandAsset,
    delete: deleteCampaignBrandAsset,
  },
  campaignCalendar: {
    get: getCampaignCalendar,
    getPublic: getPublicCalendar,
  },
};
