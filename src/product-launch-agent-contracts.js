import { readFile } from "node:fs/promises";
import path from "node:path";

export const PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT = "bossai.manager-mission-handoff.v1";

export const PRODUCT_LAUNCH_AGENT_PROJECTS = Object.freeze([
  { stepId: "intelligence", contractKey: "intelligence", projectDirectory: "bossai-intelligence-agent" },
  { stepId: "sales-positioning", contractKey: "salesPositioning", projectDirectory: "bossai-sales-employee" },
  { stepId: "content", contractKey: "content", projectDirectory: "bossai-content-agent" },
  { stepId: "design", contractKey: "design", projectDirectory: "bossai-design-agent" },
  { stepId: "video", contractKey: "video", projectDirectory: "bossai-video-agent" },
]);

function assertString(value, code, detail) {
  if (typeof value !== "string" || !value.trim()) throw contractError(code, detail);
  return value.trim();
}

function contractError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}

async function readManifest(projectsRoot, projectDirectory) {
  const manifestPath = path.join(projectsRoot, projectDirectory, "agent.manifest.json");
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw contractError(
      "PRODUCT_LAUNCH_AGENT_MANIFEST_UNREADABLE",
      `无法读取 Product Launch Agent manifest：${manifestPath}`,
      { projectDirectory, manifestPath, cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (parsed?.schema !== "bossai.agent-plugin.v1") {
    throw contractError(
      "PRODUCT_LAUNCH_AGENT_MANIFEST_SCHEMA_INVALID",
      `${projectDirectory} 不是 bossai.agent-plugin.v1。`,
      { projectDirectory, manifestPath, schema: parsed?.schema ?? null },
    );
  }
  return { manifest: parsed, manifestPath };
}

export async function verifyProductLaunchAgentContracts({ projectsRoot, missionDraft }) {
  const root = path.resolve(assertString(projectsRoot, "PRODUCT_LAUNCH_PROJECTS_ROOT_REQUIRED", "缺少 BossAI Projects 根目录。"));
  if (!missionDraft || typeof missionDraft !== "object" || Array.isArray(missionDraft)) {
    throw contractError("PRODUCT_LAUNCH_MISSION_REQUIRED", "缺少 Product Launch Mission 草案。");
  }
  if (missionDraft.targetContract !== "bossai.manager-mission.v1") {
    throw contractError("PRODUCT_LAUNCH_MANAGER_CONTRACT_MISMATCH", "Product Launch Mission 必须继续目标指向 bossai.manager-mission.v1。", { targetContract: missionDraft.targetContract ?? null });
  }
  if (!Array.isArray(missionDraft.request?.steps)) {
    throw contractError("PRODUCT_LAUNCH_MANAGER_STEPS_INVALID", "Product Launch Mission 缺少 Manager steps。");
  }

  const results = [];
  for (const item of PRODUCT_LAUNCH_AGENT_PROJECTS) {
    const expected = missionDraft.expectedStepContracts?.[item.contractKey];
    if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
      throw contractError(
        "PRODUCT_LAUNCH_EXPECTED_STEP_CONTRACT_MISSING",
        `缺少 expectedStepContracts.${item.contractKey}。`,
        item,
      );
    }
    const nativeStep = missionDraft.request.steps.find((step) => step?.id === item.stepId);
    if (!nativeStep) {
      throw contractError("PRODUCT_LAUNCH_MANAGER_STEP_MISSING", `缺少 Manager step：${item.stepId}。`, item);
    }

    const expectedAgentId = assertString(expected.agentId, "PRODUCT_LAUNCH_AGENT_ID_REQUIRED", `${item.contractKey} 缺少 agentId。`);
    const expectedCapability = assertString(expected.capability, "PRODUCT_LAUNCH_CAPABILITY_REQUIRED", `${item.contractKey} 缺少 capability。`);
    const expectedArtifact = assertString(expected.outputArtifact, "PRODUCT_LAUNCH_ARTIFACT_REQUIRED", `${item.contractKey} 缺少 outputArtifact。`);
    if (nativeStep.agentId !== expectedAgentId) {
      throw contractError(
        "PRODUCT_LAUNCH_NATIVE_STEP_AGENT_DRIFT",
        `${item.stepId} 的 Manager 原生 agentId 与包装层合同不一致。`,
        { stepId: item.stepId, nativeAgentId: nativeStep.agentId ?? null, expectedAgentId },
      );
    }

    const { manifest, manifestPath } = await readManifest(root, item.projectDirectory);
    if (manifest.id !== expectedAgentId) {
      throw contractError(
        "PRODUCT_LAUNCH_AGENT_ID_DRIFT",
        `${item.projectDirectory} manifest.id 与 Product Launch Mission 不一致。`,
        { projectDirectory: item.projectDirectory, manifestPath, manifestAgentId: manifest.id ?? null, expectedAgentId },
      );
    }
    const dependsOn = Array.isArray(nativeStep.dependsOn) ? nativeStep.dependsOn : [];
    if (dependsOn.length > 0 && (!Array.isArray(manifest.contracts) || !manifest.contracts.includes(PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT))) {
      throw contractError(
        "PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT_MISSING",
        `${expectedAgentId} 作为依赖型 Product Launch Step，必须声明 ${PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT}。`,
        { projectDirectory: item.projectDirectory, manifestPath, expectedAgentId, dependsOn },
      );
    }
    if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.includes(expectedCapability)) {
      throw contractError(
        "PRODUCT_LAUNCH_CAPABILITY_DRIFT",
        `${expectedAgentId} 未声明 Product Launch capability：${expectedCapability}。`,
        { projectDirectory: item.projectDirectory, manifestPath, expectedCapability },
      );
    }
    const primaryArtifacts = Array.isArray(manifest.artifacts)
      ? manifest.artifacts.filter((artifact) => artifact?.capability === expectedCapability && artifact?.primary === true)
      : [];
    if (primaryArtifacts.length !== 1) {
      throw contractError(
        "PRODUCT_LAUNCH_PRIMARY_ARTIFACT_COUNT_INVALID",
        `${expectedAgentId}/${expectedCapability} 必须且只能声明一个 primary Artifact。`,
        { projectDirectory: item.projectDirectory, manifestPath, expectedCapability, primaryArtifactCount: primaryArtifacts.length },
      );
    }
    if (primaryArtifacts[0].id !== expectedArtifact) {
      throw contractError(
        "PRODUCT_LAUNCH_ARTIFACT_DRIFT",
        `${expectedAgentId}/${expectedCapability} 的 primary Artifact 与 Product Launch Mission 不一致。`,
        { projectDirectory: item.projectDirectory, manifestPath, expectedArtifact, actualArtifact: primaryArtifacts[0].id ?? null },
      );
    }

    results.push({
      stepId: item.stepId,
      contractKey: item.contractKey,
      projectDirectory: item.projectDirectory,
      manifestPath,
      agentId: expectedAgentId,
      capability: expectedCapability,
      primaryArtifact: expectedArtifact,
      managerHandoffContract: dependsOn.length > 0 ? PRODUCT_LAUNCH_MANAGER_HANDOFF_CONTRACT : null,
      status: "passed",
    });
  }

  return {
    schema: "bossai.product-launch-agent-contract-verification.v1",
    overall: "passed",
    projectsRoot: root,
    targetManagerContract: missionDraft.targetContract,
    pluginCodeExecuted: false,
    registryMutated: false,
    providerCalls: 0,
    externalActions: 0,
    checks: results,
  };
}
