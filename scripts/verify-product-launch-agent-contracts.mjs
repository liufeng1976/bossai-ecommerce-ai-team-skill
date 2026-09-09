#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildExecutionPack } from "../src/engine.js";
import { verifyProductLaunchAgentContracts } from "../src/product-launch-agent-contracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const prefix = `--${name}=`;
  const inline = args.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const projectsRoot = path.resolve(option("projects-root") || process.env.BOSSAI_PROJECTS_ROOT || path.dirname(repoRoot));
const inputPath = path.resolve(option("input") || path.join(repoRoot, "examples", "product-launch-input.json"));

try {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const pack = buildExecutionPack(input);
  if (!pack.productLaunch?.missionDraft) throw new Error("PRODUCT_LAUNCH_MISSION_DRAFT_NOT_GENERATED");
  const report = await verifyProductLaunchAgentContracts({ projectsRoot, missionDraft: pack.productLaunch.missionDraft });
  process.stdout.write(`${JSON.stringify({ ...report, input: inputPath }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    code: error instanceof Error && "code" in error ? String(error.code) : "PRODUCT_LAUNCH_AGENT_CONTRACT_VERIFICATION_FAILED",
    error: error instanceof Error ? error.message : String(error),
    details: error instanceof Error && "details" in error ? error.details : {},
    projectsRoot,
    input: inputPath,
    pluginCodeExecuted: false,
    registryMutated: false,
    providerCalls: 0,
    externalActions: 0,
  }, null, 2)}\n`);
  process.exitCode = 1;
}
