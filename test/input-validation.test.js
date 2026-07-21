import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertValidInputDocument,
  INPUT_COLLECTION_KEYS,
  validateInputDocument
} from "../src/input-validation.js";

const NOW = "2026-07-14T12:00:00+08:00";

function validate(raw, options = {}) {
  return validateInputDocument(raw, { now: NOW, ...options });
}

test("现有演示输入通过严格结构校验", async () => {
  const text = await readFile(new URL("../examples/demo-input.json", import.meta.url), "utf8");
  const result = validate(JSON.parse(text));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.collections, ["signals"]);
  assert.ok(result.warnings.some((message) => message.includes("自动批量")));
  assert.ok(result.warnings.every((message) => !message.includes("泛AI新闻聚合")));
});

test("兼容全部四种机会集合名称和字符串记录", () => {
  assert.deepEqual(INPUT_COLLECTION_KEYS, ["signals", "top_opportunities", "items", "opportunities"]);
  for (const collection of INPUT_COLLECTION_KEYS) {
    const result = validate({ [collection]: ["待验证机会"] });
    assert.equal(result.ok, true, collection);
    assert.equal(result.structuralErrors.length, 0, collection);
    assert.equal(result.evidenceWarnings.length, 2, collection);
  }
});

test("顶层必须是对象且必须包含非空机会数组", () => {
  for (const raw of [null, "signals", [], 1]) {
    const result = validate(raw);
    assert.equal(result.ok, false);
    assert.equal(result.structuralErrors[0].code, "invalid_top_level");
  }

  assert.equal(validate({}).structuralErrors[0].code, "missing_signal_collection");
  assert.equal(validate({ signals: {} }).structuralErrors[0].code, "invalid_collection");
  assert.equal(validate({ signals: [] }).structuralErrors[0].code, "empty_collection");
});

test("如果同时提供多个集合，会校验每个已提供集合", () => {
  const result = validate({
    signals: [{ title: "有效记录", source: "访谈", evidence: "客户原话" }],
    items: []
  });

  assert.equal(result.ok, false);
  assert.equal(result.structuralErrors[0].path, "$.items");
});

test("记录只能是非空字符串或带非空 title 的对象", () => {
  const result = validate({ signals: ["  ", null, [], {}, { title: 3 }, { title: " " }] });
  const codes = result.structuralErrors.map((issue) => issue.code);

  assert.deepEqual(codes, [
    "empty_signal",
    "invalid_signal",
    "invalid_signal",
    "missing_title",
    "invalid_title",
    "empty_title"
  ]);
});

test("business 与标签列表遵守 Schema 的字符串类型约束", () => {
  const result = validate({
    business: { name: 42, platforms: ["Amazon", 3], constraints: {} },
    signals: [{ title: "机会", tags: ["客服", false], summary: 7 }]
  });

  assert.deepEqual(
    result.structuralErrors.map((issue) => issue.path),
    ["$.business.name", "$.business.platforms[1]", "$.business.constraints", "$.signals[0].summary", "$.signals[0].tags[1]"]
  );
});

test("URL 必须是绝对 http 或 https 地址", () => {
  const accepted = validate({
    signals: [
      { title: "网页证据", url: "https://example.com/a?q=1" },
      { title: "别名链接", source_url: " http://example.com/source " }
    ]
  });
  assert.equal(accepted.ok, true);

  const rejected = validate({
    signals: [
      { title: "FTP", url: "ftp://example.com/file" },
      { title: "相对地址", link: "/source" },
      { title: "空地址", source_url: "" },
      { title: "错误类型", url: 7 }
    ]
  });
  assert.deepEqual(rejected.structuralErrors.map((issue) => issue.code), [
    "invalid_url", "invalid_url", "invalid_url", "invalid_url"
  ]);
});

test("日期必须真实可解析且不得明显未来", () => {
  const accepted = validate({
    signals: [
      { title: "当天", observed_at: "2026-07-14" },
      { title: "容忍时区偏差", date: "2026-07-15T03:00:00+08:00" }
    ]
  });
  assert.equal(accepted.ok, true);

  const rejected = validate({
    signals: [
      { title: "无效日历日期", observed_at: "2026-02-30" },
      { title: "不可解析", published_at: "昨天" },
      { title: "明显未来", observed_at: "2026-07-20" }
    ]
  });
  assert.deepEqual(rejected.structuralErrors.map((issue) => issue.code), [
    "invalid_date", "invalid_date", "future_date"
  ]);
});

test("计数与评分必须是合理的有限数值", () => {
  const accepted = validate({
    signals: [{ title: "数值可用", observed_count: 0, count: 3, score: 8.8, opportunity_score: 100 }]
  });
  assert.equal(accepted.ok, true);

  const rejected = validate({
    signals: [
      { title: "负计数", observed_count: -1 },
      { title: "小数计数", frequency: 1.5 },
      { title: "字符串计数", count: "3" },
      { title: "越界评分", score: 101 },
      { title: "非有限评分", priority_score: Number.NaN }
    ]
  });
  assert.deepEqual(rejected.structuralErrors.map((issue) => issue.code), [
    "invalid_count", "invalid_count", "invalid_count", "invalid_score", "invalid_score"
  ]);
});

test("证据质量告警不改变 ok，并与结构错误分开", () => {
  const result = validate({ signals: [{ title: "只有想法" }] });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.structuralErrors.length, 0);
  assert.deepEqual(result.evidenceWarnings.map((issue) => issue.code), ["missing_evidence", "missing_source"]);
  assert.equal(result.warnings.length, 2);
});

test("断言 API 返回原对象，并在结构错误时携带完整校验结果", () => {
  const raw = { signals: [{ title: "待验证" }] };
  assert.equal(assertValidInputDocument(raw, { now: NOW }), raw);

  assert.throws(
    () => assertValidInputDocument({ signals: [] }, { now: NOW }),
    (error) => {
      assert.equal(error.name, "InputValidationError");
      assert.equal(error.validationResult.ok, false);
      assert.deepEqual(error.validationErrors, error.validationResult.errors);
      return true;
    }
  );
});
