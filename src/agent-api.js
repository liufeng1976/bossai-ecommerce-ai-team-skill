import http from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildExecutionPack } from "./engine.js";
import { validateInputDocument } from "./input-validation.js";
import { routeUserRequest, listWorkModes, FRONT_DESK } from "./router.js";
import { summarizeTasks, validateTaskTransition } from "./lifecycle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4191;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

const agentApiManifest = readJson("agent-api.json");
const openApiDocument = readJson("openapi/agent-api.json");

function sendJson(response, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(payload.length),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("AGENT_API_BODY_TOO_LARGE");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const decoded = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("invalid");
    return decoded;
  } catch {
    const error = new Error("AGENT_API_JSON_INVALID");
    error.status = 400;
    throw error;
  }
}

function requireBearerIfConfigured(request, env) {
  const configured = String(env.BOSSAI_AGENT_API_KEY || "").trim();
  if (!configured) return;
  const authorization = String(request.headers.authorization || "");
  if (authorization !== `Bearer ${configured}`) {
    const error = new Error("AGENT_API_UNAUTHORIZED");
    error.status = 401;
    throw error;
  }
}

function normalizedHost(env) {
  const host = String(env.BOSSAI_AGENT_API_HOST || DEFAULT_HOST).trim();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("AGENT_API_NON_LOOPBACK_BINDING_DENIED");
  }
  return host;
}

function normalizedPort(env) {
  const port = Number(env.BOSSAI_AGENT_API_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("AGENT_API_PORT_INVALID");
  return port;
}

function routingResponse(text) {
  const routing = routeUserRequest(String(text || ""));
  return {
    schema: "bossai.ecommerce-agent-route.v1",
    frontDesk: FRONT_DESK.name,
    routing,
    automaticExternalActions: false,
  };
}

function validationResponse(input) {
  const validation = validateInputDocument(input);
  return {
    schema: "bossai.ecommerce-agent-validation.v1",
    ...validation,
    automaticExternalActions: false,
  };
}

function planResponse(input) {
  const validation = validateInputDocument(input);
  if (!validation.ok) {
    const error = new Error("AGENT_API_INPUT_INVALID");
    error.status = 400;
    error.details = validation;
    throw error;
  }
  const pack = buildExecutionPack(input);
  return {
    schema: "bossai.ecommerce-agent-plan.v1",
    pack,
    automaticExternalActions: false,
    executionAuthority: "bossai-os",
  };
}

function bossAiHandoffResponse(text) {
  const objective = String(text || "").trim();
  if (objective.length < 3 || objective.length > 5000) {
    const error = new Error("AGENT_API_OBJECTIVE_INVALID");
    error.status = 400;
    throw error;
  }
  const routing = routeUserRequest(objective);
  return {
    schema: "bossai.manager-task-proposal.v1",
    targetAuthority: "bossai-os",
    targetMethod: "POST",
    targetPath: "/api/manager/tasks",
    payload: {
      objective,
      priority: "medium",
      riskLevel: "L2",
      requiresApproval: false,
      taskInput: {
        schema: "bossai.ecommerce-manager-handoff.v1",
        source: "bossai-ecommerce-ai-team-skill",
        workMode: routing.primaryMode?.id || null,
        routingConfidence: routing.confidence || null,
        automaticExternalActions: false,
      },
    },
    submitted: false,
    automaticExternalActions: false,
  };
}

export function createAgentApiHandler(options = {}) {
  const env = options.env || process.env;
  const executionPacks = new Map();
  return async function handleAgentApi(request, response) {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, {
          ok: true,
          schema: "bossai.agent-api-health.v1",
          service: agentApiManifest.id,
          version: agentApiManifest.version,
          automaticExternalActions: false,
        });
      }
      if (request.method === "GET" && url.pathname === "/.well-known/bossai-agent-api.json") {
        return sendJson(response, 200, agentApiManifest);
      }
      if (request.method === "GET" && url.pathname === "/openapi.json") {
        return sendJson(response, 200, openApiDocument);
      }
      if (request.method === "GET" && url.pathname === "/api/agent/capabilities") {
        return sendJson(response, 200, {
          schema: "bossai.agent-api-capabilities.v1",
          id: agentApiManifest.id,
          version: agentApiManifest.version,
          operations: agentApiManifest.operations,
          workModes: listWorkModes(),
          bossaiConnector: agentApiManifest.bossaiConnector,
          automaticExternalActions: false,
        });
      }

      requireBearerIfConfigured(request, env);

      if (request.method === "POST" && url.pathname === "/api/agent/route") {
        const body = await readBody(request);
        return sendJson(response, 200, routingResponse(body.text));
      }
      if (request.method === "POST" && url.pathname === "/api/agent/validate") {
        const body = await readBody(request);
        return sendJson(response, 200, validationResponse(body.input));
      }
      if (request.method === "POST" && url.pathname === "/api/agent/plan") {
        const body = await readBody(request);
        return sendJson(response, 200, planResponse(body.input));
      }
      if (request.method === "POST" && url.pathname === "/api/agent/bossai-handoff") {
        const body = await readBody(request);
        return sendJson(response, 200, bossAiHandoffResponse(body.text));
      }
      if (request.method === "POST" && url.pathname === "/api/agent/execution-packs") {
        const body = await readBody(request);
        const plan = planResponse(body.input);
        const packId = randomUUID();
        const now = new Date().toISOString();
        const record = {
          schema: "bossai.ecommerce-agent-execution-pack.v1",
          packId,
          createdAt: now,
          updatedAt: now,
          persistence: "process-local",
          authority: "bossai-ecommerce-ai-team-skill",
          runtimeAuthority: "bossai-os",
          pack: structuredClone(plan.pack),
          taskSummary: summarizeTasks(plan.pack.tasks || []),
          automaticExternalActions: false,
        };
        executionPacks.set(packId, record);
        return sendJson(response, 201, record);
      }
      const executionPackMatch = url.pathname.match(/^\/api\/agent\/execution-packs\/([0-9a-f-]{36})$/i);
      if (request.method === "GET" && executionPackMatch) {
        const record = executionPacks.get(executionPackMatch[1]);
        if (!record) return sendJson(response, 404, { error: { code: "AGENT_API_PACK_NOT_FOUND" } });
        return sendJson(response, 200, record);
      }
      const executionTaskMatch = url.pathname.match(/^\/api\/agent\/execution-packs\/([0-9a-f-]{36})\/tasks\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/i);
      if (request.method === "PATCH" && executionTaskMatch) {
        const record = executionPacks.get(executionTaskMatch[1]);
        if (!record) return sendJson(response, 404, { error: { code: "AGENT_API_PACK_NOT_FOUND" } });
        const task = record.pack.tasks?.find((item) => item.id === executionTaskMatch[2]);
        if (!task) return sendJson(response, 404, { error: { code: "AGENT_API_TASK_NOT_FOUND" } });
        const body = await readBody(request);
        const transition = validateTaskTransition(task.status || "todo", body.status, {
          blockedReason: body.blockedReason,
          acceptanceRecord: body.acceptanceRecord,
          note: body.note,
        });
        const now = new Date().toISOString();
        task.status = transition.toStatus;
        task.updatedAt = now;
        task.history = Array.isArray(task.history) ? task.history : [];
        task.history.push({
          id: randomUUID(),
          at: now,
          actor: "agent-api",
          from: transition.fromStatus,
          to: transition.toStatus,
          note: typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null,
          blockedReason: transition.blockedReason || null,
          acceptanceRecord: transition.acceptanceRecord || null,
        });
        if (transition.blockedReason) task.blockedReason = transition.blockedReason;
        if (transition.acceptanceRecord) task.acceptanceRecord = transition.acceptanceRecord;
        record.updatedAt = now;
        record.taskSummary = summarizeTasks(record.pack.tasks || []);
        return sendJson(response, 200, {
          schema: "bossai.ecommerce-agent-task-update.v1",
          packId: record.packId,
          task,
          taskSummary: record.taskSummary,
          automaticExternalActions: false,
        });
      }
      return sendJson(response, 404, { error: { code: "AGENT_API_NOT_FOUND" } });
    } catch (error) {
      const status = Number(error?.status || 500);
      return sendJson(response, status >= 400 && status <= 599 ? status : 500, {
        error: {
          code: String(error?.message || "AGENT_API_FAILED"),
          ...(error?.details ? { details: error.details } : {}),
        },
      });
    }
  };
}

export function createAgentApiServer(options = {}) {
  return http.createServer(createAgentApiHandler(options));
}

export function startAgentApiServer(options = {}) {
  const env = options.env || process.env;
  const host = normalizedHost(env);
  const port = normalizedPort(env);
  const server = createAgentApiServer({ ...options, env });
  server.listen(port, host);
  return { server, host, port };
}
