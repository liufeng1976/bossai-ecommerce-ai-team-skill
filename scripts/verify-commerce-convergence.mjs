import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const contractPath = path.join(root, 'skill', 'commerce-capabilities.json');
let contract;
try {
  contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
} catch (error) {
  failures.push(`commerce capability contract unreadable: ${error.message}`);
}

if (contract) {
  if (contract.schemaVersion !== 'bossai.commerce-intelligence-capabilities.v1') failures.push('unexpected commerce capability schemaVersion');
  if (contract.classification !== 'SKILL') failures.push('commerce intelligence package must be classified SKILL');
  if (contract.platformAuthority !== 'bossai-os') failures.push('BossAI OS must remain platform authority');
  if (contract.commerceAuthorities?.commerceCore !== 'bossai-commerce') failures.push('bossai-commerce must remain Commerce Core');
  if (contract.commerceAuthorities?.backoffice !== 'bossai-headquarters-commerce') failures.push('Headquarters Commerce must remain shared backoffice');

  const required = ['sku-research', 'market-intelligence', 'listing', 'advertising', 'customer-service', 'review-analysis', 'daily-commerce-manager'];
  const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
  const ids = new Set(capabilities.map((capability) => capability?.id));
  for (const id of required) if (!ids.has(id)) failures.push(`missing Commerce Skill capability ${id}`);
  for (const capability of capabilities) {
    if (capability?.ownsCommerceState !== false) failures.push(`${capability?.id || 'unknown'} must not own Commerce state`);
    if (!capability?.contract) failures.push(`${capability?.id || 'unknown'} must declare a canonical Skill contract`);
    if (!capability?.reference) failures.push(`${capability?.id || 'unknown'} must declare professional reference guidance`);
    if (capability?.contract) validateSkillContract(capability, failures);
    if (capability?.reference && !fs.existsSync(path.join(root, 'skill', capability.reference))) failures.push(`${capability.id}: reference file missing: ${capability.reference}`);
  }

  const prohibited = new Set(contract.prohibitedAuthorities || []);
  for (const authority of ['runtime', 'approval', 'audit', 'memory', 'knowledge-authority', 'ai-gateway', 'provider-router', 'product-store', 'sku-store', 'inventory-store', 'order-store', 'payment-store', 'refund-store', 'backoffice']) {
    if (!prohibited.has(authority)) failures.push(`missing prohibited authority ${authority}`);
  }
  if (contract.externalActions?.requiresBossAiOsApproval !== true) failures.push('external actions must require BossAI OS approval');
  if (contract.externalActions?.deterministicExecutionViaTools !== true) failures.push('external deterministic actions must execute through Tools/Connectors');
}

function validateSkillContract(capability, failures) {
  const file = path.join(root, 'skill', capability.contract);
  if (!fs.existsSync(file)) {
    failures.push(`${capability.id}: Skill contract file missing: ${capability.contract}`);
    return;
  }
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${capability.id}: Skill contract unreadable: ${error.message}`);
    return;
  }
  if (value.schemaVersion !== 'bossai.commerce-skill-contract.v1') failures.push(`${capability.id}: unexpected Skill contract schemaVersion`);
  if (value.classification !== 'SKILL') failures.push(`${capability.id}: contract must be classified SKILL`);
  if (value.platformAuthority !== 'bossai-os') failures.push(`${capability.id}: contract must delegate platform authority to BossAI OS`);
  const forbidden = new Set(value.prohibitedAuthorities || []);
  for (const authority of ['runtime', 'approval', 'audit', 'memory', 'knowledge-authority', 'ai-gateway', 'provider-router']) {
    if (!forbidden.has(authority)) failures.push(`${capability.id}: contract must prohibit ${authority}`);
  }
}

if (failures.length) {
  console.error('Commerce Skill convergence: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Commerce Skill convergence: PASS');
