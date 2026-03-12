"use client";

import type { ProfileResult } from "@/lib/types";

// Static profile slots matching what route.ts generates
const PROFILE_SLOTS = [
  { name: "macOS Per-Context A", mode: "per-context" as const },
  { name: "macOS Per-Context B", mode: "per-context" as const },
  { name: "macOS Per-Context C", mode: "per-context" as const },
  { name: "Linux Per-Context A", mode: "per-context" as const },
  { name: "Linux Per-Context B", mode: "per-context" as const },
  { name: "Linux Per-Context C", mode: "per-context" as const },
  { name: "macOS Global", mode: "global" as const },
  { name: "Linux Global", mode: "global" as const },
];

interface ProgressPanelProps {
  currentProfile: string | null;
  currentIndex: number;
  totalProfiles: number;
  completedProfiles: ProfileResult[];
}

export function ProgressPanel({ currentProfile, currentIndex, totalProfiles, completedProfiles }: ProgressPanelProps) {
  const progress = totalProfiles > 0 ? (completedProfiles.length / totalProfiles) * 100 : 0;

  return (
    <div className="bg-[#1a1034] border border-[rgba(139,127,166,0.15)] rounded-xl p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-bold text-[#e0daf0]">Running Tests</h2>
        {currentProfile && (
          <p className="text-sm text-cyan-400 animate-pulse">{currentProfile}</p>
        )}
        <p className="text-xs text-[#8b7fa6]">
          {completedProfiles.length} of {totalProfiles} profiles complete
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#0d0919] rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Profile Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {PROFILE_SLOTS.slice(0, totalProfiles).map((slot, i) => {
          const completed = completedProfiles[i];
          const isCurrent = i === currentIndex && !completed;

          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                completed
                  ? completed.error
                    ? "bg-red-950/20 text-red-400"
                    : "bg-emerald-950/20 text-emerald-400"
                  : isCurrent
                    ? "bg-cyan-950/20 text-cyan-400 animate-pulse"
                    : "bg-[#0d0919]/30 text-[#8b7fa6]/50"
              }`}
            >
              <span>
                {completed
                  ? completed.error ? "\u2717" : "\u2713"
                  : isCurrent ? "\u25CF" : "\u25CB"}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-mono truncate block">
                  {completed?.profile?.name || slot.name}
                </span>
                <span className={`text-[10px] ${
                  slot.mode === "per-context" ? "text-cyan-400/50" : "text-purple-400/50"
                }`}>
                  {slot.mode === "per-context" ? "per-ctx" : "global"}
                </span>
              </div>
              {completed && !completed.error && (
                <span className="text-[10px] shrink-0">{completed.grade}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
