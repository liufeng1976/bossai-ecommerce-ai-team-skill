import { createHash } from "node:crypto";
import { ROLE_BY_ID } from "./roles.js";

const PRODUCT_LAUNCH_TERMS = [
  "product launch", "launch product", "商品上新", "新品上新", "上新", "上架商品", "商品上架",
  "把这个商品卖起来", "把这个产品卖起来", "帮我卖这个商品", "帮我卖这个产品", "卖起来",
  "电商素材", "商品素材", "整套素材", "白底图", "商品图", "产品图", "listing素材", "listing 素材"
];

const EXTERNAL_AGENT_IDS = {
  intelligence: "bossai-intelligence-agent",
  sales: "bossai-sales-agent",
  content: "bossai-content-agent",
  design: "bossai-design-agent",
  video: "bossai-video-agent"
};

export function isProductLaunchInput(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const business = raw.business || raw.business_brief || raw.context || {};
  const text = [
    raw.intent,
    raw.action,
    raw.goal,
    raw.offer,
    raw.notes,
    business.intent,
    business.action,
    business.goal,
    business.objective,
    business.offer,
    business.product,
    business.notes,
    ...asList(business.assets || business.current_assets || raw.assets)
  ].filter(Boolean).join(" ").normalize("NFKC").toLowerCase();
  return PRODUCT_LAUNCH_TERMS.some((term) => text.includes(term));
}

export function validateProductLaunchReadiness(business = {}) {
  const hasOffer = business.offer && business.offer !== "待明确";
  const hasAssets = Array.isArray(business.assets) && business.assets.length > 0;
  if (hasOffer || hasAssets) return [];
  return ["Product Launch 至少需要明确商品/服务，或提供一个可识别的商品资产。"];
}

export function buildProductLaunchPlan(business, routing) {
  const productName = business.offer && business.offer !== "待明确"
    ? business.offer
    : "待从商品资产识别的商品";
  const targetPlatforms = normalizePlatforms(business.platforms);
  const productProfile = buildProductProfile(business, productName, targetPlatforms);
  const assetPlan = buildAssetPlan(targetPlatforms);
  const experimentPlan = buildProductLaunchExperimentPlan(productProfile, assetPlan);
  const missionDraft = buildMissionDraft(business, productName, targetPlatforms, productProfile, assetPlan);
  const tasks = buildProductLaunchTasks(business, productName, targetPlatforms);
  const sevenDayPlan = buildProductLaunchSevenDayPlan(tasks);
  const activeRoleIds = [
    "strategy", "radar", "product-selection", "sales-copy", "content", "operations", "product-qa", "project-manager"
  ];
  const active = activeRoleIds.map((id) => ROLE_BY_ID.get(id)).filter(Boolean);

  return {
    mode: "product-launch",
    productName,
    interface: {
      primaryWorkMode: routing.primaryMode,
      secondaryWorkModes: routing.secondaryModes
    },
    productProfile,
    creativeBrief: {
      status: "draft-hypotheses",
      verifiedAudience: business.customer !== "待明确" ? business.customer : null,
      audienceHypotheses: business.customer !== "待明确"
        ? [business.customer]
        : ["待由情报任务基于真实市场证据确认"],
      valuePropositionStatus: "requires-evidence",
      rule: "卖点、痛点、竞品差异和收益承诺在没有来源证据前只能作为待验证假设。"
    },
    assetPlan,
    experimentPlan,
    missionDraft,
    tasks,
    sevenDayPlan,
    team: {
      active,
      standby: []
    },
    decision: {
      selectedOpportunity: `商品上新：${productName}`,
      reason: "这是用户已提供或准备上新的商品任务，不等于市场需求已经验证。先锁定商品事实，再用情报证据收敛受众、卖点和渠道素材。",
      recommendedMode: "先完成商品事实边界与可审核素材包，再由人工决定是否进入真实上架、发布或投放。",
      stopConditions: [
        "无法确认商品身份或关键规格，导致素材可能误导客户",
        "核心卖点缺少可复核证据且无法降级为中性表达",
        "目标平台关键素材要求无法满足",
        "人工审核发现商品结构、规格、价格或合规信息被虚构或篡改"
      ]
    },
    warnings: buildWarnings(business, targetPlatforms),
    safety: {
      mode: "draft-and-plan-only",
      automaticExternalActions: false,
      externalActionsExecuted: false,
      autoPublish: false,
      autoAdSpend: false,
      humanApprovalRequiredFor: ["真实上架", "发布", "广告投放", "账号写入", "改价", "付款", "退款", "客户消息", "对外承诺"]
    }
  };
}

function buildProductProfile(business, productName, targetPlatforms) {
  const knownFacts = [];
  if (business.offer && business.offer !== "待明确") knownFacts.push(`用户提供商品/服务：${business.offer}`);
  if (business.customer && business.customer !== "待明确") knownFacts.push(`用户提供目标客户：${business.customer}`);
  if (targetPlatforms.length) knownFacts.push(`用户提供目标平台：${targetPlatforms.join("、")}`);
  for (const asset of business.assets || []) knownFacts.push(`用户提供资产：${asset}`);
  for (const constraint of business.constraints || []) knownFacts.push(`用户提供约束：${constraint}`);

  const unknowns = [];
  if (!business.offer || business.offer === "待明确") unknowns.push("商品准确名称、品类与用途");
  if (!business.customer || business.customer === "待明确") unknowns.push("主要购买人群与使用场景");
  if (!targetPlatforms.length) unknowns.push("首发平台及平台优先级");
  unknowns.push("可对外宣称的规格、尺寸、材质、功能与认证证据");
  unknowns.push("价格、库存、交付范围及促销边界");
  unknowns.push("品牌视觉规范、禁用表达与知识产权边界");

  return {
    schema: "bossai.product-profile-draft.v1",
    productName,
    status: "facts-first-draft",
    knownFacts,
    unknowns,
    visualIntegrityRules: [
      "不得改变商品主体结构、接口、按钮、开孔、包装数量或配件构成。",
      "不得生成用户未提供或证据未确认的功能、规格、材质、认证、奖项或兼容性。",
      "尺寸图、参数图、对比图只有在数据来源可复核时才能进入最终素材。",
      "场景图可以改变环境、灯光和构图，但商品本体必须保持身份一致和结构一致。",
      "任何无法从原始资产或用户资料确认的细节必须标记为待确认，不得由模型补全成事实。"
    ]
  };
}

function buildAssetPlan(platforms) {
  const channels = platforms.length ? platforms : ["核心电商素材包"];
  return {
    schema: "bossai.product-launch-asset-plan.v1",
    status: "draft",
    platformSelectionRequired: platforms.length === 0,
    channels: channels.map((platform) => ({
      platform,
      assets: platformAssets(platform)
    })),
    globalRules: [
      "所有素材先进入人工审核，不自动发布、上架或投放。",
      "只有已验证事实可以进入规格、对比、认证、价格和效果承诺类素材。",
      "优先复用同一 Product Profile，避免不同渠道把同一商品生成成不同结构。"
    ]
  };
}

function platformAssets(platform) {
  const key = platform.toLowerCase();
  if (key.includes("amazon") || key.includes("亚马逊")) {
    return [
      asset("amazon-main", "白底主图", 1, "清晰展示商品主体；不得增加不存在的配件或功能"),
      asset("amazon-benefit", "核心卖点图", 3, "卖点必须来自已确认事实或证据"),
      asset("amazon-lifestyle", "使用场景图", 2, "环境可生成，商品本体结构不可改变"),
      asset("amazon-spec", "尺寸/参数图", 1, "仅在尺寸和参数有可复核来源时生成", true),
      asset("amazon-a-plus", "A+ 页面模块草案", 1, "文案、图像和证明材料统一由人工审核")
    ];
  }
  if (key.includes("tiktok") || key.includes("抖音") || key.includes("抖店")) {
    return [
      asset("tiktok-cover", "短视频封面", 3, "分别测试不同问题/场景钩子，不虚构效果"),
      asset("tiktok-script", "15-30秒短视频脚本/分镜", 3, "先生成可审核脚本与镜头计划，不自动发布"),
      asset("tiktok-demo", "产品演示镜头计划", 1, "演示动作只能覆盖真实可用功能"),
      asset("tiktok-card", "商品卡主视觉", 2, "保持商品身份一致并适配竖屏")
    ];
  }
  if (key.includes("小红书") || key.includes("xiaohongshu") || key === "xhs") {
    return [
      asset("xhs-cover", "笔记封面", 3, "标题和视觉角度可以变化，商品事实不能变化"),
      asset("xhs-carousel", "图文轮播/九宫格", 1, "包含场景、卖点、细节和使用逻辑"),
      asset("xhs-copy", "标题与正文草稿", 3, "不得虚构体验、口碑、案例或用户评价"),
      asset("xhs-compare", "对比解释图", 1, "只有存在可复核对比证据时生成", true)
    ];
  }
  if (key.includes("shopify") || key.includes("独立站") || key.includes("website") || key.includes("官网")) {
    return [
      asset("site-hero", "首屏 Hero", 1, "一句话价值主张必须和已确认商品事实一致"),
      asset("site-benefit", "核心利益点模块", 3, "每个利益点都要能追溯到产品事实或证据"),
      asset("site-lifestyle", "场景视觉", 2, "场景可生成，商品主体不可变形"),
      asset("site-detail", "详情页结构草案", 1, "包含功能、场景、FAQ和风险边界"),
      asset("site-ad", "广告创意变体", 3, "仅生成待审核创意，不执行广告投放")
    ];
  }
  return [
    asset("core-hero", "商品主视觉", 1, "保持商品主体和结构一致"),
    asset("core-lifestyle", "使用场景图", 3, "场景可变化，商品本体不得改变"),
    asset("core-benefit", "卖点解释图", 3, "卖点只使用已确认事实"),
    asset("core-detail", "详情页/落地页素材结构", 1, "事实、假设和证据分开"),
    asset("core-copy", "标题、卖点与CTA草稿", 3, "不得虚构用户反馈、销量、认证或收益"),
    asset("core-video", "短视频脚本与分镜", 3, "先形成待审核生产计划，不自动发布")
  ];
}

function asset(id, name, quantity, guard, evidenceRequired = false) {
  return { id, name, quantity, guard, evidenceRequired, status: "planned" };
}

export function buildProductLaunchExperimentPlan(productProfile, assetPlan) {
  const channels = assetPlan.channels.map((channel) => {
    const metricProfile = productLaunchMetricProfile(channel.platform);
    const variants = channel.assets.flatMap((item) => Array.from({ length: item.quantity }, (_, index) => ({
      schema: "bossai.product-launch-creative-variant.v1",
      id: `${item.id}.v${String(index + 1).padStart(2, "0")}`,
      platform: channel.platform,
      assetPlanItemId: item.id,
      assetName: item.name,
      variantIndex: index + 1,
      status: "planned-not-published",
      hypothesisStatus: "pending-owner-definition",
      evidenceRequired: item.evidenceRequired === true,
      requiresHumanReview: true,
      publicationAuthorized: false,
      adSpendAuthorized: false
    })));
    return {
      platform: channel.platform,
      status: "planned-not-running",
      dataAuthority: "authoritative-channel-or-commerce-export",
      acceptedImportModes: ["manual-export", "approved-connector"],
      variants,
      rawMetrics: metricProfile.rawMetrics,
      derivedMetrics: metricProfile.derivedMetrics
    };
  });

  return {
    schema: "bossai.product-launch-experiment-plan.v1",
    productName: productProfile.productName,
    revision: 1,
    status: "planned-not-running",
    creativeVariantContract: "bossai.product-launch-creative-variant.v1",
    measurementContract: "bossai.product-launch-measurement-snapshot.v1",
    feedbackContract: "bossai.product-launch-feedback-handoff.v1",
    regenerationDraftContract: "bossai.product-launch-regeneration-draft.v1",
    experimentRegistrationContract: "bossai.product-launch-experiment-registration.v1",
    channels,
    registeredIterations: [],
    evidenceRules: [
      "没有权威渠道或商业系统原始数据时，不填写效果数字，不生成胜负结论。",
      "曝光、点击、访问、加购、订单、GMV/Revenue 等原始指标只接受人工导出或已批准 Connector 输入。",
      "CTR、CVR、加购率、收入/会话等派生指标由本地根据原始分子分母计算，不接受外部直接写入派生结论。",
      "同一 Variant 必须绑定明确平台和观察窗口；跨平台数据不得直接混成一个转化率。",
      "观察到的相关性不等于因果。没有可比窗口、明确变量和足够证据时只能形成下一轮假设。",
      "真实收入、订单和经营价值只有在业务系统证据可追溯时才能进入 Company State。"
    ],
    feedbackLoop: {
      stages: ["separate-publish-approval", "collect-authoritative-data", "compile-measurement", "review-performance", "form-next-hypothesis", "owner-review", "regenerate-approved-variants", "review-regenerated-result", "register-new-variant-in-next-plan", "collect-next-round-data"],
      automaticPublication: false,
      automaticAdSpend: false,
      automaticRegeneration: false,
      causalClaimAllowed: false
    },
    feedbackHandoff: {
      schema: "bossai.product-launch-feedback-handoff.v1",
      targetAgentId: EXTERNAL_AGENT_IDS.content,
      capability: "content.performance.review",
      requiredInputContract: "bossai.product-launch-measurement-snapshot.v1",
      optionalEvidenceReview: {
        targetAgentId: EXTERNAL_AGENT_IDS.intelligence,
        capability: "intelligence.evidence.review"
      },
      automaticSubmission: false,
      humanApprovalRequired: true,
      externalActionsAuthorized: false
    },
    companyStateMapping: {
      schema: "bossai.product-launch-company-state-mapping.v1",
      verifiedOrderEvidenceRequired: true,
      verifiedRevenueEvidenceRequired: true,
      valueImpactMayBeClaimedFromCreativeArtifactAlone: false,
      candidateOutcomeTypes: ["revenueCreated", "revenueProtected"]
    }
  };
}

export function compileProductLaunchMeasurementSnapshot({ experimentPlan, records, compiledAt } = {}) {
  if (!experimentPlan || experimentPlan.schema !== "bossai.product-launch-experiment-plan.v1" || !Array.isArray(experimentPlan.channels)) {
    throw new Error("PRODUCT_LAUNCH_EXPERIMENT_PLAN_INVALID");
  }
  if (!Array.isArray(records) || records.length < 1 || records.length > 500) {
    throw new Error("PRODUCT_LAUNCH_MEASUREMENT_RECORDS_INVALID");
  }
  const variantIndex = new Map();
  for (const channel of experimentPlan.channels) {
    for (const variant of channel.variants || []) {
      variantIndex.set(variant.id, { variant, channel });
    }
  }
  const recordFields = new Set(["variantId", "windowStart", "windowEnd", "sourceType", "sourceLabel", "sourceRecordId", "metrics"]);
  const normalizedRecords = records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record) || !Object.keys(record).every((key) => recordFields.has(key))) {
      throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_RECORD_INVALID:${index}`);
    }
    const variantId = String(record.variantId || "").trim();
    const resolved = variantIndex.get(variantId);
    if (!resolved) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_VARIANT_UNKNOWN:${variantId}`);
    const windowStart = normalizeMeasurementDate(record.windowStart, "windowStart");
    const windowEnd = normalizeMeasurementDate(record.windowEnd, "windowEnd");
    if (Date.parse(windowEnd) <= Date.parse(windowStart)) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_WINDOW_INVALID:${variantId}`);
    const sourceType = String(record.sourceType || "").trim();
    if (!["manual-export", "approved-connector"].includes(sourceType)) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_SOURCE_INVALID:${variantId}`);
    const sourceLabel = String(record.sourceLabel || "").trim().slice(0, 240);
    if (!sourceLabel) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_SOURCE_INVALID:${variantId}`);
    const sourceRecordId = String(record.sourceRecordId || "").trim().slice(0, 240);
    if (!record.metrics || typeof record.metrics !== "object" || Array.isArray(record.metrics)) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_METRICS_INVALID:${variantId}`);
    const allowedMetrics = new Set(resolved.channel.rawMetrics);
    const metricEntries = Object.entries(record.metrics);
    if (!metricEntries.length || metricEntries.some(([key]) => !allowedMetrics.has(key))) {
      throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_METRICS_INVALID:${variantId}`);
    }
    const metrics = {};
    for (const [key, raw] of metricEntries) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_VALUE_INVALID:${variantId}:${key}`);
      metrics[key] = value;
    }
    const derived = {};
    for (const formula of resolved.channel.derivedMetrics) {
      const numerator = metrics[formula.numerator];
      const denominator = metrics[formula.denominator];
      derived[formula.id] = Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
        ? Math.round((numerator / denominator) * 1_000_000) / 1_000_000
        : null;
    }
    return {
      variantId,
      platform: resolved.channel.platform,
      assetPlanItemId: resolved.variant.assetPlanItemId,
      windowStart,
      windowEnd,
      sourceType,
      sourceLabel,
      ...(sourceRecordId ? { sourceRecordId } : {}),
      rawMetrics: metrics,
      derivedMetrics: derived,
      evidenceStatus: "observed-not-causal"
    };
  });

  return {
    schema: "bossai.product-launch-measurement-snapshot.v1",
    productName: experimentPlan.productName,
    compiledAt: normalizeMeasurementDate(compiledAt || new Date().toISOString(), "compiledAt"),
    status: "observed-not-causal",
    records: normalizedRecords,
    causalClaimAllowed: false,
    automaticRegeneration: false,
    automaticPublication: false,
    feedbackHandoff: experimentPlan.feedbackHandoff,
    companyStateMapping: experimentPlan.companyStateMapping
  };
}

export function compileProductLaunchFeedbackReviewDraft({ measurementSnapshot, snapshotSha256 } = {}) {
  if (!measurementSnapshot || measurementSnapshot.schema !== "bossai.product-launch-measurement-snapshot.v1" || !Array.isArray(measurementSnapshot.records) || measurementSnapshot.records.length < 1) {
    throw new Error("PRODUCT_LAUNCH_MEASUREMENT_SNAPSHOT_INVALID");
  }
  const sha256 = String(snapshotSha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("PRODUCT_LAUNCH_MEASUREMENT_SNAPSHOT_HASH_INVALID");
  if (measurementSnapshot.status !== "observed-not-causal" || measurementSnapshot.causalClaimAllowed !== false) {
    throw new Error("PRODUCT_LAUNCH_MEASUREMENT_CAUSAL_BOUNDARY_INVALID");
  }
  const handoff = measurementSnapshot.feedbackHandoff;
  if (!handoff
    || handoff.schema !== "bossai.product-launch-feedback-handoff.v1"
    || handoff.targetAgentId !== EXTERNAL_AGENT_IDS.content
    || handoff.capability !== "content.performance.review"
    || handoff.automaticSubmission !== false
    || handoff.externalActionsAuthorized !== false) {
    throw new Error("PRODUCT_LAUNCH_FEEDBACK_HANDOFF_INVALID");
  }

  const included = measurementSnapshot.records.slice(0, 12);
  const observationLines = included.map((record) => {
    const raw = Object.entries(record.rawMetrics || {}).map(([key, value]) => `${key}=${value}`).join(", ");
    const derived = Object.entries(record.derivedMetrics || {})
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    return `- ${record.platform} / ${record.variantId} / ${record.windowStart} → ${record.windowEnd} / source=${record.sourceLabel} / raw{${raw}}${derived ? ` / derived{${derived}}` : ""}`;
  });
  const objective = [
    `Product Launch：复盘“${measurementSnapshot.productName}”的已导入渠道观测数据，形成下一轮待审核内容/创意假设。`,
    `Measurement Snapshot SHA-256: ${sha256}`,
    "这些记录只能视为 observed-not-causal；不得因为某个 Variant 指标更高就宣称它导致增长。先检查可比窗口、流量来源、样本和业务系统证据，再提出下一轮实验。",
    "观测记录：",
    ...observationLines,
    measurementSnapshot.records.length > included.length ? `- 其余 ${measurementSnapshot.records.length - included.length} 条记录保留在 Measurement Snapshot 中，未塞入 Manager objective。` : "",
    "输出要求：区分观测事实、数据缺口、可能解释、不可下结论事项和下一轮最小可验证实验；不发布、不投放、不自动再生成。"
  ].filter(Boolean).join("\n").slice(0, 4_800);

  return {
    schema: "bossai.product-launch-feedback-review-draft.v1",
    status: "draft-not-submitted",
    productName: measurementSnapshot.productName,
    sourceMeasurement: {
      contract: measurementSnapshot.schema,
      sha256,
      compiledAt: measurementSnapshot.compiledAt,
      recordCount: measurementSnapshot.records.length,
      status: measurementSnapshot.status
    },
    target: {
      agentId: handoff.targetAgentId,
      capability: handoff.capability
    },
    managerTaskDraft: {
      objective,
      requiresHumanApproval: true,
      automaticSubmission: false
    },
    recordsIncludedInObjective: included.length,
    recordsTruncatedFromObjective: measurementSnapshot.records.length > included.length,
    causalClaimAllowed: false,
    automaticRegeneration: false,
    automaticPublication: false,
    automaticAdSpend: false,
    externalActionsAuthorized: false
  };
}

export function compileProductLaunchRegenerationDraft({ experimentPlan, performanceReview } = {}) {
  if (!experimentPlan || experimentPlan.schema !== "bossai.product-launch-experiment-plan.v1" || !Array.isArray(experimentPlan.channels)) {
    throw new Error("PRODUCT_LAUNCH_EXPERIMENT_PLAN_INVALID");
  }
  const reviewFields = new Set(["schema", "descriptorId", "artifactSha256", "sourceMeasurementSha256", "accepted", "acceptedAt", "reviewedBy", "nextExperiment"]);
  if (!performanceReview || typeof performanceReview !== "object" || Array.isArray(performanceReview)
      || !Object.keys(performanceReview).every((key) => reviewFields.has(key))) {
    throw new Error("PRODUCT_LAUNCH_PERFORMANCE_REVIEW_INVALID");
  }
  const artifactSha256 = String(performanceReview.artifactSha256 || "").trim().toLowerCase();
  const sourceMeasurementSha256 = String(performanceReview.sourceMeasurementSha256 || "").trim().toLowerCase();
  if (performanceReview.schema !== "bossai.product-launch-performance-review.v1"
      || performanceReview.descriptorId !== "content.performance-review.md"
      || performanceReview.accepted !== true
      || !/^[a-f0-9]{64}$/u.test(artifactSha256)
      || !/^[a-f0-9]{64}$/u.test(sourceMeasurementSha256)
      || !String(performanceReview.reviewedBy || "").trim()
      || Number.isNaN(Date.parse(String(performanceReview.acceptedAt || "")))) {
    throw new Error("PRODUCT_LAUNCH_PERFORMANCE_REVIEW_NOT_ACCEPTED");
  }

  const next = performanceReview.nextExperiment;
  const nextFields = new Set(["sourceVariantId", "workstream", "hypothesis", "singleVariableChange", "successMetric", "holdConstant", "observationWindowNotes"]);
  if (!next || typeof next !== "object" || Array.isArray(next) || !Object.keys(next).every((key) => nextFields.has(key))) {
    throw new Error("PRODUCT_LAUNCH_NEXT_EXPERIMENT_INVALID");
  }
  const sourceVariantId = String(next.sourceVariantId || "").trim();
  const workstream = String(next.workstream || "").trim();
  const hypothesis = String(next.hypothesis || "").trim().slice(0, 900);
  const singleVariableChange = String(next.singleVariableChange || "").trim().slice(0, 700);
  const successMetric = String(next.successMetric || "").trim();
  const observationWindowNotes = String(next.observationWindowNotes || "").trim().slice(0, 500);
  const holdConstant = Array.isArray(next.holdConstant)
    ? [...new Set(next.holdConstant.map((item) => String(item || "").trim().slice(0, 240)).filter(Boolean))].slice(0, 12)
    : [];
  const target = productLaunchRegenerationTarget(workstream);
  if (!sourceVariantId || !target || !hypothesis || !singleVariableChange || !successMetric || holdConstant.length < 1) {
    throw new Error("PRODUCT_LAUNCH_NEXT_EXPERIMENT_INVALID");
  }

  let resolved = null;
  for (const channel of experimentPlan.channels) {
    const variant = (channel.variants || []).find((item) => item.id === sourceVariantId);
    if (variant) {
      resolved = { channel, variant };
      break;
    }
  }
  if (!resolved) throw new Error(`PRODUCT_LAUNCH_REGENERATION_SOURCE_VARIANT_UNKNOWN:${sourceVariantId}`);
  const allowedMetrics = new Set([
    ...(resolved.channel.rawMetrics || []),
    ...(resolved.channel.derivedMetrics || []).map((item) => item.id),
  ]);
  if (!allowedMetrics.has(successMetric)) throw new Error(`PRODUCT_LAUNCH_REGENERATION_SUCCESS_METRIC_INVALID:${successMetric}`);

  const acceptedAt = new Date(performanceReview.acceptedAt).toISOString();
  const digestInput = [artifactSha256, sourceMeasurementSha256, sourceVariantId, workstream, hypothesis, singleVariableChange, successMetric, ...holdConstant].join("\n");
  const iterationDigest = createHash("sha256").update(digestInput, "utf8").digest("hex");
  const iterationId = `pli-${iterationDigest.slice(0, 16)}`;
  const proposedVariantId = `${sourceVariantId}.${iterationDigest.slice(0, 10)}`;
  const objective = [
    `Product Launch 创意迭代：基于 Owner 已确认的上一轮结果，为“${experimentPlan.productName}”准备一个新的 ${workstream} 变体草稿。`,
    `Source Variant: ${sourceVariantId}`,
    `Proposed Variant: ${proposedVariantId}`,
    `Source Result SHA-256: ${artifactSha256}`,
    `Measurement Snapshot SHA-256: ${sourceMeasurementSha256}`,
    `待验证假设：${hypothesis}`,
    `本轮唯一允许改变的关键变量：${singleVariableChange}`,
    `保持不变：${holdConstant.join("；")}`,
    `成功指标：${successMetric}`,
    observationWindowNotes ? `观察窗口要求：${observationWindowNotes}` : "观察窗口要求：在发布前由负责人明确可比窗口和流量条件。",
    "只形成新变体草稿，不覆盖 Source Variant；不得把上一轮相关性当因果，不得虚构商品事实、销量、评价、价格、认证或效果。",
    "不自动提交、不自动调用 Provider/GPU/FFmpeg、不自动上架、发布、投放或操作账号。"
  ].join("\n").slice(0, 4_800);

  return {
    schema: "bossai.product-launch-regeneration-draft.v1",
    status: "draft-not-submitted",
    productName: experimentPlan.productName,
    iterationId,
    sourcePerformanceReview: {
      descriptorId: "content.performance-review.md",
      artifactSha256,
      sourceMeasurementSha256,
      acceptedAt,
      reviewedBy: String(performanceReview.reviewedBy).trim().slice(0, 160)
    },
    sourceVariant: {
      id: resolved.variant.id,
      platform: resolved.channel.platform,
      assetPlanItemId: resolved.variant.assetPlanItemId,
      assetName: resolved.variant.assetName
    },
    proposedVariant: {
      id: proposedVariantId,
      parentVariantId: sourceVariantId,
      status: "draft-not-generated",
      workstream,
      hypothesis,
      singleVariableChange,
      holdConstant,
      successMetric,
      ...(observationWindowNotes ? { observationWindowNotes } : {}),
      publicationAuthorized: false,
      adSpendAuthorized: false
    },
    target,
    managerTaskDraft: {
      objective,
      requiresHumanApproval: true,
      automaticSubmission: false
    },
    experimentRegistration: {
      requiredBeforePublication: true,
      sourceExperimentContract: experimentPlan.schema,
      mutatesExistingVariant: false,
      historicalMeasurementMutationAllowed: false
    },
    automaticGeneration: false,
    automaticRegeneration: false,
    automaticPublication: false,
    automaticAdSpend: false,
    externalActionsAuthorized: false
  };
}

export function compileProductLaunchExperimentRegistration({ experimentPlan, regenerationDraft, regenerationReview } = {}) {
  if (!experimentPlan || experimentPlan.schema !== "bossai.product-launch-experiment-plan.v1" || !Array.isArray(experimentPlan.channels)) {
    throw new Error("PRODUCT_LAUNCH_EXPERIMENT_PLAN_INVALID");
  }
  if (!regenerationDraft || regenerationDraft.schema !== "bossai.product-launch-regeneration-draft.v1" || regenerationDraft.status !== "draft-not-submitted") {
    throw new Error("PRODUCT_LAUNCH_REGENERATION_DRAFT_INVALID");
  }
  if (regenerationDraft.productName !== experimentPlan.productName
      || regenerationDraft.experimentRegistration?.mutatesExistingVariant !== false
      || regenerationDraft.experimentRegistration?.historicalMeasurementMutationAllowed !== false) {
    throw new Error("PRODUCT_LAUNCH_REGENERATION_DRAFT_MISMATCH");
  }

  const reviewFields = new Set(["schema", "proposedVariantId", "descriptorId", "artifactSha256", "accepted", "acceptedAt", "reviewedBy"]);
  if (!regenerationReview || typeof regenerationReview !== "object" || Array.isArray(regenerationReview)
      || !Object.keys(regenerationReview).every((key) => reviewFields.has(key))) {
    throw new Error("PRODUCT_LAUNCH_REGENERATION_REVIEW_INVALID");
  }
  const artifactSha256 = String(regenerationReview.artifactSha256 || "").trim().toLowerCase();
  if (regenerationReview.schema !== "bossai.product-launch-regeneration-review.v1"
      || regenerationReview.proposedVariantId !== regenerationDraft.proposedVariant?.id
      || regenerationReview.descriptorId !== regenerationDraft.target?.expectedArtifact
      || regenerationReview.accepted !== true
      || !/^[a-f0-9]{64}$/u.test(artifactSha256)
      || !String(regenerationReview.reviewedBy || "").trim()
      || Number.isNaN(Date.parse(String(regenerationReview.acceptedAt || "")))) {
    throw new Error("PRODUCT_LAUNCH_REGENERATION_REVIEW_NOT_ACCEPTED");
  }

  const sourceVariantId = regenerationDraft.sourceVariant?.id;
  const proposedVariantId = regenerationDraft.proposedVariant?.id;
  let channelIndex = -1;
  let sourceVariant = null;
  for (let index = 0; index < experimentPlan.channels.length; index += 1) {
    const candidate = (experimentPlan.channels[index].variants || []).find((item) => item.id === sourceVariantId);
    if (candidate) {
      channelIndex = index;
      sourceVariant = candidate;
      break;
    }
  }
  if (channelIndex < 0 || !sourceVariant) throw new Error(`PRODUCT_LAUNCH_REGENERATION_SOURCE_VARIANT_UNKNOWN:${sourceVariantId}`);
  const duplicate = experimentPlan.channels.some((channel) => (channel.variants || []).some((variant) => variant.id === proposedVariantId));
  if (duplicate) throw new Error(`PRODUCT_LAUNCH_REGENERATION_VARIANT_ALREADY_REGISTERED:${proposedVariantId}`);

  const currentRevision = Number(experimentPlan.revision || 1);
  if (!Number.isInteger(currentRevision) || currentRevision < 1) throw new Error("PRODUCT_LAUNCH_EXPERIMENT_PLAN_REVISION_INVALID");
  const nextPlan = structuredClone(experimentPlan);
  nextPlan.revision = currentRevision + 1;
  nextPlan.status = "planned-not-running";
  if (!Array.isArray(nextPlan.registeredIterations)) nextPlan.registeredIterations = [];
  const acceptedAt = new Date(regenerationReview.acceptedAt).toISOString();
  const nextChannel = nextPlan.channels[channelIndex];
  const registeredVariant = {
    schema: "bossai.product-launch-creative-variant.v1",
    id: proposedVariantId,
    platform: nextChannel.platform,
    assetPlanItemId: sourceVariant.assetPlanItemId,
    assetName: `${sourceVariant.assetName} / Iteration`,
    variantIndex: nextChannel.variants.length + 1,
    status: "approved-not-published",
    hypothesisStatus: "owner-approved-for-test",
    evidenceRequired: sourceVariant.evidenceRequired === true,
    requiresHumanReview: true,
    publicationAuthorized: false,
    adSpendAuthorized: false,
    parentVariantId: sourceVariantId,
    iterationId: regenerationDraft.iterationId,
    workstream: regenerationDraft.proposedVariant.workstream,
    successMetric: regenerationDraft.proposedVariant.successMetric,
    sourcePerformanceReviewSha256: regenerationDraft.sourcePerformanceReview.artifactSha256,
    regenerationArtifactSha256: artifactSha256
  };
  nextChannel.variants.push(registeredVariant);
  const registration = {
    schema: "bossai.product-launch-iteration-registration.v1",
    iterationId: regenerationDraft.iterationId,
    sourceVariantId,
    proposedVariantId,
    platform: nextChannel.platform,
    workstream: regenerationDraft.proposedVariant.workstream,
    successMetric: regenerationDraft.proposedVariant.successMetric,
    sourcePerformanceReviewSha256: regenerationDraft.sourcePerformanceReview.artifactSha256,
    sourceMeasurementSha256: regenerationDraft.sourcePerformanceReview.sourceMeasurementSha256,
    regenerationArtifact: {
      descriptorId: regenerationReview.descriptorId,
      sha256: artifactSha256,
      acceptedAt,
      reviewedBy: String(regenerationReview.reviewedBy).trim().slice(0, 160)
    },
    publicationAuthorized: false,
    adSpendAuthorized: false
  };
  nextPlan.registeredIterations.push(registration);

  return {
    schema: "bossai.product-launch-experiment-registration.v1",
    status: "next-plan-ready-not-adopted",
    productName: experimentPlan.productName,
    sourcePlanRevision: currentRevision,
    nextPlanRevision: nextPlan.revision,
    registration,
    updatedExperimentPlan: nextPlan,
    sourcePlanMutated: false,
    automaticAdoption: false,
    automaticPublication: false,
    automaticAdSpend: false,
    externalActionsAuthorized: false
  };
}

function productLaunchRegenerationTarget(workstream) {
  return ({
    content: {
      agentId: EXTERNAL_AGENT_IDS.content,
      capability: "content.commerce.launch-copy",
      expectedArtifact: "content.commerce-launch-copy.md"
    },
    design: {
      agentId: EXTERNAL_AGENT_IDS.design,
      capability: "design.commerce.asset-plan",
      expectedArtifact: "design.commerce-asset-plan.md"
    },
    video: {
      agentId: EXTERNAL_AGENT_IDS.video,
      capability: "video.commerce.production.plan",
      expectedArtifact: "video.commerce-production-plan.md"
    }
  })[workstream] || null;
}

function productLaunchMetricProfile(platform) {
  const key = String(platform || "").toLowerCase();
  if (key.includes("amazon") || key.includes("亚马逊")) {
    return metricProfile(
      ["impressions", "clicks", "detailPageViews", "addToCarts", "orders", "unitsOrdered", "revenue"],
      [["ctr", "clicks", "impressions"], ["addToCartRate", "addToCarts", "detailPageViews"], ["orderConversionRate", "orders", "detailPageViews"], ["revenuePerDetailView", "revenue", "detailPageViews"]]
    );
  }
  if (key.includes("tiktok") || key.includes("抖音") || key.includes("抖店")) {
    return metricProfile(
      ["impressions", "videoViews", "clicks", "productPageViews", "addToCarts", "orders", "gmv"],
      [["viewRate", "videoViews", "impressions"], ["ctr", "clicks", "impressions"], ["addToCartRate", "addToCarts", "productPageViews"], ["orderConversionRate", "orders", "productPageViews"], ["gmvPerProductView", "gmv", "productPageViews"]]
    );
  }
  if (key.includes("小红书") || key.includes("xiaohongshu") || key === "xhs") {
    return metricProfile(
      ["impressions", "reads", "likes", "saves", "comments", "profileVisits", "outboundClicks", "orders", "revenue"],
      [["readRate", "reads", "impressions"], ["saveRate", "saves", "reads"], ["outboundClickRate", "outboundClicks", "reads"], ["orderConversionRate", "orders", "outboundClicks"]]
    );
  }
  if (key.includes("shopify") || key.includes("独立站") || key.includes("website") || key.includes("官网")) {
    return metricProfile(
      ["sessions", "productViews", "ctaClicks", "addToCarts", "checkouts", "orders", "revenue"],
      [["ctaRate", "ctaClicks", "sessions"], ["addToCartRate", "addToCarts", "sessions"], ["checkoutRate", "checkouts", "sessions"], ["orderConversionRate", "orders", "sessions"], ["revenuePerSession", "revenue", "sessions"]]
    );
  }
  return metricProfile(
    ["impressions", "clicks", "addToCarts", "orders", "revenue"],
    [["ctr", "clicks", "impressions"], ["orderConversionRate", "orders", "clicks"], ["revenuePerClick", "revenue", "clicks"]]
  );
}

function metricProfile(rawMetrics, formulas) {
  return {
    rawMetrics,
    derivedMetrics: formulas.map(([id, numerator, denominator]) => ({ id, numerator, denominator }))
  };
}

function normalizeMeasurementDate(value, field) {
  const text = String(value || "").trim();
  const timestamp = Date.parse(text);
  if (!text || Number.isNaN(timestamp)) throw new Error(`PRODUCT_LAUNCH_MEASUREMENT_DATE_INVALID:${field}`);
  return new Date(timestamp).toISOString();
}

function buildMissionDraft(business, productName, platforms, profile, assetPlan) {
  const platformText = platforms.length ? platforms.join("、") : "待确认首发平台";
  const factsText = profile.knownFacts.length ? profile.knownFacts.join("；") : "仅有待识别商品资产";
  const assetSummary = assetPlan.channels.map((channel) => `${channel.platform}:${channel.assets.map((item) => item.name).join("/")}`).join("；");

  return {
    schema: "bossai.product-launch-mission-draft.v1",
    targetContract: "bossai.manager-mission.v1",
    executionOwner: "bossai-os",
    harness: "hermes/bossaiworkforce",
    status: "draft-not-submitted",
    automaticSubmission: false,
    externalActionsAuthorized: false,
    expectedStepContracts: {
      intelligence: {
        agentId: EXTERNAL_AGENT_IDS.intelligence,
        capability: "intelligence.commerce.launch-evidence",
        inputContracts: ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"],
        predecessorArtifactsRequired: [],
        outputArtifact: "intelligence.commerce-launch-evidence.md"
      },
      salesPositioning: {
        agentId: EXTERNAL_AGENT_IDS.sales,
        capability: "sales.commerce.positioning",
        inputContracts: ["bossai.product-profile-draft.v1"],
        predecessorArtifactsRequired: ["intelligence"],
        outputArtifact: "sales.commerce-positioning.md"
      },
      content: {
        agentId: EXTERNAL_AGENT_IDS.content,
        capability: "content.commerce.launch-copy",
        inputContracts: ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"],
        predecessorArtifactsRequired: ["intelligence", "sales-positioning"],
        outputArtifact: "content.commerce-launch-copy.md"
      },
      design: {
        agentId: EXTERNAL_AGENT_IDS.design,
        capability: "design.commerce.asset-plan",
        inputContracts: ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"],
        outputArtifact: "design.commerce-asset-plan.md"
      },
      video: {
        agentId: EXTERNAL_AGENT_IDS.video,
        capability: "video.commerce.production.plan",
        inputContracts: ["bossai.product-profile-draft.v1", "bossai.product-launch-asset-plan.v1"],
        predecessorArtifactsRequired: ["content", "design"],
        outputArtifact: "video.commerce-production-plan.md"
      }
    },
    executionHandoffs: {
      productVisual: {
        schema: "bossai.product-launch-media-handoff.v1",
        triggerAfterStep: "design",
        reviewArtifact: "design.commerce-asset-plan.md",
        executionPackContract: "bossai.product-launch-visual-execution-pack.v1",
        mediaTaskType: "media.image.generate",
        runtimeAuthority: "bossai-os",
        routingAuthority: "bossai-central-ai-gateway",
        localExecutorContract: "bossai.local-media-executor-contract.v1",
        localExecutorProject: "D:\\BossAI-Projects\\ai-product-photos",
        automaticSubmission: false,
        humanApprovalRequired: true,
        externalActionsAuthorized: false
      },
      productVideo: {
        schema: "bossai.product-launch-product-video-handoff.v1",
        triggerAfterStep: "video",
        reviewArtifact: "video.commerce-production-plan.md",
        reviewAcceptanceContract: "bossai.product-launch-video-review.v1",
        draftContract: "bossai.kaipai-product-media-draft.v1",
        draftCompiler: "compileKaipaiProductMediaDraft",
        requiresArtifactSha256: true,
        humanApprovalRequired: true,
        productionContract: "bossai.video-production-task.v1",
        executionTarget: "local-windows",
        operation: "product-video",
        professionalWorkbench: "D:\\BossAI-Projects\\bossai-iphone-talking-video-factory",
        automaticDraftImport: false,
        mediaImported: false,
        rightsConfirmed: false,
        automaticExecution: false,
        publicationAuthorized: false,
        aiGeneratedShotPolicy: "separate-approved-video-generation-flow-required"
      }
    },
    request: {
      objective: `为“${productName}”形成可人工审核的商品上新方案，目标平台：${platformText}。先核验商品和市场事实，再完成价值主张、内容、视觉素材计划和视频生产计划。不得自动上架、发布、投放、改价、付款、退款、发送客户消息或对外承诺。`,
      priority: "high",
      steps: [
        {
          id: "intelligence",
          agentId: EXTERNAL_AGENT_IDS.intelligence,
          objective: `复核商品事实、目标客户、竞品与需求证据。已知事实：${factsText}。输出事实、推断、未知项和证据缺口；不得把内部猜测写成已验证市场结论。`
        },
        {
          id: "sales-positioning",
          agentId: EXTERNAL_AGENT_IDS.sales,
          dependsOn: ["intelligence"],
          objective: `基于已核验情报，为“${productName}”形成待审核价值主张、购买理由、异议和试卖边界；不得虚构价格、折扣、销量、案例、客户评价或收益承诺。`
        },
        {
          id: "content",
          agentId: EXTERNAL_AGENT_IDS.content,
          dependsOn: ["intelligence", "sales-positioning"],
          objective: `为 ${platformText} 生成待审核 Listing/详情页文案、标题钩子、卖点解释和CTA草稿。所有规格、效果、认证与对比必须来自前置可复核事实。`
        },
        {
          id: "design",
          agentId: EXTERNAL_AGENT_IDS.design,
          dependsOn: ["intelligence", "sales-positioning"],
          objective: `按 Product Profile 的视觉保真规则审阅并细化渠道 Asset Plan，形成待审核商品视觉生产计划。计划范围：${assetSummary}。不得改变商品主体结构，不得生成不存在的功能、接口、配件或规格。`
        },
        {
          id: "video",
          agentId: EXTERNAL_AGENT_IDS.video,
          dependsOn: ["content", "design"],
          objective: `基于已审核方向形成短视频脚本、镜头结构、演示动作和生产检查清单；不得调用付费 Provider、渲染、上传、发布或投放，除非后续通过独立人工审批。`
        }
      ]
    }
  };
}

export function compileKaipaiProductMediaDraft({ productProfile, assetPlan, videoReview } = {}) {
  if (!productProfile || productProfile.schema !== "bossai.product-profile-draft.v1" || !String(productProfile.productName || "").trim()) {
    throw new Error("PRODUCT_VIDEO_PROFILE_INVALID");
  }
  if (!assetPlan || assetPlan.schema !== "bossai.product-launch-asset-plan.v1" || !Array.isArray(assetPlan.channels) || !assetPlan.channels.length) {
    throw new Error("PRODUCT_VIDEO_ASSET_PLAN_INVALID");
  }
  const reviewFields = new Set(["schema", "descriptorId", "artifactSha256", "accepted", "acceptedAt", "reviewedBy", "productionDraft"]);
  if (!videoReview || typeof videoReview !== "object" || Array.isArray(videoReview) || !Object.keys(videoReview).every((key) => reviewFields.has(key))) {
    throw new Error("PRODUCT_VIDEO_REVIEW_INVALID");
  }
  if (videoReview.schema !== "bossai.product-launch-video-review.v1"
      || videoReview.descriptorId !== "video.commerce-production-plan.md"
      || videoReview.accepted !== true
      || !/^[0-9a-f]{64}$/u.test(String(videoReview.artifactSha256 || "").toLowerCase())
      || !String(videoReview.reviewedBy || "").trim()
      || Number.isNaN(Date.parse(String(videoReview.acceptedAt || "")))) {
    throw new Error("PRODUCT_VIDEO_REVIEW_NOT_ACCEPTED");
  }

  const draft = videoReview.productionDraft;
  const draftFields = new Set(["title", "subtitle", "aspectRatio", "segmentSeconds", "suggestedTotalSeconds", "shotPlan", "factReviewNotes"]);
  if (!draft || typeof draft !== "object" || Array.isArray(draft) || !Object.keys(draft).every((key) => draftFields.has(key))) {
    throw new Error("PRODUCT_VIDEO_REVIEW_DRAFT_INVALID");
  }
  const title = String(draft.title || "").trim().slice(0, 220);
  const subtitle = String(draft.subtitle || "").trim().slice(0, 360);
  const aspectRatio = ["9:16", "16:9", "1:1"].includes(draft.aspectRatio) ? draft.aspectRatio : null;
  const segmentSeconds = [1.5, 2.5, 3.5, 5].includes(Number(draft.segmentSeconds)) ? Number(draft.segmentSeconds) : null;
  const suggestedTotalSeconds = Number(draft.suggestedTotalSeconds);
  const factReviewNotes = Array.isArray(draft.factReviewNotes)
    ? [...new Set(draft.factReviewNotes.map((item) => String(item || "").trim().slice(0, 600)).filter(Boolean))].slice(0, 20)
    : [];
  const shotPlan = normalizeReviewedShotPlan(draft.shotPlan);
  if (!title || !subtitle || !aspectRatio || !segmentSeconds || !Number.isFinite(suggestedTotalSeconds)
      || suggestedTotalSeconds < 3 || suggestedTotalSeconds > 180 || !shotPlan || !factReviewNotes.length) {
    throw new Error("PRODUCT_VIDEO_REVIEW_DRAFT_INVALID");
  }

  const platforms = [...new Set(assetPlan.channels.map((channel) => String(channel?.platform || "").trim()).filter(Boolean))].slice(0, 8);
  if (!platforms.length) throw new Error("PRODUCT_VIDEO_PLATFORMS_INVALID");

  return {
    schema: "bossai.kaipai-product-media-draft.v1",
    source: "bossai-product-launch",
    sourceReviewArtifact: "video.commerce-production-plan.md",
    sourceReviewArtifactSha256: String(videoReview.artifactSha256).toLowerCase(),
    sourceReviewAcceptedAt: new Date(videoReview.acceptedAt).toISOString(),
    sourceReviewAcceptedBy: String(videoReview.reviewedBy).trim().slice(0, 160),
    generatedAt: new Date(videoReview.acceptedAt).toISOString(),
    productName: String(productProfile.productName).trim().slice(0, 180),
    platforms,
    title,
    subtitle,
    aspectRatio,
    segmentSeconds,
    suggestedTotalSeconds: Math.round(suggestedTotalSeconds),
    shotPlan,
    factReviewNotes,
    execution: {
      contract: "bossai.video-production-task.v1",
      executionTarget: "local-windows",
      operation: "product-video",
      automaticExecution: false,
      mediaImported: false,
      rightsConfirmed: false,
      publicationAuthorized: false
    }
  };
}

function normalizeReviewedShotPlan(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const allowed = new Set(["index", "durationSeconds", "purpose", "visual"]);
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).every((key) => allowed.has(key))) return null;
    const index = Math.floor(Number(raw.index));
    const durationSeconds = Number(raw.durationSeconds);
    const purpose = String(raw.purpose || "").trim().slice(0, 240);
    const visual = String(raw.visual || "").trim().slice(0, 500);
    if (!Number.isInteger(index) || index < 1 || index > 40 || seen.has(index)
        || !Number.isFinite(durationSeconds) || durationSeconds < 0.5 || durationSeconds > 30 || !purpose || !visual) return null;
    seen.add(index);
    result.push({ index, durationSeconds: Math.round(durationSeconds * 10) / 10, purpose, visual });
  }
  return result.sort((left, right) => left.index - right.index);
}

function buildProductLaunchTasks(business, productName, platforms) {
  const platformText = platforms.length ? platforms.join("、") : "待确认平台";
  const facts = [
    `商品：${productName}`,
    `现有资产：${(business.assets || []).join("、") || "未提供"}`,
    `目标平台：${platformText}`
  ];
  return [
    task("TASK-001", "product-selection", 1, "锁定商品事实边界", "从用户资料和商品资产建立 Product Profile，区分已知事实、未知项和禁止模型补全的细节。", "01-product-profile.md", facts, ["商品身份与已有资产可追溯", "未知规格明确列出而不是猜测", "视觉保真规则完整", "不把营销假设写成商品事实"]),
    task("TASK-002", "radar", 1, "核验市场与竞品证据", "核验目标客户、使用场景、竞品、常见痛点和平台证据，为后续卖点提供来源。", "02-market-evidence.md", facts, ["至少2个独立公开来源或3条真实客户记录", "事实与推断分离", "至少1条反证或替代方案", "证据不足时保留为待验证假设"]),
    task("TASK-003", "sales-copy", 2, "形成价值主张与试卖边界", "把已核验商品事实和客户问题转成可审核价值主张、购买理由与异议处理。", "03-positioning-and-offer.md", facts, ["价值主张对应真实商品能力", "不虚构价格、销量、口碑或收益", "至少3个卖点角度", "定义不能承诺的内容"]),
    task("TASK-004", "content", 4, "生成渠道内容素材草稿", `为 ${platformText} 生成 Listing、详情页、标题钩子和CTA草稿。`, "04-channel-copy.md", facts, ["渠道文案与 Product Profile 一致", "规格和效果承诺有证据", "至少3个可测试内容角度", "所有内容仍为待审核草稿"]),
    task("TASK-005", "operations", 4, "生成整套电商素材计划", `把 ${platformText} 所需主图、场景图、卖点图、详情页和短视频素材组织成可执行 Asset Plan。`, "05-asset-plan.md", facts, ["每项素材有目的、数量和审核规则", "尺寸/参数/对比类素材有证据闸门", "商品本体结构不得被改变", "未执行真实发布或投放"]),
    task("TASK-006", "product-qa", 6, "受控审核商品上新包", "检查 Product Profile、文案、视觉计划和视频计划是否一致、真实、可交付。", "06-launch-package-review.md", facts, ["商品身份在所有素材中一致", "没有虚构规格、认证、评价或收益", "缺失项有明确回退/补证据动作", "真实上架、发布和投放仍需独立人工批准"]),
    task("TASK-007", "project-manager", 7, "决定是否进入真实上架", "根据证据与审核结果决定继续制作、补证据、调整渠道或暂停，不自动执行外部动作。", "07-launch-decision.md", facts, ["记录通过/阻塞项", "明确首发平台与素材范围", "明确需要人工批准的真实动作", "作出继续/调整/暂停之一的结论"])
  ];
}

function task(id, roleId, day, title, objective, output, facts, acceptanceCriteria) {
  const role = ROLE_BY_ID.get(roleId);
  return {
    id,
    signalId: "PRODUCT-LAUNCH",
    roleId,
    roleName: role?.name || roleId,
    title,
    objective,
    facts,
    inference: "本任务来自用户明确的商品上新目标；市场需求、受众和卖点仍需证据验证。",
    output,
    acceptanceCriteria,
    cheapestValidation: day === 6
      ? "先用一个商品和一套素材草案做人工端到端审核，再决定是否扩大到更多 SKU。"
      : "优先复用用户已有商品资料和可复核公开证据，不先进行真实发布、投放或付费生成。",
    approvalGate: "本 Skill 只生成本地草案/计划；真实上架、发布、投放、账号写入、改价、付款、退款、客户消息和对外承诺必须另行人工批准。",
    status: "todo",
    plannedDay: day,
    businessGoal: "完成可审核的商品上新包"
  };
}

function buildProductLaunchSevenDayPlan(tasks) {
  const themes = {
    1: "商品与证据：锁定商品事实，核验市场和竞品",
    2: "定位：形成可证明的价值主张和试卖边界",
    3: "素材架构：确认平台、尺寸、事实字段和生产依赖",
    4: "内容与视觉：完成渠道文案和整套 Asset Plan",
    5: "视频与详情：补齐短视频、详情页和审核清单",
    6: "受控审核：逐项核对事实、商品一致性和渠道完整性",
    7: "上架决策：继续、调整或暂停，外部动作仍需人工批准"
  };
  return Object.entries(themes).map(([dayText, theme]) => {
    const day = Number(dayText);
    const dayTasks = tasks.filter((item) => item.plannedDay === day);
    return {
      day,
      theme,
      taskIds: dayTasks.map((item) => item.id),
      outputs: dayTasks.map((item) => item.output),
      gate: day === 7
        ? "只有人工审核通过后，才可进入独立的真实上架/发布/投放审批；本计划本身不执行外部动作。"
        : "当日交付物先人工审核；事实不完整时补证据，不允许模型自行补全。"
    };
  });
}

function buildWarnings(business, platforms) {
  const warnings = [];
  if (!business.offer || business.offer === "待明确") warnings.push("商品名称/品类尚未明确，需要先从用户资料或商品资产中识别并确认。 ");
  if (!business.customer || business.customer === "待明确") warnings.push("目标客户尚未确认，客户画像和痛点只能作为待验证假设。 ");
  if (!platforms.length) warnings.push("首发平台尚未确认，当前先生成核心电商素材包，渠道尺寸和规则需后续适配。 ");
  if (!business.assets?.length) warnings.push("未提供商品资产，视觉素材生产前需要补充白底图、实拍图、包装图或可复核产品资料。 ");
  return warnings.map((item) => item.trim());
}

function normalizePlatforms(platforms = []) {
  const normalized = [];
  for (const value of platforms || []) {
    const text = String(value || "").trim();
    if (!text) continue;
    const key = text.normalize("NFKC").toLowerCase();
    let canonical = text;
    if (key.includes("amazon") || key.includes("亚马逊")) canonical = "Amazon";
    else if (key.includes("tiktok") || key.includes("tik tok")) canonical = "TikTok Shop";
    else if (key.includes("抖音") || key.includes("抖店")) canonical = "抖音/抖店";
    else if (key.includes("小红书") || key === "xhs" || key.includes("xiaohongshu")) canonical = "小红书";
    else if (key.includes("shopify") || key.includes("独立站")) canonical = "独立站/Shopify";
    if (!normalized.includes(canonical)) normalized.push(canonical);
  }
  return normalized;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean);
}
