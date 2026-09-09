import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);

async function readJson(relative) {
  return JSON.parse(await readFile(new URL(relative, root), "utf8"));
}

test("all canonical Commerce Intelligence capabilities resolve to governed contracts", async () => {
  const capabilities = await readJson("skill/commerce-capabilities.json");
  const expected = {
    "sku-research": "contracts/sku-research.v1.json",
    "market-intelligence": "contracts/market-intelligence.v1.json",
    listing: "contracts/listing.v1.json",
    advertising: "contracts/advertising.v1.json",
    "customer-service": "contracts/customer-service.v1.json",
    "review-analysis": "contracts/customer-service.v1.json",
    "daily-commerce-manager": "contracts/daily-commerce-manager.v1.json"
  };

  for (const [id, contract] of Object.entries(expected)) {
    const capability = capabilities.capabilities.find((item) => item.id === id);
    assert.ok(capability, `missing capability ${id}`);
    assert.equal(capability.ownsCommerceState, false, `${id} must not own Commerce state`);
    assert.equal(capability.contract, contract, `${id} must resolve to canonical contract`);
    assert.ok(capability.reference, `${id} must have professional reference guidance`);
  }
});

test("SKU Research preserves V27 while remaining recommendation-only", async () => {
  const contract = await readJson("skill/contracts/sku-research.v1.json");
  assert.equal(contract.classification, "SKILL");
  assert.equal(contract.sourceMigration.repository, "bossai-intelligence-agent");
  assert.equal(contract.sourceMigration.engine, "SKU Market Opportunity V27");
  assert.equal(contract.sourceMigration.standalonePlatformAllowed, false);
  assert.equal(contract.inputContract.conceptWithoutCandidateSkuMayNotEnterV27, true);
  assert.equal(contract.outputContract.resultContract, "bossai.intelligence.sku-validation-result.v1");
  assert.equal(contract.outputContract.authority, "recommendation-only");
  assert.equal(contract.outputContract.mustNotInventTargetPriceOrMargin, true);
  assert.equal(contract.outputContract.mustNotCreateProductOrListing, true);
});

test("Market Intelligence uses governed acquisition and cannot become a crawler platform", async () => {
  const contract = await readJson("skill/contracts/market-intelligence.v1.json");
  assert.equal(contract.platformAuthority, "bossai-os");
  assert.equal(contract.inputContract.freshPublicClaimsRequireCurrentEvidence, true);
  assert.equal(contract.knowledgeRequirements.localKnowledgeAuthorityAllowed, false);
  const web = contract.toolRequirements.find((tool) => tool.id === "web-acquisition.read");
  assert.equal(web?.access, "read");
  assert.equal(web?.governanceAuthority, "bossai-os");
  assert.ok(contract.prohibitedAuthorities.includes("crawler-platform"));
  assert.equal(contract.outputContract.authority, "research-and-recommendation-only");
});

test("Daily Commerce Manager is orchestration knowledge, not a second Manager runtime", async () => {
  const contract = await readJson("skill/contracts/daily-commerce-manager.v1.json");
  assert.equal(contract.classification, "SKILL");
  assert.equal(contract.delegation.taskAuthority, "bossai-os");
  assert.equal(contract.delegation.mayCreateLocalTaskStateMachine, false);
  assert.equal(contract.delegation.mayImpersonateSpecialistResults, false);
  assert.deepEqual(contract.delegation.allowedSkillDependencies, [
    "sku-research",
    "market-intelligence",
    "listing",
    "advertising",
    "customer-service",
    "review-analysis"
  ]);
  assert.equal(contract.outputContract.mustNotClaimExecutionWithoutToolReceipt, true);
  for (const authority of ["runtime", "task-authority", "scheduler", "approval", "audit", "memory", "knowledge-authority", "ai-gateway", "provider-router", "commerce-state", "backoffice"]) {
    assert.ok(contract.prohibitedAuthorities.includes(authority), `Daily Commerce Manager must forbid ${authority}`);
  }
});
