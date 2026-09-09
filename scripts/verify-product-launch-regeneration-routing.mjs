import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildExecutionPack } from '../src/engine.js';
import { compileProductLaunchRegenerationDraft } from '../src/product-launch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.resolve(root, '..');
const [content, design, video] = await Promise.all([
  import(pathToFileURL(path.join(projectsRoot, 'bossai-content-agent', 'agent', 'index.mjs')).href),
  import(pathToFileURL(path.join(projectsRoot, 'bossai-design-agent', 'agent', 'index.mjs')).href),
  import(pathToFileURL(path.join(projectsRoot, 'bossai-video-agent', 'agent', 'index.mjs')).href),
]);

const experimentPlan = buildExecutionPack({
  business: {
    name: 'Product Launch regeneration routing verification',
    platforms: ['Amazon'],
    customer: '养宠家庭',
    goal: '商品上新：用已审核表现复盘生成下一轮单变量创意迭代',
    offer: '智能宠物饮水机',
    assets: ['product-white-background.jpg'],
    constraints: ['不自动发布', '不自动投放', '不自动再生成'],
  },
}).productLaunch.experimentPlan;

const routing = {
  content: {
    agentId: 'bossai-content-agent',
    expectedCapability: 'content.commerce.launch-copy',
    expectedArtifact: 'content.commerce-launch-copy.md',
    choose: content.chooseContentCapability,
    descriptor: content.contentArtifactDescriptorId,
    change: '只调整 CTA 的动作措辞，不改变商品事实、价格、首图或流量来源。',
  },
  design: {
    agentId: 'bossai-design-agent',
    expectedCapability: 'design.commerce.asset-plan',
    expectedArtifact: 'design.commerce-asset-plan.md',
    choose: design.chooseDesignCapability,
    descriptor: design.designArtifactDescriptorId,
    change: '只调整首图信息层级，不改变商品主体、价格、Listing 标题或流量来源。',
  },
  video: {
    agentId: 'bossai-video-agent',
    expectedCapability: 'video.commerce.production.plan',
    expectedArtifact: 'video.commerce-production-plan.md',
    choose: video.chooseVideoCapability,
    descriptor: video.videoArtifactDescriptorId,
    change: '只调整商品短视频的第一镜头结构，不改变商品事实、文案口径、价格或流量来源。',
  },
};

const checks = [];
for (const [workstream, config] of Object.entries(routing)) {
  const performanceReview = {
    schema: 'bossai.product-launch-performance-review.v1',
    descriptorId: 'content.performance-review.md',
    artifactSha256: 'd'.repeat(64),
    sourceMeasurementSha256: 'e'.repeat(64),
    accepted: true,
    acceptedAt: '2026-08-16T19:00:00Z',
    reviewedBy: 'product-owner',
    nextExperiment: {
      sourceVariantId: 'amazon-main.v01',
      workstream,
      hypothesis: `${workstream} 单变量变化可能改善 ctr，但必须继续实验验证，不能从上一轮相关性直接推导因果。`,
      singleVariableChange: config.change,
      successMetric: 'ctr',
      holdConstant: ['商品主体', '价格', '流量来源'],
      observationWindowNotes: '保持与上一轮可比的观察窗口和流量条件。',
    },
  };
  const draft = compileProductLaunchRegenerationDraft({ experimentPlan, performanceReview });
  assert.equal(draft.target.agentId, config.agentId);
  assert.equal(draft.target.capability, config.expectedCapability);
  assert.equal(draft.target.expectedArtifact, config.expectedArtifact);
  const routedCapability = config.choose(draft.managerTaskDraft.objective);
  assert.equal(routedCapability, config.expectedCapability, `${workstream} regeneration objective misrouted to ${routedCapability}`);
  assert.equal(config.descriptor(routedCapability), config.expectedArtifact);
  assert.match(draft.managerTaskDraft.objective, /Product Launch 创意迭代/);
  assert.match(draft.managerTaskDraft.objective, /本轮唯一允许改变的关键变量/);
  assert.match(draft.managerTaskDraft.objective, /不得把上一轮相关性当因果/);
  assert.equal(draft.managerTaskDraft.automaticSubmission, false);
  assert.equal(draft.experimentRegistration.mutatesExistingVariant, false);
  assert.equal(draft.automaticGeneration, false);
  assert.equal(draft.automaticRegeneration, false);
  assert.equal(draft.automaticPublication, false);
  assert.equal(draft.automaticAdSpend, false);
  checks.push({
    workstream,
    targetAgentId: draft.target.agentId,
    capability: routedCapability,
    artifact: config.descriptor(routedCapability),
    sourceVariantId: draft.sourceVariant.id,
    proposedVariantId: draft.proposedVariant.id,
    automaticSubmission: false,
    automaticGeneration: false,
    automaticPublication: false,
  });
}

console.log(JSON.stringify({
  schema: 'bossai.product-launch-regeneration-routing-verification.v1',
  overall: 'passed',
  projectsRoot,
  sourcePerformanceReviewAccepted: true,
  singleVariableIterationRequired: true,
  mutatesExistingVariant: false,
  checks,
  providerCalls: 0,
  externalActions: 0,
}, null, 2));
