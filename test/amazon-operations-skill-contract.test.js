import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);

async function readJson(relative) {
  return JSON.parse(await readFile(new URL(relative, root), "utf8"));
}

test("Listing and Advertising are governed Skills and own no Commerce state", async () => {
  const capabilities = await readJson("skill/commerce-capabilities.json");
  const listing = capabilities.capabilities.find((item) => item.id === "listing");
  const advertising = capabilities.capabilities.find((item) => item.id === "advertising");

  assert.equal(listing?.ownsCommerceState, false);
  assert.equal(advertising?.ownsCommerceState, false);
  assert.equal(listing?.contract, "contracts/listing.v1.json");
  assert.equal(advertising?.contract, "contracts/advertising.v1.json");
});

test("Listing contract preserves draft logic while publication stays Tool + Approval gated", async () => {
  const contract = await readJson("skill/contracts/listing.v1.json");
  assert.equal(contract.classification, "SKILL");
  assert.equal(contract.sourceMigration.repository, "bossai-amazon-ops");
  assert.equal(contract.sourceMigration.standaloneRuntimeAllowed, false);
  assert.equal(contract.knowledgeRequirements.authority, "bossai-os");
  const write = contract.toolRequirements.find((tool) => tool.id === "marketplace.listing.write");
  assert.equal(write?.approvalRequired, true);
  assert.equal(write?.skillMayExecuteDirectly, false);
  assert.equal(contract.outputContract.mustNotClaimPublishedWithoutToolReceipt, true);
});

test("Advertising contract preserves deterministic metrics and gates campaign mutation", async () => {
  const contract = await readJson("skill/contracts/advertising.v1.json");
  assert.equal(contract.classification, "SKILL");
  assert.ok(contract.sourceMigration.sources.includes("core/amazon-ops/ads-agent.ts"));
  assert.ok(contract.sourceMigration.sources.includes("core/search-term-analysis.ts"));
  const write = contract.toolRequirements.find((tool) => tool.id === "advertising.campaign.write");
  assert.equal(write?.approvalRequired, true);
  assert.equal(write?.skillMayExecuteDirectly, false);
  assert.equal(contract.outputContract.mustNotClaimCampaignChangedWithoutToolReceipt, true);
});
