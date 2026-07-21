import { randomUUID } from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  copyFile,
  open,
  readFile,
  rename,
  rm
} from "node:fs/promises";

export const TASK_STATUSES = Object.freeze([
  "todo",
  "in-progress",
  "blocked",
  "done",
  "cancelled"
]);

export const TASK_STATUS_TRANSITIONS = Object.freeze({
  todo: Object.freeze(["in-progress", "blocked", "cancelled"]),
  "in-progress": Object.freeze(["todo", "blocked", "done", "cancelled"]),
  blocked: Object.freeze(["todo", "in-progress", "cancelled"]),
  done: Object.freeze(["in-progress"]),
  cancelled: Object.freeze(["todo"])
});

const STATUS_SET = new Set(TASK_STATUSES);
const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TASK_BOARD_FILE = "task-board.json";
const EXECUTION_PACK_FILE = "execution-pack.json";
const LOCK_FILE = ".bossai-lifecycle.lock";

/**
 * Read and validate the two local task representations in an execution pack.
 * This function never writes files or performs external actions.
 */
export async function readTaskLifecycle(executionPackDir) {
  const lifecycle = await loadTaskLifecycle(executionPackDir);
  const { sourceSnapshot: _sourceSnapshot, ...publicLifecycle } = lifecycle;
  return publicLifecycle;
}

async function loadTaskLifecycle(executionPackDir) {
  const root = resolveExecutionPackDir(executionPackDir);
  const taskBoardPath = path.join(root, TASK_BOARD_FILE);
  const executionPackPath = path.join(root, EXECUTION_PACK_FILE);
  const [taskBoardSource, executionPackSource] = await Promise.all([
    readRequiredFile(taskBoardPath),
    readRequiredFile(executionPackPath)
  ]);
  const taskBoard = parseJson(taskBoardSource, taskBoardPath);
  const executionPack = parseJson(executionPackSource, executionPackPath);

  validateTaskCollections(taskBoard, executionPack, {
    taskBoardPath,
    executionPackPath
  });

  return {
    root,
    taskBoardPath,
    executionPackPath,
    tasks: taskBoard,
    executionPack,
    summary: summarizeTasks(taskBoard),
    sourceSnapshot: {
      taskBoard: taskBoardSource,
      executionPack: executionPackSource
    }
  };
}

/**
 * Update one task in both task-board.json and execution-pack.json.
 * The update is local-only, lock-protected, audit logged, and safely replaced.
 */
export async function updateTaskStatus(executionPackDir, taskId, nextStatus, details = {}) {
  const root = resolveExecutionPackDir(executionPackDir);
  const normalizedTaskId = validateTaskId(taskId);

  return withLifecycleLock(root, async () => {
    const lifecycle = await loadTaskLifecycle(root);
    const boardTask = lifecycle.tasks.find((task) => task.id === normalizedTaskId);
    if (!boardTask) {
      throw new Error(`任务不存在：${normalizedTaskId}。`);
    }

    const packTask = lifecycle.executionPack.tasks.find((task) => task.id === normalizedTaskId);
    const previousStatus = normalizeStoredStatus(boardTask.status, normalizedTaskId);
    const transition = validateTaskTransition(previousStatus, nextStatus, details);
    const updatedAt = new Date().toISOString();
    const event = buildHistoryEvent(normalizedTaskId, transition, details, updatedAt);

    applyTransition(boardTask, transition, event, updatedAt);
    applyTransition(packTask, transition, event, updatedAt);

    await safelyWriteLifecyclePair([
      {
        filePath: lifecycle.taskBoardPath,
        originalSource: lifecycle.sourceSnapshot.taskBoard,
        value: lifecycle.tasks
      },
      {
        filePath: lifecycle.executionPackPath,
        originalSource: lifecycle.sourceSnapshot.executionPack,
        value: lifecycle.executionPack
      }
    ]);

    return {
      root,
      task: boardTask,
      previousStatus,
      status: transition.toStatus,
      updatedAt,
      summary: summarizeTasks(lifecycle.tasks),
      automaticExternalActions: false
    };
  });
}

/**
 * Validate a transition without touching the filesystem. The normalized
 * transition returned here is also used by updateTaskStatus.
 */
export function validateTaskTransition(fromStatus, toStatus, details = {}) {
  if (!isPlainObject(details)) throw new TypeError("状态变更 details 必须是对象。");
  const normalizedFrom = validateStatus(fromStatus, "当前状态");
  const normalizedTo = validateStatus(toStatus, "目标状态");
  const allowed = TASK_STATUS_TRANSITIONS[normalizedFrom];
  if (!allowed.includes(normalizedTo)) {
    throw new Error(
      `不允许任务状态从 ${normalizedFrom} 变更为 ${normalizedTo}。允许的目标状态：${allowed.join("、") || "无"}。`
    );
  }

  const blockedReason = normalizedTo === "blocked"
    ? requiredText(details.blockedReason ?? details.reason, "任务进入 blocked 状态时必须提供 blockedReason")
    : undefined;
  const acceptanceRecord = normalizedTo === "done"
    ? normalizeAcceptanceRecord(details.acceptanceRecord ?? details.acceptance)
    : undefined;

  return {
    fromStatus: normalizedFrom,
    toStatus: normalizedTo,
    blockedReason,
    acceptanceRecord
  };
}

export function summarizeTasks(tasks) {
  if (!Array.isArray(tasks)) throw new TypeError("tasks 必须是数组。");
  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0]));
  for (const task of tasks) {
    const status = normalizeStoredStatus(task?.status, task?.id || "未知任务");
    byStatus[status] += 1;
  }
  return { total: tasks.length, byStatus };
}

function resolveExecutionPackDir(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("executionPackDir 必须是非空目录路径。");
  }
  return path.resolve(value);
}

function validateTaskId(value) {
  if (typeof value !== "string" || !TASK_ID_PATTERN.test(value)) {
    throw new Error("任务 ID 无效：必须是 1-128 位字母、数字、点、下划线、冒号或连字符，且以字母或数字开头。");
  }
  return value;
}

function validateStatus(value, label) {
  if (typeof value !== "string" || !STATUS_SET.has(value)) {
    throw new Error(`${label}无效：${String(value)}。合法状态：${TASK_STATUSES.join("、")}。`);
  }
  return value;
}

function normalizeStoredStatus(value, taskId) {
  if (value == null || value === "") return "todo";
  return validateStatus(value, `任务 ${taskId} 的状态`);
}

function normalizeAcceptanceRecord(value) {
  if (typeof value === "string") {
    const summary = value.trim();
    if (summary) return summary;
  } else if (isPlainObject(value)) {
    const cloned = cloneJsonValue(value, "acceptanceRecord");
    if (hasMeaningfulValue(cloned)) return cloned;
  }
  throw new Error("任务进入 done 状态时必须提供非空 acceptanceRecord（字符串或对象）。");
}

function requiredText(value, message) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${message}。`);
  return value.trim();
}

function buildHistoryEvent(taskId, transition, details, updatedAt) {
  const event = {
    at: updatedAt,
    taskId,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus
  };
  if (typeof details.actor === "string" && details.actor.trim()) event.actor = details.actor.trim();
  if (typeof details.note === "string" && details.note.trim()) event.note = details.note.trim();
  if (transition.blockedReason) event.blockedReason = transition.blockedReason;
  if (transition.acceptanceRecord !== undefined) {
    event.acceptanceRecord = cloneJsonValue(transition.acceptanceRecord, "acceptanceRecord");
  }
  return event;
}

function applyTransition(task, transition, event, updatedAt) {
  if (task.history !== undefined && !Array.isArray(task.history)) {
    throw new Error(`任务 ${task.id} 的 history 必须是数组，已拒绝覆盖原记录。`);
  }

  task.status = transition.toStatus;
  task.updatedAt = updatedAt;
  task.history = [...(task.history || []), cloneJsonValue(event, "history event")];

  if (transition.toStatus === "blocked") {
    task.blockedReason = transition.blockedReason;
  } else {
    delete task.blockedReason;
  }

  if (transition.toStatus === "done") {
    task.acceptanceRecord = cloneJsonValue(transition.acceptanceRecord, "acceptanceRecord");
    task.completedAt = updatedAt;
  } else {
    delete task.acceptanceRecord;
    delete task.completedAt;
  }
}

function validateTaskCollections(taskBoard, executionPack, paths) {
  if (!Array.isArray(taskBoard)) {
    throw new Error(`${paths.taskBoardPath} 的根节点必须是任务数组。`);
  }
  if (!isPlainObject(executionPack) || !Array.isArray(executionPack.tasks)) {
    throw new Error(`${paths.executionPackPath} 必须包含 tasks 数组。`);
  }

  const boardById = indexAndValidateTasks(taskBoard, paths.taskBoardPath);
  const packById = indexAndValidateTasks(executionPack.tasks, paths.executionPackPath);
  const boardIds = [...boardById.keys()];
  const packIds = [...packById.keys()];
  if (boardIds.length !== packIds.length || boardIds.some((id) => !packById.has(id))) {
    throw new Error("task-board.json 与 execution-pack.json 的任务 ID 集合不一致，已拒绝更新。");
  }

  for (const id of boardIds) {
    const boardTask = boardById.get(id);
    const packTask = packById.get(id);
    const boardState = lifecycleState(boardTask, id);
    const packState = lifecycleState(packTask, id);
    if (!isDeepStrictEqual(boardState, packState)) {
      throw new Error(`任务 ${id} 在 task-board.json 与 execution-pack.json 中的生命周期状态不一致，已拒绝更新。`);
    }
  }
}

function indexAndValidateTasks(tasks, filePath) {
  const byId = new Map();
  for (const task of tasks) {
    if (!isPlainObject(task)) throw new Error(`${filePath} 包含无效任务：任务必须是对象。`);
    const id = validateTaskId(task.id);
    if (byId.has(id)) throw new Error(`${filePath} 包含重复任务 ID：${id}。`);
    normalizeStoredStatus(task.status, id);
    if (task.history !== undefined && !Array.isArray(task.history)) {
      throw new Error(`任务 ${id} 的 history 必须是数组。`);
    }
    byId.set(id, task);
  }
  return byId;
}

function lifecycleState(task, taskId) {
  return {
    status: normalizeStoredStatus(task.status, taskId),
    updatedAt: task.updatedAt ?? null,
    history: task.history ?? [],
    blockedReason: task.blockedReason ?? null,
    acceptanceRecord: task.acceptanceRecord ?? null,
    completedAt: task.completedAt ?? null
  };
}

async function withLifecycleLock(root, operation) {
  const lockPath = path.join(root, LOCK_FILE);
  let lockHandle;
  try {
    lockHandle = await open(lockPath, "wx");
    await lockHandle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await lockHandle.sync();
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`执行包正在被另一个本地进程更新：${lockPath}。`);
    }
    throw contextualFileError(error, lockPath, "无法创建生命周期锁");
  }

  try {
    return await operation();
  } finally {
    await lockHandle?.close().catch(() => {});
    await rm(lockPath, { force: true }).catch(() => {});
  }
}

async function safelyWriteLifecyclePair(entries) {
  const token = `${process.pid}-${randomUUID()}`;
  const prepared = [];
  try {
    for (const entry of entries) {
      const tempPath = `${entry.filePath}.tmp-${token}`;
      const backupPath = `${entry.filePath}.bak-${token}`;
      const source = `${JSON.stringify(entry.value, null, 2)}\n`;
      const preparedEntry = { ...entry, tempPath, backupPath };
      prepared.push(preparedEntry);
      const handle = await open(tempPath, "wx");
      try {
        await handle.writeFile(source, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await copyFile(entry.filePath, backupPath);
    }

    for (const entry of prepared) {
      const currentSource = await readRequiredFile(entry.filePath);
      if (currentSource !== entry.originalSource) {
        throw new Error(`检测到并发修改，已拒绝覆盖：${entry.filePath}。`);
      }
    }

    const committed = [];
    try {
      for (const entry of prepared) {
        await rename(entry.tempPath, entry.filePath);
        committed.push(entry);
      }
    } catch (error) {
      for (const entry of committed.reverse()) {
        await rename(entry.backupPath, entry.filePath).catch(() => {});
      }
      throw contextualFileError(error, committed.at(-1)?.filePath || "execution pack", "安全写入失败");
    }
  } finally {
    await Promise.all(prepared.flatMap((entry) => [
      rm(entry.tempPath, { force: true }),
      rm(entry.backupPath, { force: true })
    ]).map((operation) => operation.catch(() => {})));
  }
}

async function readRequiredFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw contextualFileError(error, filePath, "无法读取执行包文件");
  }
}

function parseJson(source, filePath) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`无法解析 JSON：${filePath}。${error.message}`, { cause: error });
  }
}

function contextualFileError(error, filePath, prefix) {
  return new Error(`${prefix}：${filePath}。${error.message}`, { cause: error });
}

function cloneJsonValue(value, label) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new Error(`${label} 必须是可序列化的 JSON 数据。`, { cause: error });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasMeaningfulValue(value) {
  return Object.values(value).some((item) => {
    if (typeof item === "string") return Boolean(item.trim());
    if (Array.isArray(item)) return item.length > 0;
    if (isPlainObject(item)) return hasMeaningfulValue(item);
    return item !== undefined && item !== null;
  });
}
