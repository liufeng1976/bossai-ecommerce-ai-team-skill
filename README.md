# BossAI 电商总管 Skill

> GitHub 公开源码安装｜非商业使用免费｜商业使用必须获得刘风 / BossAI 授权

**当前版本：[`v1.2.2 Source Release`](https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill/releases/tag/v1.2.2)** · [BossAI 官网](https://bossaios.com) · [English README](README_EN.md)

客户只需要说出问题，不需要选择员工。BossAI 电商总管会自动判断任务、调度后台AI员工，并把结果统一交付。

这不是16个聊天入口，也不是让客户在岗位菜单里做选择。对外只有一个角色：**BossAI 电商总管**；16个AI岗位只是后台能力模块。

## 30 秒判断它是否适合你

如果你想让 Claude Code、Codex、Hermes 或 OpenClaw 直接接手一段电商工作，而不是先让你选择“哪个 Agent”，这个仓库就是公开评估入口。

| 你现在需要的能力 | 本仓库 |
|---|---|
| 自然语言描述电商问题并自动分流 | ✅ |
| 机会评分、7天执行包、内容/销售/客服草稿 | ✅ |
| 商品上新资产计划与审核后交接 | ✅ |
| 本地测试、Demo、Agent 安装 | ✅ |
| 企业经营、收费服务、代运营、商业 SaaS | 需商业授权 |
| 生产 Amazon/Shopify 连接器与长期自动运营 | BossAI 商业产品 / BossAI OS |
| Runtime、审批、审计、Memory、AI Gateway、Billing | 不在本仓库 |

> **产品边界：**这是 BossAI 的公开获客与评估层，不是第二套 BossAI OS。持久化 AI 员工执行、生产自动化、审批审计和商业授权仍由 BossAI OS / Headquarters Commerce 负责。详见 `docs/PUBLIC_RELEASE.md`。

### BossAI 开源工作流

如果你还没有明确要做什么，可以先用 [BossAI Radar Lite](https://github.com/liufeng1976/bossai-radar-lite) 收集公开证据、筛选机会，再把 Radar 的 `top_opportunities` 直接交给本项目生成执行包。若主问题是电商客服，则可继续评估 [BossAI Customer Service Agent](https://github.com/liufeng1976/bossai-commerce-copilot) 的本地事实层、AI 草稿和强制人工审核工作流。

## 公开方式与授权原则

- 本仓库在 GitHub 公开展示完整源码；
- 任何人都可以公开下载、Fork、查看、学习、修改和安装；
- 个人研究、学习、测试以及许可证允许的非商业用途免费；
- 用于公司经营、收费服务、课程、咨询、代运营、SaaS、白标、转售或其他商业活动，必须提前获得 BossAI 商业授权；
- 下载、Fork、安装、提交 Issue 或贡献代码均不等于获得商业授权。

> **许可分类：Source Available / 公开源码，不是 OSI Open Source。** 本项目采用 PolyForm Noncommercial 1.0.0。对外应称为“公开源码 Skill”“Source-available Skill”或“非商业免费源码”，不应称为 OSI 开源软件。

## 客户怎么用

直接说自然语言即可：

```text
我的项目太多，帮我判断先做哪个。
帮我给这个产品做7天短视频内容。
检查这批客服对话并生成安全回复。
帮我做报价、卖点和成交话术。
这个软件现在能不能上线试卖？
我给你一张商品白底图，帮我做整套电商素材并准备上新。
```

总管会自动识别为“商品上新、方向与决策、内容与个人IP、客服与售后、销售与成交、选品与运营、开发与交付”中的一个主工作模式，并静默安排后台岗位。

## 商品上新｜从商品资产到整套电商素材计划

如果你已经有商品，不需要先人为编造市场 signal。提供商品/服务名称、白底图/实拍图/包装图等资产，以及可选目标平台，BossAI 电商总管会进入 Product Launch 模式：

1. 建立 `Product Profile Draft`，明确已知事实、未知项和商品视觉保真规则；
2. 对客户、痛点、卖点、竞品差异和收益承诺保持证据纪律，证据不足时只标记为假设；
3. 为 Amazon、小红书、TikTok Shop、独立站/Shopify 或通用电商渠道生成 `Asset Plan`；
4. 编译 `product-launch-mission.json`，目标合同为 BossAI OS 的 `bossai.manager-mission.v1`；
5. Mission 草案只引用现有独立 Intelligence / Sales / Content / Design / Video Agent；
6. Design 审核后只进入独立商品视觉执行边界；Video 审核后可用 `product-video-draft` 编译为 BossAI 开拍的一次性商品视频草稿；
7. 默认不自动上架、发布、投放、改价、付款、退款、发客户消息或操作账号。

示例输入：`examples/product-launch-input.json`。商品视频审核 JSON 格式示例：`examples/product-launch-video-review.example.json`；该示例中的 SHA-256 和审核人只是格式占位，不能作为真实审核证据。

## 能解决什么

输入你的业务背景和机会信号，或直接提供明确的商品上新目标与商品资产后，系统会：

1. 排除噪音并去重；
2. 从证据强度、商业匹配、具体度和时效评分；
3. 选出本轮唯一主线；
4. 由 BossAI 电商总管自动分流，不让客户选择员工；
5. 在后台动态安排真正有工作的 AI 岗位，并为任务指定负责人、事实、推断、交付物和验收标准；
6. 生成7天执行计划；
7. 对发布、客户消息、账号、采购付款、退款和删除设置人工审批闸门；
8. 第7天强制做继续、调整、暂停或放弃决定。

## 后台16个AI岗位

> 这些岗位不是客户操作菜单。客户始终只与 BossAI 电商总管对话。

### 10个核心岗位

- AI战略军师
- AI情报雷达
- AI选品经理
- AI内容总监
- AI个人IP教练
- AI电商运营经理
- AI客服主管
- AI文案销售官
- AI项目经理
- AI自动执行官

### 6个扩展岗位

- AI财务官
- AI供应链经理
- AI产品测试经理
- AI合规顾问
- AI数据分析师
- AI学习教练

岗位按真实任务动态上岗，不会为了显得复杂而强行安排全部角色。

## 最快体验

要求 Node.js 20.11 或更高版本，无第三方运行依赖。

```powershell
npm test
npm run demo
```

该命令会使用 `--clean` 重新生成 `outputs/demo`。只有目录中存在可验证的 BossAI `manifest.json` 时才会清理旧产物；普通非空目录会被拒绝清理。

演示执行包生成到：

```text
outputs/demo
```

## CI 验证的真实 Demo 摘要

`v1.2.2` 的 Source Release workflow 已真实执行 `npm run demo`。当前公开摘要同时存放在 [`examples/demo-output-summary.json`](examples/demo-output-summary.json)，并由 `npm run verify:demo-snapshot` 在 CI 中重新计算、逐字段比对；引擎输出发生变化而 snapshot 未更新时，CI 会失败。

当前 `examples/demo-input.json` 的可复核结果：

| 字段 | 实际结果 |
| --- | --- |
| 客户入口 | `BossAI 电商总管` |
| 主工作模式 | `客服与售后` |
| 首选机会 | `跨境卖家重复处理物流延误与订单查询` |
| 动态启用后台岗位 | `10` 个 |
| 生成任务 | `19` 个 |
| 输入校验告警 | `1` 条 |

这条校验告警本身也是治理行为的一部分：输入中的“自动批量给所有客户发送物流提醒”因为缺少可复核证据，被降级为**验证任务**，不会被当作已验证商业机会。

```powershell
npm run validate:demo
npm run verify:demo-snapshot
npm run demo
```

这不是手写营销样例；snapshot 来自同一套 `buildExecutionPack` 逻辑，并被 Windows / Ubuntu、Node 20.11 / 22 / 24 的 CI 组合持续校验。

## CLI 使用

### 测试总管自动分流

```powershell
node bin/bossai-team.mjs route --text "这批客服对话有退款承诺风险，帮我检查"
```

查看7种工作模式：

```powershell
node bin/bossai-team.mjs modes
```

### 创建输入模板

```powershell
node bin/bossai-team.mjs init --output bossai-team-input.json
```

### 验证输入

```powershell
node bin/bossai-team.mjs validate --input bossai-team-input.json
```

### 生成执行包

```powershell
node bin/bossai-team.mjs plan `
  --input bossai-team-input.json `
  --output outputs/latest `
  --limit 5 `
  --max-roles 8
```

### 把已审核商品视频方案编译成 BossAI 开拍草稿

先由人工确认 `video.commerce-production-plan.md`，记录真实 Artifact SHA-256、审核人和接受时间，再执行：

```powershell
node bin/bossai-team.mjs product-video-draft `
  --pack outputs/product-launch-demo `
  --review video-review.json
```

默认输出：`outputs/product-launch-demo/handoffs/product-video-draft.json`。

这个命令**不会**自动打开开拍、不会导入商品图片/视频、不会确认素材权利、不会运行 FFmpeg、不会发布。生成的 JSON 由 BossAI 开拍 `商品素材成片 / Product media video` 导入后，仍需要用户上传至少 2 个真实商品素材并人工开始现有 `bossai.video-production-task.v1 / local-windows / product-video` 流程。

### 查看内部岗位库

仅供开发和调试，不是客户操作入口：

```powershell
node bin/bossai-team.mjs roles --format markdown
```

## 支持的输入

### 通用 JSON

```json
{
  "business": {
    "name": "项目名称",
    "platforms": ["Amazon"],
    "customer": "目标客户",
    "goal": "7天验证目标",
    "offer": "当前产品或服务",
    "constraints": ["所有外部动作人工审核"]
  },
  "signals": [
    {
      "title": "真实机会或痛点",
      "summary": "具体描述",
      "source": "来源",
      "url": "https://example.com/source",
      "evidence": "客户原话、公开评论或付费需求摘要",
      "observed_at": "2026-07-12",
      "tags": ["客服", "物流"]
    }
  ]
}
```

同时兼容：

- `signals`
- `items`
- `opportunities`
- BossAI Radar Lite 的 `top_opportunities`
- Markdown 项目笔记

完整示例见 `examples/demo-input.json`，结构约束见 `schemas/input.schema.json`。

## 标准输出

```text
00-start-here.md                 客户入口和使用说明
00-executive-brief.md            总管统一执行简报
01-business-brief.md             业务简报
02-opportunity-ranking.md        机会评分和证据
03-work-routing.md               总管工作分流
04-seven-day-plan.md             7天闭环
05-task-board.md                 人类可读任务板
task-board.json                  机器可读任务板
execution-pack.json              完整执行包
manifest.json                    产物清单
internal/team-roster.md          后台岗位编制
internal/role-cards/*.md         后台岗位任务卡
```

## 从公开 GitHub 仓库安装

任何人都可以把公开仓库地址发给 OpenClaw、Hermes、Claude Code 或 Codex，由 Agent 读取 `agent-install.json` 后自动安装、配置和验收。

```text
https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill
```

一条命令：

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill --agent codex
```

可替换为：

```text
openclaw
hermes
claude
codex
```

项目级安装：

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill `
  --agent codex `
  --workspace "C:\path\to\project"
```

安装器会运行单元测试、生成演示执行包并验证 `manifest.json`。详细说明见 `AGENT_INSTALL.md`。

## 安全边界

本项目默认只做本地读取、分析、草拟、分工和测试，不会自动：

- 发布内容；
- 给客户发送消息；
- 登录或控制平台账号；
- 采购、付款、投放或退款；
- 删除数据；
- 对外承诺收益、交期或合规结果。

没有证据的想法只能生成验证任务，不能被写成已验证市场机会。

## 授权

本项目为 **Source Available / 公开源码**，采用 **PolyForm Noncommercial 1.0.0**，不属于 OSI 认可的开源许可证：

- 可以查看、学习、修改和非商业使用；
- 不得用于销售、收费服务、商业 SaaS、代运营或企业内部营利用途；
- 商业使用必须获得 **刘风 / BossAI** 的单独书面授权。

详见 `LICENSE.md` 与 `COMMERCIAL_LICENSE.md`。

公开发布候选可先执行：

```powershell
npm run release:public-check
```

该命令只证明公开包装、基础安全文件与现有测试通过，不代表已经公开上线、生产就绪或经过真实客户验证。

## 品牌与作者

- 产品：BossAI 电商总管 Skill
- 作者：刘风 / BossAI
- 版本：1.2.2
- 当前 Source Release：https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill/releases/tag/v1.2.2
