import { getBrandConfig } from "./get-brand-config";
import { upsertBrandConfig } from "./upsert-brand-config";
import { getPosts } from "./get-posts";
import { getPost } from "./get-post";
import { createPost } from "./create-post";
import { updatePost } from "./update-post";
import { deletePost } from "./delete-post";
import { generatePost } from "./generate-post";
import { approvePost } from "./approve-post";
import { schedulePost } from "./schedule-post";

export const nasaPostRouter = {
  brandConfig: {
    get: getBrandConfig,
    upsert: upsertBrandConfig,
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
};
