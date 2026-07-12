import test from "node:test";
import assert from "node:assert/strict";
import { FRONT_DESK, listWorkModes, routeUserRequest } from "../src/router.js";

test("客户始终只有 BossAI 电商总管一个入口", () => {
  const result = routeUserRequest("帮我检查这批客服对话有没有退款承诺风险");
  assert.equal(result.frontDesk.name, "BossAI 电商总管");
  assert.equal(result.primaryMode.id, "customer-service");
  assert.match(result.clientReply, /不需要找具体员工|不需要选择员工/);
  assert.ok(result.internalRoleIds.includes("customer-service"));
  assert.ok(result.internalRoleIds.includes("compliance"));
});

test("内容请求自动路由到内容与个人IP，不要求客户选员工", () => {
  const result = routeUserRequest("帮我给这个产品写7天短视频口播和小红书文案");
  assert.equal(result.primaryMode.id, "content");
  assert.match(result.clientReply, /内容与个人IP/);
  assert.equal(result.needsClarification, false);
});

test("开发验收请求自动路由到开发与交付", () => {
  const result = routeUserRequest("检查这个软件的功能、Bug和安装包，现在能不能上线交付");
  assert.equal(result.primaryMode.id, "delivery");
  assert.ok(result.internalRoleIds.includes("product-qa"));
  assert.ok(result.internalRoleIds.includes("project-manager"));
});

test("模糊请求由总管兜底，不暴露员工选择菜单", () => {
  const result = routeUserRequest("帮我看看这个");
  assert.equal(result.primaryMode.id, "decision");
  assert.equal(result.needsClarification, true);
  assert.match(result.clientReply, /不需要选择员工/);
});

test("公开的是工作模式，岗位库只在内部调试时可见", () => {
  const publicModes = listWorkModes();
  const internalModes = listWorkModes({ internal: true });
  assert.equal(publicModes.length, 6);
  assert.equal(FRONT_DESK.publicRules[0], "永远不要求客户先选择员工");
  assert.ok(publicModes.every((mode) => !("roles" in mode)));
  assert.ok(internalModes.every((mode) => Array.isArray(mode.roles)));
});
