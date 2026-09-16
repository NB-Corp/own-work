import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { atomicWriteTaskText, readTaskText, withEmbeddedTaskLock } from "./task-storage.js";

export const EMBEDDED_STORAGE_FILE = ".own-work-storage.json";
const markerSchema = z.object({
  format: z.literal("own-work-items"),
  version: z.literal(1),
  id: z.string().uuid(),
}).strict();
export type EmbeddedTaskStorage = z.infer<typeof markerSchema>;

/** Strictly read-only; malformed markers are errors, never an invitation to fork storage. */
export async function readEmbeddedTaskStorage(root: string): Promise<EmbeddedTaskStorage | undefined> {
  let text: string;
  try {
    text = await readTaskText(root, path.join(root, EMBEDDED_STORAGE_FILE));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return markerSchema.parse(JSON.parse(text) as unknown);
}

/** Initialize only an empty dedicated directory; no project scaffolding or envelope migration. */
export async function initializeEmbeddedTaskStorage(rootInput: string): Promise<EmbeddedTaskStorage> {
  const root = path.resolve(rootInput);
  await mkdir(root, { recursive: true });
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Embedded storage root must be an ordinary directory.");
  const existing = await readEmbeddedTaskStorage(root);
  if (existing) return existing;
  const entries = await readdir(root);
  if (entries.some((entry) => entry !== ".own-work-locks")) {
    throw new Error("Refusing to initialize embedded storage in a non-empty directory.");
  }
  return withEmbeddedTaskLock(root, path.join(root, ".own-work-locks", "initialize"), async () => {
    const current = await readEmbeddedTaskStorage(root);
    if (current) return current;
    const lockedEntries = await readdir(root);
    if (lockedEntries.some((entry) => entry !== ".own-work-locks")) {
      throw new Error("Storage directory changed before initialization.");
    }
    const marker: EmbeddedTaskStorage = { format: "own-work-items", version: 1, id: randomUUID() };
    await atomicWriteTaskText(root, path.join(root, EMBEDDED_STORAGE_FILE), `${JSON.stringify(marker, null, 2)}\n`);
    return marker;
  });
}
