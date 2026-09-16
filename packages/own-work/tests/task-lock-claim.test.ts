import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fault = vi.hoisted(() => ({ remaining: 0, attempts: 0 }));
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, rename: async (from: string, to: string) => {
    if (from.includes(".claim-")) {
      fault.attempts += 1;
      if (fault.remaining > 0) {
        fault.remaining -= 1;
        throw Object.assign(new Error("Simulated Windows sharing violation"), { code: "EPERM" });
      }
    }
    return actual.rename(from, to);
  } };
});
import { withEmbeddedTaskLock } from "../src/tasks/task-storage.js";
const roots: string[] = [];
afterEach(async () => {
  fault.remaining = 0; fault.attempts = 0;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.platform !== "win32")("Windows prepared lock rename", () => {
  it("retries a transient sharing violation without entering the callback twice", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "own-work-claim-")); roots.push(root);
    fault.remaining = 2;
    const callback = vi.fn(async () => "value");
    expect(await withEmbeddedTaskLock(root, path.join(root, "locks", "item"), callback)).toBe("value");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(fault.attempts).toBe(3);
    expect(await readdir(path.join(root, "locks"))).toEqual([]);
  });
  it("bounds persistent permission failure and never executes or leaves a claim", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "own-work-claim-")); roots.push(root);
    fault.remaining = 100;
    const callback = vi.fn();
    await expect(withEmbeddedTaskLock(root, path.join(root, "locks", "item"), callback)).rejects.toMatchObject({ code: "EPERM" });
    expect(callback).not.toHaveBeenCalled();
    expect(fault.attempts).toBe(11);
    expect(await readdir(path.join(root, "locks"))).toEqual([]);
  });
});
