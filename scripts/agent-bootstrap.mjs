#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const NAME = "bossai-ecommerce-ai-team";
const REPOSITORY = "https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill";
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  process.stdout.write(helpText());
  process.exit(0);
}

const requestedAgent = String(args.agent || "auto").toLowerCase();
const installDir = path.resolve(String(args["install-dir"] || path.join(os.homedir(), ".bossai-ecommerce-ai-team-skill")));
const workspace = args.workspace ? path.resolve(String(args.workspace)) : null;
const dryRun = Boolean(args["dry-run"]);
const skipVerify = Boolean(args["skip-verify"]);
const agents = resolveAgents(requestedAgent);
const summary = {
  ok: false,
  name: NAME,
  repository: REPOSITORY,
  sourceRoot,
  installDir,
  workspace,
  agents,
  displayName: "BossAI 电商总管",
  interactionMode: "single-front-desk",
  customerChoosesEmployee: false,
  license: "PolyForm Noncommercial 1.0.0; commercial use requires BossAI written authorization",
  safety: {
    externalPublishing: false,
    automaticCustomerMessaging: false,
    accountControl: false,
    purchasingAndPayments: false,
    refundsAndDeletion: false
  },
  steps: [],
  warnings: []
};

try {
  checkNodeVersion();
  if (dryRun) {
    summary.steps.push({
      step: "plan",
      status: "ok",
      detail: [
        `Install files to ${installDir}`,
        `Install Skill for ${agents.join(", ")}`,
        workspace ? `Also install a project Skill into ${workspace}` : "No project workspace requested",
        skipVerify ? "Skip verification" : "Run unit tests and demo generation"
      ]
    });
    summary.ok = true;
    print(summary);
    process.exit(0);
  }

  if (isNestedPath(installDir, sourceRoot)) {
    throw new Error("--install-dir 不能位于源码仓库内部。");
  }

  await installFiles();
  await verifyPackageMetadata();

  if (!skipVerify) {
    runRequired(process.execPath, ["--test"], installDir, "运行单元测试");
    const verifyOutput = path.join(installDir, "outputs", "self-test");
    await rm(verifyOutput, { recursive: true, force: true });
    runRequired(process.execPath, [path.join(installDir, "bin", "bossai-team.mjs"), "demo", "--output", verifyOutput], installDir, "生成演示执行包");
    const manifestPath = path.join(verifyOutput, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error("演示执行包没有生成 manifest.json。");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!manifest.selectedOpportunity || manifest.fileCount < 8) throw new Error("演示执行包验收失败。");
    summary.steps.push({ step: "verification", status: "ok", selectedOpportunity: manifest.selectedOpportunity, fileCount: manifest.fileCount });
  } else {
    summary.steps.push({ step: "verification", status: "skipped" });
  }

  for (const agent of agents) {
    const destinations = destinationsFor(agent);
    for (const destination of destinations) await installSkill(destination, agent);
  }

  summary.ok = true;
  print(summary);
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
  print(summary, true);
  process.exit(1);
}

async function installFiles() {
  if (samePath(sourceRoot, installDir)) {
    summary.steps.push({ step: "files", status: "ok", detail: "使用当前仓库作为稳定安装目录。" });
    return;
  }
  await mkdir(installDir, { recursive: true });
  await cp(sourceRoot, installDir, {
    recursive: true,
    force: true,
    filter: (source) => shouldCopy(source)
  });
  summary.steps.push({ step: "files", status: "ok", detail: `已安装到 ${installDir}` });
}

function shouldCopy(source) {
  const relative = path.relative(sourceRoot, source);
  if (!relative) return true;
  const first = relative.split(path.sep)[0];
  return !new Set([".git", "node_modules", "outputs", "coverage", ".env"]).has(first);
}

async function verifyPackageMetadata() {
  const packagePath = path.join(installDir, "package.json");
  const skillPath = path.join(installDir, "skill", "SKILL.md");
  if (!existsSync(packagePath) || !existsSync(skillPath)) throw new Error("安装包缺少 package.json 或 skill/SKILL.md。");
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  if (pkg.name !== "bossai-ecommerce-ai-team-skill") throw new Error("package.json 名称不正确。");
  summary.steps.push({ step: "package", status: "ok", version: pkg.version });
}

async function installSkill(destination, agent) {
  await mkdir(destination, { recursive: true });
  await cp(path.join(installDir, "skill"), destination, { recursive: true, force: true });
  await writeFile(path.join(destination, "BOSSAI_TEAM_HOME.txt"), `${installDir}\n`, "utf8");
  await writeFile(path.join(destination, "config.json"), `${JSON.stringify({
    name: NAME,
    displayName: "BossAI 电商总管",
    interactionMode: "single-front-desk",
    customerChoosesEmployee: false,
    agent,
    installDir,
    cli: [process.execPath, path.join(installDir, "bin", "bossai-team.mjs")],
    safetyMode: "draft-and-plan-only",
    commercialUseAllowed: false,
    installedAt: new Date().toISOString()
  }, null, 2)}\n`, "utf8");
  summary.steps.push({ step: `${agent}-skill`, status: "ok", destination });
}

function destinationsFor(agent) {
  const destinations = [];
  if (agent === "codex") {
    destinations.push(path.join(os.homedir(), ".codex", "skills", NAME));
    if (workspace) destinations.push(path.join(workspace, ".agents", "skills", NAME));
  } else if (agent === "claude") {
    destinations.push(path.join(os.homedir(), ".claude", "skills", NAME));
    if (workspace) destinations.push(path.join(workspace, ".claude", "skills", NAME));
  } else if (agent === "hermes") {
    destinations.push(path.join(os.homedir(), ".hermes", "skills", NAME));
    if (workspace) destinations.push(path.join(workspace, "skills", NAME));
  } else if (agent === "openclaw") {
    const openclawWorkspace = workspace || process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), ".openclaw", "workspace");
    destinations.push(path.join(openclawWorkspace, "skills", NAME));
  } else {
    throw new Error(`不支持的 Agent：${agent}`);
  }
  return [...new Set(destinations.map((item) => path.resolve(item)))];
}

function resolveAgents(value) {
  const valid = ["openclaw", "hermes", "claude", "codex"];
  if (valid.includes(value)) return [value];
  if (value === "all") return valid;
  if (value !== "auto") throw new Error("--agent 必须是 openclaw、hermes、claude、codex、all 或 auto。");
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) return ["claude"];
  if (process.env.CODEX_HOME || process.env.CODEX_SANDBOX) return ["codex"];
  if (process.env.HERMES_HOME || process.env.HERMES_PROFILE) return ["hermes"];
  if (process.env.OPENCLAW_HOME || process.env.OPENCLAW_WORKSPACE) return ["openclaw"];
  const detected = [
    ["hermes", "hermes"],
    ["claude", "claude"],
    ["codex", "codex"]
  ].filter(([, command]) => commandExists(command)).map(([agent]) => agent);
  if (detected.length === 1) return detected;
  throw new Error(`无法安全识别当前 Agent。请显式传入 --agent。检测到：${detected.join(", ") || "无"}。`);
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) throw new Error(`需要 Node.js 20 或更高版本，当前是 ${process.version}。`);
}

function runRequired(command, commandArgs, cwd, label) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`${label}失败：${(result.stderr || result.stdout || "未知错误").trim()}`);
  }
  return result;
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where.exe" : "which";
  return spawnSync(checker, [command], { stdio: "ignore", windowsHide: true }).status === 0;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) continue;
    const clean = token.replace(/^-+/, "");
    const [key, inline] = clean.split("=", 2);
    if (inline !== undefined) {
      parsed[key] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("-")) {
      parsed[key] = next;
      index += 1;
    } else parsed[key] = true;
  }
  return parsed;
}

function isNestedPath(candidate, parent) {
  if (samePath(candidate, parent)) return false;
  const relative = path.relative(parent, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function samePath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function print(value, stderr = false) {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  if (stderr) process.stderr.write(output);
  else process.stdout.write(output);
}

function helpText() {
  return `BossAI 电商AI员工军团 Agent 安装器

用法：
  node scripts/agent-bootstrap.mjs --agent codex
  node scripts/agent-bootstrap.mjs --agent claude --workspace <project>
  node scripts/agent-bootstrap.mjs --agent openclaw --workspace <openclaw-workspace>
  node scripts/agent-bootstrap.mjs --agent hermes

参数：
  --agent         openclaw|hermes|claude|codex|all|auto
  --workspace     同时安装项目级 Skill 的工作区
  --install-dir   稳定安装目录，默认 ~/.bossai-ecommerce-ai-team-skill
  --dry-run       只显示计划，不写入
  --skip-verify   跳过测试，不建议

默认安全模式：只分析、草拟、分工和本地验收；不自动发布、发客户消息、控制账号、采购付款、退款或删除。
`;
}
