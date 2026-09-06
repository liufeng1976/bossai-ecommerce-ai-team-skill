import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const REPO = 'liufeng1976/bossai-ecommerce-ai-team-skill';

function runGh(args) {
  return execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ghJson(args) {
  const raw = runGh(args);
  return raw ? JSON.parse(raw) : null;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function ensureInsideRepo(target) {
  const absolute = path.resolve(ROOT, target);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Snapshot output must stay inside the repository.');
  }
  return { absolute, relative };
}

function main() {
  if (process.argv.includes('--self-test')) {
    const probe = ensureInsideRepo('.bossai-local/github-traffic/self-test.json');
    if (!probe.relative.includes('.bossai-local')) throw new Error('Self-test path guard failed.');
    console.log('GitHub traffic reporter self-test passed.');
    return;
  }

  const views = ghJson(['api', `repos/${REPO}/traffic/views`]);
  const clones = ghJson(['api', `repos/${REPO}/traffic/clones`]);
  const referrers = ghJson(['api', `repos/${REPO}/traffic/popular/referrers`]) || [];
  const popularPaths = ghJson(['api', `repos/${REPO}/traffic/popular/paths`]) || [];
  const repo = ghJson(['repo', 'view', REPO, '--json', 'stargazerCount,forkCount,issues']);

  const report = {
    schemaVersion: 1,
    project: 'bossai-ecommerce-ai-team-skill',
    capturedAt: new Date().toISOString(),
    semantics: {
      traffic: 'GitHub rolling 14-day window; do not interpret changes as cumulative acquisition.',
      community: 'Point-in-time cumulative repository counts.',
    },
    traffic: {
      views: views.count,
      uniqueVisitors: views.uniques,
      clones: clones.count,
      uniqueCloners: clones.uniques,
    },
    community: {
      stars: repo.stargazerCount,
      forks: repo.forkCount,
      openIssues: repo.issues.totalCount,
    },
    topReferrers: referrers,
    popularPaths,
  };

  const savePath = argValue('--save');
  const saveDir = argValue('--save-dir');
  const save = (target) => {
    const { absolute, relative } = ensureInsideRepo(target);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(`Saved GitHub traffic snapshot: ${relative}`);
  };

  if (savePath) save(savePath);
  if (saveDir) {
    const stamp = report.capturedAt.replace(/[:.]/g, '-');
    save(path.join(saveDir, `github-traffic-${stamp}.json`));
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('BossAI Ecommerce Manager GitHub traffic report');
  console.log(`Captured: ${report.capturedAt}`);
  console.log('');
  console.log('Rolling 14-day traffic');
  console.log(`Views:           ${report.traffic.views}`);
  console.log(`Unique visitors: ${report.traffic.uniqueVisitors}`);
  console.log(`Clones:          ${report.traffic.clones}`);
  console.log(`Unique cloners:  ${report.traffic.uniqueCloners}`);
  console.log('');
  console.log('Community');
  console.log(`Stars:       ${report.community.stars}`);
  console.log(`Forks:       ${report.community.forks}`);
  console.log(`Open issues: ${report.community.openIssues}`);
  console.log('');
  console.log('Top referrers');
  for (const item of report.topReferrers.slice(0, 10)) {
    console.log(`- ${item.referrer}: ${item.count} views / ${item.uniques} uniques`);
  }
  console.log('');
  console.log('Popular paths');
  for (const item of report.popularPaths.slice(0, 10)) {
    console.log(`- ${item.path}: ${item.count} views / ${item.uniques} uniques`);
  }
}

try {
  main();
} catch (error) {
  console.error(`GitHub traffic report failed: ${error.message}`);
  process.exit(1);
}
