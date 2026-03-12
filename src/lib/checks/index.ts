"use client";

import type { TestResults } from "../types";

export interface PhaseResult {
  phase: string;
}

export async function runAllChecks(
  onPhaseComplete?: (phase: PhaseResult) => void
): Promise<TestResults> {
  // Phase 1: Collect fingerprints
  const { collectFingerprints, checkWebRTC } = await import("./collectors");
  const fingerprints = await collectFingerprints();
  onPhaseComplete?.({ phase: "fingerprints" });

  // Phase 2: Core checks
  const { runCoreChecks } = await import("./core");
  const core = await runCoreChecks();
  onPhaseComplete?.({ phase: "core" });

  // Phase 3: Extended checks
  const { runExtendedChecks } = await import("./extended");
  const extended = await runExtendedChecks();
  onPhaseComplete?.({ phase: "extended" });

  // Phase 4: Worker consistency checks
  const { runWorkerChecks } = await import("./workers");
  const workers = await runWorkerChecks();
  onPhaseComplete?.({ phase: "workers" });

  // Phase 5: WebRTC leak check
  const webrtc = await checkWebRTC();
  onPhaseComplete?.({ phase: "webrtc" });

  // Phase 6: Stability - collect fingerprints again and compare
  const fingerprints2 = await collectFingerprints();
  const diffs: string[] = [];
  if (fingerprints.canvas.hash !== fingerprints2.canvas.hash) diffs.push("canvas");
  if (fingerprints.audio.hash !== fingerprints2.audio.hash) diffs.push("audio");
  if (fingerprints.fonts.hash !== fingerprints2.fonts.hash) diffs.push("fonts");
  if (fingerprints.clientRects.hash !== fingerprints2.clientRects.hash) diffs.push("clientRects");
  if (fingerprints.speechVoices.hash !== fingerprints2.speechVoices.hash) diffs.push("speechVoices");
  const stable = diffs.length === 0;
  const detail = stable
    ? "All fingerprints stable across two collections"
    : `Unstable: ${diffs.join(", ")} changed between collections`;
  onPhaseComplete?.({ phase: "stability" });

  return {
    fingerprints,
    core,
    extended,
    workers,
    webrtc,
    stability: { fingerprints2, stable, detail },
  };
}
