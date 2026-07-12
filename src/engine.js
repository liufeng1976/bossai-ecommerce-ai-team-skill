import { ROLE_CATALOG, ROLE_BY_ID } from "./roles.js";
import { FRONT_DESK, routeUserRequest } from "./router.js";

const NOISE_STATUSES = new Set(["noise", "irrelevant", "spam", "ignored", "噪音", "无关"]);
const ALWAYS_ACTIVE = ["strategy", "radar", "project-manager"];
const OUTWARD_ACTION_WORDS = [
  "发布", "发送", "联系客户", "客户消息", "采购", "付款", "投放", "上架", "改价", "退款", "删除",
  "登录", "账号操作", "publish", "send", "message customer", "purchase", "payment", "launch ad", "delete"
];

export function normalizeInput(raw = {}) {
  if (Array.isArray(raw)) raw = { signals: raw };
  const businessRaw = raw.business || raw.business_brief || raw.context || {};
  const business = {
    name: text(businessRaw.name || raw.project_name || raw.name || "未命名电商项目"),
    platforms: list(businessRaw.platforms || businessRaw.platform || raw.platforms),
    customer: text(businessRaw.customer || businessRaw.target_customer || raw.customer || "待明确"),
    goal: text(businessRaw.goal || businessRaw.objective || raw.goal || "找到一项可验证、可交付的电商增长任务"),
    offer: text(businessRaw.offer || businessRaw.product || raw.offer || "待明确"),
    constraints: list(businessRaw.constraints || raw.constraints),
    assets: list(businessRaw.assets || businessRaw.current_assets || raw.assets),
    notes: text(businessRaw.notes || raw.notes || "")
  };

  const candidates = raw.signals || raw.top_opportunities || raw.items || raw.opportunities || [];
  const normalized = (Array.isArray(candidates) ? candidates : [])
    .map((signal, index) => normalizeSignal(signal, index))
    .filter((signal) => !NOISE_STATUSES.has(signal.status.toLowerCase()));

  return {
    business,
    signals: dedupeSignals(normalized),
    metadata: {
      sourceType: raw.top_opportunities ? "bossai-radar-lite" : "generic",
      generatedAt: new Date().toISOString()
    }
  };
}

export function validateInput(raw) {
  const normalized = normalizeInput(raw);
  const errors = [];
  const warnings = [];
  if (!normalized.signals.length) errors.push("至少需要一条 signals、top_opportunities、items 或 opportunities 记录。");
  normalized.signals.forEach((signal, index) => {
    if (!signal.title) errors.push(`第 ${index + 1} 条信号缺少 title。`);
    if (!hasEvidence(signal)) warnings.push(`“${signal.title}”缺少可复核证据，将被转成验证任务，不能视为已验证机会。`);
    if (!signal.source && !signal.url) warnings.push(`“${signal.title}”缺少 source 或 url。`);
  });
  if (normalized.business.customer === "待明确") warnings.push("目标客户尚未明确。策略任务会把客户验证列为第一优先级。");
  if (normalized.business.offer === "待明确") warnings.push("当前产品或服务尚未明确。系统将优先生成最小报价/交付测试。 ");
  return { ok: errors.length === 0, errors, warnings, normalized };
}

export function buildExecutionPack(raw, options = {}) {
  const { ok, errors, warnings, normalized } = validateInput(raw);
  if (!ok) {
    const error = new Error(errors.join(" "));
    error.validationErrors = errors;
    throw error;
  }

  const limit = clamp(Number(options.limit || 5), 1, 10);
  const maxRoles = clamp(Number(options.maxRoles || 8), 3, ROLE_CATALOG.length);
  const rankedSignals = normalized.signals
    .map((signal) => ({ ...signal, score: scoreSignal(signal, normalized.business) }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);

  const activeRoles = chooseRoles(normalized.business, rankedSignals, maxRoles);
  const tasks = buildTasks(normalized.business, rankedSignals, activeRoles);
  const sevenDayPlan = buildSevenDayPlan(tasks, rankedSignals);
  const decision = buildDecision(normalized.business, rankedSignals);
  const routing = routeUserRequest([
    normalized.business.goal,
    normalized.business.offer,
    ...rankedSignals.map((signal) => signal.title)
  ].join(" "));

  return {
    version: "1.1.0",
    generatedAt: new Date().toISOString(),
    interface: {
      mode: "single-front-desk",
      frontDesk: FRONT_DESK,
      primaryWorkMode: routing.primaryMode,
      secondaryWorkModes: routing.secondaryModes,
      customerChoosesEmployee: false,
      internalRolesVisibleByDefault: false
    },
    business: normalized.business,
    decision,
    warnings,
    rankedSignals,
    team: {
      active: activeRoles,
      standby: ROLE_CATALOG.filter((role) => !activeRoles.some((active) => active.id === role.id))
    },
    tasks,
    sevenDayPlan,
    safety: {
      mode: "draft-and-plan-only",
      automaticExternalActions: false,
      humanApprovalRequiredFor: ["发布", "客户消息", "账号操作", "采购付款", "广告投放", "退款删除", "对外承诺"]
    }
  };
}

export function scoreSignal(signal, business) {
  const explicit = normalizeExplicitScore(signal.rawScore);
  const evidence = evidenceScore(signal);
  const fit = fitScore(signal, business);
  const specificity = specificityScore(signal);
  const recency = recencyScore(signal.observedAt);
  const total = explicit == null
    ? Math.round(evidence * 0.4 + fit * 0.3 + specificity * 0.15 + recency * 0.15)
    : Math.round(explicit * 0.45 + evidence * 0.25 + fit * 0.15 + specificity * 0.075 + recency * 0.075);
  return {
    total: clamp(total, 0, 100),
    evidence,
    businessFit: fit,
    specificity,
    recency,
    explicit,
    confidence: hasEvidence(signal) ? (evidence >= 70 ? "high" : "medium") : "low"
  };
}

export function chooseRoles(business, signals, maxRoles = 8) {
  const corpus = [
    business.name,
    business.customer,
    business.goal,
    business.offer,
    ...business.platforms,
    ...business.constraints,
    ...business.assets,
    ...signals.flatMap((signal) => [signal.title, signal.summary, signal.evidence, ...signal.tags])
  ].join(" ").toLowerCase();

  const scored = ROLE_CATALOG.map((role) => ({
    role,
    score: role.triggers.reduce((sum, trigger) => sum + countOccurrences(corpus, trigger.toLowerCase()), 0)
  }));

  if (signals.some((signal) => !hasEvidence(signal))) {
    const radar = scored.find((item) => item.role.id === "radar");
    radar.score += 10;
  }
  if (business.offer === "待明确") {
    scored.find((item) => item.role.id === "sales-copy").score += 4;
    scored.find((item) => item.role.id === "product-selection").score += 4;
  }

  const selectedIds = new Set(ALWAYS_ACTIVE);
  scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.role.id.localeCompare(b.role.id))
    .forEach((item) => {
      if (selectedIds.size < maxRoles) selectedIds.add(item.role.id);
    });

  if (selectedIds.size < Math.min(5, maxRoles)) {
    ["radar", "sales-copy", "operations"].forEach((id) => {
      if (selectedIds.size < maxRoles) selectedIds.add(id);
    });
  }

  return [...selectedIds].map((id) => ROLE_BY_ID.get(id));
}

function buildTasks(business, signals, activeRoles) {
  const tasks = [];
  let sequence = 1;

  for (const signal of signals) {
    if (!hasEvidence(signal)) {
      tasks.push(makeTask(sequence++, signal, ROLE_BY_ID.get("radar"), {
        title: `核验机会：${signal.title}`,
        objective: "找到至少两条可复核的独立证据，再决定是否投入开发或销售。",
        output: `验证记录-${slug(signal.title)}.md`,
        acceptanceCriteria: ["至少2个独立公开来源或3条真实客户记录", "保留来源链接、日期和原始表述", "明确支持证据与反证", "未达到标准时标记为待观察而非已验证"],
        cheapestValidation: "先搜索公开抱怨、招聘/外包需求和付费竞品，再访谈1名目标客户。",
        day: 1
      }));
      continue;
    }

    const matchedRoles = activeRoles
      .filter((role) => !ALWAYS_ACTIVE.includes(role.id))
      .map((role) => ({ role, score: matchRoleToSignal(role, signal) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.role);

    const roles = [ROLE_BY_ID.get("strategy"), ...matchedRoles, ROLE_BY_ID.get("project-manager")];
    const uniqueRoles = [...new Map(roles.map((role) => [role.id, role])).values()];

    for (const role of uniqueRoles) {
      tasks.push(makeRoleTask(sequence++, business, signal, role));
    }
  }

  if (signals.length) {
    const topSignal = signals[0];
    const commonEvidence = {
      source: "BossAI 执行包",
      customerQuote: "",
      observedAt: "",
      tags: ["执行", "验收"]
    };

    if (hasEvidence(topSignal)) {
      tasks.push(makeTask(sequence++, {
        ...topSignal,
        id: "TOP-OPPORTUNITY-EVIDENCE-AUDIT"
      }, ROLE_BY_ID.get("radar"), {
        title: `审计唯一主线证据：${topSignal.title}`,
        objective: "在投入报价、开发或交付前，检查主线证据是否可复核、是否存在反证和替代方案。",
        output: "01-top-opportunity-evidence-audit.md",
        acceptanceCriteria: ["至少核对2个独立来源或3条真实客户记录", "明确事实、推断和未知项", "补充至少1条反证或替代方案", "证据不足时降低置信度并停止扩大投入"],
        cheapestValidation: "先复核现有来源，再补一次目标客户访谈或公开需求检索。",
        day: 1
      }, business));
    }

    const validationRole = activeRoles.find((role) => role.id === "sales-copy")
      || activeRoles.find((role) => role.id === "content")
      || ROLE_BY_ID.get("strategy");
    tasks.push(makeTask(sequence++, {
      id: "VALIDATION-ASSETS",
      title: `唯一主线验证材料：${topSignal.title}`,
      summary: "把唯一主线转成可向目标客户展示的清晰方案和验证材料。",
      evidence: topSignal.evidence || "以已核验的主线证据为准。",
      observedCount: 1,
      ...commonEvidence
    }, validationRole, {
      title: "制作第4天验证材料包",
      objective: "生成客户能看懂、能反馈、能询价的验证材料，但不自动发布或发送。",
      output: "04-validation-assets.md",
      acceptanceCriteria: ["包含一句话价值主张和明确目标客户", "包含3个痛点角度或使用场景", "包含试单范围、下一步和反馈问题", "不得虚构案例、数据、收益或客户背书"],
      cheapestValidation: "由人审核后，选择3名真实目标客户进行一对一展示并记录反馈。",
      day: 4
    }, business));

    const pilotRole = activeRoles.find((role) => role.id === "product-qa")
      || activeRoles.find((role) => role.id === "automation")
      || activeRoles.find((role) => role.id === "operations")
      || ROLE_BY_ID.get("project-manager");
    tasks.push(makeTask(sequence++, {
      id: "CONTROLLED-PILOT",
      title: `唯一主线受控试跑：${topSignal.title}`,
      summary: "使用测试数据、历史样本或人工审核跑通一次最小交付闭环。",
      evidence: "以第1至5天通过验收的材料为输入。",
      observedCount: 1,
      ...commonEvidence
    }, pilotRole, {
      title: "完成第6天受控试跑",
      objective: "验证从输入、处理、人工审核到交付结果的关键路径是否真实可用。",
      output: "06-controlled-pilot.md",
      acceptanceCriteria: ["使用测试数据、历史样本或明确授权的小范围真实数据", "记录输入、步骤、输出、耗时和异常", "所有外部发送、账号写入、采购付款保持人工审批", "失败项必须记录原因和回退，不得改写为已完成"],
      cheapestValidation: "先用1个样本端到端跑通，再决定是否扩大到5个样本。",
      day: 6
    }, business));

    tasks.push(makeTask(sequence++, {
      id: "PORTFOLIO-REVIEW",
      title: "本轮机会组合复盘",
      summary: `复盘 ${signals.length} 个候选机会及其7天执行结果。`,
      evidence: "以任务完成记录、客户反馈、成本数据和验收结果为准。",
      observedCount: signals.length,
      ...commonEvidence,
      tags: ["复盘", "决策"]
    }, ROLE_BY_ID.get("project-manager"), {
      title: "第7天复盘并作出继续/调整/暂停/放弃决定",
      objective: "根据真实证据收口本轮工作，不以“还可以继续优化”为理由无限延期。",
      output: "07-final-decision.md",
      acceptanceCriteria: ["逐项核对任务和验收结果", "记录客户反馈、成本、风险和反证", "对唯一主线作出四选一结论", "明确下一周期唯一目标或停止原因"],
      cheapestValidation: "召开一次30分钟人工复盘，只接受可复核文件、数据、客户反馈和测试结果。",
      day: 7
    }, business));
  }

  return tasks;
}

function makeRoleTask(sequence, business, signal, role) {
  const definitions = {
    strategy: {
      title: `判断是否推进：${signal.title}`,
      objective: "形成继续、调整、暂缓或放弃的证据化结论。",
      output: `机会决策-${slug(signal.title)}.md`,
      criteria: ["明确目标客户和付费场景", "列出事实、推断与未知项", "给出最小验证成本", "定义继续与停止条件"],
      validation: "用一个可报价的最小交付向3名目标客户验证，而不是先开发完整系统。",
      day: 2
    },
    radar: {
      title: `补强市场证据：${signal.title}`,
      objective: "补充需求频次、付费证据、竞品和反证。",
      output: `市场证据-${slug(signal.title)}.md`,
      criteria: ["至少3条可复核来源", "包含至少1条付费或采购证据", "包含至少1条反证或替代方案", "来源与结论一一对应"],
      validation: "从公开评论、招聘外包、竞品定价和用户访谈中交叉验证。",
      day: 1
    },
    "product-selection": {
      title: `设计最小选品测试：${signal.title}`,
      objective: "筛出一个低成本、可履约、可快速得到真实反馈的测试对象。",
      output: `选品评分-${slug(signal.title)}.md`,
      criteria: ["至少3个候选并量化评分", "包含需求、毛利、竞争、履约、合规", "明确淘汰理由", "首轮测试预算可控"],
      validation: "先用少量SKU、预售、询价或人工服务验证，不大规模备货。",
      day: 3
    },
    content: {
      title: `制作验证型内容包：${signal.title}`,
      objective: "用内容测试客户是否愿意停留、咨询或留下需求。",
      output: `内容验证包-${slug(signal.title)}.md`,
      criteria: ["3个不同痛点角度", "每条包含标题、钩子、正文、行动指令", "不虚构数据或客户案例", "定义咨询或留资指标"],
      validation: "先发布或私测3条内容草稿，人工审核后再对外发布。",
      day: 4
    },
    "ip-coach": {
      title: `建立IP表达角度：${signal.title}`,
      objective: "让老板或专家围绕该机会形成可信、连续、可成交的表达。",
      output: `IP栏目-${slug(signal.title)}.md`,
      criteria: ["一句话定位", "3个稳定栏目", "7天选题", "专业证据和个人经历不混淆"],
      validation: "先录制1条60秒口播并向目标客户收集理解度反馈。",
      day: 4
    },
    operations: {
      title: `建立运营试跑SOP：${signal.title}`,
      objective: "把机会转成可重复执行的上架、获客、转化和复盘流程。",
      output: `运营SOP-${slug(signal.title)}.md`,
      criteria: ["输入、步骤、负责人、输出清晰", "定义每日指标", "包含异常处理", "不依赖未经授权的账号自动化"],
      validation: "人工跑通一次完整流程并记录耗时、卡点和结果。",
      day: 5
    },
    "customer-service": {
      title: `建立客户问答与风险升级规则：${signal.title}`,
      objective: "准备售前、查单、物流、退款和异议处理草稿。",
      output: `客服知识包-${slug(signal.title)}.md`,
      criteria: ["至少10个真实高频问题", "每条回复注明可承诺与不可承诺", "高风险问题必须人工升级", "不得自动发送客户消息"],
      validation: "用5段历史或模拟对话进行人工质检。",
      day: 5
    },
    "sales-copy": {
      title: `形成最小可报价方案：${signal.title}`,
      objective: "把机会包装成客户能理解、能比较、能付费测试的具体结果。",
      output: `报价与成交页-${slug(signal.title)}.md`,
      criteria: ["客户、问题、结果、范围、价格逻辑清晰", "明确不包含内容", "不承诺无法证明的收益", "包含低风险试单方案"],
      validation: "向3名目标客户人工展示报价，记录接受、拒绝和异议。",
      day: 3
    },
    "project-manager": {
      title: `组织7天闭环：${signal.title}`,
      objective: "把证据、报价、内容、交付和复盘串成一个可验收的小闭环。",
      output: `项目任务板-${slug(signal.title)}.json`,
      criteria: ["每项任务只有一个负责人", "每项任务有截止时间和验收标准", "依赖和阻塞可见", "第7天必须做继续/停止决策"],
      validation: "每天收口一次任务状态，未完成项必须说明阻塞而非改成已完成。",
      day: 2
    },
    automation: {
      title: `识别安全自动化点：${signal.title}`,
      objective: "只自动化重复、低风险、可回退步骤，所有外部动作保留人工审批。",
      output: `自动化边界-${slug(signal.title)}.md`,
      criteria: ["区分读取、草拟、写入和外部动作", "列出人工审批点", "提供失败回退", "不自动登录、发布、付款、退款或删除"],
      validation: "先在测试数据或副本中跑通，保留日志并人工核对结果。",
      day: 6
    },
    finance: {
      title: `核算单位经济模型：${signal.title}`,
      objective: "确认收入是否覆盖模型、人工、渠道、履约和售后成本。",
      output: `单位经济模型-${slug(signal.title)}.md`,
      criteria: ["成本项不遗漏", "给出保守/基准/乐观三档", "计算盈亏平衡点", "设置预算红线"],
      validation: "用真实供应商报价、API账单或人工工时替代拍脑袋估算。",
      day: 3
    },
    "supply-chain": {
      title: `验证履约与供应风险：${signal.title}`,
      objective: "确认供应、库存、交期、物流和异常处理能够支撑试卖。",
      output: `供应链风险-${slug(signal.title)}.md`,
      criteria: ["至少2个供应方案", "明确交期与成本", "列出缺货和退货预案", "关键数据来自真实询价"],
      validation: "先询价和小单验证，不进行大额采购。",
      day: 3
    },
    "product-qa": {
      title: `建立可卖版本验收：${signal.title}`,
      objective: "检查关键路径是否真实可用，不允许假按钮、空页面或未说明的演示数据。",
      output: `产品验收-${slug(signal.title)}.md`,
      criteria: ["首次使用路径可完成", "关键功能有真实输出", "错误有清晰提示", "达到可演示、可试卖、可交付标准"],
      validation: "由未参与开发的人按验收清单独立操作一次。",
      day: 6
    },
    compliance: {
      title: `检查平台与商业合规：${signal.title}`,
      objective: "识别平台规则、隐私、版权、宣传承诺和自动化操作风险。",
      output: `合规检查-${slug(signal.title)}.md`,
      criteria: ["列出高/中/低风险", "每个高风险有处理措施", "对外内容不冒用案例和数据", "商业使用遵守授权条款"],
      validation: "对照实际目标平台规则并由人工确认高风险动作。",
      day: 5
    },
    "data-analyst": {
      title: `定义验证指标：${signal.title}`,
      objective: "用少量关键指标判断需求、获客、成交和交付是否成立。",
      output: `指标字典-${slug(signal.title)}.md`,
      criteria: ["指标有口径和数据源", "区分过程指标和结果指标", "设置继续/调整/停止阈值", "不把演示数据当真实结果"],
      validation: "先手工记录一轮，确认指标可采集再自动化。",
      day: 2
    },
    "learning-coach": {
      title: `补齐执行能力：${signal.title}`,
      objective: "只学习完成当前闭环所需的最小知识，不做泛泛学习。",
      output: `最短学习路径-${slug(signal.title)}.md`,
      criteria: ["能力缺口具体", "每项学习有实战作业", "24小时内能产出项目交付物", "以验收结果而非观看时长判断掌握"],
      validation: "完成一个真实交付物并由项目经理验收。",
      day: 2
    }
  };

  const definition = definitions[role.id] || definitions["project-manager"];
  return makeTask(sequence, signal, role, {
    title: definition.title,
    objective: definition.objective,
    output: definition.output,
    acceptanceCriteria: definition.criteria,
    cheapestValidation: definition.validation,
    day: definition.day
  }, business);
}

function makeTask(sequence, signal, role, definition, business = {}) {
  const evidence = compact([
    signal.source ? `来源：${signal.source}` : "",
    signal.url ? `链接：${signal.url}` : "",
    signal.evidence ? `证据：${signal.evidence}` : "",
    signal.customerQuote ? `客户原话：${signal.customerQuote}` : "",
    signal.observedCount ? `观察次数：${signal.observedCount}` : ""
  ]);
  const approvalGate = requiresHumanApproval(`${definition.title} ${definition.objective} ${definition.output}`)
    ? "任何对外发布、发送、账号操作、付款、退款、删除或承诺之前，必须由人确认。"
    : "交付物由人验收后才能进入下一阶段；本 Skill 不自动执行外部动作。";

  return {
    id: `TASK-${String(sequence).padStart(3, "0")}`,
    signalId: signal.id,
    roleId: role.id,
    roleName: role.name,
    title: definition.title,
    objective: definition.objective,
    facts: compact([signal.title, signal.summary, ...evidence]),
    inference: `基于现有证据，${role.name}可能有必要参与；该判断必须通过最小验证确认。`,
    output: definition.output,
    acceptanceCriteria: definition.acceptanceCriteria,
    cheapestValidation: definition.cheapestValidation,
    approvalGate,
    status: "todo",
    plannedDay: definition.day,
    businessGoal: business.goal || ""
  };
}

function buildSevenDayPlan(tasks, signals) {
  const themes = {
    1: "证据核验：确认真实痛点、付费信号与反证",
    2: "战略收口：确定唯一主线、客户、指标和停止条件",
    3: "最小产品与报价：形成可交付、可报价的试单方案",
    4: "内容与获客：制作验证型内容和销售材料",
    5: "运营与客服：建立交付、FAQ、风险与异常SOP",
    6: "受控试跑：在测试数据或人工审核下跑通闭环",
    7: "复盘决策：根据证据决定继续、调整、暂停或放弃"
  };

  return Object.entries(themes).map(([dayText, theme]) => {
    const day = Number(dayText);
    const dayTasks = tasks.filter((task) => task.plannedDay === day);
    return {
      day,
      theme,
      taskIds: dayTasks.map((task) => task.id),
      outputs: [...new Set(dayTasks.map((task) => task.output))],
      gate: day === 6
        ? "只允许受控测试；对外发布、客户发送、账号写入、采购付款必须人工批准。"
        : day === 7
          ? `必须对 ${signals.length} 个候选机会逐一作出继续/调整/暂停/放弃结论。`
          : "当日交付物通过人工验收后进入下一天。"
    };
  });
}

function buildDecision(business, signals) {
  const top = signals[0];
  return {
    selectedOpportunity: top?.title || "暂无",
    reason: top
      ? `综合评分 ${top.score.total}/100；证据置信度为 ${top.score.confidence}；与“${business.goal}”的匹配度为 ${top.score.businessFit}/100。`
      : "暂无可评估机会。",
    recommendedMode: top?.score.confidence === "low" ? "先验证，不开发完整产品" : "先完成7天最小成交/交付闭环",
    stopConditions: [
      "无法找到至少2个独立需求证据",
      "3名目标客户均不愿试用、询价或提供进一步反馈",
      "单位经济模型在保守情景下无法成立",
      "关键平台、履约或合规风险无法通过人工控制"
    ]
  };
}

function normalizeSignal(signal, index) {
  if (typeof signal === "string") signal = { title: signal };
  return {
    id: text(signal.id || signal.signal_id || `SIG-${String(index + 1).padStart(3, "0")}`),
    title: text(signal.title || signal.name || signal.opportunity || ""),
    summary: text(signal.summary || signal.description || signal.problem || signal.content || ""),
    source: text(signal.source || signal.source_name || signal.platform || ""),
    url: text(signal.url || signal.source_url || signal.link || ""),
    evidence: text(signal.evidence || signal.quote || signal.proof || signal.reason || ""),
    customerQuote: text(signal.customer_quote || signal.customerQuote || ""),
    observedCount: numberOrNull(signal.observed_count || signal.count || signal.frequency),
    observedAt: text(signal.observed_at || signal.date || signal.published_at || ""),
    tags: list(signal.tags || signal.keywords || signal.categories),
    status: text(signal.status || signal.label || "candidate"),
    rawScore: signal.score ?? signal.priority_score ?? signal.opportunity_score ?? null
  };
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = signal.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasEvidence(signal) {
  return Boolean(signal.url || signal.evidence || signal.customerQuote || signal.observedCount);
}

function evidenceScore(signal) {
  let score = 0;
  if (signal.url) score += 25;
  if (signal.source) score += 15;
  if (signal.evidence) score += 25;
  if (signal.customerQuote) score += 20;
  if (signal.observedCount) score += Math.min(15, 5 + Math.log10(Math.max(1, signal.observedCount)) * 5);
  return clamp(Math.round(score), 0, 100);
}

function fitScore(signal, business) {
  const businessText = [business.name, business.customer, business.goal, business.offer, ...business.platforms].join(" ").toLowerCase();
  const signalText = [signal.title, signal.summary, signal.evidence, ...signal.tags].join(" ").toLowerCase();
  const businessWords = tokenize(businessText);
  const signalWords = tokenize(signalText);
  if (!businessWords.size || !signalWords.size) return 50;

  let lexicalMatches = 0;
  for (const word of businessWords) if (signalWords.has(word)) lexicalMatches += 1;
  const lexicalScore = (lexicalMatches / Math.max(1, businessWords.size)) * 50;

  const domainTerms = [
    "amazon", "shopify", "淘宝", "天猫", "抖音", "抖店", "客服", "订单", "物流", "退款", "退货", "faq",
    "选品", "商品", "内容", "短视频", "个人ip", "运营", "转化", "获客", "报价", "付费", "试用", "供应链", "自动化"
  ];
  const sharedDomainTerms = domainTerms.filter((term) => businessText.includes(term) && signalText.includes(term)).length;
  const domainScore = Math.min(40, sharedDomainTerms * 10);

  return clamp(Math.round(30 + lexicalScore + domainScore), 0, 100);
}

function specificityScore(signal) {
  let score = 20;
  if (signal.title.length >= 8) score += 15;
  if (signal.summary.length >= 30) score += 25;
  if (signal.tags.length) score += 10;
  if (signal.observedCount) score += 15;
  if (/\d/.test(`${signal.title} ${signal.summary} ${signal.evidence}`)) score += 15;
  return clamp(score, 0, 100);
}

function recencyScore(value) {
  if (!value) return 50;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 50;
  const days = Math.max(0, (Date.now() - timestamp) / 86400000);
  if (days <= 7) return 100;
  if (days <= 30) return 85;
  if (days <= 90) return 65;
  if (days <= 365) return 45;
  return 25;
}

function normalizeExplicitScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score <= 1) return clamp(Math.round(score * 100), 0, 100);
  if (score <= 10) return clamp(Math.round(score * 10), 0, 100);
  return clamp(Math.round(score), 0, 100);
}

function matchRoleToSignal(role, signal) {
  const corpus = `${signal.title} ${signal.summary} ${signal.evidence} ${signal.tags.join(" ")}`.toLowerCase();
  return role.triggers.reduce((sum, trigger) => sum + countOccurrences(corpus, trigger.toLowerCase()), 0);
}

function requiresHumanApproval(textValue) {
  const corpus = textValue.toLowerCase();
  return OUTWARD_ACTION_WORDS.some((word) => corpus.includes(word.toLowerCase()));
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

function tokenize(value) {
  const tokens = String(value || "").toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g) || [];
  return new Set(tokens.filter((token) => !new Set(["这个", "一个", "我们", "可以", "进行", "需要", "用户", "项目", "产品", "the", "and", "for", "with"]).has(token)));
}

function slug(value) {
  return String(value || "task")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[,，;；\n]/).map(text).filter(Boolean);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compact(values) {
  return values.flat().filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
