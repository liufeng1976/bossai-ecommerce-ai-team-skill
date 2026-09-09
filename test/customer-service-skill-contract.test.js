import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);

async function readJson(relative) {
  return JSON.parse(await readFile(new URL(relative, root), "utf8"));
}

test("Customer Service and Review Analysis resolve to the same governed skill contract", async () => {
  const capabilities = await readJson("skill/commerce-capabilities.json");
  const customerService = capabilities.capabilities.find((item) => item.id === "customer-service");
  const reviewAnalysis = capabilities.capabilities.find((item) => item.id === "review-analysis");

  assert.ok(customerService);
  assert.ok(reviewAnalysis);
  assert.equal(customerService.ownsCommerceState, false);
  assert.equal(reviewAnalysis.ownsCommerceState, false);
  assert.equal(customerService.contract, "contracts/customer-service.v1.json");
  assert.equal(reviewAnalysis.contract, customerService.contract);
});

test("Customer Service contract delegates all platform and commerce authorities", async () => {
  const contract = await readJson("skill/contracts/customer-service.v1.json");

  assert.equal(contract.classification, "SKILL");
  assert.equal(contract.platformAuthority, "bossai-os");
  assert.equal(contract.commerceAuthorities.productSkuInventory, "bossai-commerce");
  assert.equal(contract.commerceAuthorities.ordersPaymentsCustomersRefundsFulfillmentBackoffice, "bossai-headquarters-commerce");
  assert.equal(contract.knowledgeRequirements.authority, "bossai-os");
  assert.equal(contract.knowledgeRequirements.localKnowledgeDatabaseAllowed, false);
  assert.equal(contract.sourceMigration.legacyKnowledgeCrudAuthority, false);
  assert.equal(contract.sourceMigration.legacyCaseStoreAuthority, false);

  for (const forbidden of [
    "runtime",
    "approval",
    "audit",
    "memory",
    "knowledge-authority",
    "ai-gateway",
    "provider-router",
    "order-store",
    "refund-store",
    "backoffice"
  ]) {
    assert.ok(contract.prohibitedAuthorities.includes(forbidden), `missing prohibited authority: ${forbidden}`);
  }
});

test("Customer Service external writes are approval-gated tools, never direct skill actions", async () => {
  const contract = await readJson("skill/contracts/customer-service.v1.json");
  const writes = contract.toolRequirements.filter((tool) => tool.access === "write");

  assert.ok(writes.length >= 2);
  assert.ok(writes.every((tool) => tool.approvalRequired === true));
  assert.ok(writes.every((tool) => tool.skillMayExecuteDirectly === false));
  assert.equal(contract.outputContract.mustNotClaimExternalExecutionWithoutToolReceipt, true);
});
