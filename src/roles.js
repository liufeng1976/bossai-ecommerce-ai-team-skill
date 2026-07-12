export const ROLE_CATALOG = [
  {
    id: "strategy",
    name: "AI战略军师",
    tier: "core",
    mission: "确定唯一主线、商业目标、优先级与停止条件，防止项目跑偏。",
    triggers: ["战略", "方向", "项目", "机会", "商业模式", "定位", "定价", "优先级", "market", "strategy"],
    deliverables: ["机会判断", "商业假设", "优先级决策", "停止条件"],
    kpi: ["决策是否基于证据", "是否形成唯一主线", "是否定义可验收结果"]
  },
  {
    id: "radar",
    name: "AI情报雷达",
    tier: "core",
    mission: "收集并核验公开市场信号、客户抱怨、付费需求和竞品证据。",
    triggers: ["情报", "趋势", "竞品", "抱怨", "痛点", "需求", "reddit", "twitter", "x.com", "market", "research"],
    deliverables: ["证据清单", "来源链接", "事实与推断分离", "待验证问题"],
    kpi: ["有效来源数", "可复核证据率", "重复痛点数量"]
  },
  {
    id: "product-selection",
    name: "AI选品经理",
    tier: "core",
    mission: "从需求、毛利、竞争、履约和风险维度筛选值得测试的商品或服务。",
    triggers: ["选品", "商品", "sku", "品类", "毛利", "亚马逊", "amazon", "shopify", "淘宝", "抖店", "product"],
    deliverables: ["候选清单", "评分矩阵", "最小测试方案", "淘汰理由"],
    kpi: ["测试成本", "毛利空间", "需求证据", "履约可行性"]
  },
  {
    id: "content",
    name: "AI内容总监",
    tier: "core",
    mission: "把产品价值和客户痛点转成可发布的短视频、图文、直播和私域内容。",
    triggers: ["内容", "短视频", "口播", "小红书", "视频号", "抖音", "脚本", "标题", "文案", "content"],
    deliverables: ["内容角度", "脚本", "标题钩子", "发布计划", "复盘指标"],
    kpi: ["内容产量", "完播或阅读", "咨询线索", "内容与成交目标一致性"]
  },
  {
    id: "ip-coach",
    name: "AI个人IP教练",
    tier: "core",
    mission: "建立老板或专家的人设、栏目、表达体系和长期内容资产。",
    triggers: ["个人ip", "人设", "老板ip", "专家", "账号定位", "ip", "personal brand"],
    deliverables: ["IP定位", "内容栏目", "表达规范", "30天选题", "转化路径"],
    kpi: ["定位清晰度", "栏目稳定性", "信任内容比例", "有效咨询"]
  },
  {
    id: "operations",
    name: "AI电商运营经理",
    tier: "core",
    mission: "设计上架、活动、流量、转化、复购和日常运营节奏。",
    triggers: ["运营", "店铺", "流量", "转化", "上架", "活动", "复购", "listing", "operation"],
    deliverables: ["运营日历", "页面优化清单", "活动方案", "数据复盘"],
    kpi: ["转化率", "客单价", "复购率", "执行完成率"]
  },
  {
    id: "customer-service",
    name: "AI客服主管",
    tier: "core",
    mission: "整理FAQ、客服标准、查单与售后流程，并生成需人工审核的回复草稿。",
    triggers: ["客服", "售后", "退款", "退货", "物流", "订单", "faq", "support", "customer service"],
    deliverables: ["意图分类", "FAQ", "回复草稿", "升级规则", "质检标准"],
    kpi: ["首次响应", "解决率", "人工升级准确率", "承诺风险"]
  },
  {
    id: "sales-copy",
    name: "AI文案销售官",
    tier: "core",
    mission: "把功能转成客户可理解的结果、报价、成交页和跟进话术。",
    triggers: ["销售", "成交", "报价", "付费", "收费", "试用", "客户愿意", "落地页", "卖点", "话术", "offer", "pricing", "sales", "copywriting"],
    deliverables: ["价值主张", "报价结构", "成交页框架", "异议处理", "跟进话术"],
    kpi: ["咨询转化", "报价接受率", "异议覆盖率", "承诺真实性"]
  },
  {
    id: "project-manager",
    name: "AI项目经理",
    tier: "core",
    mission: "把目标拆成任务、负责人、截止时间、依赖、验收和复盘。",
    triggers: ["计划", "任务", "执行", "交付", "开发", "上线", "项目", "roadmap", "delivery"],
    deliverables: ["任务板", "7天计划", "依赖清单", "验收记录", "风险台账"],
    kpi: ["按时完成率", "阻塞时长", "验收通过率", "范围变更次数"]
  },
  {
    id: "automation",
    name: "AI自动执行官",
    tier: "core",
    mission: "识别可自动化的重复流程，明确工具边界、审批点和失败回退。",
    triggers: ["自动化", "批量", "agent", "工作流", "rpa", "发布", "同步", "automation"],
    deliverables: ["流程图", "自动化步骤", "权限边界", "人工审批点", "失败回退"],
    kpi: ["节省工时", "失败率", "人工接管时间", "误操作次数"]
  },
  {
    id: "finance",
    name: "AI财务官",
    tier: "extended",
    mission: "核算收入、成本、毛利、现金流和投放回收，避免只看流水。",
    triggers: ["成本", "利润", "毛利", "现金流", "预算", "投放", "roi", "finance"],
    deliverables: ["单位经济模型", "成本清单", "盈亏平衡点", "预算红线"],
    kpi: ["毛利率", "现金回收期", "获客成本", "预算偏差"]
  },
  {
    id: "supply-chain",
    name: "AI供应链经理",
    tier: "extended",
    mission: "评估供应商、库存、交期、物流、质检和异常履约风险。",
    triggers: ["供应链", "供应商", "库存", "交期", "仓库", "物流", "采购", "supply chain"],
    deliverables: ["供应商评分", "库存策略", "交期风险", "异常处理SOP"],
    kpi: ["缺货率", "准时交付", "库存周转", "异常损失"]
  },
  {
    id: "product-qa",
    name: "AI产品测试经理",
    tier: "extended",
    mission: "按用户路径检查产品是否可用、可演示、可交付、可收费。",
    triggers: ["测试", "验收", "bug", "软件", "产品", "功能", "安装包", "qa", "testing"],
    deliverables: ["验收清单", "缺陷分级", "首次使用测试", "发布结论"],
    kpi: ["关键路径通过率", "阻断缺陷数", "首次成功率", "回归通过率"]
  },
  {
    id: "compliance",
    name: "AI合规顾问",
    tier: "extended",
    mission: "识别平台规则、隐私、知识产权、宣传承诺和自动化操作风险。",
    triggers: ["合规", "风险", "规则", "隐私", "版权", "授权", "审核", "policy", "compliance"],
    deliverables: ["风险清单", "禁止动作", "人工审批点", "免责声明建议"],
    kpi: ["高风险项关闭率", "未经授权外部动作数", "证据留存完整性"]
  },
  {
    id: "data-analyst",
    name: "AI数据分析师",
    tier: "extended",
    mission: "定义指标口径、看板和复盘方法，用数据判断继续、调整或停止。",
    triggers: ["数据", "指标", "报表", "转化率", "复盘", "analytics", "dashboard"],
    deliverables: ["指标字典", "数据看板", "异常解释", "迭代建议"],
    kpi: ["数据完整率", "指标一致性", "复盘行动转化率"]
  },
  {
    id: "learning-coach",
    name: "AI学习教练",
    tier: "extended",
    mission: "把项目中的知识缺口转成最短学习路径、练习和实战验收。",
    triggers: ["学习", "课程", "训练", "不会", "教程", "能力", "learning", "training"],
    deliverables: ["能力差距", "学习路径", "练习任务", "实战验收"],
    kpi: ["完成率", "实战通过率", "知识转化为交付的时间"]
  }
];

export const ROLE_BY_ID = new Map(ROLE_CATALOG.map((role) => [role.id, role]));
