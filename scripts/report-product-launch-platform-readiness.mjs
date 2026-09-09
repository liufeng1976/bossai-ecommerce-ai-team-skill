import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProductLaunchPlatformReadiness } from "../src/product-launch-platform-readiness.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectsRoot = process.env.BOSSAI_PROJECTS_ROOT
  ? path.resolve(process.env.BOSSAI_PROJECTS_ROOT)
  : path.resolve(root, "..");
const report = await inspectProductLaunchPlatformReadiness({ projectsRoot });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
