import { readFile } from "node:fs/promises";
import path from "node:path";

function blocker(code, message, details = {}) {
  return { code, message, details };
}

export async function inspectProductLaunchPlatformReadiness({ projectsRoot }) {
  const root = path.resolve(String(projectsRoot || "").trim());
  const bossaiOsRoot = path.join(root, "bossai-os");
  const managerSourcePath = path.join(bossaiOsRoot, "apps", "api", "src", "services", "manager.service.ts");
  const blockers = [];
  let managerSource = "";
  try {
    managerSource = await readFile(managerSourcePath, "utf8");
  } catch (error) {
    blockers.push(blocker(
      "BOSSAI_OS_MANAGER_SOURCE_MISSING",
      "当前权威 BossAI OS checkout 缺少 Manager 源码，Product Launch reviewed handoff 不能声明为已进入主线。",
      { managerSourcePath, cause: error instanceof Error ? error.message : String(error) },
    ));
  }

  if (managerSource) {
    const requiredMarkers = [
      "bossai.manager-mission-handoff.v1",
      "managerMissionDependencyReady",
      "ManagerMissionHandoffArtifactReference",
      "requiresHumanReview",
      "completionEventId",
      "reviewEventId",
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !managerSource.includes(marker));
    if (missingMarkers.length) {
      blockers.push(blocker(
        "BOSSAI_OS_REVIEWED_HANDOFF_NOT_CONSOLIDATED",
        "当前 BossAI OS Manager 源码尚未包含 Product Launch 所依赖的通用 reviewed Artifact Mission handoff。",
        { managerSourcePath, missingMarkers },
      ));
    }
  }

  return {
    schema: "bossai.product-launch-platform-readiness.v1",
    platformReady: blockers.length === 0,
    projectsRoot: root,
    bossaiOsRoot,
    managerSourcePath,
    requiredManagerContract: "bossai.manager-mission.v1",
    requiredHandoffContract: "bossai.manager-mission-handoff.v1",
    automaticSubmissionAllowed: false,
    providerCalls: 0,
    registryMutated: false,
    externalActions: 0,
    blockers,
  };
}
