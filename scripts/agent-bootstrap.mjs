#!/usr/bin/env node
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
const agentHomeExplicit = Boolean(args["agent-home"] || process.env.BOSSAI_AGENT_HOME);
const agentHome = path.resolve(String(args["agent-home"] || process.env.BOSSAI_AGENT_HOME || os.homedir()));
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
  agentHome,
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

let activeInstallDir = installDir;
let installTransaction = null;
let installedVersion = null;

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

  await stageInstallFiles();
  await verifyPackageMetadata(activeInstallDir);

  if (!skipVerify) {
    runRequired(process.execPath, ["--test"], activeInstallDir, "运行单元测试");
    const verifyOutput = path.join(activeInstallDir, "outputs", "self-test");
    await rm(verifyOutput, { recursive: true, force: true });
    runRequired(process.execPath, [path.join(activeInstallDir, "bin", "bossai-team.mjs"), "demo", "--output", verifyOutput], activeInstallDir, "生成演示执行包");
    const manifestPath = path.join(verifyOutput, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error("演示执行包没有生成 manifest.json。");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!manifest.selectedOpportunity || manifest.fileCount < 8) throw new Error("演示执行包验收失败。");
    summary.steps.push({ step: "verification", status: "ok", selectedOpportunity: manifest.selectedOpportunity, fileCount: manifest.fileCount });
  } else {
    summary.steps.push({ step: "verification", status: "skipped" });
  }

  await commitInstallFiles();
  summary.hostDiagnostics = agents.map(diagnoseHostRuntime);

  for (const agent of agents) {
    const destinations = destinationsFor(agent);
    for (const destination of destinations) await installSkill(destination, agent);
  }

  await finalizeInstallFiles();
  summary.ok = true;
  print(summary);
} catch (error) {
  await rollbackInstallFiles();
  summary.error = error instanceof Error ? error.message : String(error);
  print(summary, true);
  process.exit(1);
}

async function stageInstallFiles() {
  if (samePath(sourceRoot, installDir)) {
    activeInstallDir = installDir;
    summary.steps.push({ step: "files", status: "ok", detail: "使用当前仓库作为稳定安装目录。" });
    return;
  }

  const staging = `${installDir}.staging-${process.pid}-${Date.now()}`;
  await mkdir(path.dirname(installDir), { recursive: true });
  await rm(staging, { recursive: true, force: true });
  await cp(sourceRoot, staging, {
    recursive: true,
    force: true,
    filter: (source) => shouldCopy(source)
  });
  activeInstallDir = staging;
  installTransaction = { staging, backup: null, committed: false };
  summary.steps.push({ step: "files-stage", status: "ok", detail: `已在隔离目录准备安装内容：${staging}` });
}

async function commitInstallFiles() {
  if (!installTransaction) return;

  if (existsSync(installDir)) {
    await assertManagedInstall(installDir);
    installTransaction.backup = `${installDir}.backup-${process.pid}-${Date.now()}`;
    await rm(installTransaction.backup, { recursive: true, force: true });
    await rename(installDir, installTransaction.backup);
  }

  try {
    await rename(installTransaction.staging, installDir);
    installTransaction.committed = true;
    activeInstallDir = installDir;
    summary.steps.push({
      step: "files",
      status: "ok",
      detail: installTransaction.backup ? `已安全升级到 ${installDir}` : `已安装到 ${installDir}`
    });
  } catch (error) {
    if (installTransaction.backup && existsSync(installTransaction.backup)) {
      await rename(installTransaction.backup, installDir);
    }
    throw error;
  }
}

async function rollbackInstallFiles() {
  if (!installTransaction) return;
  try {
    if (installTransaction.committed && existsSync(installDir)) {
      await rm(installDir, { recursive: true, force: true });
    }
    if (installTransaction.backup && existsSync(installTransaction.backup)) {
      await rename(installTransaction.backup, installDir);
    }
    if (existsSync(installTransaction.staging)) {
      await rm(installTransaction.staging, { recursive: true, force: true });
    }
    summary.steps.push({ step: "rollback", status: "ok", detail: "安装失败后已恢复原稳定目录。" });
  } catch (rollbackError) {
    summary.warnings.push(`自动回滚失败：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
  }
}

async function finalizeInstallFiles() {
  if (installTransaction?.backup && existsSync(installTransaction.backup)) {
    await rm(installTransaction.backup, { recursive: true, force: true });
  }
  installTransaction = null;
}

async function assertManagedInstall(directory) {
  const packagePath = path.join(directory, "package.json");
  if (!existsSync(packagePath)) throw new Error(`拒绝覆盖未知目录：${directory} 缺少 package.json。`);
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  if (pkg.name !== "bossai-ecommerce-ai-team-skill") {
    throw new Error(`拒绝覆盖未知目录：${directory} 不是 BossAI 电商总管安装目录。`);
  }
}

function shouldCopy(source) {
  const relative = path.relative(sourceRoot, source);
  if (!relative) return true;
  const first = relative.split(path.sep)[0];
  return !new Set([".git", "node_modules", "outputs", "coverage", ".env"]).has(first);
}

async function verifyPackageMetadata(directory) {
  const packagePath = path.join(directory, "package.json");
  const manifestPath = path.join(directory, "agent-install.json");
  const skillPath = path.join(directory, "skill", "SKILL.md");
  if (!existsSync(packagePath) || !existsSync(manifestPath) || !existsSync(skillPath)) {
    throw new Error("安装包缺少 package.json、agent-install.json 或 skill/SKILL.md。");
  }
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const skillText = await readFile(skillPath, "utf8");
  if (pkg.name !== "bossai-ecommerce-ai-team-skill") throw new Error("package.json 名称不正确。");
  if (manifest.version !== pkg.version) throw new Error("agent-install.json 与 package.json 版本不一致。");
  if (!skillText.includes(`version: ${pkg.version}`)) throw new Error("skill/SKILL.md 缺少一致的版本元数据。");
  installedVersion = pkg.version;
  summary.steps.push({ step: "package", status: "ok", version: pkg.version });
}

async function installSkill(destination, agent) {
  const parent = path.dirname(destination);
  const staging = path.join(parent, `.${path.basename(destination)}.staging-${process.pid}-${Date.now()}`);
  const backup = path.join(parent, `.${path.basename(destination)}.backup-${process.pid}-${Date.now()}`);
  await mkdir(parent, { recursive: true });
  await rm(staging, { recursive: true, force: true });
  await cp(path.join(installDir, "skill"), staging, { recursive: true, force: true });
  await writeFile(path.join(staging, "BOSSAI_TEAM_HOME.txt"), `${installDir}\n`, "utf8");
  await writeFile(path.join(staging, "config.json"), `${JSON.stringify({
    name: NAME,
    displayName: "BossAI 电商总管",
    version: installedVersion,
    interactionMode: "single-front-desk",
    customerChoosesEmployee: false,
    agent,
    installDir,
    cli: [process.execPath, path.join(installDir, "bin", "bossai-team.mjs")],
    safetyMode: "draft-and-plan-only",
    commercialUseAllowed: false,
    installedAt: new Date().toISOString()
  }, null, 2)}\n`, "utf8");

  if (existsSync(destination)) {
    await assertManagedSkill(destination);
    await rm(backup, { recursive: true, force: true });
    await rename(destination, backup);
  }

  try {
    await rename(staging, destination);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(destination)) await rm(destination, { recursive: true, force: true });
    if (existsSync(backup)) await rename(backup, destination);
    throw error;
  }
  summary.steps.push({ step: `${agent}-skill`, status: "ok", destination, protocolVerified: true });
}

async function assertManagedSkill(directory) {
  const configPath = path.join(directory, "config.json");
  const homePath = path.join(directory, "BOSSAI_TEAM_HOME.txt");
  if (!existsSync(configPath) || !existsSync(homePath)) {
    throw new Error(`拒绝覆盖未知 Skill 目录：${directory}。`);
  }
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.name !== NAME) throw new Error(`拒绝覆盖未知 Skill 目录：${directory}。`);
}

function destinationsFor(agent) {
  const destinations = [];
  if (agent === "codex") {
    destinations.push(path.join(agentHome, ".codex", "skills", NAME));
    if (workspace) destinations.push(path.join(workspace, ".agents", "skills", NAME));
  } else if (agent === "claude") {
    destinations.push(path.join(agentHome, ".claude", "skills", NAME));
    if (workspace) destinations.push(path.join(workspace, ".claude", "skills", NAME));
  } else if (agent === "hermes") {
    destinations.push(path.join(resolveHermesHome(), "skills", "ecommerce", NAME));
    if (workspace) destinations.push(path.join(workspace, "skills", NAME));
  } else if (agent === "openclaw") {
    const openclawWorkspace = workspace || process.env.OPENCLAW_WORKSPACE || path.join(agentHome, ".openclaw", "workspace");
    destinations.push(path.join(openclawWorkspace, "skills", NAME));
  } else {
    throw new Error(`不支持的 Agent：${agent}`);
  }
  return [...new Set(destinations.map((item) => path.resolve(item)))];
}

function resolveHermesHome() {
  if (agentHomeExplicit) return path.join(agentHome, ".hermes");
  if (process.env.HERMES_HOME) return path.resolve(process.env.HERMES_HOME);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "hermes");
  }
  return path.join(agentHome, ".hermes");
}

function diagnoseHostRuntime(agent) {
  const checks = {
    codex: { env: ["CODEX_HOME", "CODEX_SANDBOX"], commands: ["codex"] },
    claude: { env: ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"], commands: ["claude"] },
    hermes: { env: ["HERMES_HOME", "HERMES_PROFILE"], commands: ["hermes"] },
    openclaw: { env: ["OPENCLAW_HOME", "OPENCLAW_WORKSPACE"], commands: ["openclaw"] }
  };
  const check = checks[agent];
  const environmentSignals = check.env.filter((key) => Boolean(process.env[key]));
  const commandSignals = check.commands.filter(commandExists);
  const runtimeDetected = environmentSignals.length > 0 || commandSignals.length > 0;
  return {
    agent,
    runtimeDetected,
    environmentSignals,
    commandSignals,
    verification: runtimeDetected
      ? "安装协议与目录写入已验证；检测到宿主信号，但未伪造宿主内端到端调用。"
      : "安装协议与目录写入已验证；当前环境未检测到宿主运行时，未声明宿主内安装成功。"
  };
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
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 11)) {
    throw new Error(`需要 Node.js 20.11.0 或更高版本，当前是 ${process.version}。`);
  }
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
  --agent-home    隔离用户级 Skill 根目录（正式使用默认用户主目录）
  --dry-run       只显示计划，不写入
  --skip-verify   跳过测试，不建议

默认安全模式：只分析、草拟、分工和本地验收；不自动发布、发客户消息、控制账号、采购付款、退款或删除。
`;
}
