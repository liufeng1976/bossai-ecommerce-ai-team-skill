const WORK_MODES = [
  {
    id: "decision",
    name: "方向与决策",
    promise: "帮你判断先做什么、暂停什么、怎么验证，避免继续乱开发。",
    triggers: ["方向", "战略", "项目", "优先级", "继续", "暂停", "放弃", "值不值得", "怎么选", "商业模式", "定位", "定价"],
    roles: ["strategy", "radar", "finance", "project-manager"]
  },
  {
    id: "content",
    name: "内容与个人IP",
    promise: "帮你做定位、选题、口播、图文和发布前检查。",
    triggers: ["内容", "短视频", "口播", "小红书", "视频号", "抖音", "脚本", "标题", "文案", "个人ip", "人设", "账号定位"],
    roles: ["content", "ip-coach", "sales-copy", "compliance"]
  },
  {
    id: "customer-service",
    name: "客服与售后",
    promise: "帮你分析客户问题、生成回复草稿、整理FAQ并标出风险。",
    triggers: ["客服", "售后", "退款", "退货", "物流", "订单", "查单", "faq", "回复", "投诉", "客户消息"],
    roles: ["customer-service", "compliance", "operations", "data-analyst"]
  },
  {
    id: "sales",
    name: "销售与成交",
    promise: "帮你整理卖点、报价、成交页、异议处理和跟进话术。",
    triggers: ["销售", "成交", "报价", "卖点", "落地页", "咨询", "客户", "跟进", "异议", "收费", "付费", "试单"],
    roles: ["sales-copy", "strategy", "content", "finance"]
  },
  {
    id: "operations",
    name: "选品与运营",
    promise: "帮你做选品判断、运营计划、上架流程、供应链和数据复盘。",
    triggers: ["选品", "商品", "sku", "运营", "店铺", "流量", "转化", "上架", "活动", "复购", "亚马逊", "amazon", "shopify", "淘宝", "抖店", "供应链", "库存"],
    roles: ["product-selection", "operations", "supply-chain", "data-analyst", "finance"]
  },
  {
    id: "delivery",
    name: "开发与交付",
    promise: "帮你拆任务、检查产品、跑验收、找Bug并判断能否上线试卖。",
    triggers: ["开发", "代码", "软件", "产品", "功能", "测试", "验收", "bug", "安装包", "上线", "交付", "项目管理", "自动化", "工作流"],
    roles: ["project-manager", "product-qa", "automation", "compliance"]
  }
];

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
  const corpus = input.toLowerCase();
  const ranked = WORK_MODES.map((mode) => ({
    ...mode,
    score: mode.triggers.reduce((sum, trigger) => sum + countOccurrences(corpus, trigger.toLowerCase()), 0)
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const primary = ranked[0].score > 0 ? ranked[0] : WORK_MODES.find((mode) => mode.id === "decision");
  const secondary = ranked.filter((mode) => mode.id !== primary.id && mode.score > 0).slice(0, 2);
  const confidence = primary.score >= 3 ? "high" : primary.score >= 1 ? "medium" : "low";

  return {
    frontDesk: FRONT_DESK,
    request: input,
    primaryMode: stripScore(primary),
    secondaryModes: secondary.map(stripScore),
    confidence,
    internalRoleIds: [...new Set([primary, ...secondary].flatMap((mode) => mode.roles))],
    clientReply: buildClientReply(input, primary, confidence),
    needsClarification: !input || confidence === "low"
  };
}

export function listWorkModes(options = {}) {
  const internal = Boolean(options.internal);
  return WORK_MODES.map(({ triggers, roles, ...mode }) => internal ? { ...mode, roles } : mode);
}

function buildClientReply(input, mode, confidence) {
  if (!input) return FRONT_DESK.greeting;
  if (confidence === "low") {
    return `我先按“${mode.name}”来处理。你不需要选择员工；我会在后台安排分析、执行和验收。当前目标是：${mode.promise}`;
  }
  return `收到，我会按“${mode.name}”处理。${mode.promise} 你只需要继续补充业务资料或确认关键动作，不需要找具体员工。`;
}

function stripScore(mode) {
  const { score, triggers, roles, ...publicMode } = mode;
  return publicMode;
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
