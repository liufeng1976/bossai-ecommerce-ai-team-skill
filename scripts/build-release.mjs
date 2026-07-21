#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const releaseName = `${pkg.name}-${pkg.version}-final-20260721`;
const releaseDir = path.join(root, "release", releaseName);

if (existsSync(releaseDir)) {
  const existing = await readdir(releaseDir);
  if (existing.length > 0) throw new Error(`正式发布目录已存在且非空，拒绝覆盖：${releaseDir}`);
} else {
  await mkdir(releaseDir, { recursive: true });
}

const npmLookup = process.platform === "win32"
  ? spawnSync("where.exe", ["npm.cmd"], { encoding: "utf8", windowsHide: true })
  : spawnSync("which", ["npm"], { encoding: "utf8" });
const npmCommand = npmLookup.status === 0 ? npmLookup.stdout.split(/\r?\n/).find(Boolean) : null;
if (!npmCommand) throw new Error("无法定位 npm 可执行文件。");

const relativeReleaseDir = path.relative(root, releaseDir).split(path.sep).join("/");
const npmArgs = ["pack", "--json", "--pack-destination", relativeReleaseDir];
const packed = process.platform === "win32"
  ? spawnSync(process.env.ComSpec || "cmd.exe", [
      "/d", "/s", "/c",
      `npm pack --json --pack-destination ${relativeReleaseDir}`
    ], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    })
  : spawnSync(npmCommand, npmArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
if (packed.status !== 0) {
  const detail = packed.error?.message || packed.stderr || packed.stdout || "未知错误";
  throw new Error(`npm pack 失败：${String(detail).trim()}`);
}

const result = JSON.parse(packed.stdout)[0];
if (!result?.filename || !Array.isArray(result.files)) throw new Error("npm pack 未返回可验证文件清单。");

const forbidden = result.files.filter((item) => /(^|\/)(\.env|node_modules|outputs|coverage|\.git)(\/|$)/i.test(item.path));
if (forbidden.length) throw new Error(`发布包包含禁止路径：${forbidden.map((item) => item.path).join(", ")}`);

const tarball = path.join(releaseDir, result.filename);
const digest = createHash("sha256").update(await readFile(tarball)).digest("hex");
const files = result.files.map((item) => ({ path: item.path, size: item.size })).sort((a, b) => a.path.localeCompare(b.path));

await writeFile(path.join(releaseDir, "FILES.json"), `${JSON.stringify(files, null, 2)}\n`, "utf8");
await writeFile(path.join(releaseDir, "SHA256SUMS.txt"), `${digest}  ${result.filename}\n`, "utf8");
await writeFile(path.join(releaseDir, "RELEASE.json"), `${JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  tarball: result.filename,
  sha256: digest,
  npmShasum: result.shasum,
  integrity: result.integrity,
  fileCount: files.length,
  unpackedSize: result.unpackedSize,
  license: pkg.license,
  commercialUse: "Requires separate written authorization from 刘风 / BossAI",
  published: false,
  pushed: false
}, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({
  ok: true,
  releaseDir,
  tarball,
  sha256: digest,
  fileCount: files.length,
  unpackedSize: result.unpackedSize
}, null, 2)}\n`);
