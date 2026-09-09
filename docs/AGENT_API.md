# BossAI Ecommerce Manager Agent API

This repository exposes a bounded local HTTP API so AI agents can discover and operate the ecommerce planning surface without scraping CLI output.

## Start

```bash
npm run agent:api
```

Default base URL:

```text
http://127.0.0.1:4191
```

Discovery:

```text
GET /.well-known/bossai-agent-api.json
GET /openapi.json
GET /api/agent/capabilities
```

Optional loopback bearer protection:

```text
BOSSAI_AGENT_API_KEY=<secret>
```

When configured, POST/PATCH Agent API operations require `Authorization: Bearer <secret>`. Discovery remains readable.

## Agent operations

- `POST /api/agent/route` — route one natural-language ecommerce request.
- `POST /api/agent/validate` — validate a structured Radar/ecommerce input document.
- `POST /api/agent/plan` — compile a reviewable execution plan without storing it.
- `POST /api/agent/execution-packs` — create a process-local execution pack that an Agent can operate.
- `GET /api/agent/execution-packs/{packId}` — read the current process-local pack.
- `PATCH /api/agent/execution-packs/{packId}/tasks/{taskId}` — operate the local task-board lifecycle.
- `POST /api/agent/bossai-handoff` — compile, but do not submit, a BossAI OS `/api/manager/tasks` request.

The execution-pack API is deliberately process-local. It is an **AI Assistant / planning surface**, not a persistent AI Employee Runtime.

## BossAI Agent integration

BossAI Agent should read `agent-api.json` first. The preferred integration pattern is:

```text
BossAI Agent
→ BossAI OS governed Connector / MCP / Tool adapter
→ this local Agent API
→ route / validate / plan / local task operations
```

For persistent employee execution:

```text
BossAI Agent / product
→ BossAI OS Manager task
→ installed Agent Plugin
→ Hermes bossaiworkforce
→ Approval / Audit / Memory / AI Gateway
```

The `bossai-handoff` operation only compiles the Manager request; it intentionally returns `submitted=false`. This repository does not possess BossAI OS task submission authority.

## Current remote-auth limitation

BossAI OS does not yet provide a generalized cross-product machine-to-machine token exchange. Therefore:

- do not use an upstream AI Provider key as Agent authentication;
- do not copy the BossAI OS desktop token into this project;
- do not expose this loopback service on a public interface without an approved authenticated proxy/service-identity boundary;
- do not describe a process-local execution-pack task as a BossAI OS Manager task.

## Safety boundary

This API has no operation for publishing, customer messaging, purchases, payments, refunds, compensation, account mutation or deletion. Those actions must use the relevant governed BossAI OS action contract after the required human approval.
