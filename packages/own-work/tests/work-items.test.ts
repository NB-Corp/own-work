import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTask, initializeEmbeddedTaskStorage, inspectTaskStorage, listTasks, peekTask, updateWorkItem } from "../src/task.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
async function store() {
  const root = await mkdtemp(path.join(os.tmpdir(), "own-work-items-"));
  roots.push(root);
  await initializeEmbeddedTaskStorage(root);
  return root;
}

describe("embedded work items", () => {
  it("creates without project or PRD scaffolding and reads without recovery writes", async () => {
    const root = await store();
    const created = await createTask({ root, title: "An idea", workItem: { workspaceId: "workspace-a", requestKey: "create-a" } });
    expect(await readdir(path.join(root, created.path))).toEqual(["task.json"]);
    expect(await readdir(root)).not.toContain(".absorb");
    expect(created.prd).toBe("");
    const bytes = await readFile(path.join(root, created.path, "task.json"), "utf8");
    expect((await peekTask({ root, id: created.task.id })).task.title).toBe("An idea");
    expect(await readFile(path.join(root, created.path, "task.json"), "utf8")).toBe(bytes);
    expect((await inspectTaskStorage(root)).kind).toBe("embedded");
  });

  it("serializes duplicate creation keys and separates workspace ownership", async () => {
    const root = await store();
    const request = { root, title: "Same title", workItem: { workspaceId: "workspace-a", requestKey: "submit-a" } };
    const [a, b] = await Promise.all([createTask(request), createTask(request)]);
    expect(a.task.id).toBe(b.task.id);
    await expect(createTask({ ...request, title: "Different input" })).rejects.toMatchObject({ code: "TASK_CONFLICT" });
    const other = await createTask({ ...request, workItem: { workspaceId: "workspace-b", requestKey: "submit-a" } });
    expect(other.task.id).not.toBe(a.task.id);
    expect((await listTasks({ root, workspaceId: "workspace-a" })).tasks.map((entry) => entry.id)).toEqual([a.task.id]);
  });

  it("updates details and multi-session/execution association in one revision, preserving history", async () => {
    const root = await store();
    const created = await createTask({ root, title: "Before", workItem: { workspaceId: "workspace-a", requestKey: "submit-a" } });
    const updated = await updateWorkItem({ root, workspaceId: "workspace-a", id: created.task.id, expectedRevision: 0, patch: { title: "After", description: "Details", priority: "P1", category: "Feature", sessionIds: ["session-a", "session-b"], executionIds: ["run-a", "run-b"] } });
    expect(updated.revision).toBe(1);
    expect(updated.task.status).toBe("active");
    expect(updated.task.meta.own_work_item).toMatchObject({ history: [{ revision: 0, previous: { title: "Before" } }], executionIds: ["run-a", "run-b"] });
    const page = await listTasks({ root, workspaceId: "workspace-a", sessionId: "session-b" });
    expect(page.tasks).toHaveLength(1);
    expect(page.tasks[0]).not.toHaveProperty("prd");
    expect(page.tasks[0]).not.toHaveProperty("description");
    expect((await listTasks({ root, sessionId: "unassociated" })).tasks).toHaveLength(0);
    await expect(updateWorkItem({ root, workspaceId: "workspace-b", id: created.task.id, expectedRevision: 1, patch: { title: "Wrong workspace" } })).rejects.toMatchObject({ code: "TASK_CONFLICT" });
  });

  it("allows one concurrent writer and never reopens terminal records", async () => {
    const root = await store();
    const created = await createTask({ root, title: "Idea", workItem: { workspaceId: "workspace-a", requestKey: "submit-a" } });
    const request = { root, workspaceId: "workspace-a", id: created.task.id, expectedRevision: 0 };
    const results = await Promise.allSettled([
      updateWorkItem({ ...request, patch: { title: "One" } }),
      updateWorkItem({ ...request, patch: { title: "Two" } }),
    ]);
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(results.find((entry) => entry.status === "rejected")).toMatchObject({ reason: { code: "TASK_REVISION_CONFLICT" } });
    await updateWorkItem({ ...request, expectedRevision: 1, patch: { status: "done" } });
    await expect(updateWorkItem({ ...request, expectedRevision: 2, patch: { status: "active" } })).rejects.toMatchObject({ code: "TASK_TERMINAL" });
  });

  it("refuses foreign content, damaged markers, and read-time checkpoint repair", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "own-work-foreign-"));
    roots.push(root);
    await writeFile(path.join(root, "notes.txt"), "Keep this");
    await expect(initializeEmbeddedTaskStorage(root)).rejects.toThrow("non-empty");
    const initialized = await store();
    const card = await createTask({ root: initialized, title: "Idea", workItem: { workspaceId: "a", requestKey: "a" } });
    const checkpoint = path.join(initialized, card.path, ".assay-checkpoint.json");
    await writeFile(checkpoint, "unrecovered");
    await expect(peekTask({ root: initialized, id: card.task.id })).rejects.toMatchObject({ code: "TASK_CONFLICT" });
    expect(await readFile(checkpoint, "utf8")).toBe("unrecovered");
    await writeFile(path.join(initialized, ".own-work-storage.json"), "broken");
    await expect(inspectTaskStorage(initialized)).rejects.toThrow();
  });
});
