import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installer = path.join(root, "scripts", "agent-bootstrap.mjs");
const skillName = "bossai-ecommerce-ai-team";

function runInstaller(args, options = {}) {
  return spawnSync(process.execPath, [installer, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, ...options.env }
  });
}

function parseOutput(result) {
  const text = result.status === 0 ? result.stdout : result.stderr;
  return JSON.parse(text);
}

function userSkillPath(agent, agentHome) {
  if (agent === "codex") return path.join(agentHome, ".codex", "skills", skillName);
  if (agent === "claude") return path.join(agentHome, ".claude", "skills", skillName);
  if (agent === "hermes") return path.join(agentHome, ".hermes", "skills", "ecommerce", skillName);
  return path.join(agentHome, ".openclaw", "workspace", "skills", skillName);
}

function projectSkillPath(agent, workspace) {
  if (agent === "codex") return path.join(workspace, ".agents", "skills", skillName);
  if (agent === "claude") return path.join(workspace, ".claude", "skills", skillName);
  return path.join(workspace, "skills", skillName);
}

test("安装器可为四种宿主生成无写入安装计划", () => {
  for (const agent of ["openclaw", "hermes", "claude", "codex"]) {
    const result = runInstaller(["--agent", agent, "--dry-run"]);
    assert.equal(result.status, 0, `${agent}: ${result.stderr}`);
    const output = parseOutput(result);
    assert.equal(output.ok, true);
    assert.deepEqual(output.agents, [agent]);
    assert.equal(output.steps[0].step, "plan");
  }
});

test("安装清单、Skill 元数据与 package.json 使用一致版本", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(root, "agent-install.json"), "utf8"));
  const skill = await readFile(path.join(root, "skill", "SKILL.md"), "utf8");
  assert.equal(manifest.version, pkg.version);
  assert.match(skill, new RegExp(`^version: ${pkg.version.replaceAll(".", "\\.")}$`, "m"));
  assert.equal(manifest.minimumNodeVersion, pkg.engines.node.replace(/^>=/, ""));
  assert.deepEqual(Object.keys(manifest.agents).sort(), ["claude-code", "codex", "hermes", "openclaw"]);
});

test("四种宿主协议可在隔离目录真实写入，并区分协议验证与宿主运行时检测", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bossai-installer-matrix-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  for (const agent of ["openclaw", "hermes", "claude", "codex"]) {
    const base = path.join(tempRoot, agent);
    const installDir = path.join(base, "stable");
    const agentHome = path.join(base, "home");
    const workspace = path.join(base, "workspace");
    await mkdir(workspace, { recursive: true });

    const args = [
      "--agent", agent,
      "--install-dir", installDir,
      "--agent-home", agentHome,
      "--workspace", workspace,
      "--skip-verify"
    ];
    const result = runInstaller(args);
    assert.equal(result.status, 0, `${agent}: ${result.stderr}`);
    const output = parseOutput(result);
    assert.equal(output.ok, true);
    assert.equal(output.hostDiagnostics.length, 1);
    assert.equal(output.hostDiagnostics[0].agent, agent);
    assert.match(output.hostDiagnostics[0].verification, /未伪造|未声明/);

    const userDestination = agent === "openclaw"
      ? projectSkillPath(agent, workspace)
      : userSkillPath(agent, agentHome);
    assert.equal(existsSync(path.join(userDestination, "SKILL.md")), true, `${agent} user/workspace skill missing`);
    const config = JSON.parse(await readFile(path.join(userDestination, "config.json"), "utf8"));
    assert.equal(config.name, skillName);
    assert.equal(config.version, "1.3.0");
    assert.equal(config.commercialUseAllowed, false);
    if (agent === "hermes") {
      assert.equal(
        existsSync(path.join(userDestination, "references", "autoparts-commercial-closure.md")),
        true,
        "Hermes install must include the canonical automotive closure reference",
      );
    }

    if (agent !== "openclaw") {
      const projectDestination = projectSkillPath(agent, workspace);
      assert.equal(existsSync(path.join(projectDestination, "SKILL.md")), true, `${agent} project skill missing`);
    }
  }
});

test("重复安装执行安全升级并清除受管目录中的旧残留", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bossai-installer-upgrade-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const installDir = path.join(tempRoot, "stable");
  const agentHome = path.join(tempRoot, "home");
  const args = ["--agent", "codex", "--install-dir", installDir, "--agent-home", agentHome, "--skip-verify"];

  const first = runInstaller(args);
  assert.equal(first.status, 0, first.stderr);
  const skillDir = userSkillPath("codex", agentHome);
  await writeFile(path.join(installDir, "stale.tmp"), "old", "utf8");
  await writeFile(path.join(skillDir, "stale.tmp"), "old", "utf8");

  const second = runInstaller(args);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(existsSync(path.join(installDir, "stale.tmp")), false);
  assert.equal(existsSync(path.join(skillDir, "stale.tmp")), false);
  const output = parseOutput(second);
  assert.equal(output.steps.some((step) => step.step === "files" && step.detail.includes("安全升级")), true);
});

test("未知安装目录失败关闭且不覆盖原文件", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bossai-installer-fail-closed-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  const installDir = path.join(tempRoot, "unknown");
  const agentHome = path.join(tempRoot, "home");
  await mkdir(installDir, { recursive: true });
  const marker = path.join(installDir, "keep-me.txt");
  await writeFile(marker, "do not overwrite", "utf8");

  const result = runInstaller(["--agent", "codex", "--install-dir", installDir, "--agent-home", agentHome, "--skip-verify"]);
  assert.notEqual(result.status, 0);
  const output = parseOutput(result);
  assert.match(output.error, /拒绝覆盖未知目录/);
  assert.equal(await readFile(marker, "utf8"), "do not overwrite");
});
