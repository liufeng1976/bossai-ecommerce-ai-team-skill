import path from "node:path";
import { readFile, readdir, rm } from "node:fs/promises";
import { writeJson, writeText } from "./io.js";

const EXECUTION_PACK_NAME = "BossAI 电商AI员工军团执行包";

export async function cleanExecutionPackOutput(outputDir) {
  const root = path.resolve(outputDir);
  if (root === path.parse(root).root) {
    throw new Error("拒绝清理文件系统根目录。");
  }

  let entries;
  try {
    entries = await readdir(root);
  } catch (error) {
    if (error?.code === "ENOENT") return { root, cleaned: false };
    throw error;
  }

  if (entries.length === 0) return { root, cleaned: false };

  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  } catch {
    throw new Error(`拒绝清理非空目录：${root}。未找到可验证的 BossAI 执行包清单。`);
  }

  const isBossAiPack = manifest?.name === EXECUTION_PACK_NAME
    && manifest?.safetyMode === "draft-and-plan-only"
    && Array.isArray(manifest?.files)
    && manifest.files.includes("manifest.json");
  if (!isBossAiPack) {
    throw new Error(`拒绝清理非空目录：${root}。manifest.json 不是有效的 BossAI 执行包清单。`);
  }

  await rm(root, { recursive: true, force: true });
  return { root, cleaned: true };
}

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
  if (pack.productLaunch) {
    await emit("06-product-launch-plan.md", renderProductLaunchPlan(pack));
    await writeJson(path.join(root, "product-profile.json"), pack.productLaunch.productProfile);
    files.push("product-profile.json");
    await writeJson(path.join(root, "asset-plan.json"), pack.productLaunch.assetPlan);
    files.push("asset-plan.json");
    await writeJson(path.join(root, "experiment-plan.json"), pack.productLaunch.experimentPlan);
    files.push("experiment-plan.json");
    await writeJson(path.join(root, "product-launch-mission.json"), pack.productLaunch.missionDraft);
    files.push("product-launch-mission.json");
  }
  await writeJson(path.join(root, "execution-pack.json"), pack);
  files.push("execution-pack.json");

  await emit(path.join("internal", "team-roster.md"), renderTeamRoster(pack));

  for (const role of pack.team.active) {
    const roleTasks = pack.tasks.filter((task) => task.roleId === role.id);
    await emit(path.join("internal", "role-cards", `${role.id}.md`), renderRoleCard(role, roleTasks));
  }

  const manifest = {
    name: EXECUTION_PACK_NAME,
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
- 帮我分析店铺、选品或运营问题；
- 我给你一张商品白底图，帮我把这个商品上新并做成整套电商素材。

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
  if (pack.productLaunch) return renderProductLaunchExecutiveBrief(pack);
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
  if (pack.productLaunch) {
    return `# 商品上新｜事实、假设与证据边界

本轮是用户明确发起的商品上新任务，不把“已有商品”误写成“市场需求已验证”。

## 已知事实

${pack.productLaunch.productProfile.knownFacts.length ? pack.productLaunch.productProfile.knownFacts.map((item) => `- ${item}`).join("\n") : "- 暂无可确认商品事实；先从用户提供资产中识别并人工确认。"}

## 待确认

${pack.productLaunch.productProfile.unknowns.map((item) => `- ${item}`).join("\n")}

## 事实纪律

- 市场、受众、痛点、竞品差异和收益承诺没有证据时只能作为假设；
- 商品结构、规格、材质、认证、接口和配件不得由模型自行补全；
- 情报任务负责补证据，不能把内部推断改写成“已验证”。
`;
  }
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

export function renderProductLaunchPlan(pack) {
  const launch = pack.productLaunch;
  const profile = launch.productProfile;
  const assetPlan = launch.assetPlan;
  const mission = launch.missionDraft;
  const contractRows = [
    ["intelligence", "intelligence"],
    ["sales-positioning", "salesPositioning"],
    ["content", "content"],
    ["design", "design"],
    ["video", "video"]
  ].map(([stepId, contractKey]) => {
    const contract = mission.expectedStepContracts[contractKey];
    return `| ${stepId} | ${contract.agentId} | ${contract.capability} | ${contract.outputArtifact} |`;
  }).join("\n");
  return `# Product Launch｜商品上新执行包

## 商品状态

- **商品：** ${profile.productName}
- **Product Profile：** ${profile.status}
- **首发平台：** ${assetPlan.channels.map((channel) => channel.platform).join("、")}
- **自动发布：** 否
- **外部动作已授权：** 否

## 商品视觉保真规则

${profile.visualIntegrityRules.map((item) => `- ${item}`).join("\n")}

## 渠道素材计划

${assetPlan.channels.map((channel) => `### ${channel.platform}

${channel.assets.map((item) => `- **${item.name} × ${item.quantity}**：${item.guard}${item.evidenceRequired ? "（需要可复核证据）" : ""}`).join("\n")}`).join("\n\n")}

## Creative Brief 边界

- **状态：** ${launch.creativeBrief.status}
- **目标客户：** ${launch.creativeBrief.verifiedAudience || "待证据确认"}
- **规则：** ${launch.creativeBrief.rule}

## BossAI OS Manager Mission 草案

- **草案合同：** ${mission.schema}
- **目标合同：** ${mission.targetContract}
- **执行权：** ${mission.executionOwner}
- **Harness：** ${mission.harness}
- **状态：** ${mission.status}
- **自动提交：** 否

${mission.request.steps.map((step, index) => `${index + 1}. **${step.id}** → ${step.agentId}${step.dependsOn?.length ? `（依赖：${step.dependsOn.join("、")}）` : ""}\n   - ${step.objective}`).join("\n")}

## 五员工执行合同矩阵

| Step | Agent Plugin | Expected Capability | Primary Artifact |
| --- | --- | --- | --- |
${contractRows}

这张表来自 Product Launch 的 **expectedStepContracts** 包装层，用来做编译前与本地 manifest 防漂移校验；它不是 **bossai.manager-mission.v1** 原生 step 字段，也不授予任何执行权限。

## 商品视觉执行 Handoff

Design Agent 只交付审核型素材计划，不直接生图。**design.commerce-asset-plan.md** 经人工审核后，才允许进入下一层媒体执行：

- **审核 Artifact：** ${mission.executionHandoffs.productVisual.reviewArtifact}
- **视觉执行包：** ${mission.executionHandoffs.productVisual.executionPackContract}
- **BossAI OS Media Task：** ${mission.executionHandoffs.productVisual.mediaTaskType}
- **Runtime Authority：** ${mission.executionHandoffs.productVisual.runtimeAuthority}
- **Media Routing：** ${mission.executionHandoffs.productVisual.routingAuthority}
- **Local Executor Contract：** ${mission.executionHandoffs.productVisual.localExecutorContract}
- **当前本地执行器：** ${mission.executionHandoffs.productVisual.localExecutorProject}
- **自动提交：** 否
- **仍需人工批准：** 是

这段 Handoff 是 Product Launch 包装层元数据，不是 **bossai.manager-mission.v1** 的 step 字段，也不授予 Provider、GPU、发布或投放权限。

## 商品短视频生产 Handoff

Video Agent 只交付审核型商品短视频生产计划，不生成成片。**${mission.executionHandoffs.productVideo.reviewArtifact}** 经人工审核后，才允许导入 BossAI 开拍的商品素材成片草稿：

- **开拍草稿合同：** ${mission.executionHandoffs.productVideo.draftContract}
- **真实生产合同：** ${mission.executionHandoffs.productVideo.productionContract}
- **执行目标：** ${mission.executionHandoffs.productVideo.executionTarget}
- **Operation：** ${mission.executionHandoffs.productVideo.operation}
- **专业工作台：** ${mission.executionHandoffs.productVideo.professionalWorkbench}
- **自动导入草稿：** 否
- **自动导入媒体：** 否
- **自动确认素材权利：** 否
- **自动执行 FFmpeg：** 否
- **自动发布：** 否

这条 Handoff 只允许把标题、卖点、渠道、画幅和镜头计划带入开拍草稿。真实图片/视频素材仍必须由用户在开拍中上传；开拍现有至少 2 个素材、Windows 本地 FFmpeg 和人工确认门禁继续生效。AI 生成镜头必须另走已批准的视频生成执行流，Product Launch 和 Video Agent 不得直接调用内部 Cloud GPU 或伪造不存在的 Central Media 视频合同。

## 发布后实验与学习闭环

- **实验合同：** ${launch.experimentPlan.schema}
- **当前状态：** ${launch.experimentPlan.status}
- **Creative Variant：** ${launch.experimentPlan.channels.reduce((sum, channel) => sum + channel.variants.length, 0)} 个计划版本
- **Experiment Plan Revision：** ${launch.experimentPlan.revision}
- **Measurement：** ${launch.experimentPlan.measurementContract}
- **Regeneration Draft：** ${launch.experimentPlan.regenerationDraftContract}
- **Experiment Registration：** ${launch.experimentPlan.experimentRegistrationContract}
- **反馈员工：** ${launch.experimentPlan.feedbackHandoff.targetAgentId} / ${launch.experimentPlan.feedbackHandoff.capability}
- **自动提交反馈任务：** 否
- **自动再生成：** 否
- **自动发布：** 否
- **自动广告花费：** 否
- **允许因果结论：** 否

渠道数据必须来自人工导出或已批准 Connector。CTR、CVR、加购率、收入/会话等派生指标由本地根据原始分子分母计算；没有权威数据不填效果数字，没有可比实验不宣称“某个创意导致了增长”。真实订单与收入只有在业务系统证据可追溯时才能进入 Company State。老板接受 performance review 后，只能生成单变量 Regeneration Draft；新结果再次审核通过后写入下一版 Experiment Plan，原 Variant 和历史 Measurement 都不覆盖。

## 审批边界

这个执行包只形成本地草案、证据任务和生产计划。真实上架、发布、投放、账号写入、改价、付款、退款、客户消息和对外承诺必须另行人工批准。
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

function renderProductLaunchExecutiveBrief(pack) {
  const launch = pack.productLaunch;
  return `# BossAI 电商总管｜商品上新执行简报

## 本轮目标

**${pack.decision.selectedOpportunity}**

${pack.decision.reason}

建议模式：**${pack.decision.recommendedMode}**

## 已经形成的工作包

- Product Profile Draft：先锁定商品事实和未知项；
- Creative Brief：客户、痛点和卖点在证据不足时保持“待验证”；
- Asset Plan：按目标渠道规划主图、场景、卖点、详情和视频素材；
- Manager Mission Draft：交给现有 Intelligence / Sales / Content / Design / Video 独立 Agent 协作；
- 人工审核闸门：本批不自动上架、发布、投放或操作账号。

## 视觉保真底线

${launch.productProfile.visualIntegrityRules.map((item) => `- ${item}`).join("\n")}

## 当前风险/缺口

${pack.warnings.length ? pack.warnings.map((item) => `- ${item}`).join("\n") : "- 当前输入足以进入上新草案，但商品事实与市场证据仍需逐项审核。"}

## 停止条件

${pack.decision.stopConditions.map((item) => `- ${item}`).join("\n")}
`;
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}
