import { z } from "zod";

export const actionContext = z.object({
  id: z.string(),
});

export type ActionContext = z.infer<typeof actionContext>;

export const actionDetail = z.object({
  id: z.string(),
  title: z.string(),
  isDone: z.boolean(),
  workspaceId: z.string(),
  columnId: z.string().nullable(),
  priority: z.string(),
  dueDate: z.date().nullable().optional(),
  participantIds: z.array(z.string()).default([]),
  responsibleIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
});

export type ActionDetail = z.infer<typeof actionDetail>;
