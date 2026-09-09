import assert from "node:assert/strict";
import test from "node:test";
import { createAgentApiServer } from "../src/agent-api.js";

async function withServer(run) {
  const server = createAgentApiServer({ env: {} });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return { response, body: await response.json() };
}

const input = {
  business: {
    name: "Agent API test store",
    customer: "US Amazon sellers",
    goal: "Reduce repetitive delivery-delay support work",
    offer: "Customer-service operations",
  },
  signals: [{
    title: "Sellers repeatedly ask for delivery-delay reply workflows",
    source: "https://example.com/evidence",
    score: 90,
  }],
};

test("canonical Agent API exposes BossAI authority and local task operations", async () => {
  await withServer(async (baseUrl) => {
    const discovery = await json(baseUrl, "/.well-known/bossai-agent-api.json");
    assert.equal(discovery.response.status, 200);
    assert.equal(discovery.body.authority.runtime, "bossai-os");
    assert.equal(discovery.body.authority.ownsRuntime, false);
    assert.equal(discovery.body.bossaiConnector.persistentEmployeeExecution, "bossai-os");
    assert.ok(discovery.body.operations.some((item) => item.id === "execution-pack.task.update"));

    const capabilities = await json(baseUrl, "/api/agent/capabilities");
    assert.equal(capabilities.response.status, 200);
    assert.equal(capabilities.body.automaticExternalActions, false);

    const created = await json(baseUrl, "/api/agent/execution-packs", {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.persistence, "process-local");
    assert.equal(created.body.runtimeAuthority, "bossai-os");
    assert.equal(created.body.automaticExternalActions, false);
    assert.ok(created.body.pack.tasks.length > 0);

    const task = created.body.pack.tasks[0];
    const updated = await json(baseUrl, `/api/agent/execution-packs/${created.body.packId}/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in-progress", note: "Agent started local review work" }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.task.status, "in-progress");
    assert.equal(updated.body.automaticExternalActions, false);

    const reread = await json(baseUrl, `/api/agent/execution-packs/${created.body.packId}`);
    assert.equal(reread.response.status, 200);
    assert.equal(reread.body.pack.tasks.find((item) => item.id === task.id).status, "in-progress");
  });
});
