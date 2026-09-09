# Public Release Batch — 2026-08-30

Purpose: isolate the open-source acquisition/public-release work from pre-existing Product Launch development in the same working tree.

## Hard rule

Do **not** use `git add -A`, `git add .`, or whole-tree commit automation for this batch.

The working tree already contained Product Launch changes before the public-release work began. Those changes remain valid work, but they are a separate batch unless explicitly reviewed together.

## Whole-file safe for this public-release batch

These files were created or changed specifically for the public-release/acquisition batch and may be staged as whole files after final diff review:

- `.github/workflows/ci.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/release.yml`
- `CONTRIBUTING.md`
- `README_EN.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/GITHUB_LAUNCH_CHECKLIST.md`
- `docs/PUBLIC_RELEASE_BATCH_2026-08-30.md`
- `public-release.json`
- `scripts/verify-public-release.mjs`

## Mixed files — hunk-level staging only

The following files already had unrelated working-tree changes before this batch:

- `README.md`
- `package.json`

Only the public-release/acquisition hunks should enter this batch unless the Product Launch batch is explicitly reviewed and combined.

Public-release hunks in `README.md` include:

- the 30-second public/commercial boundary table;
- BossAI open-source workflow cross-links;
- public-release check explanation.

`README.md` also contains pre-existing Product Launch edits. Those are not automatically authorized by this release batch.

Public-release hunks in `package.json` include:

- GitHub homepage/bugs metadata;
- public-release files in the package list;
- `verify:public-release` and `release:public-check` scripts;
- acquisition/discovery keywords.

`package.json` also contains pre-existing Product Launch scripts. Stage by hunk.

## Pre-existing changes explicitly outside this batch

Examples include Product Launch source/tests/examples and existing `Atlas/CURRENT_STATE.md` changes. Do not infer that this document freezes or rejects them; it only prevents accidental bundling.

## Acceptance

On the exact candidate after staging:

```bash
npm run verify:public-release
npm run check
```

Expected evidence at the time this batch was prepared:

- public-release gate passes with tracked + untracked candidate scanning;
- project test suite previously passed 93/93;
- demo and input validation previously passed.

Re-run on the final staged/committed candidate. Do not reuse old output as release evidence.
