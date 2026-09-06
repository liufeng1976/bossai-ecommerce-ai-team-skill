# BossAI Ecommerce Manager Skill

> **AI ecommerce manager for customer service, operations, product research, content, sales, project execution, and approval-aware workflows.**

[![GitHub stars](https://img.shields.io/github/stars/liufeng1976/bossai-ecommerce-ai-team-skill?style=social)](https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill/stargazers)
[![BossAI](https://img.shields.io/badge/BossAI-bossaios.com-black)](https://bossaios.com)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange)](LICENSE.md)

[中文 README](README.md) · [BossAI website](https://bossaios.com) · [BossAI Radar Lite](https://github.com/liufeng1976/bossai-radar-lite)

**License classification: Source Available, not OSI Open Source.** Source viewing, learning, modification, testing, and permitted noncommercial use are free under PolyForm Noncommercial 1.0.0. Commercial use requires separate written BossAI authorization.

Customers talk to one front desk only: **BossAI Ecommerce Manager**. They describe the problem in natural language; the Manager selects internal work modes and AI roles, coordinates the work, and returns one unified result.

Customers are never asked to choose among employees. The 16 roles are backstage capabilities, not a user-facing menu.

If this Skill is useful to your ecommerce or AI-agent workflow, consider giving the repository a **Star** so other operators and developers can find it.

## What it can coordinate

Use one natural-language entry point for work such as:

- ecommerce customer service and after-sales review;
- product and opportunity prioritization;
- listing, content, and short-video planning;
- sales copy, offer, and conversion work;
- ecommerce operations and execution planning;
- project management and seven-day validation loops;
- risk-aware workflows that require human approval before external actions.

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
git clone https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill.git
cd bossai-ecommerce-ai-team-skill
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

Give an AI coding/agent environment the repository URL, or install with one command:

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

## How it fits the BossAI ecosystem

BossAI Ecommerce Manager is a source-available Skill, not a second Agent Platform. Shared runtime, identity, approvals, memory, model routing, and governance remain platform concerns rather than being duplicated inside this repository.

Related public project:

- **BossAI Radar Lite** — public-signal collection, filtering, opportunity evidence, and commercial-signal scoring: https://github.com/liufeng1976/bossai-radar-lite

Main BossAI entry point: https://bossaios.com

## Safety

The default interaction mode is a single front desk with hidden backstage roles. The operational mode is local analysis, drafting, planning, and verification only. The Skill does not automatically publish content, message customers, control platform accounts, purchase, pay, refund, delete data, or make external promises.

Unsupported ideas are converted into evidence-verification tasks and are never represented as validated opportunities.

## License

This repository is **source-available under PolyForm Noncommercial 1.0.0; it is not OSI-approved open source**. Source viewing, learning, modification, and permitted noncommercial use are allowed. Sales, paid services, commercial SaaS, agency operations, or internal profit-generating business use require separate written authorization from Liu Feng / BossAI. See [`LICENSE.md`](LICENSE.md) and [`COMMERCIAL_LICENSE.md`](COMMERCIAL_LICENSE.md).