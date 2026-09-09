# GitHub Public Launch Checklist

This checklist converts `public-release.json` into the manual GitHub repository settings and release actions that cannot be represented by source code alone.

## Repository metadata

Use the exact values from `public-release.json`.

**Description**

> Source-available BossAI ecommerce manager Skill for evidence-aware research, product launch, content, sales and customer-service planning with one natural-language front desk.

**Topics**

`ecommerce-ai`, `ecommerce-automation`, `ai-agent`, `ai-workforce`, `amazon-seller`, `shopify`, `customer-service`, `product-research`, `claude-code`, `codex`

## Pre-release gates

During development, run:

```bash
npm run release:public-check
```

For the actual GitHub Release/package candidate, first commit the reviewed batch and require a clean working tree:

```bash
npm run release:public-final
```

`release:public-final` fails closed when any tracked modification or non-ignored untracked file exists. This prevents unrelated parallel work from being swept into `npm pack` or a GitHub Release. A pass is packaging/technical evidence only.

## GitHub release

1. Ensure the release commit contains only reviewed public-release and product changes; do not sweep unrelated local work into the release.
2. Confirm `public-release.json.product.version` matches `package.json.version`.
3. Use release title `BossAI Ecommerce Manager Skill v{version}`.
4. Generate release notes from GitHub and review them against `.github/release.yml`.
5. Link the Quick Start, `AGENT_INSTALL.md`, `COMMERCIAL_LICENSE.md`, `SECURITY.md` and `docs/PUBLIC_RELEASE.md` in the release body.
6. Do not claim production readiness, public launch traction, real-user validation, Amazon/Shopify production automation, or BossAI OS Runtime ownership without external evidence.

## Conversion path

The repository README is the free evaluation entry. Commercial-use requests must be routed to `COMMERCIAL_LICENSE.md`; persistent employee execution, Approval/Audit/Memory, AI Gateway and Billing remain outside this repository.

## After release

- pin the repository on the GitHub profile/organization if it is a current acquisition priority;
- verify the social preview and README first screen on desktop and mobile;
- verify the install command from a clean environment;
- record external evidence such as release URL, first successful clean install, first issue/PR, stars/forks and qualified commercial inquiries before changing any launch/validation claim in `public-release.json`.
