# SKU Research / Market Intelligence / Daily Commerce Manager

## SKU Research

SKU Research 使用现有 SKU Market Opportunity V27 真实算法资产，不重新实现第二套选品引擎。

进入 V27 前必须存在真实候选 SKU 和成本/价格类证据。仅有设计概念、用户想法或社区热度时，先形成 Product Candidate/Research Task，不能直接伪造 SKU 输入。

V27 输出始终是 recommendation-only evidence。它可以提供 Opportunity Score、Market Demand、Evidence、Competition、Tier、Recommendation、Missing Signals 等，但不能直接创建 Product、改库存、上架、采购或投放。

## Market Intelligence

市场研究必须把：

- 公开事实；
- 内部事实；
- 推断；
- 反证；
- 未知项

分开。当前市场、规则、竞争、价格和趋势必须带来源与观察时间。没有证据时输出验证任务，不把想法写成“市场已验证”。

Web Acquisition 只能通过 BossAI OS governed Connector；Skill 不创建独立 crawler 平台、source database 或 Provider credential path。

## Daily Commerce Manager

Daily Commerce Manager 是 Skill，不是另一个 Manager Runtime。

它从 BossAI Commerce / Headquarters Commerce 读取当前事实，再汇总 SKU Research、Market Intelligence、Listing、Advertising、Customer Service、Review Analysis 的专业 Artifact，形成：

1. 今日经营事实；
2. 异常与风险；
3. 最优先的 3–5 项工作；
4. 每项建议的依据；
5. 哪些需要审批；
6. 下一次检查点。

Task、Scheduler、Approval、Audit、Memory 和执行状态始终由 BossAI OS 管理。Daily Commerce Manager 不建立自己的任务表或后台状态机。

## Authority discipline

- SKU / Product / Inventory → BossAI Commerce；
- Order / Payment / Customer / Refund / Fulfillment / Backoffice → Headquarters Commerce；
- Runtime / Task / Approval / Audit / Memory / Knowledge / AI Gateway → BossAI OS；
- Marketplace / Web / Supplier reads and writes → Tools / Connectors；
- Intelligence → Evidence / Analysis / Draft / Recommendation。

任何价格写入、上架、广告支出、退款、客户消息、采购、履约写入都必须走 Approval + Tool。没有 Tool receipt 不得宣称外部动作已经完成。
