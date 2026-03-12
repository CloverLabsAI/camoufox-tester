"use client";

import { useEffect, useState, useRef } from "react";
import { ProgressPanel } from "./ProgressPanel";
import { ResultCard } from "./ResultCard";
import { Certificate } from "./Certificate";
import type { FullTestResult, ProfileResult, SSEEvent } from "@/lib/types";

interface TestRunnerProps {
  binaryPath: string;
  running: boolean;
  results: FullTestResult | null;
  onComplete: (result: FullTestResult) => void;
  onReset: () => void;
}

export function TestRunner({ binaryPath, running, results, onComplete, onReset }: TestRunnerProps) {
  const [profileResults, setProfileResults] = useState<ProfileResult[]>([]);
  const [currentProfile, setCurrentProfile] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running) return;

    setProfileResults([]);
    setCurrentProfile(null);
    setCurrentIndex(0);
    setError(null);
    setSelectedProfile(null);

    const abort = new AbortController();
    abortRef.current = abort;

    async function runTests() {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ binaryPath }),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          setError("Failed to start tests");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventType = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6)) as SSEEvent;

                if (data.type === "progress") {
                  setCurrentProfile(data.profileName);
                  setCurrentIndex(data.profileIndex);
                  setTotalProfiles(data.total);
                } else if (data.type === "profile-complete") {
                  setProfileResults(prev => [...prev, data.result]);
                } else if (data.type === "complete") {
                  onCompleteRef.current(data.result);
                } else if (data.type === "error") {
                  setError(data.message);
                }
              } catch {}
              eventType = "";
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Test run failed");
        }
      }
    }

    runTests();

    return () => {
      abort.abort();
    };
  }, [running, binaryPath]);

  if (running && !error) {
    return (
      <ProgressPanel
        currentProfile={currentProfile}
        currentIndex={currentIndex}
        totalProfiles={totalProfiles}
        completedProfiles={profileResults}
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-950/30 border border-red-800/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">Test Failed</p>
          <p className="text-red-400/70 text-sm mt-2">{error}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={onReset}
            className="px-6 py-2 bg-[#241b3d] hover:bg-[#2d2249] border border-[rgba(139,127,166,0.2)] rounded-lg text-sm text-[#e0daf0] transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <div className="space-y-6">
        {/* Overall Summary */}
        <div className="bg-[#1a1034] border border-[rgba(139,127,166,0.15)] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradeColors[results.overallGrade] || gradeColors.F} flex items-center justify-center`}>
                <span className="text-4xl font-bold text-white">{results.overallGrade}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#e0daf0]">
                  {results.totalPassed} / {results.totalChecks} checks passed
                </h2>
                <p className="text-[#8b7fa6] mt-1 text-sm">
                  {Math.round((results.totalPassed / results.totalChecks) * 100)}% pass rate across {results.profiles.length} profiles
                  {results.totalPassed === results.totalChecks ? " -- Perfect score" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Cross-profile uniqueness */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <UniquenessCard
              title="macOS Per-Context"
              data={results.crossProfile.macPerContext}
            />
            <UniquenessCard
              title="Linux Per-Context"
              data={results.crossProfile.linuxPerContext}
            />
          </div>
        </div>

        {/* Profile Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider px-1">
            Profile Results ({results.profiles.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.profiles.map((pr, i) => (
              <ProfileCard
                key={i}
                profile={pr}
                selected={selectedProfile === i}
                onClick={() => setSelectedProfile(selectedProfile === i ? null : i)}
              />
            ))}
          </div>
        </div>

        {/* Expanded Profile Detail */}
        {selectedProfile !== null && results.profiles[selectedProfile] && (
          <ResultCard profileResult={results.profiles[selectedProfile]} />
        )}

        {/* Certificate */}
        <Certificate results={results} />

        {/* Actions */}
        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={onReset}
            className="px-6 py-2 bg-[#241b3d] hover:bg-[#2d2249] border border-[rgba(139,127,166,0.2)] rounded-lg text-sm text-[#e0daf0] transition-colors"
          >
            Run Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const gradeColors: Record<string, string> = {
  A: "from-emerald-500 to-green-600",
  B: "from-cyan-500 to-teal-600",
  C: "from-yellow-500 to-amber-600",
  D: "from-orange-500 to-orange-600",
  F: "from-red-500 to-red-600",
};

function ProfileCard({ profile, selected, onClick }: {
  profile: ProfileResult;
  selected: boolean;
  onClick: () => void;
}) {
  const osIcon = profile.profile.os === "macos" ? "\uF8FF" : "\u{1F427}";
  const modeLabel = profile.profile.mode === "per-context" ? "Per-Ctx" : "Global";
  const hasError = !!profile.error;

  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-all ${
        selected
          ? "bg-[#2d2249] border-cyan-500/50 ring-1 ring-cyan-500/30"
          : "bg-[#1a1034] border-[rgba(139,127,166,0.15)] hover:border-[rgba(139,127,166,0.3)]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{osIcon}</span>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradeColors[profile.grade] || gradeColors.F} flex items-center justify-center`}>
          <span className="text-sm font-bold text-white">{hasError ? "!" : profile.grade}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-[#e0daf0] truncate">{profile.profile.name}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          profile.profile.mode === "per-context"
            ? "bg-cyan-500/10 text-cyan-400"
            : "bg-purple-500/10 text-purple-400"
        }`}>
          {modeLabel}
        </span>
        {!hasError && (
          <span className="text-[10px] text-[#8b7fa6]">
            {profile.passCount}/{profile.totalChecks}
          </span>
        )}
        {hasError && (
          <span className="text-[10px] text-red-400">Error</span>
        )}
      </div>
    </button>
  );
}

function UniquenessCard({ title, data }: {
  title: string;
  data: { uniqueAudio: number; uniqueCanvas: number; uniqueFonts: number; uniqueTimezones: number; uniqueScreens: number; uniqueVoices: number; uniqueWebGL: number; uniquePlatforms: number; total: number };
}) {
  if (data.total === 0) return null;

  const items = [
    { label: "Audio", unique: data.uniqueAudio },
    { label: "Canvas", unique: data.uniqueCanvas },
    { label: "Fonts", unique: data.uniqueFonts },
    { label: "Voices", unique: data.uniqueVoices },
    { label: "WebGL", unique: data.uniqueWebGL },
    { label: "Screens", unique: data.uniqueScreens },
    { label: "Timezones", unique: data.uniqueTimezones },
    { label: "Platforms", unique: data.uniquePlatforms },
  ];

  return (
    <div className="bg-[#0d0919]/50 rounded-lg p-4">
      <h4 className="text-xs font-bold text-[#8b7fa6] uppercase tracking-wider mb-3">{title} Uniqueness</h4>
      <div className="flex gap-3">
        {items.map(item => {
          const allUnique = item.unique === data.total;
          return (
            <div key={item.label} className="text-center">
              <div className={`text-lg font-bold ${allUnique ? "text-cyan-400" : "text-amber-400"}`}>
                {item.unique}/{data.total}
              </div>
              <div className="text-[10px] text-[#8b7fa6]">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
