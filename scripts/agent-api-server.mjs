import { pathToFileURL } from "node:url";
import { startAgentApiServer } from "../src/agent-api.js";

export function start(options = {}) {
  return startAgentApiServer(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { host, port } = start();
  console.log(`BossAI Ecommerce Manager Agent API listening on http://${host}:${port}`);
}
