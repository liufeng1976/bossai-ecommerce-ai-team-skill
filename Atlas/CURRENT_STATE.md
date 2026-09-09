# CURRENT STATE — BossAI 电商总管 Skill

> 更新时间：2026-08-16
> 本地 package 版本：1.3.0
> 分支：main
> 基线 HEAD：`1c8647d feat: make automotive closure canonical in ecommerce skill 1.2.2`
> 远端基线：0 ahead / 0 behind
> 本批状态：Product Launch Mission + 商品视觉/视频受控 Handoff 已完成本地 L2 合同实现与验收，尚未 commit / push / release

## 当前产品口径

- 对外唯一入口：**BossAI 电商总管**；
- 后台岗位：10个核心岗位 + 6个扩展岗位；
- 客户不选择员工，岗位按自然语言和实际任务自动调度；
- 默认模式为本地分析、草拟、分工、测试和执行包管理；
- 发布、客户消息、账号控制、采购付款、退款赔偿、删除和公开承诺必须人工批准；
- 无证据想法只能进入验证任务，不能称为已验证机会；
- 已有商品可通过“商品上新”模式直接进入 Product Profile → Asset Plan → Manager Mission Draft，不要求先伪造市场 signal；
- 当前共有7种内部工作模式：商品上新、方向与决策、内容与个人IP、客服与售后、销售与成交、选品与运营、开发与交付；
- 公开源码采用 PolyForm Noncommercial 1.0.0，商业使用需刘风 / BossAI 单独书面授权。

## 2026-08-15 Product Launch Mission v0.1

### 已完成

- 新增 `product-launch` 工作模式，可识别“商品上新 / 白底图 / 整套电商素材 / 把这个商品卖起来 / Product Launch”等明确请求；
- Product Launch 可在 `signalCount=0` 时启动，但普通机会验证模式仍要求非空 signal，未整体放宽证据纪律；
- 新增 `bossai.product-profile-draft.v1`：区分用户已提供事实、未知项与视觉保真规则；
- 新增 `bossai.product-launch-asset-plan.v1`：支持 Amazon、小红书、TikTok Shop、独立站/Shopify 和通用核心素材包；
- 尺寸、参数、对比、认证、价格与效果承诺类素材设置证据闸门；
- 新增 `bossai.product-launch-mission-draft.v1`，目标合同为 BossAI OS `bossai.manager-mission.v1`；
- Mission 草案只引用现有独立 `bossai-intelligence-agent`、`bossai-sales-agent`、`bossai-content-agent`、`bossai-design-agent`、`bossai-video-agent`；
- 未在本 Skill 新建 Runtime、Scheduler、Approval、Audit、Memory 或 Provider 路径；
- 新增输出：`06-product-launch-plan.md`、`product-profile.json`、`asset-plan.json`、`product-launch-mission.json`；
- 新增 `examples/product-launch-input.json` 作为 CLI 真实入口演示输入；
- Product Launch 默认 `automaticExternalActions=false`、`externalActionsAuthorized=false`、`autoPublish=false`、`autoAdSpend=false`；
- Video Step 现期望 `video.commerce.production.plan` / `video.commerce-production-plan.md`，审核后使用 `bossai.product-launch-video-review.v1` 记录 Artifact SHA-256、审核人和接受时间；
- 新增 `product-video-draft` CLI，把已接受 Video Artifact 编译为 `bossai.kaipai-product-media-draft.v1`；编译结果固定 `bossai.video-production-task.v1 / local-windows / product-video`，且 `mediaImported=false`、`rightsConfirmed=false`、`automaticExecution=false`、`publicationAuthorized=false`；
- 新增 `examples/product-launch-video-review.example.json`，只作为格式示例，不构成真实审核证据。

### 本批真实验收

- `npm test`：73/73 PASS；
- Product Launch / 开拍跨项目直接 import 验收 PASS：电商总管当前 compiler 产物被开拍当前 sanitizer 原样接受；
- 开拍 `test:product-launch-video-handoff` PASS，production `npm run build` PASS；
- Product Launch CLI：`validate --input examples/product-launch-input.json` PASS，`signalCount=0`；
- Product Launch CLI：`plan --input examples/product-launch-input.json --output outputs/product-launch-demo` PASS；
- Product Launch `product-video-draft --pack <pack> --review <accepted-review.json>` 成功路径与未接受 review 失败关闭路径均由 CLI 级测试覆盖；
- 实际生成 7 项任务与 23 个执行包文件；
- `product-launch-mission.json` 实际状态为 `draft-not-submitted`，`automaticSubmission=false`，`externalActionsAuthorized=false`；
- `git diff --check` PASS，仅有现有 Windows 行尾转换 warning，无 whitespace error。

### 未完成 / 不得提高声明

- 尚未把 Mission 草案真实提交给 BossAI OS Manager；
- 尚未执行真实 Design / Video Provider 生成图片或视频；
- 尚未连接真实 Amazon、小红书、TikTok Shop、Shopify 账号；
- 尚未进行真实上架、发布、投放、成交或转化回流；
- 尚未形成 Creative → Conversion → Learning 的真实数据闭环；
- 本批未 commit、未 push、未 release，不提高 productionReady / actuallyLaunched / realUserValidated / formalAIEmployeeRegistered 声明。

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


## 2026-08-16 — Product Launch reviewed five-Agent handoff verification

Product Launch now has two separate cross-repository safeguards:

1. `verify:product-launch-agent-contracts` reads the five real local Agent manifests and verifies Mission step Agent ID, expected capability and unique primary Artifact without executing plugin code.
2. `verify:product-launch-reviewed-handoff` executes the current five Agent result/handoff functions in sequence and proves reviewed upstream information propagates Intelligence → Sales → Content/Design → Video. A predecessor with review-required Artifact metadata but no approved review event is rejected.

`npm run check:product-launch` now runs the normal 77-test suite, demo/input validation, the real five-manifest contract matrix and the reviewed-handoff cross-repository chain. Current result: PASS.

The Manager Mission platform behavior required for this chain has been implemented and tested only in an isolated `bossai-os` worktree based on `bd58feb`. Observed `bossai-os/main@93f07aa` still lacks active Manager source, so Product Launch must not be described as end-to-end active on current main until the generic reviewed-Artifact Mission handoff patch is consolidated into the authoritative OS source. `automaticSubmission=false` remains unchanged.

No Provider calls, media execution, publication, account mutation or external actions are performed by these verification paths. No commit, push, deployment or release signing occurred.


## 2026-08-16 — Product Launch submission readiness CLI and BossAI OS main P0 blocker

Added the user/developer-facing read-only command:

```text
bossai-team product-launch-readiness --pack <product-launch-pack> [--projects-root D:\BossAI-Projects] [--strict]
```

The command combines the real five-Agent manifest contract verification with the authoritative BossAI OS Manager source readiness check. It does not execute plugin code, mutate the registry, call Providers, submit a Mission or perform external actions. `--strict` exits non-zero when the execution platform is not ready; without `--strict` it reports the blocker without pretending that a reporting command itself failed.

Current real D-drive result:

```text
agentContracts.overall=passed
five Product Launch Agent contracts=passed
submissionReady=false
platform.platformReady=false
blocker=BOSSAI_OS_MANAGER_SOURCE_MISSING
automaticSubmissionAllowed=false
providerCalls=0
registryMutated=false
externalActions=0
```

The platform blocker is now independently classified as a P0 repository-integrity issue in the isolated BossAI OS recovery worktree. `main@93f07aa` has no surviving `apps/` tree; the checkpoint commit has parent `bd58feb` and deleted 383 tracked files overall, including 203 `apps/api`, 98 `apps/web`, 18 `apps/desktop`, plus shared/Gateway/engine source. Its own `CODEX_HANDOFF.md` states the pre-checkpoint `bd58feb` checkout contained 115 modified and 274 untracked post-HEAD files and explicitly prohibited normalizing or overwriting that dirty tree. Therefore direct parent-tree restoration is not a safe recovery method.

Recovery-source inspection remains read-only. The D-drive GA worktree and `bossai-os-7976cce1` contain complementary post-HEAD platform changes; all 11 overlapping core files inspected have different SHA-256 values, so a controlled three-way consolidation is required. The Artifact-first Manager in 7976 has compatible completion metadata for the reviewed Mission handoff patch, but the patch must be adapted to the current Artifact-first Manager text instead of applying the old bd58feb diff wholesale.

Product Launch remains L2 engineering work. It is not submitted to BossAI OS main, not production-ready, not launched and not real-user validated. No commit, push, deployment or signing occurred.


## 2026-08-16 — Product Launch handoff size containment

Reviewed Manager Mission handoff remains the full bounded runtime input, but downstream commerce Artifacts no longer recursively embed entire predecessor Artifacts. Sales, Content, Design and Video now compact only the displayed predecessor-evidence section to a shared UTF-8-safe excerpt while preserving the complete validated handoff in pending task context.

The cross-repository reviewed-handoff verifier now hard-fails if any Product Launch Artifact that must become a predecessor exceeds the current two-predecessor Manager handoff budget of 8192 UTF-8 bytes.

Current real source result sizes:

```text
intelligence.commerce-launch-evidence.md = 1849 bytes
sales.commerce-positioning.md = 3880 bytes
content.commerce-launch-copy.md = 4441 bytes
design.commerce-asset-plan.md = 5221 bytes
budget per predecessor = 8192 bytes
```

The Video input context still preserves the exact upstream unknown-item statement before output compaction, while the final Video Artifact independently preserves equivalent fail-closed fact boundaries for unconfirmed specifications, certifications, price, effects and other claims.

After the change, Sales/Content/Design/Video unit + architecture verification and real commerce Runtime scenarios pass, and `npm run check:product-launch` remains PASS with 83/83 tests, the five-manifest contract matrix and the reviewed cross-repository chain. Provider/media/publication/external actions remain zero.


## 2026-08-16 — Product Launch Creative → Measure → Learn → Regenerate loop

Product Launch now has a bounded local learning loop on top of the existing five-Agent launch chain. This is still an L2 engineering workflow and does not authorize publication, ad spend, Provider/GPU execution or automatic Manager submission.

### Experiment identity

Each planned channel asset receives a stable `bossai.product-launch-creative-variant.v1` ID. The initial demo plan contains 35 planned Variants. `bossai.product-launch-experiment-plan.v1` now starts at `revision=1`, records measurement/feedback/regeneration/registration contracts, and keeps `registeredIterations=[]` until a reviewed iteration is explicitly registered.

### Authoritative measurement

`bossai-team product-launch-measurement` compiles only manually exported or approved-Connector raw observations into `bossai.product-launch-measurement-snapshot.v1`.

- Unknown Variant IDs fail closed.
- Negative/non-finite observations fail closed.
- External callers cannot inject derived values such as CTR/CVR; derived metrics are calculated locally from allowed raw numerator/denominator fields.
- Records remain `observed-not-causal` and do not prove that a Creative Variant caused an outcome.
- An optional `--experiment-plan` can point to a later immutable Experiment Plan revision for subsequent rounds.

### Measure → Learn

`bossai-team product-launch-feedback-draft` binds the exact Measurement Snapshot SHA-256 and produces a `bossai.product-launch-feedback-review-draft.v1` for the existing `bossai-content-agent / content.performance.review` capability. It does not submit the task automatically.

The Content Agent now has a dedicated `content.performance.review` Artifact form instead of returning a generic writing template. `content.performance-review.md` separates observed facts, data/comparability gaps, conclusions that cannot be made, next hypotheses, minimum experiments and Company State evidence boundaries. It explicitly rejects “higher metric = this creative caused growth” and performs no publication, ad, regeneration, account or customer action.

### Learn → Regenerate

After an Owner accepts the exact `content.performance-review.md`, `bossai-team product-launch-regeneration-draft` can compile `bossai.product-launch-regeneration-draft.v1` from a single-variable `nextExperiment` declaration.

- Source performance-review Artifact SHA-256 and source Measurement Snapshot SHA-256 are required.
- Only one key variable change is allowed per draft; hold-constant fields and success metric are explicit.
- Source Variant is never overwritten.
- A deterministic iteration ID and proposed child Variant ID are derived from the accepted review + measurement + experiment definition.
- Content, Design and Video iteration objectives route back to their existing commerce capabilities; explicit Product Launch iteration routing prevents the request from falling back to performance review, QA or remediation.
- No automatic submission, generation, Provider/GPU/FFmpeg execution, publication or ad spend is permitted.

### Reviewed iteration registration

After the regenerated Content/Design/Video result is separately reviewed and accepted, `bossai-team product-launch-register-iteration` creates `bossai.product-launch-experiment-registration.v1` and writes a **new** `experiment-plan.next.json` rather than changing the original plan or `execution-pack.json`.

The new Variant is `approved-not-published`, retains its parent Variant, iteration ID, success metric and the accepted regenerated Artifact SHA-256. The original Experiment Plan remains revision 1; the returned plan becomes revision 2 and records the iteration in `registeredIterations`. A second Measurement run using `--experiment-plan experiment-plan.next.json` can then recognize the newly registered Variant.

### Real closed-loop verification

The cross-repository feedback verifier runs a complete local cycle using current Agent source:

```text
Amazon amazon-main.v01
→ first raw observations
→ local CTR = 0.08
→ Measurement Snapshot (observed-not-causal)
→ feedback draft
→ current Content Agent content.performance.review
→ Owner-accepted review record
→ Design single-variable regeneration draft
→ current Design Agent design.commerce.asset-plan
→ Owner-accepted regenerated result
→ Experiment Plan revision 1 → revision 2
→ new immutable child Variant registered
→ second raw observations against the new Variant
→ local CTR = 0.10
→ still observed-not-causal
```

The verification does **not** claim that CTR improved because of the design change; it proves only that the evidence/iteration loop can repeat without losing Variant identity, review provenance or causality boundaries.

### Current machine evidence

```text
Product Launch unit/integration tests: 93/93 PASS
validate:demo: PASS
demo: PASS
five-Agent manifest contract verification: PASS
reviewed five-Agent handoff verification: PASS
full feedback-loop verification: PASS
Content/Design/Video regeneration routing verification: PASS
git diff --check: PASS
```

The real D-drive `product-launch-readiness` report remains intentionally fail-closed:

```text
agentContracts.overall=passed
submissionReady=false
platform.platformReady=false
blocker=BOSSAI_OS_MANAGER_SOURCE_MISSING
automaticSubmissionAllowed=false
externalActions=0
```

Therefore the local Product Launch business/learning contracts are implemented and machine-verified, but the current authoritative BossAI OS `main` is still not a valid execution target. No commit, push, deployment, release signing, production launch or real-user validation occurred.
