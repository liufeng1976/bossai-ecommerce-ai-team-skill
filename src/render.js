import path from "node:path";
import { writeJson, writeText } from "./io.js";

export async function writeExecutionPack(pack, outputDir) {
  const root = path.resolve(outputDir);
  const files = [];

  await emit("00-start-here.md", renderStartHere(pack));
  await emit("00-executive-brief.md", renderExecutiveBrief(pack));
  await emit("01-business-brief.md", renderBusinessBrief(pack));
  await emit("02-opportunity-ranking.md", renderOpportunityRanking(pack));
  await emit("03-work-routing.md", renderClientRouting(pack));
  await emit("04-seven-day-plan.md", renderSevenDayPlan(pack));
  await emit("05-task-board.md", renderTaskBoard(pack));
  await writeJson(path.join(root, "task-board.json"), pack.tasks);
  files.push("task-board.json");
  await writeJson(path.join(root, "execution-pack.json"), pack);
  files.push("execution-pack.json");

  await emit(path.join("internal", "team-roster.md"), renderTeamRoster(pack));

  for (const role of pack.team.active) {
    const roleTasks = pack.tasks.filter((task) => task.roleId === role.id);
    await emit(path.join("internal", "role-cards", `${role.id}.md`), renderRoleCard(role, roleTasks));
  }

  const manifest = {
    name: "BossAI 电商AI员工军团执行包",
    version: pack.version,
    generatedAt: pack.generatedAt,
    selectedOpportunity: pack.decision.selectedOpportunity,
    fileCount: files.length + 1,
    files: [...files, "manifest.json"],
    safetyMode: pack.safety.mode
  };
  await writeJson(path.join(root, "manifest.json"), manifest);
  return { root, files: manifest.files };

  async function emit(relativePath, content) {
    await writeText(path.join(root, relativePath), content);
    files.push(relativePath.replaceAll("\\", "/"));
  }
}

export function renderStartHere(pack) {
  const mode = pack.interface.primaryWorkMode;
  return `# 从这里开始｜只和 BossAI 电商总管对话

## 你不需要选择员工

直接告诉 **BossAI 电商总管** 你现在遇到的问题，例如：

- 我的项目太多，不知道先做哪个；
- 帮我写一条产品口播；
- 这段客服回复有没有风险；
- 帮我做报价和成交话术；
- 这个产品能不能上线试卖；
- 帮我分析店铺、选品或运营问题。

总管会自动判断问题、安排后台岗位、合并结果并统一回复。客户不进入后台员工之间切换。

## 本轮自动识别

- **工作模式：** ${mode.name}
- **处理目标：** ${mode.promise}
- **唯一主线：** ${pack.decision.selectedOpportunity}
- **下一步：** ${pack.decision.recommendedMode}

## 客户只需要做什么

1. 描述问题和希望得到的结果；
2. 提供现有资料、对话、数据、产品或项目文件；
3. 对发布、发送、账号操作、付款、退款和删除等外部动作进行人工确认。

## 系统内部怎么工作

后台会自动调用需要的岗位完成分析、草拟、执行计划和验收。内部岗位默认不展示，除非需要解释责任、风险或交付来源。
`;
}

export function renderExecutiveBrief(pack) {
  const top = pack.rankedSignals[0];
  return `# BossAI 电商总管｜老板执行简报

## 当前处理模式

**${pack.interface.primaryWorkMode.name}**：${pack.interface.primaryWorkMode.promise}

客户只和 BossAI 电商总管对话，后台员工由系统自动安排。

## 本轮唯一主线

**${pack.decision.selectedOpportunity}**

${pack.decision.reason}

建议模式：**${pack.decision.recommendedMode}**

## 为什么现在做

${top ? `- 综合评分：${top.score.total}/100
- 证据强度：${top.score.evidence}/100
- 商业匹配：${top.score.businessFit}/100
- 置信度：${top.score.confidence}` : "- 暂无可评估信号"}

## 本周必须交付

- 完成证据核验，不把推断当事实；
- 形成一个可报价、可人工交付的最小方案；
- 由动态组建的 AI 员工完成任务草稿与验收材料；
- 所有对外发布、发送、账号操作、付款、退款、删除和承诺都由人批准；
- 第7天作出继续、调整、暂停或放弃决定。

## 停止条件

${pack.decision.stopConditions.map((item) => `- ${item}`).join("\n")}

## 风险提醒

${pack.warnings.length ? pack.warnings.map((item) => `- ${item}`).join("\n") : "- 当前输入未发现结构性警告，但仍需人工核验事实。"}
`;
}

export function renderBusinessBrief(pack) {
  const business = pack.business;
  return `# 业务简报

| 项目字段 | 内容 |
|---|---|
| 项目名称 | ${escapeCell(business.name)} |
| 平台 | ${escapeCell(business.platforms.join("、") || "待明确")} |
| 目标客户 | ${escapeCell(business.customer)} |
| 当前产品/服务 | ${escapeCell(business.offer)} |
| 本轮目标 | ${escapeCell(business.goal)} |
| 现有资产 | ${escapeCell(business.assets.join("、") || "未提供")} |
| 约束 | ${escapeCell(business.constraints.join("、") || "未提供")} |

## 补充说明

${business.notes || "无。"}
`;
}

export function renderOpportunityRanking(pack) {
  return `# 机会排序

| 排名 | 机会 | 总分 | 证据 | 匹配 | 具体度 | 时效 | 置信度 |
|---:|---|---:|---:|---:|---:|---:|---|
${pack.rankedSignals.map((signal, index) => `| ${index + 1} | ${escapeCell(signal.title)} | ${signal.score.total} | ${signal.score.evidence} | ${signal.score.businessFit} | ${signal.score.specificity} | ${signal.score.recency} | ${signal.score.confidence} |`).join("\n")}

${pack.rankedSignals.map((signal, index) => `## ${index + 1}. ${signal.title}

- **事实摘要：** ${signal.summary || "未提供"}
- **来源：** ${signal.source || "未提供"}
- **链接：** ${signal.url || "未提供"}
- **证据：** ${signal.evidence || signal.customerQuote || "缺少证据，必须先验证"}
- **评分说明：** 总分 ${signal.score.total}/100，置信度 ${signal.score.confidence}。
`).join("\n")}
`;
}

export function renderClientRouting(pack) {
  const primary = pack.interface.primaryWorkMode;
  const secondary = pack.interface.secondaryWorkModes;
  return `# BossAI 电商总管｜工作分流

## 客户入口

客户只需要对 BossAI 电商总管说出问题，不需要选择员工或切换角色。

## 本轮处理方式

- **主工作模式：** ${primary.name}
- **处理承诺：** ${primary.promise}
${secondary.length ? `- **辅助模式：** ${secondary.map((mode) => mode.name).join("、")}` : "- **辅助模式：** 暂无"}
- **统一交付：** 总管合并后台分析、草稿、执行计划和验收结果后统一回复。

## 使用示例

- “我现在项目太多，帮我决定先做什么。”
- “把这个产品做成7天内容计划。”
- “检查这批客服对话并生成安全回复。”
- “帮我做一个可试卖的报价方案。”
- “检查这个软件能不能交付客户。”

客户不需要知道哪个岗位负责；系统只有在说明风险、责任和验收来源时，才显示后台岗位名称。
`;
}

export function renderTeamRoster(pack) {
  return `# 内部文件｜AI员工后台编制

> 本文件供 BossAI 电商总管和执行 Agent 使用，不是客户选择员工的菜单。

## 本轮后台上岗员工

| 岗位 | 层级 | 本轮使命 | KPI |
|---|---|---|---|
${pack.team.active.map((role) => `| ${role.name} | ${role.tier === "core" ? "核心" : "扩展"} | ${escapeCell(role.mission)} | ${escapeCell(role.kpi.join("、"))} |`).join("\n")}

## 待命员工

${pack.team.standby.map((role) => `- **${role.name}**：${role.mission}`).join("\n")}

## 组队原则

- AI战略军师和AI项目经理默认上岗；
- 其他员工按信号内容和业务目标动态加入；
- 没有真实工作就不安排岗位，避免“角色很多、没有交付”；
- 每个岗位必须对应明确输出、验收标准和最小验证；
- 本 Skill 只规划、分析和生成草稿，不自动执行外部商业动作。
`;
}

export function renderSevenDayPlan(pack) {
  return `# 7天执行计划

${pack.sevenDayPlan.map((day) => `## 第${day.day}天｜${day.theme}

**任务：** ${day.taskIds.length ? day.taskIds.join("、") : "无自动生成任务；由项目经理补充人工复盘任务"}

**交付物：** ${day.outputs.length ? day.outputs.join("、") : "当日复盘记录"}

**验收闸门：** ${day.gate}
`).join("\n")}
`;
}

export function renderTaskBoard(pack) {
  return `# 任务板

${pack.tasks.map((task) => `## ${task.id}｜${task.title}

- **负责人：** ${task.roleName}
- **计划日：** 第${task.plannedDay}天
- **目标：** ${task.objective}
- **事实：** ${task.facts.join("；") || "无"}
- **推断：** ${task.inference}
- **交付物：** ${task.output}
- **最低成本验证：** ${task.cheapestValidation}
- **人工审批：** ${task.approvalGate}
- **状态：** ${task.status}

**验收标准**

${task.acceptanceCriteria.map((item) => `- [ ] ${item}`).join("\n")}
`).join("\n")}
`;
}

export function renderRoleCard(role, tasks = []) {
  return `# ${role.name}｜岗位卡

## 岗位使命

${role.mission}

## 标准交付物

${role.deliverables.map((item) => `- ${item}`).join("\n")}

## KPI

${role.kpi.map((item) => `- ${item}`).join("\n")}

## 本轮任务

${tasks.length ? tasks.map((task) => `### ${task.id}｜${task.title}

- 输出：${task.output}
- 最小验证：${task.cheapestValidation}
- 人工审批：${task.approvalGate}
`).join("\n") : "本轮待命，无强行安排任务。"}
`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}
