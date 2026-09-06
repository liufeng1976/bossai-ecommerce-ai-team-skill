#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildExecutionPack, validateInput } from "../src/engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "examples", "demo-input.json");
const snapshotPath = path.join(root, "examples", "demo-output-summary.json");

const raw = JSON.parse(await readFile(inputPath, "utf8"));
const expected = JSON.parse(await readFile(snapshotPath, "utf8"));
const validation = validateInput(raw);
if (!validation.ok) {
  throw new Error(`Demo input is invalid: ${JSON.stringify(validation.errors)}`);
}

const pack = buildExecutionPack(raw, { limit: 5, maxRoles: 10 });
const actual = {
  schemaVersion: "bossai.ecommerce-demo-summary.v1",
  sourceInput: "examples/demo-input.json",
  frontDesk: pack.interface.frontDesk.name,
  primaryWorkMode: pack.interface.primaryWorkMode.name,
  selectedOpportunity: pack.decision.selectedOpportunity,
  internalActiveRoleCount: pack.team.active.length,
  internalActiveRoles: pack.team.active.map((role) => role.name),
  taskCount: pack.tasks.length,
  validationWarningCount: validation.warnings.length,
  validationWarnings: validation.warnings
};

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error("Verified demo snapshot drift detected.");
  console.error("Expected:");
  console.error(JSON.stringify(expected, null, 2));
  console.error("Actual:");
  console.error(JSON.stringify(actual, null, 2));
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ ok: true, ...actual }, null, 2)}\n`);
