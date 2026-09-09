import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectProductLaunchPlatformReadiness } from "../src/product-launch-platform-readiness.js";

async function fixture(managerSource) {
  const root = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-platform-readiness-"));
  if (managerSource !== undefined) {
    const services = path.join(root, "bossai-os", "apps", "api", "src", "services");
    await mkdir(services, { recursive: true });
    await writeFile(path.join(services, "manager.service.ts"), managerSource, "utf8");
  }
  return root;
}

test("Product Launch 平台就绪度在当前 Manager 源码缺失时失败关闭", async () => {
  const root = await fixture();
  try {
    const report = await inspectProductLaunchPlatformReadiness({ projectsRoot: root });
    assert.equal(report.platformReady, false);
    assert.equal(report.automaticSubmissionAllowed, false);
    assert.equal(report.blockers[0]?.code, "BOSSAI_OS_MANAGER_SOURCE_MISSING");
    assert.equal(report.providerCalls, 0);
    assert.equal(report.externalActions, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 平台就绪度拒绝仍是旧 summary-only Mission 的 Manager 源码", async () => {
  const root = await fixture(`
    const schema = "bossai.manager-mission-handoff.v1";
    function advanceManagerMission() { return schema; }
  `);
  try {
    const report = await inspectProductLaunchPlatformReadiness({ projectsRoot: root });
    assert.equal(report.platformReady, false);
    assert.equal(report.blockers[0]?.code, "BOSSAI_OS_REVIEWED_HANDOFF_NOT_CONSOLIDATED");
    assert.ok(report.blockers[0]?.details?.missingMarkers.includes("managerMissionDependencyReady"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 平台就绪度只在 reviewed Artifact Mission handoff 标记完整时通过", async () => {
  const root = await fixture(`
    type ManagerMissionHandoffArtifactReference = { requiresHumanReview: boolean };
    const schema = "bossai.manager-mission-handoff.v1";
    function managerMissionDependencyReady() { return true; }
    const completionEventId = "completionEventId";
    const reviewEventId = "reviewEventId";
  `);
  try {
    const report = await inspectProductLaunchPlatformReadiness({ projectsRoot: root });
    assert.equal(report.platformReady, true);
    assert.deepEqual(report.blockers, []);
    assert.equal(report.automaticSubmissionAllowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
