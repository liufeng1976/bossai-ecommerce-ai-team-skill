#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExecutionPack, validateInput } from "../src/engine.js";
import { ROLE_CATALOG } from "../src/roles.js";
import { FRONT_DESK, listWorkModes, routeUserRequest } from "../src/router.js";
import { readInputFile, writeJson, writeText } from "../src/io.js";
import { cleanExecutionPackOutput, writeExecutionPack } from "../src/render.js";
import { readTaskLifecycle, updateTaskStatus } from "../src/lifecycle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageMeta = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";

try {
  if (["help", "--help", "-h"].includes(command) || args.help || args.h) {
    process.stdout.write(helpText());
    process.exit(0);
  }

  if (["version", "--version", "-v"].includes(command)) {
    process.stdout.write(`${packageMeta.version}\n`);
    process.exit(0);
  }

  if (command === "init") {
    const output = path.resolve(String(args.output || args.o || "bossai-team-input.json"));
    await writeJson(output, inputTemplate());
    printJson({ ok: true, command, output });
    process.exit(0);
  }

  if (command === "route") {
    const request = String(args.text || args.t || args._.slice(1).join(" ") || "").trim();
    const result = routeUserRequest(request);
    printJson({
      ok: true,
      command,
      frontDesk: result.frontDesk.name,
      reply: result.clientReply,
      primaryMode: result.primaryMode,
      secondaryModes: result.secondaryModes,
      needsClarification: result.needsClarification,
      ...(args.internal ? { internalRoleIds: result.internalRoleIds } : {})
    });
    process.exit(0);
  }

  if (command === "modes") {
    printJson({ ok: true, frontDesk: FRONT_DESK, modes: listWorkModes({ internal: Boolean(args.internal) }) });
    process.exit(0);
  }

  if (command === "roles") {
    const format = String(args.format || "markdown").toLowerCase();
    if (format === "json") printJson({ ok: true, visibility: "internal", roles: ROLE_CATALOG });
    else process.stdout.write(renderRolesMarkdown());
    process.exit(0);
  }

  if (command === "validate") {
    const input = required(args.input || args.i, "validate 需要 --input <file>。");
    const raw = await readInputFile(input);
    const result = validateInput(raw);
    printJson({
      ok: result.ok,
      errors: result.errors,
      warnings: result.warnings,
      summary: {
        project: result.normalized.business.name,
        signalCount: result.normalized.signals.length,
        sourceType: result.normalized.metadata.sourceType
      }
    });
    process.exit(result.ok ? 0 : 2);
  }

  if (command === "plan") {
    const input = required(args.input || args.i, "plan 需要 --input <file>。");
    const output = path.resolve(String(args.output || args.o || "outputs/latest"));
    const raw = await readInputFile(input);
    const pack = buildExecutionPack(raw, {
      limit: numberOption(args.limit, 5),
      maxRoles: numberOption(args["max-roles"], 8)
    });
    const written = await writeExecutionPack(pack, output);
    printJson({
      ok: true,
      command,
      output: written.root,
      frontDesk: pack.interface.frontDesk.name,
      workMode: pack.interface.primaryWorkMode.name,
      selectedOpportunity: pack.decision.selectedOpportunity,
      internalActiveRoles: pack.team.active.map((role) => role.name),
      taskCount: pack.tasks.length,
      warnings: pack.warnings,
      files: written.files
    });
    process.exit(0);
  }

  if (command === "task-status") {
    const pack = requiredOption(args.pack, "pack", command);
    const taskId = optionalOption(args.task, "task", command);
    const lifecycle = await readTaskLifecycle(pack);
    const task = taskId
      ? lifecycle.tasks.find((item) => item.id === taskId)
      : undefined;
    if (taskId && !task) throw new Error(`任务不存在：${taskId}。`);
    printJson({
      ok: true,
      command,
      pack: lifecycle.root,
      summary: lifecycle.summary,
      ...(taskId ? { task } : { tasks: lifecycle.tasks }),
      automaticExternalActions: false
    });
    process.exit(0);
  }

  if (command === "task-update") {
    const pack = requiredOption(args.pack, "pack", command);
    const taskId = requiredOption(args.task, "task", command);
    const status = requiredOption(args.status, "status", command);
    const result = await updateTaskStatus(pack, taskId, status, {
      actor: optionalOption(args.actor, "actor", command),
      note: optionalOption(args.note, "note", command),
      blockedReason: optionalOption(args["blocked-reason"], "blocked-reason", command),
      acceptance: optionalOption(args.acceptance, "acceptance", command)
    });
    printJson({ ok: true, command, pack: result.root, ...result });
    process.exit(0);
  }

  if (command === "demo") {
    const output = path.resolve(String(args.output || args.o || "outputs/demo"));
    const demoPath = path.join(root, "examples", "demo-input.json");
    const raw = await readInputFile(demoPath);
    const pack = buildExecutionPack(raw, { limit: 5, maxRoles: 10 });
    const cleanup = args.clean
      ? await cleanExecutionPackOutput(output)
      : { root: output, cleaned: false };
    const written = await writeExecutionPack(pack, output);
    printJson({
      ok: true,
      command,
      input: demoPath,
      output: written.root,
      frontDesk: pack.interface.frontDesk.name,
      workMode: pack.interface.primaryWorkMode.name,
      selectedOpportunity: pack.decision.selectedOpportunity,
      internalActiveRoles: pack.team.active.map((role) => role.name),
      taskCount: pack.tasks.length,
      cleanedPreviousOutput: cleanup.cleaned,
      files: written.files
    });
    process.exit(0);
  }

  throw new Error(`未知命令：${command}。运行 bossai-team help 查看用法。`);
} catch (error) {
  printJson({
    ok: false,
    command,
    error: error instanceof Error ? error.message : String(error),
    validationErrors: error?.validationErrors || []
  }, true);
  process.exit(1);
}

function inputTemplate() {
  return {
    business: {
      name: "我的电商项目",
      platforms: ["Amazon"],
      customer: "请写清楚目标客户",
      goal: "7天内验证一个客户愿意付费的最小方案",
      offer: "请填写当前商品、服务或软件",
      constraints: ["预算有限", "所有对外动作人工审核"],
      assets: ["已有店铺", "历史客服记录"]
    },
    signals: [
      {
        id: "SIG-001",
        title: "请填写一个真实机会或客户痛点",
        summary: "描述发生了什么、谁受影响、为什么值得处理。",
        source: "Reddit / 客户访谈 / 招聘需求 / 竞品评论等",
        url: "https://example.com/source",
        evidence: "粘贴摘要或客户原话，不要虚构。",
        observed_at: new Date().toISOString().slice(0, 10),
        tags: ["客服", "Amazon"]
      }
    ]
  };
}

function renderRolesMarkdown() {
  return `# 内部文件｜BossAI 电商AI员工岗位库\n\n> 客户不需要选择岗位。所有岗位由 BossAI 电商总管自动调度。\n\n${ROLE_CATALOG.map((role) => `## ${role.name}\n\n- 层级：${role.tier === "core" ? "核心" : "扩展"}\n- 使命：${role.mission}\n- 标准交付：${role.deliverables.join("、")}\n- KPI：${role.kpi.join("、")}\n`).join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) {
      parsed._.push(token);
      continue;
    }
    const clean = token.replace(/^-+/, "");
    const [key, inlineValue] = clean.split("=", 2);
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("-")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function required(value, message) {
  if (!value) throw new Error(message);
  return String(value);
}

function requiredOption(value, name, commandName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${commandName} 需要 --${name} <value>。`);
  }
  return value.trim();
}

function optionalOption(value, name, commandName) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${commandName} 的 --${name} 需要非空值。`);
  }
  return value.trim();
}

function numberOption(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function printJson(value, stderr = false) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  if (stderr) process.stderr.write(output);
  else process.stdout.write(output);
}

function helpText() {
  return `BossAI 电商总管 Skill v${packageMeta.version}

客户只和 BossAI 电商总管对话，不需要选择员工。后台岗位自动分配。

用法：
  bossai-team route --text "我现在项目太多，不知道先做哪个"
  bossai-team modes
  bossai-team route --text "..." --internal   # 仅开发调试时显示后台岗位
  bossai-team init --output bossai-team-input.json
  bossai-team validate --input bossai-team-input.json
  bossai-team plan --input bossai-team-input.json --output outputs/latest
  bossai-team task-status --pack outputs/latest [--task TASK-001]
  bossai-team task-update --pack outputs/latest --task TASK-001 --status in-progress [--actor "负责人"] [--note "开始处理"]
  bossai-team task-update --pack outputs/latest --task TASK-001 --status blocked --blocked-reason "等待证据"
  bossai-team task-update --pack outputs/latest --task TASK-001 --status done --acceptance "验收通过"
  bossai-team demo --output outputs/demo [--clean]
  bossai-team roles --format markdown|json   # 仅供内部查看
  bossai-team version

plan 参数：
  --input, -i       JSON 或 Markdown 输入文件
  --output, -o      输出目录，默认 outputs/latest
  --limit           最多评估的机会数量，默认 5
  --max-roles       本轮最多上岗岗位数量，默认 8

demo 参数：
  --clean           仅在目标目录含有效 BossAI manifest.json 时清理旧演示产物

任务生命周期参数：
  --pack            执行包目录（必须包含 task-board.json 与 execution-pack.json）
  --task            任务 ID；task-status 中可省略以查看全部任务
  --status          目标状态：todo | in-progress | blocked | done | cancelled
  --actor           可选，本地状态变更操作者
  --note            可选，本地状态变更说明
  --blocked-reason  进入 blocked 时必填
  --acceptance      进入 done 时必填的验收记录

输入兼容：
  - 通用 JSON：signals / items / opportunities
  - BossAI Radar Lite JSON：top_opportunities
  - Markdown：用“业务/项目”和“机会/信号/痛点/需求”标题组织

安全边界：
  本工具只做分析、分工、草拟和验收计划；不会自动发布、发送客户消息、登录账号、采购、付款、退款或删除数据。
`;
}
