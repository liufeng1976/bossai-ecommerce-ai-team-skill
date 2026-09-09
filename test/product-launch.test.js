import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildExecutionPack, validateInput } from "../src/engine.js";
import { routeUserRequest } from "../src/router.js";
import { compileKaipaiProductMediaDraft, compileProductLaunchExperimentRegistration, compileProductLaunchFeedbackReviewDraft, compileProductLaunchMeasurementSnapshot, compileProductLaunchRegenerationDraft } from "../src/product-launch.js";
import { writeExecutionPack } from "../src/render.js";

const launchInput = {
  business: {
    name: "新品上新测试",
    platforms: ["Amazon", "小红书", "TikTok Shop", "独立站"],
    customer: "养宠家庭",
    goal: "把这个商品卖起来，用一张产品白底图做成整套电商素材并准备上新",
    offer: "智能宠物饮水机",
    assets: ["product-white-background.jpg"],
    constraints: ["不得改变商品结构", "不自动发布"]
  }
};

test("白底图商品上新请求无需预造 market signal 即可通过输入校验", () => {
  const result = validateInput(launchInput);
  assert.equal(result.ok, true);
  assert.equal(result.normalized.signals.length, 0);
});

test("空 signal 集合在 Product Launch 模式允许，但普通机会模式仍失败", () => {
  const launch = validateInput({ ...launchInput, signals: [] });
  assert.equal(launch.ok, true);

  const ordinary = validateInput({
    business: {
      name: "普通机会",
      goal: "判断这个方向值不值得做",
      offer: "客服工具"
    },
    signals: []
  });
  assert.equal(ordinary.ok, false);
  assert.ok(ordinary.errors.some((message) => message.includes("至少需要一条")));
});

test("商品上新请求优先路由到 Product Launch，不要求客户选择员工", () => {
  const result = routeUserRequest("我给你一张商品白底图，帮我做整套电商素材并把这个商品卖起来");
  assert.equal(result.primaryMode.id, "product-launch");
  assert.equal(result.needsClarification, false);
  assert.ok(["medium", "high"].includes(result.confidence));
  assert.equal("roles" in result.primaryMode, false);
});

test("Product Launch 执行包严格区分商品事实、未知项和营销假设", () => {
  const pack = buildExecutionPack(launchInput);
  assert.equal(pack.interface.primaryWorkMode.id, "product-launch");
  assert.equal(pack.rankedSignals.length, 0);
  assert.equal(pack.productLaunch.schema, "bossai.product-launch-plan.v1");
  assert.equal(pack.productLaunch.productProfile.schema, "bossai.product-profile-draft.v1");
  assert.ok(pack.productLaunch.productProfile.knownFacts.some((item) => item.includes("智能宠物饮水机")));
  assert.ok(pack.productLaunch.productProfile.unknowns.some((item) => item.includes("规格")));
  assert.ok(pack.productLaunch.productProfile.visualIntegrityRules.some((item) => item.includes("不得改变商品主体结构")));
  assert.equal(pack.productLaunch.creativeBrief.status, "draft-hypotheses");
  assert.match(pack.productLaunch.creativeBrief.rule, /没有来源证据前只能作为待验证假设/);
});

test("Asset Plan 按渠道生成素材，同时对规格和对比素材设置证据闸门", () => {
  const pack = buildExecutionPack(launchInput);
  const channels = new Map(pack.productLaunch.assetPlan.channels.map((channel) => [channel.platform, channel]));
  assert.ok(channels.has("Amazon"));
  assert.ok(channels.has("小红书"));
  assert.ok(channels.has("TikTok Shop"));
  assert.ok(channels.has("独立站/Shopify"));

  const amazon = channels.get("Amazon");
  assert.ok(amazon.assets.some((asset) => asset.name === "白底主图"));
  assert.ok(amazon.assets.some((asset) => asset.name === "尺寸/参数图" && asset.evidenceRequired === true));
  const xhs = channels.get("小红书");
  assert.ok(xhs.assets.some((asset) => asset.name === "对比解释图" && asset.evidenceRequired === true));
});

test("Experiment Plan 为每个渠道素材生成稳定 Variant 和证据化指标合同，但不自动发布或再生成", () => {
  const pack = buildExecutionPack(launchInput);
  const experiment = pack.productLaunch.experimentPlan;
  assert.equal(experiment.schema, "bossai.product-launch-experiment-plan.v1");
  assert.equal(experiment.revision, 1);
  assert.equal(experiment.status, "planned-not-running");
  assert.equal(experiment.measurementContract, "bossai.product-launch-measurement-snapshot.v1");
  assert.equal(experiment.regenerationDraftContract, "bossai.product-launch-regeneration-draft.v1");
  assert.equal(experiment.experimentRegistrationContract, "bossai.product-launch-experiment-registration.v1");
  assert.deepEqual(experiment.registeredIterations, []);
  assert.equal(experiment.feedbackHandoff.targetAgentId, "bossai-content-agent");
  assert.equal(experiment.feedbackHandoff.capability, "content.performance.review");
  assert.equal(experiment.feedbackHandoff.automaticSubmission, false);
  assert.equal(experiment.feedbackLoop.automaticPublication, false);
  assert.equal(experiment.feedbackLoop.automaticAdSpend, false);
  assert.equal(experiment.feedbackLoop.automaticRegeneration, false);
  assert.equal(experiment.feedbackLoop.causalClaimAllowed, false);
  assert.equal(experiment.companyStateMapping.valueImpactMayBeClaimedFromCreativeArtifactAlone, false);

  const variants = experiment.channels.flatMap((channel) => channel.variants);
  assert.equal(variants.length, 35);
  assert.equal(new Set(variants.map((variant) => variant.id)).size, variants.length);
  assert.ok(variants.every((variant) => variant.publicationAuthorized === false && variant.adSpendAuthorized === false));
  assert.ok(variants.some((variant) => variant.id === "amazon-main.v01"));
  const amazon = experiment.channels.find((channel) => channel.platform === "Amazon");
  assert.ok(amazon.rawMetrics.includes("impressions"));
  assert.ok(amazon.rawMetrics.includes("orders"));
  assert.ok(amazon.derivedMetrics.some((metric) => metric.id === "ctr" && metric.numerator === "clicks" && metric.denominator === "impressions"));
  assert.match(experiment.evidenceRules.join(" "), /没有权威渠道或商业系统原始数据时，不填写效果数字/);
});

test("Measurement compiler 只接受权威原始观测并本地计算派生指标，不接受伪造结论", () => {
  const experiment = buildExecutionPack(launchInput).productLaunch.experimentPlan;
  const snapshot = compileProductLaunchMeasurementSnapshot({
    experimentPlan: experiment,
    compiledAt: "2026-08-16T18:00:00Z",
    records: [{
      variantId: "amazon-main.v01",
      windowStart: "2026-08-15T00:00:00Z",
      windowEnd: "2026-08-16T00:00:00Z",
      sourceType: "manual-export",
      sourceLabel: "Amazon Seller Central export",
      sourceRecordId: "export-001",
      metrics: {
        impressions: 1000,
        clicks: 80,
        detailPageViews: 70,
        addToCarts: 14,
        orders: 7,
        unitsOrdered: 8,
        revenue: 350
      }
    }]
  });
  assert.equal(snapshot.schema, "bossai.product-launch-measurement-snapshot.v1");
  assert.equal(snapshot.status, "observed-not-causal");
  assert.equal(snapshot.causalClaimAllowed, false);
  assert.equal(snapshot.automaticRegeneration, false);
  assert.equal(snapshot.automaticPublication, false);
  assert.equal(snapshot.records[0].derivedMetrics.ctr, 0.08);
  assert.equal(snapshot.records[0].derivedMetrics.addToCartRate, 0.2);
  assert.equal(snapshot.records[0].derivedMetrics.orderConversionRate, 0.1);
  assert.equal(snapshot.records[0].derivedMetrics.revenuePerDetailView, 5);
  assert.equal(snapshot.feedbackHandoff.capability, "content.performance.review");

  const base = {
    variantId: "amazon-main.v01",
    windowStart: "2026-08-15T00:00:00Z",
    windowEnd: "2026-08-16T00:00:00Z",
    sourceType: "manual-export",
    sourceLabel: "authoritative export",
    metrics: { impressions: 10, clicks: 1 }
  };
  assert.throws(() => compileProductLaunchMeasurementSnapshot({ experimentPlan: experiment, records: [{ ...base, variantId: "unknown.v01" }] }), /VARIANT_UNKNOWN/);
  assert.throws(() => compileProductLaunchMeasurementSnapshot({ experimentPlan: experiment, records: [{ ...base, metrics: { impressions: -1 } }] }), /VALUE_INVALID/);
  assert.throws(() => compileProductLaunchMeasurementSnapshot({ experimentPlan: experiment, records: [{ ...base, metrics: { impressions: 10, ctr: 0.5 } }] }), /METRICS_INVALID/);
  assert.throws(() => compileProductLaunchMeasurementSnapshot({ experimentPlan: experiment, records: [{ ...base, sourceType: "unapproved-browser" }] }), /SOURCE_INVALID/);
});

test("Feedback review draft 只把 Measurement Snapshot 变成待审核内容复盘任务，不自动选赢家或再生成", () => {
  const experiment = buildExecutionPack(launchInput).productLaunch.experimentPlan;
  const snapshot = compileProductLaunchMeasurementSnapshot({
    experimentPlan: experiment,
    compiledAt: "2026-08-16T18:00:00Z",
    records: [{
      variantId: "amazon-main.v01",
      windowStart: "2026-08-15T00:00:00Z",
      windowEnd: "2026-08-16T00:00:00Z",
      sourceType: "manual-export",
      sourceLabel: "Amazon Seller Central export",
      metrics: { impressions: 1000, clicks: 80, detailPageViews: 70, addToCarts: 14, orders: 7, unitsOrdered: 8, revenue: 350 }
    }]
  });
  const draft = compileProductLaunchFeedbackReviewDraft({ measurementSnapshot: snapshot, snapshotSha256: "c".repeat(64) });
  assert.equal(draft.schema, "bossai.product-launch-feedback-review-draft.v1");
  assert.equal(draft.status, "draft-not-submitted");
  assert.equal(draft.sourceMeasurement.sha256, "c".repeat(64));
  assert.equal(draft.sourceMeasurement.recordCount, 1);
  assert.equal(draft.target.agentId, "bossai-content-agent");
  assert.equal(draft.target.capability, "content.performance.review");
  assert.equal(draft.managerTaskDraft.automaticSubmission, false);
  assert.equal(draft.managerTaskDraft.requiresHumanApproval, true);
  assert.match(draft.managerTaskDraft.objective, /observed-not-causal/);
  assert.match(draft.managerTaskDraft.objective, /不得因为某个 Variant 指标更高就宣称它导致增长/);
  assert.match(draft.managerTaskDraft.objective, /amazon-main\.v01/);
  assert.equal(draft.causalClaimAllowed, false);
  assert.equal(draft.automaticRegeneration, false);
  assert.equal(draft.automaticPublication, false);
  assert.equal(draft.externalActionsAuthorized, false);

  assert.throws(() => compileProductLaunchFeedbackReviewDraft({ measurementSnapshot: { ...snapshot, causalClaimAllowed: true }, snapshotSha256: "c".repeat(64) }), /CAUSAL_BOUNDARY_INVALID/);
  assert.throws(() => compileProductLaunchFeedbackReviewDraft({ measurementSnapshot: snapshot, snapshotSha256: "bad" }), /SNAPSHOT_HASH_INVALID/);
});

test("Regeneration draft 只基于已接受 performance review 创建新 Variant，不覆盖旧 Variant 或自动执行", () => {
  const experiment = buildExecutionPack(launchInput).productLaunch.experimentPlan;
  const review = {
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
      hypothesis: "更清晰的首图信息层级可能提高点击意愿，但仍需重新实验验证。",
      singleVariableChange: "只调整首图信息层级，不改变商品主体、价格、卖点事实或背景证据。",
      successMetric: "ctr",
      holdConstant: ["商品主体", "价格", "Listing 标题", "流量来源"],
      observationWindowNotes: "使用与上一轮可比的 24 小时窗口，并记录流量来源。"
    }
  };
  const draft = compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: review });
  assert.equal(draft.schema, "bossai.product-launch-regeneration-draft.v1");
  assert.equal(draft.status, "draft-not-submitted");
  assert.equal(draft.sourcePerformanceReview.artifactSha256, "d".repeat(64));
  assert.equal(draft.sourcePerformanceReview.sourceMeasurementSha256, "e".repeat(64));
  assert.equal(draft.sourceVariant.id, "amazon-main.v01");
  assert.match(draft.proposedVariant.id, /^amazon-main\.v01\.[0-9a-f]{10}$/u);
  assert.equal(draft.proposedVariant.parentVariantId, "amazon-main.v01");
  assert.equal(draft.proposedVariant.workstream, "design");
  assert.equal(draft.proposedVariant.successMetric, "ctr");
  assert.equal(draft.target.agentId, "bossai-design-agent");
  assert.equal(draft.target.capability, "design.commerce.asset-plan");
  assert.equal(draft.target.expectedArtifact, "design.commerce-asset-plan.md");
  assert.equal(draft.managerTaskDraft.requiresHumanApproval, true);
  assert.equal(draft.managerTaskDraft.automaticSubmission, false);
  assert.match(draft.managerTaskDraft.objective, /本轮唯一允许改变的关键变量/);
  assert.match(draft.managerTaskDraft.objective, /不得把上一轮相关性当因果/);
  assert.equal(draft.experimentRegistration.mutatesExistingVariant, false);
  assert.equal(draft.experimentRegistration.historicalMeasurementMutationAllowed, false);
  assert.equal(draft.automaticGeneration, false);
  assert.equal(draft.automaticRegeneration, false);
  assert.equal(draft.automaticPublication, false);
  assert.equal(draft.automaticAdSpend, false);
  assert.equal(draft.externalActionsAuthorized, false);

  const repeated = compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: review });
  assert.equal(repeated.iterationId, draft.iterationId);
  assert.equal(repeated.proposedVariant.id, draft.proposedVariant.id);

  assert.throws(() => compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: { ...review, accepted: false } }), /PERFORMANCE_REVIEW_NOT_ACCEPTED/);
  assert.throws(() => compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: { ...review, nextExperiment: { ...review.nextExperiment, sourceVariantId: "unknown.v01" } } }), /SOURCE_VARIANT_UNKNOWN/);
  assert.throws(() => compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: { ...review, nextExperiment: { ...review.nextExperiment, successMetric: "madeUpMetric" } } }), /SUCCESS_METRIC_INVALID/);
  assert.throws(() => compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview: { ...review, nextExperiment: { ...review.nextExperiment, holdConstant: [] } } }), /NEXT_EXPERIMENT_INVALID/);
});

test("Experiment registration 只把已审核再生成结果加入新版计划，并允许下一轮 Measurement 识别新 Variant", () => {
  const experiment = buildExecutionPack(launchInput).productLaunch.experimentPlan;
  const performanceReview = {
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
      hypothesis: "更清晰的首图信息层级可能提高点击意愿，但仍需重新实验验证。",
      singleVariableChange: "只调整首图信息层级。",
      successMetric: "ctr",
      holdConstant: ["商品主体", "价格", "流量来源"]
    }
  };
  const regenerationDraft = compileProductLaunchRegenerationDraft({ experimentPlan: experiment, performanceReview });
  const originalVariantCount = experiment.channels.reduce((sum, channel) => sum + channel.variants.length, 0);
  const registration = compileProductLaunchExperimentRegistration({
    experimentPlan: experiment,
    regenerationDraft,
    regenerationReview: {
      schema: "bossai.product-launch-regeneration-review.v1",
      proposedVariantId: regenerationDraft.proposedVariant.id,
      descriptorId: "design.commerce-asset-plan.md",
      artifactSha256: "f".repeat(64),
      accepted: true,
      acceptedAt: "2026-08-16T20:00:00Z",
      reviewedBy: "product-owner"
    }
  });
  assert.equal(experiment.revision, 1);
  assert.equal(experiment.registeredIterations.length, 0);
  assert.equal(experiment.channels.reduce((sum, channel) => sum + channel.variants.length, 0), originalVariantCount);
  assert.equal(registration.schema, "bossai.product-launch-experiment-registration.v1");
  assert.equal(registration.status, "next-plan-ready-not-adopted");
  assert.equal(registration.sourcePlanRevision, 1);
  assert.equal(registration.nextPlanRevision, 2);
  assert.equal(registration.sourcePlanMutated, false);
  assert.equal(registration.automaticAdoption, false);
  assert.equal(registration.automaticPublication, false);
  assert.equal(registration.automaticAdSpend, false);
  assert.equal(registration.externalActionsAuthorized, false);
  const nextPlan = registration.updatedExperimentPlan;
  assert.equal(nextPlan.revision, 2);
  assert.equal(nextPlan.registeredIterations.length, 1);
  assert.equal(nextPlan.registeredIterations[0].proposedVariantId, regenerationDraft.proposedVariant.id);
  assert.equal(nextPlan.registeredIterations[0].regenerationArtifact.sha256, "f".repeat(64));
  const registeredVariant = nextPlan.channels.flatMap((channel) => channel.variants).find((variant) => variant.id === regenerationDraft.proposedVariant.id);
  assert.ok(registeredVariant);
  assert.equal(registeredVariant.parentVariantId, "amazon-main.v01");
  assert.equal(registeredVariant.status, "approved-not-published");
  assert.equal(registeredVariant.publicationAuthorized, false);
  assert.equal(registeredVariant.adSpendAuthorized, false);

  const nextMeasurement = compileProductLaunchMeasurementSnapshot({
    experimentPlan: nextPlan,
    records: [{
      variantId: regenerationDraft.proposedVariant.id,
      windowStart: "2026-08-17T00:00:00Z",
      windowEnd: "2026-08-18T00:00:00Z",
      sourceType: "manual-export",
      sourceLabel: "Amazon Seller Central next-iteration export",
      metrics: { impressions: 500, clicks: 50, detailPageViews: 45, addToCarts: 9, orders: 4, unitsOrdered: 4, revenue: 200 }
    }]
  });
  assert.equal(nextMeasurement.records[0].variantId, regenerationDraft.proposedVariant.id);
  assert.equal(nextMeasurement.records[0].derivedMetrics.ctr, 0.1);

  assert.throws(() => compileProductLaunchExperimentRegistration({
    experimentPlan: experiment,
    regenerationDraft,
    regenerationReview: {
      schema: "bossai.product-launch-regeneration-review.v1",
      proposedVariantId: regenerationDraft.proposedVariant.id,
      descriptorId: "design.commerce-asset-plan.md",
      artifactSha256: "f".repeat(64),
      accepted: false,
      acceptedAt: "2026-08-16T20:00:00Z",
      reviewedBy: "product-owner"
    }
  }), /REGENERATION_REVIEW_NOT_ACCEPTED/);
  assert.throws(() => compileProductLaunchExperimentRegistration({
    experimentPlan: nextPlan,
    regenerationDraft,
    regenerationReview: {
      schema: "bossai.product-launch-regeneration-review.v1",
      proposedVariantId: regenerationDraft.proposedVariant.id,
      descriptorId: "design.commerce-asset-plan.md",
      artifactSha256: "f".repeat(64),
      accepted: true,
      acceptedAt: "2026-08-16T20:00:00Z",
      reviewedBy: "product-owner"
    }
  }), /VARIANT_ALREADY_REGISTERED/);
});

test("Mission 草案只指向现有独立 Agent，并保留 BossAI OS 执行权", () => {
  const pack = buildExecutionPack(launchInput);
  const mission = pack.productLaunch.missionDraft;
  assert.equal(mission.schema, "bossai.product-launch-mission-draft.v1");
  assert.equal(mission.targetContract, "bossai.manager-mission.v1");
  assert.equal(mission.executionOwner, "bossai-os");
  assert.equal(mission.automaticSubmission, false);
  assert.equal(mission.externalActionsAuthorized, false);

  const agentIds = mission.request.steps.map((step) => step.agentId);
  assert.deepEqual(agentIds, [
    "bossai-intelligence-agent",
    "bossai-sales-agent",
    "bossai-content-agent",
    "bossai-design-agent",
    "bossai-video-agent"
  ]);
  const intelligenceStep = mission.request.steps.find((step) => step.id === "intelligence");
  assert.deepEqual(Object.keys(intelligenceStep).sort(), ["agentId", "id", "objective"]);
  assert.equal(mission.expectedStepContracts.intelligence.agentId, "bossai-intelligence-agent");
  assert.equal(mission.expectedStepContracts.intelligence.capability, "intelligence.commerce.launch-evidence");
  assert.deepEqual(mission.expectedStepContracts.intelligence.inputContracts, ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"]);
  assert.deepEqual(mission.expectedStepContracts.intelligence.predecessorArtifactsRequired, []);
  assert.equal(mission.expectedStepContracts.intelligence.outputArtifact, "intelligence.commerce-launch-evidence.md");
  const salesStep = mission.request.steps.find((step) => step.id === "sales-positioning");
  assert.deepEqual(salesStep.dependsOn, ["intelligence"]);
  assert.deepEqual(Object.keys(salesStep).sort(), ["agentId", "dependsOn", "id", "objective"]);
  assert.equal(mission.expectedStepContracts.salesPositioning.agentId, "bossai-sales-agent");
  assert.equal(mission.expectedStepContracts.salesPositioning.capability, "sales.commerce.positioning");
  assert.deepEqual(mission.expectedStepContracts.salesPositioning.inputContracts, ["bossai.product-profile-draft.v1"]);
  assert.deepEqual(mission.expectedStepContracts.salesPositioning.predecessorArtifactsRequired, ["intelligence"]);
  assert.equal(mission.expectedStepContracts.salesPositioning.outputArtifact, "sales.commerce-positioning.md");
  const contentStep = mission.request.steps.find((step) => step.id === "content");
  assert.deepEqual(contentStep.dependsOn, ["intelligence", "sales-positioning"]);
  assert.deepEqual(Object.keys(contentStep).sort(), ["agentId", "dependsOn", "id", "objective"]);
  assert.equal(mission.expectedStepContracts.content.agentId, "bossai-content-agent");
  assert.equal(mission.expectedStepContracts.content.capability, "content.commerce.launch-copy");
  assert.deepEqual(mission.expectedStepContracts.content.inputContracts, ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"]);
  assert.deepEqual(mission.expectedStepContracts.content.predecessorArtifactsRequired, ["intelligence", "sales-positioning"]);
  assert.equal(mission.expectedStepContracts.content.outputArtifact, "content.commerce-launch-copy.md");
  const designStep = mission.request.steps.find((step) => step.id === "design");
  assert.deepEqual(designStep.dependsOn, ["intelligence", "sales-positioning"]);
  assert.deepEqual(Object.keys(designStep).sort(), ["agentId", "dependsOn", "id", "objective"]);
  assert.equal(mission.expectedStepContracts.design.agentId, "bossai-design-agent");
  assert.equal(mission.expectedStepContracts.design.capability, "design.commerce.asset-plan");
  assert.deepEqual(mission.expectedStepContracts.design.inputContracts, ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"]);
  assert.equal(mission.expectedStepContracts.design.outputArtifact, "design.commerce-asset-plan.md");
  assert.deepEqual(mission.request.steps.find((step) => step.id === "video").dependsOn, ["content", "design"]);
  assert.equal(mission.expectedStepContracts.video.agentId, "bossai-video-agent");
  assert.equal(mission.expectedStepContracts.video.capability, "video.commerce.production.plan");
  assert.deepEqual(mission.expectedStepContracts.video.inputContracts, ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"]);
  assert.deepEqual(mission.expectedStepContracts.video.predecessorArtifactsRequired, ["content", "design"]);
  assert.equal(mission.expectedStepContracts.video.outputArtifact, "video.commerce-production-plan.md");

  const visualHandoff = mission.executionHandoffs.productVisual;
  assert.equal(visualHandoff.schema, "bossai.product-launch-media-handoff.v1");
  assert.equal(visualHandoff.triggerAfterStep, "design");
  assert.equal(visualHandoff.reviewArtifact, "design.commerce-asset-plan.md");
  assert.equal(visualHandoff.executionPackContract, "bossai.product-launch-visual-execution-pack.v1");
  assert.equal(visualHandoff.mediaTaskType, "media.image.generate");
  assert.equal(visualHandoff.runtimeAuthority, "bossai-os");
  assert.equal(visualHandoff.routingAuthority, "bossai-central-ai-gateway");
  assert.equal(visualHandoff.localExecutorContract, "bossai.local-media-executor-contract.v1");
  assert.equal(visualHandoff.localExecutorProject, "D:\\BossAI-Projects\\ai-product-photos");
  assert.equal(visualHandoff.automaticSubmission, false);
  assert.equal(visualHandoff.humanApprovalRequired, true);
  assert.equal(visualHandoff.externalActionsAuthorized, false);

  const videoHandoff = mission.executionHandoffs.productVideo;
  assert.equal(videoHandoff.schema, "bossai.product-launch-product-video-handoff.v1");
  assert.equal(videoHandoff.triggerAfterStep, "video");
  assert.equal(videoHandoff.reviewArtifact, "video.commerce-production-plan.md");
  assert.equal(videoHandoff.draftContract, "bossai.kaipai-product-media-draft.v1");
  assert.equal(videoHandoff.productionContract, "bossai.video-production-task.v1");
  assert.equal(videoHandoff.executionTarget, "local-windows");
  assert.equal(videoHandoff.operation, "product-video");
  assert.equal(videoHandoff.professionalWorkbench, "D:\\BossAI-Projects\\bossai-iphone-talking-video-factory");
  assert.equal(videoHandoff.automaticDraftImport, false);
  assert.equal(videoHandoff.mediaImported, false);
  assert.equal(videoHandoff.rightsConfirmed, false);
  assert.equal(videoHandoff.automaticExecution, false);
  assert.equal(videoHandoff.publicationAuthorized, false);
  assert.equal(videoHandoff.aiGeneratedShotPolicy, "separate-approved-video-generation-flow-required");
});

test("审核后的 Video Artifact 才能编译成开拍商品视频草稿，并保持零自动执行", () => {
  const pack = buildExecutionPack(launchInput);
  const draft = compileKaipaiProductMediaDraft({
    productProfile: pack.productLaunch.productProfile,
    assetPlan: pack.productLaunch.assetPlan,
    videoReview: {
      schema: "bossai.product-launch-video-review.v1",
      descriptorId: "video.commerce-production-plan.md",
      artifactSha256: "a".repeat(64),
      accepted: true,
      acceptedAt: "2026-08-16T08:20:00+08:00",
      reviewedBy: "product-owner",
      productionDraft: {
        title: "智能宠物饮水机｜真实商品素材演示",
        subtitle: "只展示已审核商品事实，未确认卖点继续保持待确认",
        aspectRatio: "9:16",
        segmentSeconds: 2.5,
        suggestedTotalSeconds: 20,
        shotPlan: [
          { index: 1, durationSeconds: 4, purpose: "商品身份", visual: "使用真实商品主图，完整展示商品主体" },
          { index: 2, durationSeconds: 6, purpose: "使用场景", visual: "使用已审核真实素材展示使用场景，不补造功能" },
          { index: 3, durationSeconds: 6, purpose: "事实说明", visual: "字幕只使用已审核事实；规格未知项不进入画面声明" },
          { index: 4, durationSeconds: 4, purpose: "行动引导", visual: "干净收尾，不承诺销量、效果或收益" }
        ],
        factReviewNotes: ["所有规格和效果声明必须来自已审核证据", "真实素材仍由用户在开拍中上传"]
      }
    }
  });

  assert.equal(draft.schema, "bossai.kaipai-product-media-draft.v1");
  assert.equal(draft.sourceReviewArtifact, "video.commerce-production-plan.md");
  assert.equal(draft.sourceReviewArtifactSha256, "a".repeat(64));
  assert.equal(draft.sourceReviewAcceptedBy, "product-owner");
  assert.equal(draft.productName, "智能宠物饮水机");
  assert.deepEqual(draft.platforms, ["Amazon", "小红书", "TikTok Shop", "独立站/Shopify"]);
  assert.equal(draft.execution.contract, "bossai.video-production-task.v1");
  assert.equal(draft.execution.executionTarget, "local-windows");
  assert.equal(draft.execution.operation, "product-video");
  assert.equal(draft.execution.automaticExecution, false);
  assert.equal(draft.execution.mediaImported, false);
  assert.equal(draft.execution.rightsConfirmed, false);
  assert.equal(draft.execution.publicationAuthorized, false);
});

test("商品视频草稿编译器拒绝未审核 Artifact、坏哈希和夹带未知执行字段", () => {
  const pack = buildExecutionPack(launchInput);
  const baseReview = {
    schema: "bossai.product-launch-video-review.v1",
    descriptorId: "video.commerce-production-plan.md",
    artifactSha256: "b".repeat(64),
    accepted: true,
    acceptedAt: "2026-08-16T08:20:00+08:00",
    reviewedBy: "product-owner",
    productionDraft: {
      title: "商品素材成片",
      subtitle: "待审核事实边界",
      aspectRatio: "9:16",
      segmentSeconds: 2.5,
      suggestedTotalSeconds: 15,
      shotPlan: [{ index: 1, durationSeconds: 5, purpose: "商品展示", visual: "真实商品素材" }],
      factReviewNotes: ["不补造商品事实"]
    }
  };
  assert.throws(() => compileKaipaiProductMediaDraft({ productProfile: pack.productLaunch.productProfile, assetPlan: pack.productLaunch.assetPlan, videoReview: { ...baseReview, accepted: false } }), /PRODUCT_VIDEO_REVIEW_NOT_ACCEPTED/);
  assert.throws(() => compileKaipaiProductMediaDraft({ productProfile: pack.productLaunch.productProfile, assetPlan: pack.productLaunch.assetPlan, videoReview: { ...baseReview, artifactSha256: "bad" } }), /PRODUCT_VIDEO_REVIEW_NOT_ACCEPTED/);
  assert.throws(() => compileKaipaiProductMediaDraft({ productProfile: pack.productLaunch.productProfile, assetPlan: pack.productLaunch.assetPlan, videoReview: { ...baseReview, provider: "forbidden" } }), /PRODUCT_VIDEO_REVIEW_INVALID/);
  assert.throws(() => compileKaipaiProductMediaDraft({ productProfile: pack.productLaunch.productProfile, assetPlan: pack.productLaunch.assetPlan, videoReview: { ...baseReview, productionDraft: { ...baseReview.productionDraft, assets: ["secret.png"] } } }), /PRODUCT_VIDEO_REVIEW_DRAFT_INVALID/);
});

test("Manager Mission request 严格只使用 BossAI OS OpenAPI 允许的 step 字段", () => {
  const mission = buildExecutionPack(launchInput).productLaunch.missionDraft;
  const allowed = new Set(["id", "objective", "agentId", "dependsOn"]);
  for (const step of mission.request.steps) {
    assert.ok(Object.keys(step).every((key) => allowed.has(key)), `${step.id} contains unsupported Manager Mission field`);
  }
});

test("Product Launch 安全边界明确禁止自动发布、投放和外部动作", () => {
  const pack = buildExecutionPack(launchInput);
  assert.equal(pack.safety.automaticExternalActions, false);
  assert.equal(pack.safety.externalActionsExecuted, false);
  assert.equal(pack.safety.autoPublish, false);
  assert.equal(pack.safety.autoAdSpend, false);
  assert.ok(pack.tasks.every((task) => /真实上架|发布|投放/.test(task.approvalGate)));
  assert.match(pack.productLaunch.missionDraft.request.objective, /不得自动上架、发布、投放/);
});

test("只有资产但商品名待识别时允许进入 facts-first 草案，不伪造商品身份", () => {
  const pack = buildExecutionPack({
    business: {
      goal: "我只有一张商品白底图，先帮我做商品上新和整套素材规划",
      assets: ["unknown-product.png"]
    }
  });
  assert.equal(pack.productLaunch.productProfile.productName, "待从商品资产识别的商品");
  assert.ok(pack.productLaunch.productProfile.unknowns.some((item) => item.includes("商品准确名称")));
  assert.ok(pack.warnings.some((item) => item.includes("商品名称/品类尚未明确")));
});

test("Product Launch 写盘后包含 Product Profile、Asset Plan 和 Manager Mission 文件", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-"));
  try {
    const pack = buildExecutionPack(launchInput);
    const written = await writeExecutionPack(pack, temp);
    assert.ok(written.files.includes("06-product-launch-plan.md"));
    assert.ok(written.files.includes("product-profile.json"));
    assert.ok(written.files.includes("asset-plan.json"));
    assert.ok(written.files.includes("experiment-plan.json"));
    assert.ok(written.files.includes("product-launch-mission.json"));

    const mission = JSON.parse(await readFile(path.join(temp, "product-launch-mission.json"), "utf8"));
    const experiment = JSON.parse(await readFile(path.join(temp, "experiment-plan.json"), "utf8"));
    const launchPlan = await readFile(path.join(temp, "06-product-launch-plan.md"), "utf8");
    assert.match(launchPlan, /五员工执行合同矩阵/);
    assert.match(launchPlan, /intelligence\.commerce\.launch-evidence/);
    assert.match(launchPlan, /sales\.commerce\.positioning/);
    assert.match(launchPlan, /content\.commerce\.launch-copy/);
    assert.match(launchPlan, /design\.commerce\.asset-plan/);
    assert.match(launchPlan, /video\.commerce\.production\.plan/);
    assert.match(launchPlan, /不是 \*\*bossai\.manager-mission\.v1\*\* 原生 step 字段/);
    assert.match(launchPlan, /发布后实验与学习闭环/);
    assert.match(launchPlan, /没有权威数据不填效果数字/);
    assert.equal(experiment.schema, "bossai.product-launch-experiment-plan.v1");
    assert.equal(experiment.feedbackLoop.automaticRegeneration, false);
    assert.equal(mission.executionOwner, "bossai-os");
    assert.equal(mission.targetContract, "bossai.manager-mission.v1");
    assert.equal(mission.executionHandoffs.productVisual.mediaTaskType, "media.image.generate");
    assert.equal(mission.executionHandoffs.productVisual.localExecutorProject, "D:\\BossAI-Projects\\ai-product-photos");
    assert.equal(mission.executionHandoffs.productVideo.draftContract, "bossai.kaipai-product-media-draft.v1");
    assert.equal(mission.executionHandoffs.productVideo.productionContract, "bossai.video-production-task.v1");
    assert.equal(mission.executionHandoffs.productVideo.operation, "product-video");
    assert.equal(mission.executionHandoffs.productVideo.automaticExecution, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
