"use client";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckRow } from "./CheckRow";

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  automation: "Automation Detection",
  jsEngine: "JS Engine Consistency",
  lieDetection: "Lie / Tampering Detection",
  firefoxAPIs: "Firefox API Presence",
  crossSignal: "Cross-Signal Consistency",
  cssFingerprint: "CSS Fingerprint",
  mathEngine: "Math Engine",
  permissionsAPI: "Permissions API",
  speechVoices: "Speech Voices",
  performanceAPI: "Performance API",
  intlConsistency: "Intl Consistency",
  emojiFingerprint: "Emoji Fingerprint",
  canvasNoiseDetection: "Canvas Noise Detection",
  webglRenderHash: "WebGL Render Hash",
  fontPlatformConsistency: "Font Platform Consistency",
  webglExtended: "WebGL Extended Parameters",
  audioIntegrity: "Audio Integrity",
  iframeTesting: "Iframe Testing",
  workerConsistency: "Worker Consistency",
  headlessDetection: "Headless Detection",
  trashDetection: "Trash Detection",
  fontEnvironment: "Font Environment",
};

interface CheckCategoryProps {
  category: string;
  checks: Record<string, { passed: boolean; detail: string }>;
  defaultOpen?: boolean;
}

export function CheckCategory({
  category,
  checks,
  defaultOpen = false,
}: CheckCategoryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(checks).filter(
    ([, v]) => v && typeof v.passed === "boolean"
  );
  const passed = entries.filter(([, v]) => v.passed).length;
  const total = entries.length;
  const allPassed = passed === total;
  const label = CATEGORY_LABELS[category] || category;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 bg-[#0d0919]/60 hover:bg-[#0d0919]/80 rounded-lg border border-[rgba(139,127,166,0.1)] transition-colors">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${allPassed ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <span className="font-medium text-sm text-[#e0daf0]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono ${allPassed ? "text-emerald-400" : "text-red-400"}`}
          >
            {passed}/{total}
          </span>
          <span className="text-[#8b7fa6] text-xs">{open ? "\u25B2" : "\u25BC"}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 bg-[#0d0919]/50 rounded-lg border border-[rgba(139,127,166,0.1)] overflow-hidden">
          {entries.map(([name, check]) => (
            <CheckRow
              key={name}
              name={name}
              passed={check.passed}
              detail={check.detail}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { CATEGORY_LABELS };
