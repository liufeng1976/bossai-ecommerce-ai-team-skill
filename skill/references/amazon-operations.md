# Amazon Listing / Advertising Skill Rules

当任务涉及 Amazon Listing、Search Term、广告、ACOS、CTR、CPC、CVR、否定关键词、竞价、预算或 Seller Central 运营建议时，使用本规则。

## 边界

Amazon Ops 不再作为独立 AI 产品扩张。原仓库中的确定性分析资产按以下方式复用：

- Listing deterministic engine → `bossai-commerce.listing` Skill；
- Ads + Search Term deterministic analysis → `bossai-commerce.advertising` Skill；
- SP-API read client → BossAI Tool / Connector；
- Automotive Catalog / Pricing persistent business state → BossAI Commerce；
- Fulfillment business state → BossAI Commerce / Headquarters Commerce；
- Next/Electron operator shell → BossAI Agent 达到工作流 parity 后归档。

Runtime、Approval、Audit、Memory、Knowledge 和 AI Gateway 始终属于 BossAI OS。

## Listing SOP

1. 从 BossAI Commerce 取得真实 Product/SKU/Variant 事实。
2. 从 BossAI OS Knowledge 取得品牌与平台规则。
3. 对标题、Features、关键词和竞品信息标记来源。
4. 草拟 Title / Bullets / Description / Search Terms。
5. 对规格、认证、兼容性、性能、材料、尺寸等声明做证据检查。
6. 缺少证据的卖点写入 evidence gap，不得由模型补造。
7. 人工讨论并 Revision。
8. 真实发布必须进入 BossAI OS Approval，并调用 marketplace listing write Tool。
9. 没有 Tool receipt 不得写“已发布/已更新”。

原 `ListingAgent` 的确定性草稿逻辑可以作为 Draft Tool/Skill implementation 继续使用，但它不是 Agent Runtime，也不能成为 Listing Authority。

## Advertising SOP

1. 读取广告/搜索词事实，并记录来源时间。
2. 确定性计算 Spend / Sales / Orders / CTR / CPC / CVR / ACOS / ROAS。
3. 运行 Search Term 分析，识别浪费词、转化词、观察词。
4. 输出风险等级和建议：否定词、Exact、Bid、Budget、Targeting 等。
5. 明确“建议”与“已经修改”之间的区别。
6. 人工确认策略和预算。
7. Campaign/Bid/Budget/Targeting/Keyword 状态的任何真实写入必须进入 Approval + Tool。
8. Tool receipt 才能作为执行完成证据。

原 `AdsAgent` 和 `core/search-term-analysis.ts` 的确定性算法继续保留，不要求重写。

## 输入纪律

- 零值和缺失值不能互相替代；
- 未提供 Sales/Orders 时不得声称真实 ROAS/CVR；
- Search Term CSV 字段缺失时必须暴露 warning；
- 不能把建议加价、暂停、否定关键词说成已经执行；
- Amazon 平台规则、费用或 API 行为会变化时，需要真实 Connector/Knowledge 证据。

## 输出

Listing 至少输出：Verified Facts、Evidence Gaps、Title、Bullets、Description、Search Terms、Approval Status。

Advertising 至少输出：Source Facts、Calculated Metrics、Search Term Findings、Risk、Recommendations、Approval Status。
