import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildExecutionPack } from '../src/engine.js';
import {
  compileProductLaunchExperimentRegistration,
  compileProductLaunchFeedbackReviewDraft,
  compileProductLaunchMeasurementSnapshot,
  compileProductLaunchRegenerationDraft,
} from '../src/product-launch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.resolve(root, '..');
const [content, design] = await Promise.all([
  import(pathToFileURL(path.join(projectsRoot, 'bossai-content-agent', 'agent', 'index.mjs')).href),
  import(pathToFileURL(path.join(projectsRoot, 'bossai-design-agent', 'agent', 'index.mjs')).href),
]);

const launchInput = {
  business: {
    name: 'Product Launch feedback-loop verification',
    platforms: ['Amazon'],
    customer: '养宠家庭',
    goal: '把商品上新后的渠道观测变成下一轮可验证创意假设',
    offer: '智能宠物饮水机',
    assets: ['product-white-background.jpg'],
    constraints: ['不自动发布', '不自动投放', '不自动再生成'],
  },
};

const pack = buildExecutionPack(launchInput);
const experimentPlan = pack.productLaunch?.experimentPlan;
assert.equal(experimentPlan?.schema, 'bossai.product-launch-experiment-plan.v1');

const measurementSnapshot = compileProductLaunchMeasurementSnapshot({
  experimentPlan,
  compiledAt: '2026-08-16T18:00:00Z',
  records: [{
    variantId: 'amazon-main.v01',
    windowStart: '2026-08-15T00:00:00Z',
    windowEnd: '2026-08-16T00:00:00Z',
    sourceType: 'manual-export',
    sourceLabel: 'Amazon Seller Central export',
    sourceRecordId: 'feedback-loop-export-001',
    metrics: {
      impressions: 1000,
      clicks: 80,
      detailPageViews: 70,
      addToCarts: 14,
      orders: 7,
      unitsOrdered: 8,
      revenue: 350,
    },
  }],
});
assert.equal(measurementSnapshot.status, 'observed-not-causal');
assert.equal(measurementSnapshot.records[0].derivedMetrics.ctr, 0.08);
assert.equal(measurementSnapshot.records[0].derivedMetrics.orderConversionRate, 0.1);
assert.equal(measurementSnapshot.causalClaimAllowed, false);

const measurementBytes = Buffer.from(`${JSON.stringify(measurementSnapshot, null, 2)}\n`, 'utf8');
const measurementSha256 = createHash('sha256').update(measurementBytes).digest('hex');
const feedbackDraft = compileProductLaunchFeedbackReviewDraft({
  measurementSnapshot,
  snapshotSha256: measurementSha256,
});
assert.equal(feedbackDraft.status, 'draft-not-submitted');
assert.equal(feedbackDraft.target.agentId, 'bossai-content-agent');
assert.equal(feedbackDraft.target.capability, 'content.performance.review');
assert.equal(feedbackDraft.sourceMeasurement.sha256, measurementSha256);
assert.equal(feedbackDraft.causalClaimAllowed, false);
assert.equal(feedbackDraft.automaticRegeneration, false);
assert.equal(feedbackDraft.automaticPublication, false);
assert.equal(feedbackDraft.managerTaskDraft.automaticSubmission, false);

const capability = content.chooseContentCapability(feedbackDraft.managerTaskDraft.objective);
assert.equal(capability, 'content.performance.review');
const artifactDescriptorId = content.contentArtifactDescriptorId(capability);
assert.equal(artifactDescriptorId, 'content.performance-review.md');
const performanceReview = content.buildReviewableContentResult({
  objective: feedbackDraft.managerTaskDraft.objective,
  capability,
  riskLevel: 'L2',
});
assert.match(performanceReview, /内容表现复盘（待审核｜观测不代表因果）/);
assert.match(performanceReview, /amazon-main\.v01/);
assert.match(performanceReview, new RegExp(measurementSha256));
assert.match(performanceReview, /不可直接得出的结论/);
assert.match(performanceReview, /下一轮假设/);
assert.match(performanceReview, /Company State 边界/);
assert.match(performanceReview, /未发布、未上传、未排期、未投放、未自动再生成、未操作账号、未发送客户/);
assert.doesNotMatch(performanceReview, /已经证明|已经胜出|自动选择赢家|已证明.*导致增长/u);

const performanceReviewBytes = Buffer.from(`${performanceReview}\n`, 'utf8');
const performanceReviewSha256 = createHash('sha256').update(performanceReviewBytes).digest('hex');
const acceptedPerformanceReview = {
  schema: 'bossai.product-launch-performance-review.v1',
  descriptorId: artifactDescriptorId,
  artifactSha256: performanceReviewSha256,
  sourceMeasurementSha256: measurementSha256,
  accepted: true,
  acceptedAt: '2026-08-16T19:00:00Z',
  reviewedBy: 'product-owner',
  nextExperiment: {
    sourceVariantId: 'amazon-main.v01',
    workstream: 'design',
    hypothesis: '更清晰的首图信息层级可能改善 ctr，但必须继续实验验证。',
    singleVariableChange: '只调整首图信息层级，不改变商品主体、价格、Listing 标题或流量来源。',
    successMetric: 'ctr',
    holdConstant: ['商品主体', '价格', 'Listing 标题', '流量来源'],
    observationWindowNotes: '保持与上一轮可比的观察窗口和流量条件。',
  },
};
const regenerationDraft = compileProductLaunchRegenerationDraft({
  experimentPlan,
  performanceReview: acceptedPerformanceReview,
});
assert.equal(regenerationDraft.status, 'draft-not-submitted');
assert.equal(regenerationDraft.target.agentId, 'bossai-design-agent');
assert.equal(regenerationDraft.target.capability, 'design.commerce.asset-plan');
assert.equal(regenerationDraft.managerTaskDraft.automaticSubmission, false);
assert.equal(regenerationDraft.experimentRegistration.mutatesExistingVariant, false);

const designCapability = design.chooseDesignCapability(regenerationDraft.managerTaskDraft.objective);
assert.equal(designCapability, 'design.commerce.asset-plan');
const designArtifactDescriptorId = design.designArtifactDescriptorId(designCapability);
assert.equal(designArtifactDescriptorId, 'design.commerce-asset-plan.md');
const designIterationResult = design.buildReviewableDesignResult({
  objective: regenerationDraft.managerTaskDraft.objective,
  capability: designCapability,
  riskLevel: 'L2',
});
assert.match(designIterationResult, /商品电商视觉素材规划/);
assert.match(designIterationResult, /本轮唯一允许改变的关键变量/);
assert.match(designIterationResult, /不得把上一轮相关性当因果/);
assert.match(designIterationResult, /未提交 GPU.*未生成或修改视觉资产/s);

const designIterationSha256 = createHash('sha256').update(Buffer.from(`${designIterationResult}\n`, 'utf8')).digest('hex');
const registration = compileProductLaunchExperimentRegistration({
  experimentPlan,
  regenerationDraft,
  regenerationReview: {
    schema: 'bossai.product-launch-regeneration-review.v1',
    proposedVariantId: regenerationDraft.proposedVariant.id,
    descriptorId: designArtifactDescriptorId,
    artifactSha256: designIterationSha256,
    accepted: true,
    acceptedAt: '2026-08-16T20:00:00Z',
    reviewedBy: 'product-owner',
  },
});
assert.equal(registration.status, 'next-plan-ready-not-adopted');
assert.equal(registration.sourcePlanRevision, 1);
assert.equal(registration.nextPlanRevision, 2);
assert.equal(registration.sourcePlanMutated, false);
assert.equal(experimentPlan.revision, 1);
assert.equal(experimentPlan.registeredIterations.length, 0);
assert.equal(registration.updatedExperimentPlan.registeredIterations.length, 1);
assert.equal(registration.updatedExperimentPlan.registeredIterations[0].proposedVariantId, regenerationDraft.proposedVariant.id);

const secondMeasurement = compileProductLaunchMeasurementSnapshot({
  experimentPlan: registration.updatedExperimentPlan,
  compiledAt: '2026-08-18T18:00:00Z',
  records: [{
    variantId: regenerationDraft.proposedVariant.id,
    windowStart: '2026-08-17T00:00:00Z',
    windowEnd: '2026-08-18T00:00:00Z',
    sourceType: 'manual-export',
    sourceLabel: 'Amazon Seller Central iteration export',
    sourceRecordId: 'feedback-loop-export-002',
    metrics: {
      impressions: 500,
      clicks: 50,
      detailPageViews: 45,
      addToCarts: 9,
      orders: 4,
      unitsOrdered: 4,
      revenue: 200,
    },
  }],
});
assert.equal(secondMeasurement.records[0].variantId, regenerationDraft.proposedVariant.id);
assert.equal(secondMeasurement.records[0].derivedMetrics.ctr, 0.1);
assert.equal(secondMeasurement.status, 'observed-not-causal');
assert.equal(secondMeasurement.causalClaimAllowed, false);

console.log(JSON.stringify({
  schema: 'bossai.product-launch-feedback-loop-verification.v1',
  overall: 'passed',
  projectsRoot,
  experimentContract: experimentPlan.schema,
  measurementContract: measurementSnapshot.schema,
  measurementStatus: measurementSnapshot.status,
  measurementSha256,
  feedbackDraftContract: feedbackDraft.schema,
  feedbackTargetAgentId: feedbackDraft.target.agentId,
  feedbackCapability: capability,
  feedbackArtifactDescriptorId: artifactDescriptorId,
  performanceReviewSha256,
  regenerationDraftContract: regenerationDraft.schema,
  regenerationTargetAgentId: regenerationDraft.target.agentId,
  regenerationCapability: designCapability,
  regenerationArtifactDescriptorId: designArtifactDescriptorId,
  proposedVariantId: regenerationDraft.proposedVariant.id,
  nextExperimentPlanRevision: registration.nextPlanRevision,
  secondMeasurementVariantId: secondMeasurement.records[0].variantId,
  secondMeasurementCtr: secondMeasurement.records[0].derivedMetrics.ctr,
  causalClaimAllowed: false,
  automaticFeedbackSubmission: false,
  automaticRegeneration: false,
  automaticPublication: false,
  providerCalls: 0,
  externalActions: 0,
}, null, 2));
