#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildExecutionPack, validateInput } from "../src/engine.js";
import { ROLE_CATALOG } from "../src/roles.js";
import { FRONT_DESK, listWorkModes, routeUserRequest } from "../src/router.js";
import { readInputFile, writeJson, writeText } from "../src/io.js";
import { cleanExecutionPackOutput, writeExecutionPack } from "../src/render.js";
import { readTaskLifecycle, updateTaskStatus } from "../src/lifecycle.js";
import { compileKaipaiProductMediaDraft, compileProductLaunchExperimentRegistration, compileProductLaunchFeedbackReviewDraft, compileProductLaunchMeasurementSnapshot, compileProductLaunchRegenerationDraft } from "../src/product-launch.js";
import { verifyProductLaunchAgentContracts } from "../src/product-launch-agent-contracts.js";
import { inspectProductLaunchPlatformReadiness } from "../src/product-launch-platform-readiness.js";

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

  if (command === "product-launch-readiness") {
    const projectsRoot = path.resolve(String(args["projects-root"] || process.env.BOSSAI_PROJECTS_ROOT || path.resolve(root, "..")));
    let missionDraft;
    let missionSource;
    if (args.pack) {
      const packRoot = path.resolve(String(args.pack));
      const pack = JSON.parse(await readFile(path.join(packRoot, "execution-pack.json"), "utf8"));
      missionDraft = pack?.productLaunch?.missionDraft;
      if (!missionDraft) throw new Error("product-launch-readiness 的 --pack 必须包含有效 Product Launch execution-pack.json。");
      missionSource = packRoot;
    } else {
      const inputPath = path.join(root, "examples", "product-launch-input.json");
      const input = JSON.parse(await readFile(inputPath, "utf8"));
      missionDraft = buildExecutionPack(input).productLaunch?.missionDraft;
      if (!missionDraft) throw new Error("内置 Product Launch 验证输入未生成 Mission 草案。");
      missionSource = inputPath;
    }
    const agentContracts = await verifyProductLaunchAgentContracts({ projectsRoot, missionDraft });
    const platform = await inspectProductLaunchPlatformReadiness({ projectsRoot });
    const submissionReady = agentContracts.overall === "passed" && platform.platformReady === true;
    printJson({
      ok: true,
      command,
      submissionReady,
      missionSource,
      projectsRoot,
      agentContracts,
      platform,
      automaticSubmissionAllowed: false,
      externalActions: 0
    });
    process.exit(args.strict && !submissionReady ? 3 : 0);
  }

  if (command === "product-launch-measurement") {
    const packRoot = path.resolve(requiredOption(args.pack, "pack", command));
    const inputPath = path.resolve(requiredOption(args.input || args.i, "input", command));
    const output = path.resolve(String(args.output || args.o || path.join(packRoot, "measurements", "measurement-snapshot.json")));
    if (path.extname(output).toLowerCase() !== ".json") throw new Error("product-launch-measurement 的 --output 必须是 .json 文件。");
    const pack = JSON.parse(await readFile(path.join(packRoot, "execution-pack.json"), "utf8"));
    const baseExperimentPlan = pack?.productLaunch?.experimentPlan;
    if (!baseExperimentPlan || baseExperimentPlan.schema !== "bossai.product-launch-experiment-plan.v1") {
      throw new Error("product-launch-measurement 需要包含 experimentPlan 的有效 Product Launch execution-pack.json。");
    }
    const experimentPlanPath = args["experiment-plan"] ? path.resolve(String(args["experiment-plan"])) : null;
    const experimentPlan = experimentPlanPath
      ? await readJsonFile(experimentPlanPath, "Product Launch Experiment Plan")
      : baseExperimentPlan;
    if (experimentPlan?.schema !== "bossai.product-launch-experiment-plan.v1" || experimentPlan.productName !== baseExperimentPlan.productName) {
      throw new Error("product-launch-measurement 的 --experiment-plan 必须属于同一 Product Launch 商品并使用有效 experiment plan 合同。");
    }
    const input = await readJsonFile(inputPath, "Product Launch 测量输入");
    const snapshot = compileProductLaunchMeasurementSnapshot({
      experimentPlan,
      records: input?.records,
      compiledAt: input?.compiledAt
    });
    await writeJson(output, snapshot);
    printJson({
      ok: true,
      command,
      pack: packRoot,
      input: inputPath,
      experimentPlanSource: experimentPlanPath || "execution-pack.json#productLaunch.experimentPlan",
      experimentPlanRevision: experimentPlan.revision || 1,
      output,
      schema: snapshot.schema,
      status: snapshot.status,
      recordCount: snapshot.records.length,
      causalClaimAllowed: snapshot.causalClaimAllowed,
      automaticRegeneration: snapshot.automaticRegeneration,
      automaticPublication: snapshot.automaticPublication,
      feedbackAgentId: snapshot.feedbackHandoff.targetAgentId,
      feedbackCapability: snapshot.feedbackHandoff.capability,
      automaticFeedbackSubmission: snapshot.feedbackHandoff.automaticSubmission,
      externalActions: 0
    });
    process.exit(0);
  }

  if (command === "product-launch-feedback-draft") {
    const snapshotPath = path.resolve(requiredOption(args.snapshot, "snapshot", command));
    const output = path.resolve(String(args.output || args.o || path.join(path.dirname(snapshotPath), "feedback-review-draft.json")));
    if (path.extname(output).toLowerCase() !== ".json") throw new Error("product-launch-feedback-draft 的 --output 必须是 .json 文件。");
    const snapshotBytes = await readFile(snapshotPath);
    const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
    const snapshotSha256 = createHash("sha256").update(snapshotBytes).digest("hex");
    const draft = compileProductLaunchFeedbackReviewDraft({ measurementSnapshot: snapshot, snapshotSha256 });
    await writeJson(output, draft);
    printJson({
      ok: true,
      command,
      snapshot: snapshotPath,
      snapshotSha256,
      output,
      schema: draft.schema,
      status: draft.status,
      targetAgentId: draft.target.agentId,
      capability: draft.target.capability,
      recordCount: draft.sourceMeasurement.recordCount,
      recordsIncludedInObjective: draft.recordsIncludedInObjective,
      recordsTruncatedFromObjective: draft.recordsTruncatedFromObjective,
      causalClaimAllowed: draft.causalClaimAllowed,
      automaticSubmission: draft.managerTaskDraft.automaticSubmission,
      automaticRegeneration: draft.automaticRegeneration,
      automaticPublication: draft.automaticPublication,
      externalActions: 0
    });
    process.exit(0);
  }

  if (command === "product-launch-regeneration-draft") {
    const packRoot = path.resolve(requiredOption(args.pack, "pack", command));
    const reviewPath = path.resolve(requiredOption(args.review, "review", command));
    const output = path.resolve(String(args.output || args.o || path.join(packRoot, "iterations", "regeneration-draft.json")));
    if (path.extname(output).toLowerCase() !== ".json") throw new Error("product-launch-regeneration-draft 的 --output 必须是 .json 文件。");
    const pack = JSON.parse(await readFile(path.join(packRoot, "execution-pack.json"), "utf8"));
    const experimentPlan = pack?.productLaunch?.experimentPlan;
    if (!experimentPlan || experimentPlan.schema !== "bossai.product-launch-experiment-plan.v1") {
      throw new Error("product-launch-regeneration-draft 需要包含 experimentPlan 的有效 Product Launch execution-pack.json。");
    }
    const performanceReview = await readJsonFile(reviewPath, "Product Launch 已接受表现复盘");
    const draft = compileProductLaunchRegenerationDraft({ experimentPlan, performanceReview });
    await writeJson(output, draft);
    printJson({
      ok: true,
      command,
      pack: packRoot,
      review: reviewPath,
      output,
      schema: draft.schema,
      status: draft.status,
      iterationId: draft.iterationId,
      sourceVariantId: draft.sourceVariant.id,
      proposedVariantId: draft.proposedVariant.id,
      workstream: draft.proposedVariant.workstream,
      targetAgentId: draft.target.agentId,
      capability: draft.target.capability,
      automaticSubmission: draft.managerTaskDraft.automaticSubmission,
      automaticGeneration: draft.automaticGeneration,
      automaticRegeneration: draft.automaticRegeneration,
      automaticPublication: draft.automaticPublication,
      automaticAdSpend: draft.automaticAdSpend,
      externalActions: 0
    });
    process.exit(0);
  }

  if (command === "product-launch-register-iteration") {
    const packRoot = path.resolve(requiredOption(args.pack, "pack", command));
    const draftPath = path.resolve(requiredOption(args.draft, "draft", command));
    const reviewPath = path.resolve(requiredOption(args.review, "review", command));
    const output = path.resolve(String(args.output || args.o || path.join(packRoot, "iterations", "experiment-plan.next.json")));
    if (path.extname(output).toLowerCase() !== ".json") throw new Error("product-launch-register-iteration 的 --output 必须是 .json 文件。");
    const pack = JSON.parse(await readFile(path.join(packRoot, "execution-pack.json"), "utf8"));
    const experimentPlan = pack?.productLaunch?.experimentPlan;
    if (!experimentPlan || experimentPlan.schema !== "bossai.product-launch-experiment-plan.v1") {
      throw new Error("product-launch-register-iteration 需要包含 experimentPlan 的有效 Product Launch execution-pack.json。");
    }
    const regenerationDraft = await readJsonFile(draftPath, "Product Launch Regeneration Draft");
    const regenerationReview = await readJsonFile(reviewPath, "Product Launch 已接受再生成结果");
    const registration = compileProductLaunchExperimentRegistration({ experimentPlan, regenerationDraft, regenerationReview });
    await writeJson(output, registration.updatedExperimentPlan);
    const receiptOutput = path.join(path.dirname(output), `${path.basename(output, ".json")}.registration.json`);
    await writeJson(receiptOutput, {
      schema: registration.schema,
      status: registration.status,
      productName: registration.productName,
      sourcePlanRevision: registration.sourcePlanRevision,
      nextPlanRevision: registration.nextPlanRevision,
      registration: registration.registration,
      sourcePlanMutated: registration.sourcePlanMutated,
      automaticAdoption: registration.automaticAdoption,
      automaticPublication: registration.automaticPublication,
      automaticAdSpend: registration.automaticAdSpend,
      externalActionsAuthorized: registration.externalActionsAuthorized
    });
    printJson({
      ok: true,
      command,
      pack: packRoot,
      draft: draftPath,
      review: reviewPath,
      output,
      receiptOutput,
      schema: registration.schema,
      status: registration.status,
      sourcePlanRevision: registration.sourcePlanRevision,
      nextPlanRevision: registration.nextPlanRevision,
      proposedVariantId: registration.registration.proposedVariantId,
      sourcePlanMutated: registration.sourcePlanMutated,
      automaticAdoption: registration.automaticAdoption,
      automaticPublication: registration.automaticPublication,
      automaticAdSpend: registration.automaticAdSpend,
      externalActions: 0
    });
    process.exit(0);
  }

  if (command === "product-video-draft") {
    const packRoot = path.resolve(requiredOption(args.pack, "pack", command));
    const reviewPath = path.resolve(requiredOption(args.review, "review", command));
    const output = path.resolve(String(args.output || args.o || path.join(packRoot, "handoffs", "product-video-draft.json")));
    if (path.extname(output).toLowerCase() !== ".json") throw new Error("product-video-draft 的 --output 必须是 .json 文件。");
    const pack = JSON.parse(await readFile(path.join(packRoot, "execution-pack.json"), "utf8"));
    if (!pack?.productLaunch?.productProfile || !pack?.productLaunch?.assetPlan) {
      throw new Error("product-video-draft 需要有效的 Product Launch execution-pack.json。");
    }
    const videoReview = await readJsonFile(reviewPath, "商品视频审核文件");
    const draft = compileKaipaiProductMediaDraft({
      productProfile: pack.productLaunch.productProfile,
      assetPlan: pack.productLaunch.assetPlan,
      videoReview
    });
    await writeJson(output, draft);
    printJson({
      ok: true,
      command,
      pack: packRoot,
      review: reviewPath,
      output,
      schema: draft.schema,
      sourceReviewArtifact: draft.sourceReviewArtifact,
      sourceReviewArtifactSha256: draft.sourceReviewArtifactSha256,
      executionContract: draft.execution.contract,
      executionTarget: draft.execution.executionTarget,
      operation: draft.execution.operation,
      automaticDraftImport: false,
      mediaImported: draft.execution.mediaImported,
      rightsConfirmed: draft.execution.rightsConfirmed,
      automaticExecution: draft.execution.automaticExecution,
      publicationAuthorized: draft.execution.publicationAuthorized
    });
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

async function readJsonFile(filePath, label) {
  const absolute = path.resolve(filePath);
  try {
    return JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    throw new Error(`${label}无法解析：${absolute}。${error instanceof Error ? error.message : String(error)}`);
  }
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
  bossai-team product-launch-readiness --pack outputs/product-launch [--projects-root D:\\BossAI-Projects] [--strict]
  bossai-team product-launch-measurement --pack outputs/product-launch --input measurements.json [--output snapshot.json]
  bossai-team product-launch-feedback-draft --snapshot measurement-snapshot.json [--output feedback-review-draft.json]
  bossai-team product-launch-regeneration-draft --pack outputs/product-launch --review accepted-performance-review.json [--output regeneration-draft.json]
  bossai-team product-launch-register-iteration --pack outputs/product-launch --draft regeneration-draft.json --review accepted-regeneration-review.json [--output experiment-plan.next.json]
  bossai-team product-video-draft --pack outputs/product-launch --review video-review.json [--output handoff.json]
  bossai-team demo --output outputs/demo [--clean]
  bossai-team roles --format markdown|json   # 仅供内部查看
  bossai-team version

plan 参数：
  --input, -i       JSON 或 Markdown 输入文件
  --output, -o      输出目录，默认 outputs/latest
  --limit           最多评估的机会数量，默认 5
  --max-roles       本轮最多上岗岗位数量，默认 8

product-launch-readiness 参数：
  --pack            可选 Product Launch 执行包目录；省略时使用内置验证输入
  --projects-root   BossAI 项目根目录；默认当前项目父目录或 BOSSAI_PROJECTS_ROOT
  --strict          若五员工合同或权威 BossAI OS 平台未就绪，以非零状态退出
  只读检查 Agent manifest 与 BossAI OS Manager 源码；不启动插件、不注册、不调用 Provider、不自动提交 Mission。

product-launch-measurement 参数：
  --pack            Product Launch 执行包目录，必须包含 experimentPlan
  --experiment-plan 可选新版 experiment-plan.next.json；必须属于同一商品
  --input, -i       人工导出或已批准 Connector 形成的原始观测 JSON
  --output, -o      可选输出路径；默认 <pack>/measurements/measurement-snapshot.json
  该命令只校验和本地计算派生指标；不抓平台数据、不宣称因果、不自动再生成、不发布、不投放。

product-launch-feedback-draft 参数：
  --snapshot        已编译的 bossai.product-launch-measurement-snapshot.v1 JSON
  --output, -o      可选输出路径；默认与 snapshot 同目录的 feedback-review-draft.json
  该命令只生成给 content.performance.review 的待审核 Manager Task 草稿；不自动提交、不选赢家、不再生成、不发布。

product-launch-regeneration-draft 参数：
  --pack            Product Launch 执行包目录，必须包含 experimentPlan
  --review          已接受的 bossai.product-launch-performance-review.v1 JSON，内含单变量 nextExperiment
  --output, -o      可选输出路径；默认 <pack>/iterations/regeneration-draft.json
  该命令只生成新的不可变 Variant 草稿和待审核 Manager Task；不覆盖旧 Variant、不自动提交、不生成、不发布、不投放。

product-launch-register-iteration 参数：
  --pack            原 Product Launch 执行包目录
  --draft           已生成的 bossai.product-launch-regeneration-draft.v1
  --review          已接受的 bossai.product-launch-regeneration-review.v1
  --output, -o      可选新版 Experiment Plan；默认 <pack>/iterations/experiment-plan.next.json
  只生成下一版 Experiment Plan 和注册回执，不覆盖 execution-pack.json 或原 experiment-plan.json；新 Variant 仍是 approved-not-published。

product-video-draft 参数：
  --pack            Product Launch 执行包目录
  --review          已人工接受的 bossai.product-launch-video-review.v1 JSON
  --output, -o      可选输出路径；默认 <pack>/handoffs/product-video-draft.json
  该命令只编译本地开拍草稿，不导入媒体、不确认权利、不执行 FFmpeg、不发布。

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
