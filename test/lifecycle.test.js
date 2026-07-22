import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  TASK_STATUSES,
  readTaskLifecycle,
  summarizeTasks,
  updateTaskStatus,
  validateTaskTransition
} from "../src/lifecycle.js";

async function makeExecutionPack() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bossai-lifecycle-"));
  const tasks = [
    { id: "TASK-001", title: "核验证据", status: "todo", history: [] },
    { id: "TASK-002", title: "制作草稿", status: "todo" }
  ];
  const executionPack = {
    version: "1.2.1",
    tasks: structuredClone(tasks),
    safety: { automaticExternalActions: false }
  };
  await writeFile(path.join(root, "task-board.json"), `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "execution-pack.json"), `${JSON.stringify(executionPack, null, 2)}\n`, "utf8");
  return root;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("读取执行包并汇总合法任务状态", async () => {
  const root = await makeExecutionPack();
  try {
    const lifecycle = await readTaskLifecycle(root);
    assert.equal(lifecycle.tasks.length, 2);
    assert.deepEqual(lifecycle.summary, {
      total: 2,
      byStatus: { todo: 2, "in-progress": 0, blocked: 0, done: 0, cancelled: 0 }
    });
    assert.deepEqual(TASK_STATUSES, ["todo", "in-progress", "blocked", "done", "cancelled"]);
    assert.deepEqual(summarizeTasks([{ id: "TASK-009" }]).byStatus, {
      todo: 1, "in-progress": 0, blocked: 0, done: 0, cancelled: 0
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("状态更新会同步两份 JSON 并追加审计历史", async () => {
  const root = await makeExecutionPack();
  try {
    const result = await updateTaskStatus(root, "TASK-001", "in-progress", {
      actor: "本地验收人",
      note: "开始整理来源"
    });
    assert.equal(result.previousStatus, "todo");
    assert.equal(result.status, "in-progress");
    assert.equal(result.automaticExternalActions, false);

    const board = await readJson(path.join(root, "task-board.json"));
    const pack = await readJson(path.join(root, "execution-pack.json"));
    assert.deepEqual(board[0], pack.tasks[0]);
    assert.equal(board[0].status, "in-progress");
    assert.match(board[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(board[0].history[0], {
      at: board[0].updatedAt,
      taskId: "TASK-001",
      fromStatus: "todo",
      toStatus: "in-progress",
      actor: "本地验收人",
      note: "开始整理来源"
    });
    assert.equal(pack.safety.automaticExternalActions, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("更新时保留已有 history，并用新的 updatedAt 标记本次变更", async () => {
  const root = await makeExecutionPack();
  try {
    const previousEvent = {
      at: "2026-07-01T00:00:00.000Z",
      taskId: "TASK-001",
      fromStatus: "blocked",
      toStatus: "todo",
      blockedReason: "等待输入"
    };
    const boardPath = path.join(root, "task-board.json");
    const packPath = path.join(root, "execution-pack.json");
    const board = await readJson(boardPath);
    const pack = await readJson(packPath);
    board[0].updatedAt = previousEvent.at;
    board[0].history = [previousEvent];
    pack.tasks[0].updatedAt = previousEvent.at;
    pack.tasks[0].history = [structuredClone(previousEvent)];
    await writeFile(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");

    await updateTaskStatus(root, "TASK-001", "in-progress");
    const updated = await readJson(boardPath);
    assert.deepEqual(updated[0].history[0], previousEvent);
    assert.equal(updated[0].history.length, 2);
    assert.notEqual(updated[0].updatedAt, previousEvent.at);
    assert.equal(updated[0].history[1].at, updated[0].updatedAt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("blocked 必须记录原因，解除阻塞后原因保留在 history", async () => {
  const root = await makeExecutionPack();
  try {
    await assert.rejects(
      updateTaskStatus(root, "TASK-001", "blocked"),
      /必须提供 blockedReason/
    );
    await updateTaskStatus(root, "TASK-001", "blocked", { blockedReason: "缺少可复核来源" });
    let board = await readJson(path.join(root, "task-board.json"));
    assert.equal(board[0].blockedReason, "缺少可复核来源");

    await updateTaskStatus(root, "TASK-001", "in-progress", { note: "已补充来源" });
    board = await readJson(path.join(root, "task-board.json"));
    assert.equal("blockedReason" in board[0], false);
    assert.equal(board[0].history[0].blockedReason, "缺少可复核来源");
    assert.equal(board[0].history.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("done 必须有验收记录，完成与重新打开均受合法流转约束", async () => {
  const root = await makeExecutionPack();
  try {
    await assert.rejects(
      updateTaskStatus(root, "TASK-001", "done", { acceptanceRecord: "已验收" }),
      /不允许任务状态从 todo 变更为 done/
    );
    await updateTaskStatus(root, "TASK-001", "in-progress");
    await assert.rejects(updateTaskStatus(root, "TASK-001", "done"), /必须提供非空 acceptanceRecord/);

    const acceptanceRecord = {
      summary: "4项标准均通过",
      evidence: ["outputs/evidence-review.md"],
      acceptedBy: "人工验收"
    };
    await updateTaskStatus(root, "TASK-001", "done", { acceptanceRecord });
    let board = await readJson(path.join(root, "task-board.json"));
    assert.deepEqual(board[0].acceptanceRecord, acceptanceRecord);
    assert.equal(board[0].completedAt, board[0].updatedAt);

    await updateTaskStatus(root, "TASK-001", "in-progress", { note: "发现反证，重新打开" });
    board = await readJson(path.join(root, "task-board.json"));
    assert.equal("acceptanceRecord" in board[0], false);
    assert.equal("completedAt" in board[0], false);
    assert.deepEqual(board[0].history[1].acceptanceRecord, acceptanceRecord);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("拒绝非法状态、非法或不存在的任务 ID 和重复状态", async () => {
  const root = await makeExecutionPack();
  try {
    assert.throws(() => validateTaskTransition("todo", "done", {}), /不允许/);
    assert.throws(() => validateTaskTransition("todo", "waiting", {}), /目标状态无效/);
    assert.throws(() => validateTaskTransition("todo", "in-progress", null), /details 必须是对象/);
    await assert.rejects(updateTaskStatus(root, "../TASK-001", "in-progress"), /任务 ID 无效/);
    await assert.rejects(updateTaskStatus(root, "TASK-999", "in-progress"), /任务不存在/);
    await assert.rejects(updateTaskStatus(root, "TASK-001", "todo"), /不允许/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("检测两份任务状态不一致时拒绝覆盖任何文件", async () => {
  const root = await makeExecutionPack();
  try {
    const packPath = path.join(root, "execution-pack.json");
    const pack = await readJson(packPath);
    pack.tasks[0].status = "blocked";
    pack.tasks[0].blockedReason = "人为制造的不一致";
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    const boardBefore = await readFile(path.join(root, "task-board.json"), "utf8");
    const packBefore = await readFile(packPath, "utf8");

    await assert.rejects(updateTaskStatus(root, "TASK-001", "in-progress"), /生命周期状态不一致/);
    assert.equal(await readFile(path.join(root, "task-board.json"), "utf8"), boardBefore);
    assert.equal(await readFile(packPath, "utf8"), packBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("安全写入只修改执行包 JSON，不触碰其他本地文件", async () => {
  const root = await makeExecutionPack();
  try {
    const sentinelPath = path.join(root, "do-not-touch.txt");
    await writeFile(sentinelPath, "保留原样\n", "utf8");
    await updateTaskStatus(root, "TASK-002", "cancelled", { note: "人工决定停止" });
    assert.equal(await readFile(sentinelPath, "utf8"), "保留原样\n");
    const transientFiles = (await readdir(root)).filter((name) => /\.tmp-|\.bak-|\.bossai-lifecycle\.lock/.test(name));
    assert.deepEqual(transientFiles, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
