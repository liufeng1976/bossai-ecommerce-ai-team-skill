import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.resolve(root, '..');
const MAX_PRODUCT_LAUNCH_PREDECESSOR_SUMMARY_BYTES = 8 * 1024;

function assertPredecessorSummaryFitsManagerBudget(stepId, summary) {
  const bytes = Buffer.byteLength(summary, 'utf8');
  assert.ok(
    bytes <= MAX_PRODUCT_LAUNCH_PREDECESSOR_SUMMARY_BYTES,
    `${stepId} reviewable Artifact is ${bytes} UTF-8 bytes and would be truncated by the current two-predecessor Manager Mission handoff budget.`,
  );
  return bytes;
}

async function load(projectDirectory) {
  return import(pathToFileURL(path.join(projectsRoot, projectDirectory, 'agent', 'index.mjs')).href);
}

function reviewedPredecessor({ stepId, agentId, summary, capability, descriptorId, revision = 1 }) {
  return {
    stepId,
    taskId: `product-launch-${stepId}-task`,
    agentId,
    summary,
    resultRevision: revision,
    completionEventId: `product-launch-${stepId}-completion-${revision}`,
    review: {
      required: true,
      status: 'approved',
      reviewEventId: `product-launch-${stepId}-review-${revision}`,
      reviewedAt: '2026-08-16T09:30:00-07:00',
    },
    artifacts: [{
      artifactId: `product-launch-${stepId}-artifact-${revision}`,
      descriptorId,
      capability,
      revision,
      format: 'markdown',
      primary: true,
      requiresHumanReview: true,
      sizeBytes: Buffer.byteLength(summary, 'utf8'),
      sha256: createHash('sha256').update(summary, 'utf8').digest('hex'),
    }],
    artifactCount: 1,
    artifactsTruncated: false,
  };
}

function handoff(predecessors) {
  return {
    handoff: {
      schema: 'bossai.manager-mission-handoff.v1',
      predecessors,
      authoritativeBusinessDataTransferred: false,
      externalActionsExecuted: false,
    },
  };
}

const intelligence = await load('bossai-intelligence-agent');
const sales = await load('bossai-sales-employee');
const content = await load('bossai-content-agent');
const design = await load('bossai-design-agent');
const video = await load('bossai-video-agent');

const intelligenceResult = intelligence.buildReviewableIntelligenceResult({
  objective: 'Product Launch：复核智能宠物饮水机的商品事实、养宠家庭目标客户、竞品和需求证据；商品身份已确认，认证、价格、具体尺寸和效果仍待核验。',
  capability: 'intelligence.commerce.launch-evidence',
  riskLevel: 'L2',
});
assert.match(intelligenceResult, /BossAI 商品上新证据包（待审核）/);
assert.match(intelligenceResult, /认证、价格、具体尺寸和效果仍待核验/);
const intelligenceBytes = assertPredecessorSummaryFitsManagerBudget('intelligence', intelligenceResult);
const intelligenceRef = reviewedPredecessor({
  stepId: 'intelligence',
  agentId: 'bossai-intelligence-agent',
  summary: intelligenceResult,
  capability: 'intelligence.commerce.launch-evidence',
  descriptorId: 'intelligence.commerce-launch-evidence.md',
});

const salesContext = sales.extractManagerMissionHandoffContext(handoff([intelligenceRef]));
const salesResult = sales.buildReviewableSalesResult({
  objective: 'Product Launch：为智能宠物饮水机形成待审核价值主张、购买理由、异议和试卖边界。',
  capability: 'sales.commerce.positioning',
  riskLevel: 'L2',
  handoffContext: salesContext,
});
assert.match(salesResult, /BossAI 商品上新商业定位方案（待审核）/);
assert.match(salesResult, /BossAI 商品上新证据包（待审核）/);
assert.match(salesResult, /认证、价格、具体尺寸和效果仍待核验/);
const salesBytes = assertPredecessorSummaryFitsManagerBudget('sales-positioning', salesResult);
const salesRef = reviewedPredecessor({
  stepId: 'sales-positioning',
  agentId: 'bossai-sales-agent',
  summary: salesResult,
  capability: 'sales.commerce.positioning',
  descriptorId: 'sales.commerce-positioning.md',
});

const contentContext = content.extractManagerMissionHandoffContext(handoff([intelligenceRef, salesRef]));
const contentResult = content.buildReviewableContentResult({
  objective: 'Product Launch：为 Amazon、小红书、TikTok Shop、Shopify 生成待审核 Listing、详情页、卖点和 CTA 文案。',
  capability: 'content.commerce.launch-copy',
  riskLevel: 'L2',
  handoffContext: contentContext,
});
assert.match(contentResult, /BossAI 商品上新渠道文案包（待审核）/);
assert.match(contentResult, /前置步骤 intelligence/);
assert.match(contentResult, /前置步骤 sales-positioning/);
assert.match(contentResult, /认证、价格、具体尺寸和效果仍待核验/);
const contentBytes = assertPredecessorSummaryFitsManagerBudget('content', contentResult);
const contentRef = reviewedPredecessor({
  stepId: 'content',
  agentId: 'bossai-content-agent',
  summary: contentResult,
  capability: 'content.commerce.launch-copy',
  descriptorId: 'content.commerce-launch-copy.md',
});

const designContext = design.extractManagerMissionHandoffContext(handoff([intelligenceRef, salesRef]));
const designResult = design.buildReviewableDesignResult({
  objective: 'Product Launch：按已审核 Product Profile 和 Asset Plan 规划 Amazon、小红书、TikTok Shop、Shopify 商品视觉。',
  capability: 'design.commerce.asset-plan',
  riskLevel: 'L2',
  handoffContext: designContext,
});
assert.match(designResult, /商品电商视觉素材规划/);
assert.match(designResult, /前置步骤 intelligence/);
assert.match(designResult, /前置步骤 sales-positioning/);
assert.match(designResult, /认证、价格、具体尺寸和效果仍待核验/);
const designBytes = assertPredecessorSummaryFitsManagerBudget('design', designResult);
const designRef = reviewedPredecessor({
  stepId: 'design',
  agentId: 'bossai-design-agent',
  summary: designResult,
  capability: 'design.commerce.asset-plan',
  descriptorId: 'design.commerce-asset-plan.md',
});

const videoContext = video.extractManagerMissionHandoffContext(handoff([contentRef, designRef]));
assert.match(videoContext, /认证、价格、具体尺寸和效果仍待核验/);
const videoResult = video.buildReviewableVideoResult({
  objective: 'Product Launch：基于已审核 Content/Design 结果形成商品短视频脚本、镜头结构、演示动作和生产检查清单。',
  capability: 'video.commerce.production.plan',
  riskLevel: 'L2',
  handoffContext: videoContext,
});
assert.match(videoResult, /BossAI 商品短视频生产方案（待审核）/);
assert.match(videoResult, /BossAI 商品上新渠道文案包（待审核）/);
assert.match(videoResult, /商品电商视觉素材规划/);
assert.match(videoResult, /未确认的规格、材质、功能、认证、销量、口碑、价格、效果/);
assert.match(videoResult, /保持未知/);
assert.match(videoResult, /未提交视频 Provider/);

assert.throws(
  () => video.extractManagerMissionHandoffContext(handoff([{
    ...designRef,
    review: { required: true, status: 'pending' },
  }])),
  (error) => error?.code === 'MANAGER_HANDOFF_REVIEW_REQUIRED',
);

console.log(JSON.stringify({
  schema: 'bossai.product-launch-reviewed-handoff-verification.v1',
  overall: 'passed',
  projectsRoot,
  chain: [
    ['intelligence', 'intelligence.commerce.launch-evidence', 'intelligence.commerce-launch-evidence.md'],
    ['sales-positioning', 'sales.commerce.positioning', 'sales.commerce-positioning.md'],
    ['content', 'content.commerce.launch-copy', 'content.commerce-launch-copy.md'],
    ['design', 'design.commerce.asset-plan', 'design.commerce-asset-plan.md'],
    ['video', 'video.commerce.production.plan', 'video.commerce-production-plan.md'],
  ],
  reviewedHandoffRequired: true,
  unapprovedHandoffRejected: true,
  predecessorSummaryBudgetBytes: MAX_PRODUCT_LAUNCH_PREDECESSOR_SUMMARY_BYTES,
  predecessorSummaryBytes: {
    intelligence: intelligenceBytes,
    salesPositioning: salesBytes,
    content: contentBytes,
    design: designBytes,
  },
  providerCalls: 0,
  mediaExecution: false,
  publicationExecuted: false,
  externalActions: 0,
}, null, 2));
