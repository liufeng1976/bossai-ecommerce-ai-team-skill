import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildExecutionPack } from "../src/engine.js";
import { writeExecutionPack } from "../src/render.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "bossai-team.mjs");

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
}

function launchInput() {
  return {
    business: {
      name: "Product video CLI test",
      goal: "把这个商品卖起来，用白底图准备整套电商素材和商品短视频",
      offer: "智能宠物饮水机",
      customer: "养宠家庭",
      platforms: ["TikTok Shop", "小红书"],
      assets: ["product-white-background.jpg"],
      constraints: ["不得虚构规格", "不自动发布"]
    }
  };
}

function acceptedReview(overrides = {}) {
  return {
    schema: "bossai.product-launch-video-review.v1",
    descriptorId: "video.commerce-production-plan.md",
    artifactSha256: "d".repeat(64),
    accepted: true,
    acceptedAt: "2026-08-16T09:10:00+08:00",
    reviewedBy: "product-owner",
    productionDraft: {
      title: "智能宠物饮水机｜真实商品素材演示",
      subtitle: "真实素材优先，未核实规格不进入画面声明",
      aspectRatio: "9:16",
      segmentSeconds: 2.5,
      suggestedTotalSeconds: 18,
      shotPlan: [
        { index: 1, durationSeconds: 4, purpose: "商品身份", visual: "使用真实商品主图展示完整主体" },
        { index: 2, durationSeconds: 6, purpose: "使用场景", visual: "使用用户上传真实素材展示已确认场景" },
        { index: 3, durationSeconds: 4, purpose: "事实说明", visual: "字幕只引用已审核事实" },
        { index: 4, durationSeconds: 4, purpose: "行动引导", visual: "中性 CTA，不承诺效果或销量" }
      ],
      factReviewNotes: ["规格、认证、效果与销量无证据不得进入字幕或旁白"]
    },
    ...overrides
  };
}

async function prepare() {
  const temp = await mkdtemp(path.join(os.tmpdir(), "bossai-product-video-draft-cli-"));
  const packDir = path.join(temp, "pack");
  await writeExecutionPack(buildExecutionPack(launchInput()), packDir);
  const reviewPath = path.join(temp, "video-review.json");
  await writeFile(reviewPath, `${JSON.stringify(acceptedReview(), null, 2)}\n`, "utf8");
  return { temp, packDir, reviewPath };
}

test("product-video-draft CLI 把已审核 Video Artifact 编译成开拍本地草稿但不执行", async () => {
  const { temp, packDir, reviewPath } = await prepare();
  try {
    const result = run("product-video-draft", "--pack", packDir, "--review", reviewPath);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.command, "product-video-draft");
    assert.equal(output.schema, "bossai.kaipai-product-media-draft.v1");
    assert.equal(output.executionContract, "bossai.video-production-task.v1");
    assert.equal(output.executionTarget, "local-windows");
    assert.equal(output.operation, "product-video");
    assert.equal(output.automaticDraftImport, false);
    assert.equal(output.mediaImported, false);
    assert.equal(output.rightsConfirmed, false);
    assert.equal(output.automaticExecution, false);
    assert.equal(output.publicationAuthorized, false);

    const draft = JSON.parse(await readFile(output.output, "utf8"));
    assert.equal(draft.sourceReviewArtifactSha256, "d".repeat(64));
    assert.equal(draft.sourceReviewAcceptedBy, "product-owner");
    assert.equal(draft.execution.automaticExecution, false);
    assert.equal(draft.execution.mediaImported, false);
    assert.equal(draft.execution.rightsConfirmed, false);
    assert.equal(draft.execution.publicationAuthorized, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("product-video-draft CLI 对未接受 review 失败关闭且不写草稿", async () => {
  const { temp, packDir, reviewPath } = await prepare();
  const outputPath = path.join(temp, "blocked-draft.json");
  try {
    await writeFile(reviewPath, `${JSON.stringify(acceptedReview({ accepted: false }), null, 2)}\n`, "utf8");
    const result = run("product-video-draft", "--pack", packDir, "--review", reviewPath, "--output", outputPath);
    assert.equal(result.status, 1, result.stdout);
    const error = JSON.parse(result.stderr);
    assert.equal(error.ok, false);
    assert.match(error.error, /PRODUCT_VIDEO_REVIEW_NOT_ACCEPTED/);
    await assert.rejects(access(outputPath), { code: "ENOENT" });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
