import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { FRONT_DESK, listWorkModes, routeUserRequest } from "../src/router.js";

const ROUTE_CASES = [
  ["商品上新", "我有一张商品白底图，帮我做整套电商素材并把这个商品卖起来", "product-launch"],
  ["方向与决策", "项目太多了，帮我判断先做哪个、哪个应该暂停", "decision"],
  ["内容与个人IP", "写一组小红书文案和短视频口播脚本", "content"],
  ["客服与售后", "检查客服对话里的退款承诺，并给出售后处理建议", "customer-service"],
  ["销售与成交", "提炼销售卖点、报价方案和成交话术", "sales"],
  ["选品与运营", "做亚马逊选品分析、库存周转和店铺运营计划", "operations"],
  ["开发与交付", "检查软件测试、功能验收和上线交付条件", "delivery"]
];

for (const [name, request, expectedMode] of ROUTE_CASES) {
  test(`${name}请求路由到正确模式`, () => {
    const result = routeUserRequest(request);
    assert.equal(result.primaryMode.id, expectedMode);
    assert.equal(result.needsClarification, false);
    assert.ok(["medium", "high"].includes(result.confidence));
    assert.equal("roles" in result.primaryMode, false);
  });
}

test("客户始终只有 BossAI 电商总管一个入口", () => {
  const result = routeUserRequest("帮我检查这批客服对话有没有退款承诺风险");
  assert.equal(result.frontDesk.name, "BossAI 电商总管");
  assert.match(result.clientReply, /不需要找具体员工|不需要选择员工/);
  assert.ok(result.internalRoleIds.includes("customer-service"));
  assert.ok(result.internalRoleIds.includes("compliance"));
});

test("混合请求保留次要模式，并用模式分差避免虚报高置信度", () => {
  const result = routeUserRequest("先写短视频口播脚本，同时提炼销售卖点和成交话术");
  assert.ok(["content", "sales"].includes(result.primaryMode.id));
  assert.ok(result.secondaryModes.some((mode) => ["content", "sales"].includes(mode.id)));
  assert.equal(result.confidence, "medium");
  assert.equal(result.needsClarification, false);
});

test("客户、产品、项目等通用词不会单独造成误路由", () => {
  for (const request of ["这个客户的产品项目", "帮我看看这个产品", "这个项目怎么办"]) {
    const result = routeUserRequest(request);
    assert.equal(result.primaryMode.id, "decision");
    assert.equal(result.confidence, "low");
    assert.equal(result.needsClarification, true);
  }
});

test("弱信号且模式分差不足时明确为低置信度", () => {
  const result = routeUserRequest("写文案，也需要报价");
  assert.equal(result.confidence, "low");
  assert.equal(result.needsClarification, true);
  assert.equal(result.secondaryModes.length, 1);
  assert.match(result.clientReply, /最优先的结果/);
});

test("空请求由总管兜底，不暴露员工选择菜单", () => {
  const result = routeUserRequest(" ");
  assert.equal(result.primaryMode.id, "decision");
  assert.equal(result.needsClarification, true);
  assert.equal(result.clientReply, FRONT_DESK.greeting);
});

test("公开工作模式不暴露岗位或匹配规则", () => {
  const publicModes = listWorkModes();
  const internalModes = listWorkModes({ internal: true });
  assert.equal(publicModes.length, 7);
  assert.equal(FRONT_DESK.publicRules[0], "永远不要求客户先选择员工");
  assert.ok(publicModes.every((mode) => !("roles" in mode) && !("signals" in mode)));
  assert.ok(internalModes.every((mode) => Array.isArray(mode.roles) && !("signals" in mode)));
});

test("公开 route 和 modes CLI 输出不暴露后台岗位", () => {
  const routeOutput = runCli("route", "--text", "检查客服退款承诺");
  const modesOutput = runCli("modes");
  assert.equal("internalRoleIds" in routeOutput, false);
  assert.equal("roles" in routeOutput.primaryMode, false);
  assert.ok(modesOutput.modes.every((mode) => !("roles" in mode)));
});

function runCli(...args) {
  const output = execFileSync(process.execPath, ["bin/bossai-team.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  return JSON.parse(output);
}
