import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentApiServer } from "../src/agent-api.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function withServer(options, run) {
  const server = createAgentApiServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { response, body };
}

test("Agent API exposes discovery, capabilities, route and BossAI handoff without external execution", async () => {
  await withServer({ env: {} }, async (base) => {
    const manifest = await jsonRequest(`${base}/.well-known/bossai-agent-api.json`);
    assert.equal(manifest.response.status, 200);
    assert.equal(manifest.body.schema, "bossai.agent-api.v1");
    assert.equal(manifest.body.authority.runtime, "bossai-os");

    const capabilities = await jsonRequest(`${base}/api/agent/capabilities`);
    assert.equal(capabilities.body.schema, "bossai.agent-api-capabilities.v1");
    assert.equal(capabilities.body.automaticExternalActions, false);
    assert.ok(capabilities.body.operations.some((item) => item.id === "plan"));

    const routed = await jsonRequest(`${base}/api/agent/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "这批客服对话有退款承诺风险，帮我检查" }),
    });
    assert.equal(routed.response.status, 200);
    assert.equal(routed.body.schema, "bossai.ecommerce-agent-route.v1");
    assert.equal(routed.body.automaticExternalActions, false);

    const handoff = await jsonRequest(`${base}/api/agent/bossai-handoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "分析这些客服对话并生成待审核回复方案" }),
    });
    assert.equal(handoff.response.status, 200);
    assert.equal(handoff.body.targetAuthority, "bossai-os");
    assert.equal(handoff.body.targetPath, "/api/manager/tasks");
    assert.equal(handoff.body.submitted, false);
    assert.equal(handoff.body.payload.taskInput.automaticExternalActions, false);
  });
});

test("Agent API compiles an in-memory execution pack", async () => {
  const input = JSON.parse(fs.readFileSync(path.join(root, "examples", "demo-input.json"), "utf8"));
  await withServer({ env: {} }, async (base) => {
    const result = await jsonRequest(`${base}/api/agent/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.schema, "bossai.ecommerce-agent-plan.v1");
    assert.equal(result.body.executionAuthority, "bossai-os");
    assert.equal(result.body.automaticExternalActions, false);
    assert.ok(result.body.pack.tasks.length > 0);
  });
});

test("Configured bearer protects mutation-style POST surfaces while discovery stays readable", async () => {
  await withServer({ env: { BOSSAI_AGENT_API_KEY: "test-agent-api-key" } }, async (base) => {
    const discovery = await fetch(`${base}/api/agent/capabilities`);
    assert.equal(discovery.status, 200);

    const denied = await fetch(`${base}/api/agent/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${base}/api/agent/route`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-agent-api-key" },
      body: JSON.stringify({ text: "hello" }),
    });
    assert.equal(allowed.status, 200);
  });
});
