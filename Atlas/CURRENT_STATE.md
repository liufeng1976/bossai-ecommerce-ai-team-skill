# CURRENT STATE — BossAI 电商总管 Skill

> 更新时间：2026-07-21
> 本地版本：1.2.0
> 分支：main
> 基线 HEAD：`8363aba release: BossAI Ecommerce Manager Skill v1.1.0`
> 发布状态：仅本地封版，未 push、未公开发布

## 当前产品口径

- 对外唯一入口：**BossAI 电商总管**；
- 后台岗位：10个核心岗位 + 6个扩展岗位；
- 客户不选择员工，岗位按自然语言和实际任务自动调度；
- 默认模式为本地分析、草拟、分工、测试和执行包管理；
- 发布、客户消息、账号控制、采购付款、退款赔偿、删除和公开承诺必须人工批准；
- 无证据想法只能进入验证任务，不能称为已验证机会；
- 公开源码采用 PolyForm Noncommercial 1.0.0，商业使用需刘风 / BossAI 单独书面授权。

## 1.2.0 已完成内容

### 版本统一

- `package.json`：1.2.0；
- `agent-install.json`：1.2.0；
- `skill/SKILL.md`：1.2.0；
- README：1.2.0；
- CLI help：从 `package.json` 读取并显示1.2.0；
- 执行包版本：运行时从 `package.json` 读取，不再残留1.1.0。

### 路由、输入和执行包

- 公开 route / modes 不暴露后台岗位菜单；
- 支持方向与决策、内容与个人IP、客服与售后、销售与成交、选品与运营、开发与交付六种内部模式；
- 严格校验输入对象、机会集合、字段类型、URL、日期、计数和评分；
- 支持 signals / items / opportunities / Radar Lite top_opportunities / Markdown；
- 缺少证据时生成情报核验任务；
- 执行包包含标准文件合同、岗位卡、task-board、execution-pack 和 manifest；
- `demo --clean` 只清理具有有效 BossAI manifest 的旧执行包，拒绝普通非空目录。

### 任务生命周期

- 支持 todo / in-progress / blocked / done / cancelled；
- blocked 必须记录原因；
- done 必须记录验收结果；
- 两份任务 JSON 状态不一致时失败关闭；
- 状态更新只修改执行包内受管 JSON，并保留审计 history。

### 安装器

- 支持 Codex、Claude Code、Hermes、OpenClaw；
- 支持用户级安装和项目级安装；
- 支持重复安装的受管升级；
- 未知 Skill 目录拒绝覆盖；
- 稳定安装目录采用 staging 验证后切换；
- 安装协议验证与宿主运行时检测分开报告。

## 真实测试结果

最后执行：`npm run check`

- Node tests：58/58 通过；
- `validate:demo`：通过，并正确警告无证据的自动客户消息想法；
- `demo`：通过，生成19项任务和完整 manifest；
- CLI `version`：输出1.2.0；
- CLI `help`：显示 BossAI 电商总管 Skill v1.2.0。

隔离安装协议：

- Codex：目录协议写入通过；检测到 codex 命令；未伪造宿主内端到端调用；
- Claude Code：目录协议写入通过；检测到 claude 命令；未伪造宿主内端到端调用；
- Hermes：目录协议写入通过；检测到 hermes 命令；未伪造宿主内端到端调用；
- OpenClaw：目录协议写入通过；当前环境未检测到运行时，不能宣称宿主安装成功。

## 本地发布产物

正式发布目录：

`C:\Users\42059\Projects\bossai-ecommerce-ai-team-skill\release\bossai-ecommerce-ai-team-skill-1.2.0-final-20260721`

安装包：

`bossai-ecommerce-ai-team-skill-1.2.0.tgz`

- 发布文件数：24；
- 解包大小：160812 bytes；
- SHA-256：`a402a9da890c5da9352fdbb52eaa30a11f9699693343b1ddfd286e7338402bd4`；
- 目录包含 `FILES.json`、`SHA256SUMS.txt`、`RELEASE.json`；
- 未包含 `.env`、API Key、node_modules、outputs、coverage 或 Git 元数据；
- `published=false`、`pushed=false`。

## 关联课程仓库

课程交付仓库：

`C:\Users\42059\Projects\bossai-ecommerce-agent-course`

课程已统一为16岗位、35页PPT、35页讲稿、16份岗位作业和真实课堂执行包。课程版本V1.0对应本 Skill 1.2.0。

## 剩余外部阻断

1. 远端 GitHub HEAD 仍为1.1.0；未经明确要求不 push，因此公开 GitHub 安装仍不能代表1.2.0远端发布。
2. OpenClaw 宿主运行时未检测到，只完成安装协议兼容验证。
3. Codex、Claude Code、Hermes虽检测到命令，但未在各宿主内伪造端到端触发成功。
4. 商业授权合同、公开发布时间和销售动作仍需刘风 / BossAI 人工批准。
