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
import { approvePost } from "./approve-post";
import { schedulePost } from "./schedule-post";
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

export const nasaPlannerRouter = {
  planners: {
    list: listPlanners,
    get: getPlanner,
    create: createPlanner,
    update: updatePlanner,
    delete: deletePlanner,
  },
  posts: {
    getMany: getPosts,
    getOne: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
    generate: generatePost,
    approve: approvePost,
    schedule: schedulePost,
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
  },
};
