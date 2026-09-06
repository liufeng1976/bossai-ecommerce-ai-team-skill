# BossAI Ecommerce Manager — GitHub Growth Measurement

This repository measures public GitHub discovery separately from product correctness and commercial conversion.

## Read-only traffic report

Requires an authenticated GitHub CLI (`gh`) user who has access to repository traffic data.

```bash
npm run growth:traffic
```

The report reads only:

- rolling 14-day repository views and unique visitors;
- rolling 14-day clones and unique cloners;
- top referrers;
- popular paths;
- point-in-time Stars, Forks, and open Issues.

It does not create Issues, publish content, send messages, mutate ecommerce platforms, read customer data, or change BossAI commercial authorization.

## Save a local snapshot

```bash
npm run growth:traffic -- --save-dir .bossai-local/github-traffic
```

`.bossai-local/` is gitignored. Do not commit private local analytics exports or credentials.

## CI-safe self-test

```bash
npm run growth:traffic:check
```

The self-test checks only the local path guard and does not call GitHub.

## Interpretation

GitHub views and clones are rolling 14-day windows, not cumulative acquisition. Stars, Forks, and Issues are point-in-time cumulative counts. Do not claim that README, cross-repository handoff, or other growth changes caused a traffic increase unless a time-separated comparison supports that conclusion.

The current cross-repository experiment is:

`douyin-taobao-cs` → API-free demo → BossAI Ecommerce Manager demo → `[Connector handoff]` Issue / Star / Fork.

Traffic measurement should help distinguish:

1. nobody reached this repository;
2. visitors arrived but did not clone;
3. visitors cloned but did not engage;
4. visitors engaged through Star/Fork/Issue;
5. users asked about commercial deployment.
