# BossAI Ecommerce Manager — Public Release Boundary

This repository is the public acquisition and evaluation surface for **BossAI Ecommerce Manager / BossAI 电商总管**.

## What this repository is

It is an installable, source-available ecommerce Skill that accepts a natural-language business request, routes work to bounded internal role modules, and produces reviewable plans, drafts, evidence summaries, task boards and handoff artifacts.

It is designed for evaluation, learning, local testing and the non-commercial uses permitted by `LICENSE.md`.

## What it is not

This repository is **not** the BossAI Agent Platform and does not own or replace:

- the BossAI OS Agent Runtime;
- Task or Scheduler authority;
- Approval or Audit authority;
- Memory authority;
- the AI Gateway or Provider Router;
- authoritative Points/Billing;
- Headquarters Commerce identity, subscription, payment, refund or settlement authority.

Persistent AI-employee execution, production automation and governed side effects belong to BossAI OS and the relevant commercial BossAI product.

## Community/source-available evaluation scope

The public repository is intended to let a user evaluate the method end to end:

- install from GitHub into a supported Agent host;
- route ecommerce requests through one customer-facing manager entry;
- validate structured business inputs;
- rank evidence-backed opportunities;
- generate a seven-day execution package;
- create product-launch plans and reviewable handoff artifacts;
- inspect the role/task routing logic;
- run unit tests and deterministic demo acceptance locally.

No external publishing, customer messaging, account control, purchasing, payment, ad spend, refund or destructive action is granted by default.

## Commercial upgrade boundary

A separate BossAI commercial authorization is required for uses outside the repository license, including commercial internal operations, paid delivery, SaaS, agency work, white-label/OEM use or resale.

Commercial BossAI offerings may add or govern:

- production Amazon/Shopify/commerce connectors;
- managed deployment and support;
- multi-store or multi-team operation;
- persistent AI employees through BossAI OS;
- approval/audit/knowledge/memory integration;
- enterprise identity and entitlements;
- production automation after explicit human authorization;
- SLA, implementation and private deployment.

See `COMMERCIAL_LICENSE.md` for the legal/commercial authorization path.

## Public-release verification

Before publishing a release candidate, run:

```bash
npm run verify:public-release
npm run check
```

`verify:public-release` is intentionally narrow: it verifies required public/legal files, repository metadata, public positioning language and obvious tracked secret-file hazards. It does **not** replace security review, legal review, tests or real-user acceptance.

## Product truth

Passing the public-release check means only that the repository packaging is internally consistent enough for a public release candidate. It does not prove public launch, production readiness, commercial success or real-user validation.
