const WORK_MODES = [
  {
    id: "product-launch",
    name: "商品上新",
    promise: "把商品和现有资产变成可审核的上新方案、渠道素材计划和多员工执行草案。",
    signals: [
      ["把这个商品卖起来", 9], ["把这个产品卖起来", 9], ["商品上新", 8], ["新品上新", 8],
      ["一整套电商素材", 8], ["整套电商素材", 8], ["白底图", 7], ["商品素材", 7],
      ["产品素材", 7], ["商品图", 6], ["产品图", 6], ["listing素材", 6],
      ["商品上架", 6], ["product launch", 8], ["launch product", 8]
    ],
    roles: ["product-selection", "radar", "sales-copy", "content", "operations", "compliance", "project-manager"]
  },
  {
    id: "decision",
    name: "方向与决策",
    promise: "帮你判断先做什么、暂停什么、怎么验证，避免继续乱开发。",
    signals: [
      ["暂停还是继续", 7], ["先做哪个", 6], ["优先做什么", 6], ["值不值得", 6],
      ["要不要继续", 5], ["是否继续", 5], ["项目优先级", 5], ["项目取舍", 5],
      ["项目排序", 5], ["方向判断", 5], ["商业模式", 5], ["验证想法", 5],
      ["可行性", 4], ["优先级", 4], ["怎么选", 4], ["决策", 3],
      ["战略", 3], ["方向", 3], ["取舍", 3], ["暂停", 3], ["放弃", 3]
    ],
    roles: ["strategy", "radar", "finance", "project-manager"]
  },
  {
    id: "content",
    name: "内容与个人IP",
    promise: "帮你做定位、选题、口播、图文和发布前检查。",
    signals: [
      ["短视频脚本", 6], ["短视频口播", 6], ["小红书文案", 6], ["账号定位", 5],
      ["内容计划", 5], ["内容日历", 5], ["个人ip", 5], ["视频号", 4],
      ["短视频", 4], ["小红书", 4], ["口播", 4], ["选题", 4],
      ["人设", 4], ["抖音", 3], ["脚本", 3], ["文案", 3], ["标题", 3], ["内容", 3]
    ],
    roles: ["content", "ip-coach", "sales-copy", "compliance"]
  },
  {
    id: "customer-service",
    name: "客服与售后",
    promise: "帮你分析客户问题、生成回复草稿、整理FAQ并标出风险。",
    signals: [
      ["客服对话", 6], ["退款承诺", 6], ["退货退款", 6], ["售后处理", 5],
      ["投诉处理", 5], ["客服回复", 5], ["回复客户", 5], ["客户消息", 5],
      ["物流异常", 5], ["订单查询", 5], ["售后", 4], ["客服", 4],
      ["退款", 4], ["退货", 4], ["投诉", 4], ["查单", 4],
      ["faq", 3], ["物流", 3], ["订单", 2]
    ],
    roles: ["customer-service", "compliance", "operations", "data-analyst"]
  },
  {
    id: "sales",
    name: "销售与成交",
    promise: "帮你整理卖点、报价、成交页、异议处理和跟进话术。",
    signals: [
      ["销售话术", 6], ["成交话术", 6], ["跟进话术", 6], ["客户跟进", 5],
      ["异议处理", 5], ["报价方案", 5], ["卖点提炼", 5], ["促成成交", 5],
      ["落地页", 4], ["销售", 4], ["成交", 4], ["报价", 4],
      ["卖点", 4], ["异议", 3], ["跟进", 3], ["试单", 3],
      ["收费", 3], ["付费", 3], ["咨询转化", 3]
    ],
    roles: ["sales-copy", "strategy", "content", "finance"]
  },
  {
    id: "operations",
    name: "选品与运营",
    promise: "帮你做选品判断、运营计划、上架流程、供应链和数据复盘。",
    signals: [
      ["亚马逊选品", 6], ["选品分析", 6], ["店铺运营", 6], ["商品上架", 5],
      ["库存周转", 5], ["运营计划", 5], ["数据复盘", 5], ["供应链", 5],
      ["转化率", 4], ["店铺活动", 4], ["选品", 4], ["运营", 4],
      ["上架", 4], ["库存", 4], ["复购", 3], ["流量", 3],
      ["转化", 3], ["店铺", 3], ["sku", 3], ["amazon", 3],
      ["亚马逊", 3], ["shopify", 3], ["淘宝", 3], ["抖店", 3]
    ],
    roles: ["product-selection", "operations", "supply-chain", "data-analyst", "finance"]
  },
  {
    id: "delivery",
    name: "开发与交付",
    promise: "帮你拆任务、检查产品、跑验收、找Bug并判断能否上线试卖。",
    signals: [
      ["功能验收", 6], ["代码审查", 6], ["软件测试", 6], ["上线交付", 6],
      ["产品验收", 5], ["产品测试", 5], ["开发任务", 5], ["修复bug", 5],
      ["接口测试", 5], ["自动化工作流", 5], ["安装包", 4], ["项目管理", 4],
      ["开发", 4], ["代码", 4], ["软件", 4], ["测试", 4],
      ["验收", 4], ["bug", 4], ["交付", 4], ["自动化", 3],
      ["工作流", 3], ["上线", 3], ["功能", 2]
    ],
    roles: ["project-manager", "product-qa", "automation", "compliance"]
  }
];

const MIN_SECONDARY_SCORE = 3;
const MIN_CONFIDENT_SCORE = 3;
const LOW_CONFIDENCE_MARGIN = 2;
const STRONG_MIXED_SCORE = 7;
const HIGH_CONFIDENCE_SCORE = 9;
const HIGH_CONFIDENCE_MARGIN = 4;

export const FRONT_DESK = {
  id: "bossai-manager",
  name: "BossAI 电商总管",
  greeting: "把你现在最想解决的问题直接告诉我，不需要选择员工。我会判断问题、安排后台AI员工，并把结果统一交给你。",
  promise: "你只和一个入口对话，后台岗位自动协作。",
  publicRules: [
    "永远不要求客户先选择员工",
    "先理解目标，再自动判断工作模式",
    "客户只看统一结果，不看内部角色会议",
    "只有在解释责任或风险时才简要显示后台分工",
    "外部动作仍需人工批准"
  ]
};

export function routeUserRequest(text = "") {
  const input = String(text || "").trim();
  const corpus = normalizeText(input);
  const ranked = WORK_MODES.map((mode, index) => ({
    ...mode,
    ...scoreMode(corpus, mode.signals),
    order: index
  })).sort(compareModeScores);

  const candidate = ranked[0];
  const fallback = ranked.find((mode) => mode.id === "decision");
  const primary = candidate.score > 0 ? candidate : fallback;
  const runnerUp = ranked.find((mode) => mode.id !== primary.id && mode.score > 0);
  const secondary = ranked
    .filter((mode) => mode.id !== primary.id && mode.score >= MIN_SECONDARY_SCORE)
    .slice(0, 2);
  const confidence = determineConfidence(primary.score, runnerUp?.score || 0);

  return {
    frontDesk: FRONT_DESK,
    request: input,
    primaryMode: stripInternalFields(primary),
    secondaryModes: secondary.map(stripInternalFields),
    confidence,
    internalRoleIds: [...new Set([primary, ...secondary].flatMap((mode) => mode.roles))],
    clientReply: buildClientReply(input, primary, confidence),
    needsClarification: !input || confidence === "low"
  };
}

export function listWorkModes(options = {}) {
  const internal = Boolean(options.internal);
  return WORK_MODES.map(({ signals, roles, ...mode }) => internal ? { ...mode, roles } : mode);
}

function scoreMode(corpus, signals) {
  let score = 0;
  let strongestMatch = 0;
  let matchedSignalCount = 0;

  for (const [term, weight] of signals) {
    const occurrences = countOccurrences(corpus, normalizeText(term));
    if (occurrences === 0) continue;
    // Repetition is weak additional evidence; one repeated keyword cannot dominate a route.
    score += weight * (1 + Math.min(occurrences - 1, 2) * 0.2);
    strongestMatch = Math.max(strongestMatch, weight);
    matchedSignalCount += 1;
  }

  return {
    score: Math.round(score * 10) / 10,
    strongestMatch,
    matchedSignalCount
  };
}

function compareModeScores(left, right) {
  return right.score - left.score
    || right.strongestMatch - left.strongestMatch
    || right.matchedSignalCount - left.matchedSignalCount
    || left.order - right.order;
}

function determineConfidence(primaryScore, runnerUpScore) {
  if (primaryScore < MIN_CONFIDENT_SCORE) return "low";

  const margin = primaryScore - runnerUpScore;
  if (runnerUpScore > 0 && margin < LOW_CONFIDENCE_MARGIN) {
    // A strong mixed request is actionable, but there is no dominant mode.
    return primaryScore >= STRONG_MIXED_SCORE && runnerUpScore >= STRONG_MIXED_SCORE ? "medium" : "low";
  }
  if (primaryScore >= HIGH_CONFIDENCE_SCORE && margin >= HIGH_CONFIDENCE_MARGIN) return "high";
  return "medium";
}

function buildClientReply(input, mode, confidence) {
  if (!input) return FRONT_DESK.greeting;
  if (confidence === "low") {
    return `我先按“${mode.name}”整理现有信息，但还需要确认这次最优先的结果。你不需要选择员工；我会在后台安排分析、执行和验收。当前处理方向是：${mode.promise}`;
  }
  return `收到，我会按“${mode.name}”处理。${mode.promise} 你只需要继续补充业务资料或确认关键动作，不需要找具体员工。`;
}

function stripInternalFields(mode) {
  const { score, strongestMatch, matchedSignalCount, order, signals, roles, ...publicMode } = mode;
  return publicMode;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let position = 0;
  while ((position = haystack.indexOf(needle, position)) !== -1) {
    count += 1;
    position += needle.length;
  }
  return count;
}
