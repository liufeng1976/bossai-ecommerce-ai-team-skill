# Contributing to BossAI Ecommerce Manager

Thanks for helping improve the public BossAI ecommerce Skill.

## Before opening a pull request

1. Read `AGENTS.md`, `SECURITY.md`, `LICENSE.md` and `docs/PUBLIC_RELEASE.md`.
2. Keep the public product boundary intact: this repository may contain Skills, routing, evidence handling, plans, drafts and handoff artifacts, but it must not become a second BossAI Agent Runtime, Approval/Audit authority, AI Gateway, Provider Router or billing authority.
3. Do not add Provider master keys, customer credentials, production account tokens, private keys, real customer PII or proprietary customer datasets.
4. Do not claim that a generated draft has been published, sent, refunded, purchased or otherwise executed externally unless the repository contains real evidence for that action and the product boundary explicitly supports it.
5. Keep demo data clearly marked as demo/synthetic.

## Development checks

Use Node.js 20.11 or newer.

```bash
npm test
npm run validate:demo
npm run demo
npm run verify:public-release
```

For product-launch changes also run:

```bash
npm run check:product-launch
```

## Good contribution areas

- new evidence-safe ecommerce workflows;
- better deterministic routing and input validation;
- additional non-destructive output formats;
- documentation and examples;
- test coverage;
- safe interoperability with supported Agent hosts;
- privacy/security hardening;
- accessibility and internationalization.

## Commercial features

A contribution to this repository does not grant commercial-use rights beyond `LICENSE.md`. Commercial licensing questions belong in the commercial authorization channel described by `COMMERCIAL_LICENSE.md`, not in a feature pull request.

## Pull request expectations

Describe:

- the user problem;
- the user-visible change;
- what is intentionally out of scope;
- tests/checks run;
- any security, privacy or external-action impact;
- whether the change affects the public/commercial boundary.

Keep pull requests focused. Do not mix unrelated refactors with user-facing behavior changes when avoidable.
