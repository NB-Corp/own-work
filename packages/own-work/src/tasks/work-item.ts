import { z } from "zod";

const text = z.string().max(100_000);
const identity = z.string().min(1).max(512);
const links = z.array(identity).max(256).transform((values) => [...new Set(values)]);
export const workItemCreateSchema = z.object({
  workspaceId: identity,
  requestKey: identity,
  category: z.string().max(256).default(""),
  sessionIds: links.default([]),
  executionIds: links.default([]),
}).strict();
export type WorkItemCreate = z.input<typeof workItemCreateSchema>;
export const workItemPatchSchema = z.object({
  title: z.string().trim().min(1).max(1000).optional(),
  description: text.optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  category: z.string().max(256).optional(),
  sessionIds: links.optional(),
  executionIds: links.optional(),
  status: z
    .enum(["active", "in_progress", "paused", "done", "cancelled", "superseded"])
    .optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "A patch must change at least one field.");
export type WorkItemPatch = z.infer<typeof workItemPatchSchema>;

export const workItemMetadataSchema = z.object({
  version: z.literal(1),
  workspaceId: identity,
  requestKey: identity,
  category: z.string().max(256),
  sessionIds: links,
  executionIds: links,
  updatedAt: z.string(),
  lightweight: z.boolean(),
  creation: z.object({
    title: z.string(), description: z.string(), priority: z.string(),
    category: z.string(), sessionIds: links, executionIds: links,
  }).strict(),
  history: z.array(z.object({
    revision: z.number().int().nonnegative(),
    at: z.string(),
    previous: z.object({
      title: z.string(), description: z.string(), priority: z.string(), status: z.string(),
      category: z.string(), sessionIds: links, executionIds: links,
    }).strict(),
  }).strict()),
}).strict();
export type WorkItemMetadata = z.infer<typeof workItemMetadataSchema>;
