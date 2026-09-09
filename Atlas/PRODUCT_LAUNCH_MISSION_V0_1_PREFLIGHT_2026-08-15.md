# BossAI 电商总管 · Product Launch Mission v0.1 Preflight

日期：2026-08-15

## 最高商业目标

让老板不再逐个操作“抠图 / 场景图 / 文案 / 视频”等 AI 工具，而是把一个商品和已有资产交给 BossAI 电商总管，由系统形成可审核、可继续交给 BossAI OS Manager 的完整商品上新任务包。

## 当前最大用户缺口

现有执行引擎要求必须先提供市场 signal / opportunity。用户已经有商品、白底图或商品资料并希望“上新 / 卖起来”时，反而无法直接启动。

## 用户问题

用户需要从“我有一个商品”直接进入商品理解、证据核验、价值主张、渠道素材规划、内容/设计/视频协作和人工审核，而不是先理解内部员工、功能按钮或机会数据结构。

## 用户可见变化

- 识别 Product Launch / 商品上新类请求；
- 允许“商品 + 资产 + 上新目标”在没有市场 signals 时创建执行包；
- 输出 Product Profile、事实/未知项、视觉保真规则；
- 输出平台化 Asset Plan；
- 输出面向 `bossai.manager-mission.v1` 的多 Agent Mission 草案；
- 保留单一 BossAI 电商总管入口。

## 范围

- 电商总管 Skill 内的 Product Launch 意图识别；
- 输入校验的安全放宽；
- 商品事实边界；
- 素材规划；
- BossAI OS Manager Mission 草案编译；
- 执行包渲染与测试。

## 不在本批范围

- 不在 BossAI OS 内硬编码电商业务流程；
- 不创建第二套 Runtime / Scheduler / Approval / Audit / Memory；
- 不自动调用真实图片或视频 Provider；
- 不自动发布、上架、投放、发送客户消息、改价、付款或退款；
- 不虚构产品规格、客户画像、竞品数据、转化率或市场验证；
- 不宣称生产就绪、上线或真实用户验证完成。

## 能力分类

本批是 BossAI 电商总管的业务编排 Skill / AI Assistant 层能力。持续任务、Agent Run、审批、审计和执行权仍属于 BossAI OS + Hermes `bossaiworkforce`。

## 真实入口验收

使用最小输入：

- 一个明确商品或 offer；
- 至少一个商品资产（例如 `product-white-background.jpg`）；
- 目标包含“上新 / 卖起来 / product launch”等意图；
- 可选目标平台。

验收执行：`npm test` 与 `npm run check`。

## 目标完成级别

仅主张源码级 / 本地执行包技术闭环。不会提高任何 BossAI Agent 的 productionReady、actuallyLaunched、realUserValidated 或 formalAIEmployeeRegistered 状态。
