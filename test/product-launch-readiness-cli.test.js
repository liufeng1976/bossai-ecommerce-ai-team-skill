import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "bossai-team.mjs");
const handoffContract = "bossai.manager-mission-handoff.v1";
const projects = [
  ["bossai-intelligence-agent", "bossai-intelligence-agent", "intelligence.commerce.launch-evidence", "intelligence.commerce-launch-evidence.md", false],
  ["bossai-sales-employee", "bossai-sales-agent", "sales.commerce.positioning", "sales.commerce-positioning.md", true],
  ["bossai-content-agent", "bossai-content-agent", "content.commerce.launch-copy", "content.commerce-launch-copy.md", true],
  ["bossai-design-agent", "bossai-design-agent", "design.commerce.asset-plan", "design.commerce-asset-plan.md", true],
  ["bossai-video-agent", "bossai-video-agent", "video.commerce.production.plan", "video.commerce-production-plan.md", true],
];

async function writeAgentFixtures(projectsRoot) {
  for (const [directory, agentId, capability, artifactId, dependsOn] of projects) {
    const projectRoot = path.join(projectsRoot, directory);
    await mkdir(projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, "agent.manifest.json"), `${JSON.stringify({
      schema: "bossai.agent-plugin.v1",
      id: agentId,
      version: "0.0.0-test",
      contracts: dependsOn ? [handoffContract] : [],
      capabilities: [capability],
      artifacts: [{ id: artifactId, capability, primary: true }],
    }, null, 2)}\n`, "utf8");
  }
}

async function writeReadyManager(projectsRoot) {
  const services = path.join(projectsRoot, "bossai-os", "apps", "api", "src", "services");
  await mkdir(services, { recursive: true });
  await writeFile(path.join(services, "manager.service.ts"), `
    type ManagerMissionHandoffArtifactReference = { requiresHumanReview: boolean };
    const handoff = "bossai.manager-mission-handoff.v1";
    function managerMissionDependencyReady() { return true; }
    const completionEventId = "completionEventId";
    const reviewEventId = "reviewEventId";
  `, "utf8");
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("product-launch-readiness CLI 汇总五员工合同和权威 OS 平台状态", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-readiness-cli-"));
  try {
    await writeAgentFixtures(temp);
    await writeReadyManager(temp);
    const result = run("product-launch-readiness", "--projects-root", temp);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.command, "product-launch-readiness");
    assert.equal(output.submissionReady, true);
    assert.equal(output.agentContracts.overall, "passed");
    assert.equal(output.agentContracts.checks.length, 5);
    assert.equal(output.platform.platformReady, true);
    assert.equal(output.automaticSubmissionAllowed, false);
    assert.equal(output.externalActions, 0);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-launch-readiness 默认只报告 blocker，--strict 才非零退出", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-readiness-cli-blocked-"));
  try {
    await writeAgentFixtures(temp);
    const report = run("product-launch-readiness", "--projects-root", temp);
    assert.equal(report.status, 0, report.stderr);
    const output = JSON.parse(report.stdout);
    assert.equal(output.submissionReady, false);
    assert.equal(output.platform.blockers[0]?.code, "BOSSAI_OS_MANAGER_SOURCE_MISSING");

    const strict = run("product-launch-readiness", "--projects-root", temp, "--strict");
    assert.equal(strict.status, 3, strict.stderr);
    const strictOutput = JSON.parse(strict.stdout);
    assert.equal(strictOutput.submissionReady, false);
    assert.equal(strictOutput.automaticSubmissionAllowed, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
