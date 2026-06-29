export type MenuAction =
  | { type: "editImage" }
  | { type: "editVideo" }
  | { type: "generate" }
  | { type: "approve" }
  | { type: "schedule" }
  | { type: "publish" }
  | { type: "download" }
  | { type: "delete" }
  | { type: "moveTo"; status: string };
