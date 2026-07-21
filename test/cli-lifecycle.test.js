import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "bossai-team.mjs");

async function makeExecutionPack() {
  const packDir = await mkdtemp(path.join(os.tmpdir(), "bossai-cli-lifecycle-"));
  const tasks = [
    { id: "TASK-001", title: "核验证据", status: "todo" },
    { id: "TASK-002", title: "制作草稿", status: "todo" }
  ];
  await writeFile(path.join(packDir, "task-board.json"), `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(packDir, "execution-pack.json"),
    `${JSON.stringify({ tasks: structuredClone(tasks) }, null, 2)}\n`,
    "utf8"
  );
  return packDir;
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
}

function parseSuccess(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function parseFailure(result) {
  assert.equal(result.status, 1, result.stdout);
  return JSON.parse(result.stderr);
}

test("task-status 输出状态汇总并可只读查询单个任务", async () => {
  const packDir = await makeExecutionPack();
  try {
    const all = parseSuccess(run("task-status", "--pack", packDir));
    assert.equal(all.ok, true);
    assert.equal(all.command, "task-status");
    assert.deepEqual(all.summary, {
      total: 2,
      byStatus: { todo: 2, "in-progress": 0, blocked: 0, done: 0, cancelled: 0 }
    });
    assert.equal(all.tasks.length, 2);
    assert.equal(all.automaticExternalActions, false);

    const one = parseSuccess(run("task-status", "--pack", packDir, "--task", "TASK-002"));
    assert.equal(one.task.id, "TASK-002");
    assert.equal("tasks" in one, false);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("task-update 支持开始、阻塞、恢复和带验收记录的完成", async () => {
  const packDir = await makeExecutionPack();
  try {
    const started = parseSuccess(run(
      "task-update", "--pack", packDir, "--task", "TASK-001", "--status", "in-progress",
      "--actor", "CLI 测试", "--note", "开始处理"
    ));
    assert.equal(started.previousStatus, "todo");
    assert.equal(started.status, "in-progress");

    const blocked = parseSuccess(run(
      "task-update", "--pack", packDir, "--task", "TASK-001", "--status", "blocked",
      "--blocked-reason", "等待来源"
    ));
    assert.equal(blocked.task.blockedReason, "等待来源");

    const resumed = parseSuccess(run(
      "task-update", "--pack", packDir, "--task", "TASK-001", "--status", "in-progress",
      "--note", "来源已补齐"
    ));
    assert.equal(resumed.previousStatus, "blocked");
    assert.equal("blockedReason" in resumed.task, false);

    const completed = parseSuccess(run(
      "task-update", "--pack", packDir, "--task", "TASK-001", "--status", "done",
      "--acceptance", "人工验收通过"
    ));
    assert.equal(completed.status, "done");
    assert.equal(completed.task.acceptanceRecord, "人工验收通过");
    assert.equal(completed.summary.byStatus.done, 1);
    assert.equal(completed.automaticExternalActions, false);

    const board = JSON.parse(await readFile(path.join(packDir, "task-board.json"), "utf8"));
    const pack = JSON.parse(await readFile(path.join(packDir, "execution-pack.json"), "utf8"));
    assert.deepEqual(board, pack.tasks);
    assert.deepEqual(
      board[0].history.map((event) => event.toStatus),
      ["in-progress", "blocked", "in-progress", "done"]
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("CLI 以 JSON 拒绝非法变更和缺少必填参数", async () => {
  const packDir = await makeExecutionPack();
  try {
    const illegal = parseFailure(run(
      "task-update", "--pack", packDir, "--task", "TASK-002", "--status", "done",
      "--acceptance", "不能跳过开始"
    ));
    assert.equal(illegal.ok, false);
    assert.match(illegal.error, /不允许任务状态从 todo 变更为 done/);

    const missingStatus = parseFailure(run(
      "task-update", "--pack", packDir, "--task", "TASK-001"
    ));
    assert.match(missingStatus.error, /--status <value>/);

    const missingPack = parseFailure(run("task-status"));
    assert.match(missingPack.error, /--pack <value>/);

    const board = JSON.parse(await readFile(path.join(packDir, "task-board.json"), "utf8"));
    assert.equal(board[1].status, "todo");
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});
