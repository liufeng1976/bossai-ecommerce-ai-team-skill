import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildExecutionPack } from "../src/engine.js";
import { PRODUCT_LAUNCH_AGENT_PROJECTS, verifyProductLaunchAgentContracts } from "../src/product-launch-agent-contracts.js";

const launchInput = {
  business: {
    name: "agent contract verification",
    goal: "把这个商品卖起来，用白底图准备 Product Launch",
    offer: "智能宠物饮水机",
    customer: "养宠家庭",
    platforms: ["Amazon", "TikTok Shop"],
    assets: ["product-white-background.jpg"],
    constraints: ["不得虚构规格", "不自动发布"]
  }
};

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bossai-product-launch-agent-contracts-"));
  const missionDraft = buildExecutionPack(launchInput).productLaunch.missionDraft;
  for (const project of PRODUCT_LAUNCH_AGENT_PROJECTS) {
    const expected = missionDraft.expectedStepContracts[project.contractKey];
    const projectRoot = path.join(root, project.projectDirectory);
    await mkdir(projectRoot, { recursive: true });
    const nativeStep = missionDraft.request.steps.find((step) => step.id === project.stepId);
    await writeFile(path.join(projectRoot, "agent.manifest.json"), `${JSON.stringify({
      schema: "bossai.agent-plugin.v1",
      id: expected.agentId,
      version: "0.0.0-test",
      contracts: nativeStep?.dependsOn?.length ? ["bossai.manager-mission-handoff.v1"] : [],
      capabilities: [expected.capability],
      artifacts: [{
        schema: "bossai.agent-artifact-descriptor.v1",
        id: expected.outputArtifact,
        capability: expected.capability,
        primary: true,
        format: "markdown",
        previewMode: "text"
      }]
    }, null, 2)}\n`, "utf8");
  }
  return { root, missionDraft };
}

test("Product Launch 五员工合同验证器只读校验 Agent ID、capability 和唯一 primary Artifact", async () => {
  const { root, missionDraft } = await fixture();
  try {
    const report = await verifyProductLaunchAgentContracts({ projectsRoot: root, missionDraft });
    assert.equal(report.overall, "passed");
    assert.equal(report.checks.length, 5);
    assert.equal(report.pluginCodeExecuted, false);
    assert.equal(report.registryMutated, false);
    assert.equal(report.providerCalls, 0);
    assert.equal(report.externalActions, 0);
    assert.deepEqual(report.checks.map((item) => item.agentId), [
      "bossai-intelligence-agent",
      "bossai-sales-agent",
      "bossai-content-agent",
      "bossai-design-agent",
      "bossai-video-agent"
    ]);
    assert.equal(report.checks.find((item) => item.agentId === "bossai-sales-agent").projectDirectory, "bossai-sales-employee");
    assert.equal(report.checks.find((item) => item.agentId === "bossai-intelligence-agent").managerHandoffContract, null);
    assert.equal(report.checks.find((item) => item.agentId === "bossai-sales-agent").managerHandoffContract, "bossai.manager-mission-handoff.v1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 合同验证器对 capability 漂移失败关闭", async () => {
  const { root, missionDraft } = await fixture();
  try {
    const manifestPath = path.join(root, "bossai-content-agent", "agent.manifest.json");
    await writeFile(manifestPath, `${JSON.stringify({
      schema: "bossai.agent-plugin.v1",
      id: "bossai-content-agent",
      contracts: ["bossai.manager-mission-handoff.v1"],
      capabilities: ["content.script.draft"],
      artifacts: [{ id: "content.script-draft.md", capability: "content.script.draft", primary: true }]
    }, null, 2)}\n`, "utf8");
    await assert.rejects(
      verifyProductLaunchAgentContracts({ projectsRoot: root, missionDraft }),
      (error) => error?.code === "PRODUCT_LAUNCH_CAPABILITY_DRIFT" && /content\.commerce\.launch-copy/u.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 合同验证器对重复 primary Artifact 失败关闭", async () => {
  const { root, missionDraft } = await fixture();
  try {
    const expected = missionDraft.expectedStepContracts.design;
    const manifestPath = path.join(root, "bossai-design-agent", "agent.manifest.json");
    await writeFile(manifestPath, `${JSON.stringify({
      schema: "bossai.agent-plugin.v1",
      id: expected.agentId,
      contracts: ["bossai.manager-mission-handoff.v1"],
      capabilities: [expected.capability],
      artifacts: [
        { id: expected.outputArtifact, capability: expected.capability, primary: true },
        { id: "duplicate-design.md", capability: expected.capability, primary: true }
      ]
    }, null, 2)}\n`, "utf8");
    await assert.rejects(
      verifyProductLaunchAgentContracts({ projectsRoot: root, missionDraft }),
      (error) => error?.code === "PRODUCT_LAUNCH_PRIMARY_ARTIFACT_COUNT_INVALID" && error?.details?.primaryArtifactCount === 2,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 合同验证器对依赖型 Agent 未声明 Manager handoff 合同失败关闭", async () => {
  const { root, missionDraft } = await fixture();
  try {
    const expected = missionDraft.expectedStepContracts.video;
    const manifestPath = path.join(root, "bossai-video-agent", "agent.manifest.json");
    await writeFile(manifestPath, `${JSON.stringify({
      schema: "bossai.agent-plugin.v1",
      id: expected.agentId,
      contracts: [],
      capabilities: [expected.capability],
      artifacts: [{ id: expected.outputArtifact, capability: expected.capability, primary: true }]
    }, null, 2)}\n`, "utf8");
    await assert.rejects(
      verifyProductLaunchAgentContracts({ projectsRoot: root, missionDraft }),
      (error) => error?.code === "PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT_MISSING" && /bossai\.manager-mission-handoff\.v1/u.test(error.message),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Product Launch 合同验证器对 Manager 原生 step 与包装层 Agent ID 漂移失败关闭", async () => {
  const { root, missionDraft } = await fixture();
  try {
    const mutated = structuredClone(missionDraft);
    mutated.request.steps.find((step) => step.id === "video").agentId = "wrong-video-agent";
    await assert.rejects(
      verifyProductLaunchAgentContracts({ projectsRoot: root, missionDraft: mutated }),
      (error) => error?.code === "PRODUCT_LAUNCH_NATIVE_STEP_AGENT_DRIFT",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
