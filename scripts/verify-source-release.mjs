import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const readmeZh = readFileSync(resolve(root, 'README.md'), 'utf8');
const readmeEn = readFileSync(resolve(root, 'README_EN.md'), 'utf8');
const license = readFileSync(resolve(root, 'LICENSE.md'), 'utf8');
const commercial = readFileSync(resolve(root, 'COMMERCIAL_LICENSE.md'), 'utf8');

if (pkg.version !== '1.2.2') throw new Error(`Expected version 1.2.2, received ${pkg.version}`);
if (pkg.license !== 'PolyForm-Noncommercial-1.0.0') throw new Error(`Unexpected license metadata: ${pkg.license}`);
if (!license.includes('PolyForm Noncommercial License 1.0.0')) throw new Error('LICENSE.md must contain PolyForm Noncommercial 1.0.0.');
if (!readmeZh.includes('不是 OSI Open Source')) throw new Error('Chinese README must classify the project as source-available, not OSI Open Source.');
if (!readmeEn.includes('not OSI Open Source')) throw new Error('English README must classify the project as source-available, not OSI Open Source.');
if (!commercial.includes('BossAI')) throw new Error('COMMERCIAL_LICENSE.md must preserve the BossAI commercial authorization path.');

console.log(JSON.stringify({
  schemaVersion: 'bossai.source-release-gate.v1',
  version: pkg.version,
  license: pkg.license,
  sourceAvailable: true,
  osiOpenSource: false,
  sourceReleaseOnly: true,
  npmPublishedByThisRelease: false,
  hostedServiceIncluded: false,
}));
