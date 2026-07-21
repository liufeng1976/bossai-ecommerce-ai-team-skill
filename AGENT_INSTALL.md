# BossAI 电商总管 — Agent 自安装

正确的产品形态是：仓库在 GitHub 公开，任何人都可以把公开地址发给 OpenClaw、Hermes、Claude Code 或 Codex，Agent 自己完成下载、安装、配置和测试；手工命令只用于排错。公开安装不代表获得商业使用权。

仓库地址：

```text
https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill
```

## 给 Agent 的标准指令

```text
安装并验证这个 GitHub 项目：
https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill

要求：
1. 阅读 agent-install.json、AGENTS.md、SECURITY.md 和 LICENSE.md；
2. 识别你属于 OpenClaw、Hermes、Claude Code 还是 Codex；
3. 使用 scripts/agent-bootstrap.mjs 自动安装；
4. 安装到稳定目录；
5. 安装对应的 Skill；
6. 运行单元测试；
7. 生成并检查演示执行包；
8. 默认只允许本地分析、草拟、分工和测试；
9. 对客户只提供“BossAI 电商总管”一个入口，不得要求客户选择AI员工；
10. 后台岗位由系统自动分流，默认不向客户展示岗位菜单；
11. 不得自动发布、发送客户消息、控制账号、采购付款、退款或删除；
12. 最后报告安装目录、Skill 目录、测试结果、演示产物和授权边界。
```

## GitHub 一条命令安装

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill --agent codex
```

替换最后一个参数：

```text
openclaw
hermes
claude
codex
```

### 同时安装到当前项目

Codex：

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill `
  --agent codex `
  --workspace "C:\path\to\project"
```

Claude Code：

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill `
  --agent claude `
  --workspace "C:\path\to\project"
```

OpenClaw：

```powershell
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill `
  --agent openclaw `
  --workspace "C:\path\to\openclaw-workspace"
```

## 已克隆仓库时

```powershell
node scripts/agent-bootstrap.mjs --agent codex
```

或：

```powershell
npm run agent:install -- --agent codex
```

## 安装结果

默认稳定目录：

```text
~/.bossai-ecommerce-ai-team-skill
```

默认 Skill 目录：

| Agent | 用户级目录 |
|---|---|
| Codex | `~/.codex/skills/bossai-ecommerce-ai-team` |
| Claude Code | `~/.claude/skills/bossai-ecommerce-ai-team` |
| Hermes | `~/.hermes/skills/bossai-ecommerce-ai-team` |
| OpenClaw | `~/.openclaw/workspace/skills/bossai-ecommerce-ai-team` |

安装器采用隔离暂存、验证后替换的升级流程。只会覆盖能够验证为 BossAI 安装目录或 BossAI Skill 的受管目录；未知目录会失败关闭，不会强行覆盖。重复安装会清除受管目录内的旧版本残留，并保留失败回滚边界。

安装器还会在 Skill 目录生成：

```text
BOSSAI_TEAM_HOME.txt
config.json
```

Agent 应先读取稳定安装目录，再运行 CLI，不能把路径写死。

## 自动验收

安装器默认执行：

1. 检查 Node.js 版本；
2. 检查 `package.json` 与 `skill/SKILL.md`；
3. 运行全部 Node 单元测试；
4. 使用 `examples/demo-input.json` 生成完整执行包；
5. 检查 `manifest.json`、文件数量和唯一主线；
6. 以暂存目录安全替换稳定安装目录和 Skill 目录；
7. 写入包含版本、安全模式和商业授权边界的配置；
8. 输出宿主运行时诊断，明确区分“安装协议与目录写入已验证”和“宿主内端到端调用已验证”。当前环境未检测到某宿主时，不会伪造宿主安装成功。

仅排错或隔离验收时使用：

```powershell
--dry-run
--skip-verify
--install-dir <path>
--agent-home <isolated-user-home>
```

`--agent-home` 用于把 Codex、Claude、Hermes、OpenClaw 的用户级 Skill 目录重定向到隔离目录，避免污染真实用户配置。

`--skip-verify` 不建议在正式安装中使用。

## 安装后首次任务

先验证单入口自动分流：

```powershell
node <BOSSAI_TEAM_HOME>\bin\bossai-team.mjs route --text "检查这批客服对话并生成安全回复"
```

再生成正式执行包：

```powershell
node <BOSSAI_TEAM_HOME>\bin\bossai-team.mjs init --output bossai-team-input.json
node <BOSSAI_TEAM_HOME>\bin\bossai-team.mjs validate --input bossai-team-input.json
node <BOSSAI_TEAM_HOME>\bin\bossai-team.mjs plan --input bossai-team-input.json --output outputs/latest
```

## 公开安装与商业使用限制

仓库公开、下载公开、安装公开。任何人都可以从 GitHub 安装并用于许可证允许的非商业用途。

源码开放仅限查看、学习、修改和非商业使用。不得用于销售、收费服务、商业 SaaS、代运营、白标、转售或企业内部营利用途。商业使用必须在使用前获得刘风 / BossAI 的单独书面授权。
