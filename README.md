# BossAI 电商总管 Skill

> GitHub 公开源码安装｜非商业使用免费｜商业使用必须获得刘风 / BossAI 授权

客户只需要说出问题，不需要选择员工。BossAI 电商总管会自动判断任务、调度后台AI员工，并把结果统一交付。

这不是16个聊天入口，也不是让客户在岗位菜单里做选择。对外只有一个角色：**BossAI 电商总管**；16个AI岗位只是后台能力模块。

## 公开方式与授权原则

- 本仓库在 GitHub 公开展示完整源码；
- 任何人都可以公开下载、Fork、查看、学习、修改和安装；
- 个人研究、学习、测试以及许可证允许的非商业用途免费；
- 用于公司经营、收费服务、课程、咨询、代运营、SaaS、白标、转售或其他商业活动，必须提前获得 BossAI 商业授权；
- 下载、Fork、安装、提交 Issue 或贡献代码均不等于获得商业授权。

> 对外可以称为“开源 Skill”；严格的软件许可证表述是“公开源码、非商业许可（source-available）”，并非允许任意商业使用的 OSI 开源许可证。

## 客户怎么用

直接说自然语言即可：

```text
我的项目太多，帮我判断先做哪个。
帮我给这个产品做7天短视频内容。
检查这批客服对话并生成安全回复。
帮我做报价、卖点和成交话术。
这个软件现在能不能上线试卖？
```

总管会自动识别为“方向与决策、内容与个人IP、客服与售后、销售与成交、选品与运营、开发与交付”中的一个主工作模式，并静默安排后台岗位。

## 能解决什么

输入你的业务背景和机会信号后，系统会：

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

## CLI 使用

### 测试总管自动分流

```powershell
node bin/bossai-team.mjs route --text "这批客服对话有退款承诺风险，帮我检查"
```

查看6种工作模式：

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

本项目公开源码，采用 **PolyForm Noncommercial 1.0.0**：

- 可以查看、学习、修改和非商业使用；
- 不得用于销售、收费服务、商业 SaaS、代运营或企业内部营利用途；
- 商业使用必须获得 **刘风 / BossAI** 的单独书面授权。

详见 `LICENSE.md` 与 `COMMERCIAL_LICENSE.md`。

## 品牌与作者

- 产品：BossAI 电商总管 Skill
- 作者：刘风 / BossAI
- 版本：1.2.1
