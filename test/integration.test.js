import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildExecutionPack } from "../src/engine.js";
import { writeExecutionPack } from "../src/render.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("执行包会生成稳定文件合同和岗位卡", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-team-"));
  try {
    const raw = JSON.parse(await readFile(path.join(root, "examples", "demo-input.json"), "utf8"));
    const pack = buildExecutionPack(raw, { maxRoles: 10 });
    const result = await writeExecutionPack(pack, temp);
    const expected = [
      "00-start-here.md",
      "00-executive-brief.md",
      "01-business-brief.md",
      "02-opportunity-ranking.md",
      "03-work-routing.md",
      "04-seven-day-plan.md",
      "05-task-board.md",
      "task-board.json",
      "execution-pack.json",
      "internal/team-roster.md",
      "manifest.json"
    ];
    expected.forEach((file) => assert.ok(result.files.includes(file), `缺少 ${file}`));
    const manifest = JSON.parse(await readFile(path.join(temp, "manifest.json"), "utf8"));
    assert.equal(manifest.selectedOpportunity, pack.decision.selectedOpportunity);
    assert.ok(manifest.fileCount >= 10);
    const startHere = await readFile(path.join(temp, "00-start-here.md"), "utf8");
    assert.match(startHere, /不需要选择员工/);
    assert.match(startHere, /BossAI 电商总管/);
    const brief = await readFile(path.join(temp, "00-executive-brief.md"), "utf8");
    assert.match(brief, /本轮唯一主线/);
    assert.match(brief, /客户只和 BossAI 电商总管对话/);
    assert.match(brief, /人工批准|人工审核|由人批准|人工验收/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("CLI validate 和 demo 输出可机器读取 JSON", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-team-cli-"));
  try {
    const cli = path.join(root, "bin", "bossai-team.mjs");
    const input = path.join(root, "examples", "demo-input.json");
    const validate = spawnSync(process.execPath, [cli, "validate", "--input", input], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(validate.status, 0, validate.stderr);
    const validation = JSON.parse(validate.stdout);
    assert.equal(validation.ok, true);
    assert.equal(validation.summary.signalCount, 4);

    const demo = spawnSync(process.execPath, [cli, "demo", "--output", temp], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(demo.status, 0, demo.stderr);
    const result = JSON.parse(demo.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.frontDesk, "BossAI 电商总管");
    assert.ok(result.workMode);
    assert.ok(result.taskCount > 0);
    assert.ok(result.files.includes("manifest.json"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("Markdown 项目笔记可以验证并生成执行包", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-team-md-"));
  try {
    const cli = path.join(root, "bin", "bossai-team.mjs");
    const input = path.join(root, "examples", "demo-input.md");
    const validate = spawnSync(process.execPath, [cli, "validate", "--input", input], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(validate.status, 0, validate.stderr);
    const validation = JSON.parse(validate.stdout);
    assert.equal(validation.ok, true);
    assert.equal(validation.summary.signalCount, 2);

    const plan = spawnSync(process.execPath, [cli, "plan", "--input", input, "--output", temp], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    });
    assert.equal(plan.status, 0, plan.stderr);
    const result = JSON.parse(plan.stdout);
    assert.equal(result.ok, true);
    assert.match(result.selectedOpportunity, /客服|FAQ/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("CLI route 默认隐藏后台岗位，只有 --internal 才显示", () => {
  const cli = path.join(root, "bin", "bossai-team.mjs");
  const publicResult = spawnSync(process.execPath, [cli, "route", "--text", "帮我检查客服退款和物流回复风险"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(publicResult.status, 0, publicResult.stderr);
  const publicOutput = JSON.parse(publicResult.stdout);
  assert.equal(publicOutput.frontDesk, "BossAI 电商总管");
  assert.equal(publicOutput.primaryMode.id, "customer-service");
  assert.equal("internalRoleIds" in publicOutput, false);
  assert.equal("roles" in publicOutput.primaryMode, false);

  const internalResult = spawnSync(process.execPath, [cli, "route", "--text", "帮我检查客服退款和物流回复风险", "--internal"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(internalResult.status, 0, internalResult.stderr);
  const internalOutput = JSON.parse(internalResult.stdout);
  assert.ok(internalOutput.internalRoleIds.includes("customer-service"));
});

test("安装器 dry-run 不写入并返回安装计划", () => {
  const installer = path.join(root, "scripts", "agent-bootstrap.mjs");
  const result = spawnSync(process.execPath, [installer, "--agent", "codex", "--dry-run"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.deepEqual(output.agents, ["codex"]);
  assert.equal(output.safety.externalPublishing, false);
  assert.equal(output.safety.automaticCustomerMessaging, false);
});
