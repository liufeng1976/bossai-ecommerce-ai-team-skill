# BossAI Ecommerce Manager Skill

Customers talk to one front desk only: **BossAI Ecommerce Manager**. They describe the problem in natural language; the Manager selects internal work modes and AI roles, coordinates the work, and returns one unified result.

Customers are never asked to choose among employees. The 16 roles are backstage capabilities, not a user-facing menu.

It includes:

- a zero-dependency Node.js CLI;
- 16 ecommerce AI roles;
- evidence and business-fit scoring;
- dynamic role selection;
- a seven-day execution plan;
- task cards with facts, inferences, deliverables, acceptance criteria, and approval gates;
- agent self-installation for OpenClaw, Hermes, Claude Code, and Codex;
- unit and integration tests.

## Quick start

Requires Node.js 20.11 or newer.

```bash
npm test
npm run demo
```

This command regenerates `outputs/demo` with `--clean`. Existing files are removed only when the directory contains a verifiable BossAI `manifest.json`; cleanup is refused for an ordinary non-empty directory.

Test automatic routing:

```bash
node bin/bossai-team.mjs route --text "Review these customer-service conversations for refund and delivery-risk replies"
```

Create an input template:

```bash
node bin/bossai-team.mjs init --output bossai-team-input.json
```

Validate and generate an execution pack:

```bash
node bin/bossai-team.mjs validate --input bossai-team-input.json
node bin/bossai-team.mjs plan --input bossai-team-input.json --output outputs/latest
```

The CLI accepts generic `signals`, `items`, `opportunities`, BossAI Radar Lite `top_opportunities`, and Markdown project notes.

## Agent installation

```bash
npx -y github:liufeng1976/bossai-ecommerce-ai-team-skill --agent codex
```

Supported values:

```text
openclaw
hermes
claude
codex
```

## Safety

The default interaction mode is a single front desk with hidden backstage roles. The operational mode is local analysis, drafting, planning, and verification only. The Skill does not automatically publish content, message customers, control platform accounts, purchase, pay, refund, delete data, or make external promises.

Unsupported ideas are converted into evidence-verification tasks and are never represented as validated opportunities.

## License

PolyForm Noncommercial 1.0.0. Source viewing, learning, modification, and noncommercial use are allowed. Sales, paid services, commercial SaaS, agency operations, or internal profit-generating business use require separate written authorization from Liu Feng / BossAI.
