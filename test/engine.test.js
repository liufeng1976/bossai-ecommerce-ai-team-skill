import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildExecutionPack, normalizeInput, validateInput } from "../src/engine.js";

const business = {
  name: "跨境客服副驾驶",
  platforms: ["Amazon"],
  customer: "跨境卖家",
  goal: "验证物流查单和英文回复草稿是否值得付费",
  offer: "人工导入订单并生成回复草稿",
  constraints: ["不自动发送客户消息"]
};

test("兼容 BossAI Radar Lite top_opportunities 并排除 noise", () => {
  const normalized = normalizeInput({
    business,
    top_opportunities: [
      { title: "物流查单痛点", source: "访谈", evidence: "3名卖家重复提到", tags: ["客服", "物流"] },
      { title: "泛新闻", status: "noise", source: "资讯" }
    ]
  });
  assert.equal(normalized.metadata.sourceType, "bossai-radar-lite");
  assert.equal(normalized.signals.length, 1);
  assert.equal(normalized.signals[0].title, "物流查单痛点");
});

test("缺少证据时不冒充已验证机会，而是生成情报核验任务", () => {
  const pack = buildExecutionPack({
    business,
    signals: [{ title: "自动给所有客户发物流消息", tags: ["自动化", "客户消息"] }]
  });
  assert.equal(pack.rankedSignals[0].score.confidence, "low");
  assert.ok(pack.tasks.length >= 4);
  const verificationTask = pack.tasks.find((task) => /核验机会/.test(task.title));
  const validationAssetsTask = pack.tasks.find((task) => task.plannedDay === 4);
  const controlledPilotTask = pack.tasks.find((task) => task.plannedDay === 6);
  const finalReviewTask = pack.tasks.find((task) => task.plannedDay === 7);
  assert.equal(verificationTask.roleId, "radar");
  assert.match(verificationTask.approvalGate, /不自动执行外部动作|必须由人确认/);
  assert.ok(validationAssetsTask);
  assert.ok(controlledPilotTask);
  assert.ok(finalReviewTask);
  assert.match(finalReviewTask.title, /继续\/调整\/暂停\/放弃/);
});

test("高相关客服与退款信号会动态启用客服和合规岗位", () => {
  const pack = buildExecutionPack({
    business,
    signals: [{
      title: "退款退货回复存在平台规则风险",
      summary: "客服可能错误承诺退款、补发和物流时效。",
      source: "历史客服记录",
      evidence: "20段对话中6段出现未经核对的承诺。",
      observed_count: 6,
      tags: ["客服", "退款", "退货", "合规"]
    }]
  }, { maxRoles: 10 });
  const ids = new Set(pack.team.active.map((role) => role.id));
  assert.ok(ids.has("strategy"));
  assert.ok(ids.has("project-manager"));
  assert.ok(ids.has("customer-service"));
  assert.ok(ids.has("compliance"));
});

test("每个任务都有交付物、验收标准、最低成本验证和审批闸门", () => {
  const pack = buildExecutionPack({
    business,
    signals: [{
      title: "卖家重复处理物流延误与订单查询",
      summary: "需要在承运商、订单系统和客服窗口之间切换。",
      source: "客户访谈",
      url: "https://example.com/interview",
      evidence: "3名卖家表达同类问题。",
      observed_count: 3,
      tags: ["客服", "物流", "订单", "报价"]
    }]
  });
  assert.ok(pack.tasks.length >= 3);
  for (const task of pack.tasks) {
    assert.ok(task.output);
    assert.ok(task.acceptanceCriteria.length >= 4);
    assert.ok(task.cheapestValidation);
    assert.ok(task.approvalGate);
    assert.equal(task.status, "todo");
  }
});

test("验证器拒绝没有任何信号的输入", () => {
  const result = validateInput({ business, signals: [] });
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("至少需要一条"));
});

test("执行引擎拒绝非法 URL、日期和字段类型", () => {
  const invalidInputs = [
    { business, signals: [{ title: "非法 URL", url: "/relative" }] },
    { business, signals: [{ title: "非法日期", observed_at: "2026-02-30" }] },
    { business, signals: [{ title: "非法类型", observed_count: "3" }] }
  ];

  for (const input of invalidInputs) {
    const result = validateInput(input);
    assert.equal(result.ok, false);
    assert.ok(result.structuredValidation.structuralErrors.length > 0);
    assert.throws(
      () => buildExecutionPack(input),
      (error) => {
        assert.deepEqual(error.validationErrors, result.errors);
        assert.equal(error.validationResult.ok, false);
        return true;
      }
    );
  }
});

test("证据警告与业务警告合并后不会重复", () => {
  const result = validateInput({
    signals: [
      { title: "重复想法" },
      { title: "重复想法" }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, new Set(result.warnings).size);
  assert.equal(result.warnings.filter((warning) => warning.includes("缺少可复核证据")).length, 1);
  assert.equal(result.warnings.filter((warning) => warning.includes("缺少 source 或 url")).length, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("目标客户尚未明确")));
  assert.ok(result.warnings.some((warning) => warning.includes("产品或服务尚未明确")));
});

test("保留顶层数组与四种集合的现有兼容输入", () => {
  const collections = ["signals", "top_opportunities", "items", "opportunities"];
  const signal = { title: "兼容输入", source: "客户访谈", evidence: "两名客户重复提出" };

  for (const collection of collections) {
    const result = validateInput({ business, [collection]: [signal] });
    assert.equal(result.ok, true, collection);
    assert.equal(result.normalized.signals[0].title, signal.title, collection);
  }

  const arrayResult = validateInput([signal]);
  assert.equal(arrayResult.ok, true);
  assert.equal(arrayResult.normalized.signals[0].title, signal.title);
  assert.doesNotThrow(() => buildExecutionPack([signal]));
});

test("现有演示输入仍可生成执行包", async () => {
  const text = await readFile(new URL("../examples/demo-input.json", import.meta.url), "utf8");
  const pack = buildExecutionPack(JSON.parse(text));

  assert.ok(pack.rankedSignals.length > 0);
  assert.ok(pack.tasks.length > 0);
});

test("综合评分会优先保留显式高分且证据完整的机会", () => {
  const pack = buildExecutionPack({
    business,
    signals: [
      { title: "低证据想法", source: "内部", tags: ["客服"], score: 9.5 },
      {
        title: "有付费证据的物流查单",
        summary: "客户明确愿意使用人工导入订单的首版。",
        source: "客户访谈",
        url: "https://example.com/source",
        evidence: "客户愿意付费测试。",
        customer_quote: "可以先上传订单表测试。",
        observed_count: 3,
        tags: ["客服", "物流", "订单"],
        score: 9
      }
    ]
  });
  assert.equal(pack.rankedSignals[0].title, "有付费证据的物流查单");
});
