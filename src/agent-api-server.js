import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAgentApiServer } from "./agent-api.js";

export { createAgentApiHandler, createAgentApiServer, startAgentApiServer } from "./agent-api.js";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { host, port } = startAgentApiServer();
  process.stdout.write(`BossAI Ecommerce Manager Agent API listening on http://${host}:${port}\n`);
}
