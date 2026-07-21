# NEXT MISSION — BossAI 电商总管 Skill 商业交付封版

## Priority

Project rank: 4.
Primary workspace: `C:\Users\42059\Projects\bossai-ecommerce-ai-team-skill`.
Supporting course workspace: `C:\Users\42059\Projects\bossai-ecommerce-agent-course`.

## Mission

把现有“BossAI 电商总管 Skill + 电商 AI 员工军团课程”收口为一套可以公开安装、稳定演示、用于课程交付并受商业授权保护的完整产品。当前阶段不再扩充更多岗位或制造多个客户入口。

## Non-negotiable product rules

1. 对外只有一个入口：BossAI 电商总管。
2. 后台岗位由系统自动调度，不让客户选择员工。
3. 没有证据的项目只能进入验证任务，不得称为已验证机会。
4. 发布、客户消息、账号操作、采购、付款、退款、删除等外部动作必须人工批准。
5. 公开源码仅允许许可证规定的非商业使用；商业使用必须获得刘风 / BossAI 书面授权。
6. 课程、README、Skill、安装器、演示和销售材料必须使用同一套岗位数量、名称、版本和产品口径。

## Current risks to resolve first

- 主仓库存在大量未提交修改和未跟踪文件，禁止 reset、覆盖或丢弃。
- `package.json` / README 已显示 1.2.0，但 HEAD 仍是 1.1.0 发布提交，需要核对并完成真实 1.2.0 封版。
- Skill 当前描述 16 个后台岗位，课程状态文档描述 14 个岗位，必须统一架构并修订全部材料。
- 课程仓库不是 Git 仓库，必须先保护现有产物并建立清晰的版本和产物清单；未经检查不得删除或重生成覆盖 PPT。

## Execution order

### Phase 1 — Protect and audit

- 检查两个工作区全部文件、版本、修改时间和现有产物。
- 读取 `AGENTS.md`、`agent-install.json`、`AGENT_INSTALL.md`、`SECURITY.md`、`LICENSE.md`、`COMMERCIAL_LICENSE.md`、`README.md`、`skill/SKILL.md`。
- 检查课程 `PROJECT_STATUS.md`、课程架构、Prompt、案例、讲稿、销售资料和 PPT 生成脚本。
- 输出功能、内容、授权、版本和岗位口径差异清单。

### Phase 2 — Skill release baseline

- 运行并修复 `npm run check`。
- 验证 route、validate、plan、demo、manifest、生命周期、输入校验和安全清理。
- 在隔离临时目录验证 Codex、Claude、Hermes、OpenClaw 安装协议；不能安装的宿主必须输出可验证的兼容诊断，不能伪造成功。
- 验证项目级安装、稳定安装目录、重复安装、升级、卸载/回滚边界和非法输入失败关闭。
- 统一 1.2.0 版本号、README、英文 README、Skill 元数据、安装清单和演示产物。
- 清理临时产物，只删除可证明由本项目生成的文件。

### Phase 3 — Course delivery package

- 统一课程与 Skill 的角色架构。推荐保留 16 个后台岗位，并明确核心岗位与扩展岗位，不把岗位做成客户菜单。
- 核验 35 页 PPT 与逐页讲稿一一对应；修复页码、标题、案例、术语和价格冲突。
- 为 14/16 个岗位补齐可提交的学员作业模板、评分标准、示例输入、合格输出和常见错误。
- 建立一套真实可运行的课堂演示：自然语言需求 → Skill 自动分流 → 7 天执行包 → 人工审批闸门 → 第 7 天复盘决策。
- 演示数据必须标注为演示；Amazon、Shopify、个人 IP 案例没有真实证据时不得包装成真实经营结果。
- 输出讲师手册、学员手册、安装手册、故障排查、课前检查、课后作业、授权说明和交付清单。

### Phase 4 — Commercial readiness

- 统一公开免费边界、商业授权场景、咨询/课程/企业部署边界。
- 检查 PolyForm Noncommercial、NOTICE、README 和销售材料是否一致。
- 生成可交付 ZIP/目录清单与 SHA-256 清单，不包含密钥、个人数据或临时文件。
- 完成 GitHub 展示页、安装演示、版本变更说明和最小可复现示例。
- 不自动发布、推送或销售；只准备经人工确认后可发布的材料。

## Acceptance gates

- 主仓库所有测试、验证、Demo 和安装器检查通过。
- 课程 PPT、讲稿、Prompt、作业、案例和销售资料口径统一。
- 新用户只看 README 即可安装并生成第一个执行包。
- 商业授权边界在所有入口一致。
- 工作区有效成果形成干净、可审查的本地 Git 提交；未经明确要求不要 push。
- 更新 `Atlas/CURRENT_STATE.md`，记录真实通过项、失败项、外部阻断和产物路径。
