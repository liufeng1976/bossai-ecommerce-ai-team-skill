import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildExecutionPack } from "../src/engine.js";
import { writeExecutionPack } from "../src/render.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "bossai-team.mjs");

const launchInput = {
  business: {
    name: "measurement-cli-test",
    platforms: ["Amazon"],
    customer: "养宠家庭",
    goal: "把这个商品卖起来并建立发布后实验闭环",
    offer: "智能宠物饮水机",
    assets: ["product-white-background.jpg"],
    constraints: ["不自动发布", "不自动投放"]
  }
};

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env } });
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

test("product-launch-measurement CLI 从执行包编译权威观测快照但不触发外部动作", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-measurement-cli-"));
  try {
    const packRoot = path.join(temp, "pack");
    await writeExecutionPack(buildExecutionPack(launchInput), packRoot);
    const inputPath = path.join(temp, "measurement-input.json");
    await writeFile(inputPath, `${JSON.stringify({
      compiledAt: "2026-08-16T18:00:00Z",
      records: [{
        variantId: "amazon-main.v01",
        windowStart: "2026-08-15T00:00:00Z",
        windowEnd: "2026-08-16T00:00:00Z",
        sourceType: "manual-export",
        sourceLabel: "Amazon Seller Central export",
        sourceRecordId: "amazon-export-001",
        metrics: { impressions: 1000, clicks: 80, detailPageViews: 70, addToCarts: 14, orders: 7, unitsOrdered: 8, revenue: 350 }
      }]
    }, null, 2)}\n`, "utf8");

    const result = run("product-launch-measurement", "--pack", packRoot, "--input", inputPath);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.recordCount, 1);
    assert.equal(output.causalClaimAllowed, false);
    assert.equal(output.automaticRegeneration, false);
    assert.equal(output.automaticPublication, false);
    assert.equal(output.automaticFeedbackSubmission, false);
    assert.equal(output.externalActions, 0);

    const snapshot = JSON.parse(await readFile(output.output, "utf8"));
    assert.equal(snapshot.records[0].derivedMetrics.ctr, 0.08);
    assert.equal(snapshot.records[0].derivedMetrics.orderConversionRate, 0.1);
    assert.equal(snapshot.status, "observed-not-causal");

    const feedback = run("product-launch-feedback-draft", "--snapshot", output.output);
    assert.equal(feedback.status, 0, feedback.stderr);
    const feedbackOutput = JSON.parse(feedback.stdout);
    assert.equal(feedbackOutput.ok, true);
    assert.equal(feedbackOutput.targetAgentId, "bossai-content-agent");
    assert.equal(feedbackOutput.capability, "content.performance.review");
    assert.equal(feedbackOutput.causalClaimAllowed, false);
    assert.equal(feedbackOutput.automaticSubmission, false);
    assert.equal(feedbackOutput.automaticRegeneration, false);
    assert.equal(feedbackOutput.automaticPublication, false);
    assert.equal(feedbackOutput.externalActions, 0);
    const feedbackDraft = JSON.parse(await readFile(feedbackOutput.output, "utf8"));
    assert.match(feedbackDraft.managerTaskDraft.objective, /observed-not-causal/);
    assert.match(feedbackDraft.managerTaskDraft.objective, /amazon-main\.v01/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-launch-feedback-draft CLI 拒绝被篡改为因果结论的 snapshot 且不留下草稿", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-feedback-cli-reject-"));
  try {
    const snapshotPath = path.join(temp, "tampered-snapshot.json");
    const outputPath = path.join(temp, "feedback.json");
    await writeFile(snapshotPath, `${JSON.stringify({
      schema: "bossai.product-launch-measurement-snapshot.v1",
      productName: "智能宠物饮水机",
      compiledAt: "2026-08-16T18:00:00.000Z",
      status: "observed-not-causal",
      records: [{
        variantId: "amazon-main.v01",
        platform: "Amazon",
        assetPlanItemId: "amazon-main",
        windowStart: "2026-08-15T00:00:00.000Z",
        windowEnd: "2026-08-16T00:00:00.000Z",
        sourceType: "manual-export",
        sourceLabel: "Amazon export",
        rawMetrics: { impressions: 100, clicks: 20 },
        derivedMetrics: { ctr: 0.2 },
        evidenceStatus: "observed-not-causal"
      }],
      causalClaimAllowed: true,
      automaticRegeneration: false,
      automaticPublication: false,
      feedbackHandoff: {
        schema: "bossai.product-launch-feedback-handoff.v1",
        targetAgentId: "bossai-content-agent",
        capability: "content.performance.review",
        automaticSubmission: false,
        externalActionsAuthorized: false
      }
    }, null, 2)}\n`, "utf8");
    const result = run("product-launch-feedback-draft", "--snapshot", snapshotPath, "--output", outputPath);
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.match(error.error, /PRODUCT_LAUNCH_MEASUREMENT_CAUSAL_BOUNDARY_INVALID/);
    assert.equal(await exists(outputPath), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-launch-regeneration-draft CLI 从已接受 performance review 生成不可变新 Variant 草稿", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-regeneration-cli-"));
  try {
    const packRoot = path.join(temp, "pack");
    await writeExecutionPack(buildExecutionPack(launchInput), packRoot);
    const reviewPath = path.join(temp, "accepted-performance-review.json");
    await writeFile(reviewPath, `${JSON.stringify({
      schema: "bossai.product-launch-performance-review.v1",
      descriptorId: "content.performance-review.md",
      artifactSha256: "d".repeat(64),
      sourceMeasurementSha256: "e".repeat(64),
      accepted: true,
      acceptedAt: "2026-08-16T19:00:00Z",
      reviewedBy: "product-owner",
      nextExperiment: {
        sourceVariantId: "amazon-main.v01",
        workstream: "design",
        hypothesis: "更清晰的首图信息层级可能提高点击意愿，但仍需实验验证。",
        singleVariableChange: "只调整首图信息层级，不改变商品主体、价格或 Listing 标题。",
        successMetric: "ctr",
        holdConstant: ["商品主体", "价格", "Listing 标题", "流量来源"],
        observationWindowNotes: "使用与上一轮可比的 24 小时窗口。"
      }
    }, null, 2)}\n`, "utf8");

    const result = run("product-launch-regeneration-draft", "--pack", packRoot, "--review", reviewPath);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.status, "draft-not-submitted");
    assert.equal(output.sourceVariantId, "amazon-main.v01");
    assert.match(output.proposedVariantId, /^amazon-main\.v01\.[0-9a-f]{10}$/u);
    assert.equal(output.workstream, "design");
    assert.equal(output.targetAgentId, "bossai-design-agent");
    assert.equal(output.capability, "design.commerce.asset-plan");
    assert.equal(output.automaticSubmission, false);
    assert.equal(output.automaticGeneration, false);
    assert.equal(output.automaticRegeneration, false);
    assert.equal(output.automaticPublication, false);
    assert.equal(output.automaticAdSpend, false);
    assert.equal(output.externalActions, 0);
    const draft = JSON.parse(await readFile(output.output, "utf8"));
    assert.equal(draft.experimentRegistration.mutatesExistingVariant, false);
    assert.equal(draft.sourcePerformanceReview.artifactSha256, "d".repeat(64));
    assert.match(draft.managerTaskDraft.objective, /Product Launch 创意迭代/);

    const regenerationReviewPath = path.join(temp, "accepted-regeneration-review.json");
    await writeFile(regenerationReviewPath, `${JSON.stringify({
      schema: "bossai.product-launch-regeneration-review.v1",
      proposedVariantId: output.proposedVariantId,
      descriptorId: "design.commerce-asset-plan.md",
      artifactSha256: "f".repeat(64),
      accepted: true,
      acceptedAt: "2026-08-16T20:00:00Z",
      reviewedBy: "product-owner"
    }, null, 2)}\n`, "utf8");
    const register = run("product-launch-register-iteration", "--pack", packRoot, "--draft", output.output, "--review", regenerationReviewPath);
    assert.equal(register.status, 0, register.stderr);
    const registerOutput = JSON.parse(register.stdout);
    assert.equal(registerOutput.ok, true);
    assert.equal(registerOutput.sourcePlanRevision, 1);
    assert.equal(registerOutput.nextPlanRevision, 2);
    assert.equal(registerOutput.proposedVariantId, output.proposedVariantId);
    assert.equal(registerOutput.sourcePlanMutated, false);
    assert.equal(registerOutput.automaticAdoption, false);
    assert.equal(registerOutput.automaticPublication, false);
    assert.equal(registerOutput.automaticAdSpend, false);
    assert.equal(registerOutput.externalActions, 0);
    const nextPlan = JSON.parse(await readFile(registerOutput.output, "utf8"));
    assert.equal(nextPlan.revision, 2);
    assert.ok(nextPlan.channels.flatMap((channel) => channel.variants).some((variant) => variant.id === output.proposedVariantId));

    const nextMeasurementInput = path.join(temp, "next-measurement.json");
    const nextMeasurementOutput = path.join(temp, "next-measurement-snapshot.json");
    await writeFile(nextMeasurementInput, `${JSON.stringify({
      records: [{
        variantId: output.proposedVariantId,
        windowStart: "2026-08-17T00:00:00Z",
        windowEnd: "2026-08-18T00:00:00Z",
        sourceType: "manual-export",
        sourceLabel: "Amazon Seller Central iteration export",
        metrics: { impressions: 500, clicks: 50, detailPageViews: 45, addToCarts: 9, orders: 4, unitsOrdered: 4, revenue: 200 }
      }]
    }, null, 2)}\n`, "utf8");
    const nextMeasurement = run(
      "product-launch-measurement",
      "--pack", packRoot,
      "--experiment-plan", registerOutput.output,
      "--input", nextMeasurementInput,
      "--output", nextMeasurementOutput,
    );
    assert.equal(nextMeasurement.status, 0, nextMeasurement.stderr);
    const nextMeasurementResult = JSON.parse(nextMeasurement.stdout);
    assert.equal(nextMeasurementResult.experimentPlanRevision, 2);
    assert.equal(nextMeasurementResult.recordCount, 1);
    const nextSnapshot = JSON.parse(await readFile(nextMeasurementOutput, "utf8"));
    assert.equal(nextSnapshot.records[0].variantId, output.proposedVariantId);
    assert.equal(nextSnapshot.records[0].derivedMetrics.ctr, 0.1);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-launch-regeneration-draft CLI 拒绝未接受 performance review 且不留下草稿", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-regeneration-cli-reject-"));
  try {
    const packRoot = path.join(temp, "pack");
    await writeExecutionPack(buildExecutionPack(launchInput), packRoot);
    const reviewPath = path.join(temp, "rejected-performance-review.json");
    const outputPath = path.join(temp, "regeneration.json");
    await writeFile(reviewPath, `${JSON.stringify({
      schema: "bossai.product-launch-performance-review.v1",
      descriptorId: "content.performance-review.md",
      artifactSha256: "d".repeat(64),
      sourceMeasurementSha256: "e".repeat(64),
      accepted: false,
      acceptedAt: "2026-08-16T19:00:00Z",
      reviewedBy: "product-owner",
      nextExperiment: {
        sourceVariantId: "amazon-main.v01",
        workstream: "design",
        hypothesis: "测试首图信息层级。",
        singleVariableChange: "只调整首图信息层级。",
        successMetric: "ctr",
        holdConstant: ["商品主体"]
      }
    }, null, 2)}\n`, "utf8");
    const result = run("product-launch-regeneration-draft", "--pack", packRoot, "--review", reviewPath, "--output", outputPath);
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.match(error.error, /PRODUCT_LAUNCH_PERFORMANCE_REVIEW_NOT_ACCEPTED/);
    assert.equal(await exists(outputPath), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-launch-measurement CLI 拒绝外部直接写入派生 CTR 且不留下快照", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-measurement-cli-reject-"));
  try {
    const packRoot = path.join(temp, "pack");
    await writeExecutionPack(buildExecutionPack(launchInput), packRoot);
    const inputPath = path.join(temp, "bad-input.json");
    const outputPath = path.join(temp, "bad-output.json");
    await writeFile(inputPath, `${JSON.stringify({
      records: [{
        variantId: "amazon-main.v01",
        windowStart: "2026-08-15T00:00:00Z",
        windowEnd: "2026-08-16T00:00:00Z",
        sourceType: "manual-export",
        sourceLabel: "untrusted derived metric attempt",
        metrics: { impressions: 100, clicks: 20, ctr: 0.2 }
      }]
    }, null, 2)}\n`, "utf8");

    const result = run("product-launch-measurement", "--pack", packRoot, "--input", inputPath, "--output", outputPath);
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.equal(error.ok, false);
    assert.match(error.error, /PRODUCT_LAUNCH_MEASUREMENT_METRICS_INVALID/);
    assert.equal(await exists(outputPath), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
