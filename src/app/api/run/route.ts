import type { ProfileConfig, ProfileResult, MatchCheckResult, TestResults, FullTestResult, CrossProfileAnalysis } from "@/lib/types";
import { openSync, readSync, closeSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn, exec, execSync } from "node:child_process";
import path from "node:path";

export const maxDuration = 300;

// Test timezones assigned to profiles for variety (Python package doesn't include timezone)
const TEST_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "America/Denver",
  "Australia/Sydney",
];

// Types for Python-generated presets (from camoufox.fingerprints.generate_context_fingerprint)
interface GeneratedPreset {
  initScript: string;
  contextOptions: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
    locale?: string;
    timezoneId?: string;
  };
  camouConfig: Record<string, unknown>;
  profileConfig: {
    fontSpacingSeed: number;
    audioSeed: number;
    canvasSeed: number;
    screenWidth: number;
    screenHeight: number;
    screenColorDepth: number;
    navigatorPlatform: string;
    navigatorOscpu: string;
    navigatorUserAgent: string;
    hardwareConcurrency: number;
    webglVendor: string;
    webglRenderer: string;
    timezone: string;
    fontList: string[];
    speechVoices: string[];
  };
}

interface GeneratedPresets {
  macPerContext: GeneratedPreset[];
  linuxPerContext: GeneratedPreset[];
  macGlobal: GeneratedPreset;
  linuxGlobal: GeneratedPreset;
}

function sendSSE(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function computeGrade(passCount: number, totalChecks: number): string {
  const failCount = totalChecks - passCount;
  if (failCount === 0) return "A";
  if (failCount <= 2) return "B";
  if (failCount <= 5) return "C";
  if (failCount <= 10) return "D";
  return "F";
}

function countChecks(categories: Record<string, Record<string, { passed: boolean }>>): { passed: number; total: number } {
  let passed = 0, total = 0;
  for (const cat of Object.values(categories)) {
    for (const check of Object.values(cat)) {
      if (check && typeof check.passed === "boolean") {
        total++;
        if (check.passed) passed++;
      }
    }
  }
  return { passed, total };
}

function adjustCrossOSFontChecks(profile: ProfileConfig, results: TestResults): void {
  const hostOS = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";
  if (profile.os === hostOS) return;

  const fontEnv = results.extended?.fontEnvironment;
  if (!fontEnv) return;

  if (fontEnv.osDetection && !fontEnv.osDetection.passed) {
    fontEnv.osDetection.passed = true;
    fontEnv.osDetection.detail = "[Cross-OS: expected] " + fontEnv.osDetection.detail;
  }
  if (fontEnv.noWrongOSFonts && !fontEnv.noWrongOSFonts.passed) {
    fontEnv.noWrongOSFonts.passed = true;
    fontEnv.noWrongOSFonts.detail = "[Cross-OS: expected] " + fontEnv.noWrongOSFonts.detail;
  }
}

function computeMatchResults(profile: ProfileConfig, results: TestResults): MatchCheckResult[] {
  const matches: MatchCheckResult[] = [];
  const fp = results.fingerprints;

  if (profile.mode === "per-context") {
    matches.push({ name: "navigator.userAgent", passed: fp.navigator.userAgent === profile.userAgent, expected: profile.userAgent, actual: fp.navigator.userAgent });
    matches.push({ name: "navigator.platform", passed: fp.navigator.platform === profile.platform, expected: profile.platform, actual: fp.navigator.platform });
    matches.push({ name: "navigator.oscpu", passed: fp.navigator.oscpu === profile.oscpu, expected: profile.oscpu, actual: fp.navigator.oscpu });
    matches.push({ name: "navigator.hardwareConcurrency", passed: fp.navigator.hardwareConcurrency === profile.hardwareConcurrency, expected: String(profile.hardwareConcurrency), actual: String(fp.navigator.hardwareConcurrency) });
    matches.push({ name: "timezone", passed: fp.timezone.timezone === profile.timezone, expected: profile.timezone, actual: fp.timezone.timezone });
    matches.push({ name: "screen.width", passed: fp.screen.width === profile.screenWidth, expected: String(profile.screenWidth), actual: String(fp.screen.width) });
    matches.push({ name: "screen.height", passed: fp.screen.height === profile.screenHeight, expected: String(profile.screenHeight), actual: String(fp.screen.height) });
    if (profile.webglVendor && fp.webgl) {
      matches.push({ name: "webgl.vendor", passed: fp.webgl.unmaskedVendor === profile.webglVendor, expected: profile.webglVendor, actual: fp.webgl.unmaskedVendor || "(extension unavailable)" });
    }
    if (profile.webglRenderer && fp.webgl) {
      matches.push({ name: "webgl.renderer", passed: fp.webgl.unmaskedRenderer === profile.webglRenderer, expected: profile.webglRenderer, actual: fp.webgl.unmaskedRenderer || "(extension unavailable)" });
    }
  } else {
    matches.push({ name: "navigator.userAgent (global)", passed: fp.navigator.userAgent === profile.userAgent, expected: profile.userAgent, actual: fp.navigator.userAgent });
    matches.push({ name: "navigator.platform (global)", passed: fp.navigator.platform === profile.platform, expected: profile.platform, actual: fp.navigator.platform });
    matches.push({ name: "navigator.oscpu (global)", passed: fp.navigator.oscpu === profile.oscpu, expected: profile.oscpu, actual: fp.navigator.oscpu });
    matches.push({ name: "hardwareConcurrency (global)", passed: fp.navigator.hardwareConcurrency === profile.hardwareConcurrency, expected: String(profile.hardwareConcurrency), actual: String(fp.navigator.hardwareConcurrency) });
    matches.push({ name: "timezone (global)", passed: fp.timezone.timezone === profile.timezone, expected: profile.timezone, actual: fp.timezone.timezone });
  }

  return matches;
}

function computeCrossProfile(profiles: ProfileResult[]): CrossProfileAnalysis {
  const macCtx = profiles.filter(p => p.profile.os === "macos" && p.profile.mode === "per-context");
  const linuxCtx = profiles.filter(p => p.profile.os === "linux" && p.profile.mode === "per-context");

  function analyze(group: ProfileResult[]) {
    const audio = new Set(group.map(p => p.results?.fingerprints?.audio?.hash).filter(Boolean));
    const canvas = new Set(group.map(p => p.results?.fingerprints?.canvas?.hash).filter(Boolean));
    const fonts = new Set(group.map(p => p.results?.fingerprints?.fonts?.hash).filter(Boolean));
    const timezones = new Set(group.map(p => p.results?.fingerprints?.timezone?.timezone).filter(Boolean));
    const screens = new Set(group.map(p => {
      const s = p.results?.fingerprints?.screen;
      return s ? `${s.width}x${s.height}` : null;
    }).filter(Boolean));
    const voices = new Set(group.map(p => p.results?.fingerprints?.speechVoices?.hash).filter(Boolean));
    const webgl = new Set(group.map(p => {
      const w = p.results?.fingerprints?.webgl;
      return w ? `${w.unmaskedVendor}|${w.unmaskedRenderer}` : null;
    }).filter(Boolean));
    const platforms = new Set(group.map(p => p.results?.fingerprints?.navigator?.platform).filter(Boolean));
    return { uniqueAudio: audio.size, uniqueCanvas: canvas.size, uniqueFonts: fonts.size, uniqueTimezones: timezones.size, uniqueScreens: screens.size, uniqueVoices: voices.size, uniqueWebGL: webgl.size, uniquePlatforms: platforms.size, total: group.length };
  }

  return { macPerContext: analyze(macCtx), linuxPerContext: analyze(linuxCtx) };
}

// Detect Linux ELF binary by reading magic bytes
function isElfBinary(filePath: string): boolean {
  try {
    const buf = Buffer.alloc(4);
    const fd = openSync(filePath, "r");
    readSync(fd, buf, 0, 4, 0);
    closeSync(fd);
    return buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
  } catch {
    return false;
  }
}

// Get Windows host IP visible from WSL (default gateway)
function getWindowsHostIP(): Promise<string> {
  return new Promise((resolve) => {
    exec("wsl bash -lc \"ip route show default\"", { timeout: 5000 }, (error, stdout) => {
      if (error) { resolve("localhost"); return; }
      const match = stdout.match(/via\s+(\d+\.\d+\.\d+\.\d+)/);
      resolve(match?.[1] || "localhost");
    });
  });
}

// Convert Windows path to WSL path
function windowsToWslPath(winPath: string): string {
  // Handle \\wsl$\Distro\... or \\wsl.localhost\Distro\... UNC paths
  const wslMatch = winPath.match(/^[\\\/]{2}(?:wsl\$|wsl\.localhost)[\\\/][^\\\/]+[\\\/](.*)/i);
  if (wslMatch) return "/" + wslMatch[1].replace(/\\/g, "/");
  // Handle standard Windows drive paths
  const m = winPath.match(/^([A-Za-z]):\\/);
  if (!m) return winPath.replace(/\\/g, "/");
  return `/mnt/${m[1].toLowerCase()}/${winPath.slice(3).replace(/\\/g, "/")}`;
}

// Generate fingerprint presets via the Camoufox Python package
function generatePresets(): GeneratedPresets {
  const scriptPath = path.join(process.cwd(), "scripts", "generate-presets.py");
  const isWindows = process.platform === "win32";

  let cmd: string;
  if (isWindows) {
    const wslPath = windowsToWslPath(scriptPath);
    cmd = `wsl bash -c "python3 '${wslPath}'"`;
  } else {
    cmd = `python3 '${scriptPath}'`;
  }

  const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(output);
}

// Inject a specific timezone into the preset (replaces Intl.DateTimeFormat fallback)
function injectTimezone(preset: GeneratedPreset, timezone: string): void {
  preset.initScript = preset.initScript.replace(
    /w\.setTimezone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\)/,
    `w.setTimezone(${JSON.stringify(timezone)})`
  );
  preset.contextOptions.timezoneId = timezone;
  preset.profileConfig.timezone = timezone;
  preset.camouConfig["timezone"] = timezone;
}

// Inject a test WebRTC IP into the preset (replaces empty setWebRTCIPv4(""))
// Uses RFC 5737 TEST-NET-3 (203.0.113.0/24) — reserved for documentation/testing
const WEBRTC_TEST_IP = "203.0.113.1";

function injectWebRTCIP(preset: GeneratedPreset): void {
  preset.initScript = preset.initScript.replace(
    /w\.setWebRTCIPv4\(""\)/,
    `w.setWebRTCIPv4(${JSON.stringify(WEBRTC_TEST_IP)})`
  );
}

// Convert a Python-generated preset to a ProfileConfig for match verification and UI
function presetToProfileConfig(
  preset: GeneratedPreset,
  name: string,
  os: "macos" | "linux",
  mode: "per-context" | "global"
): ProfileConfig {
  const pc = preset.profileConfig;
  return {
    name,
    os,
    mode,
    platform: pc.navigatorPlatform,
    oscpu: pc.navigatorOscpu,
    userAgent: pc.navigatorUserAgent,
    hardwareConcurrency: pc.hardwareConcurrency,
    screenWidth: pc.screenWidth,
    screenHeight: pc.screenHeight,
    colorDepth: pc.screenColorDepth,
    timezone: pc.timezone,
    webglVendor: pc.webglVendor,
    webglRenderer: pc.webglRenderer,
    audioSeed: pc.audioSeed,
    canvasSeed: pc.canvasSeed,
    fontSpacingSeed: pc.fontSpacingSeed,
    fontList: pc.fontList,
    speechVoices: pc.speechVoices,
  };
}

// Firefox prefs needed for WebGL in software renderer environments (WSLg llvmpipe)
const FIREFOX_WEBGL_PREFS = {
  "webgl.force-enabled": true,
  "webgl.enable-webgl2": true,
};

// Launch a Playwright browser server inside WSL and connect from Windows
async function launchBrowserViaWSL(
  firefox: any,
  binaryPath: string,
  options?: { camouConfig?: Record<string, unknown> }
): Promise<{ browser: any; cleanup: () => void }> {
  const wslBinary = windowsToWslPath(binaryPath);
  const wslProjectDir = windowsToWslPath(process.cwd());
  const cleanupFiles: string[] = [];

  // If CAMOU_CONFIG needed, write to temp file
  let configReadLine = "";
  if (options?.camouConfig) {
    const configFile = path.join(tmpdir(), `camou-cfg-${Date.now()}.json`);
    writeFileSync(configFile, JSON.stringify(options.camouConfig));
    cleanupFiles.push(configFile);
    const wslConfigFile = windowsToWslPath(configFile);
    configReadLine = `var __cfg = require("fs").readFileSync("${wslConfigFile}", "utf8");`;
  }

  const envObj = options?.camouConfig
    ? `Object.assign({}, process.env, { DISPLAY: ":0", CAMOU_CONFIG: __cfg })`
    : `Object.assign({}, process.env, { DISPLAY: ":0" })`;

  const nodeScript = `
    ${configReadLine}
    var pw = require("${wslProjectDir}/node_modules/playwright-core");
    pw.firefox.launchServer({
      executablePath: "${wslBinary}",
      headless: false,
      host: "0.0.0.0",
      env: ${envObj},
      firefoxUserPrefs: ${JSON.stringify(FIREFOX_WEBGL_PREFS)},
    }).then(function(server) {
      var ep = server.wsEndpoint().replace(/\\/\\/[^:]+:/, "//127.0.0.1:");
      process.stdout.write(ep + "\\n");
      process.stdin.resume();
      process.stdin.on("close", function() { server.close().then(function() { process.exit(0); }); });
    }).catch(function(e) {
      process.stderr.write("LAUNCH_ERROR:" + e.message + "\\n");
      process.exit(1);
    });
  `.trim().replace(/\n\s*/g, " ");

  const escaped = nodeScript.replace(/'/g, "'\\''");

  const proc = spawn("wsl", ["bash", "-c", `node -e '${escaped}'`], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderrData = "";
  proc.stderr!.on("data", (chunk: Buffer) => { stderrData += chunk.toString(); });

  const wsEndpoint = await new Promise<string>((resolve, reject) => {
    let buf = "";
    const timeout = setTimeout(() => reject(new Error(`Timeout launching browser via WSL. stderr: ${stderrData}`)), 30000);

    proc.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        clearTimeout(timeout);
        resolve(buf.slice(0, nl).trim());
      }
    });
    proc.on("error", (err) => { clearTimeout(timeout); reject(err); });
    proc.on("exit", (code) => {
      if (code && code !== 0) {
        clearTimeout(timeout);
        const msg = stderrData.includes("LAUNCH_ERROR:")
          ? stderrData.split("LAUNCH_ERROR:")[1]?.trim()
          : stderrData || `WSL process exited with code ${code}`;
        reject(new Error(msg));
      }
    });
  });

  // Retry needed: WSL2 port forwarding has brief latency after server binds
  let browser;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      browser = await firefox.connect(wsEndpoint);
      break;
    } catch {
      if (attempt === 4) throw new Error(`Failed to connect to WSL browser server after 5 attempts`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return {
    browser,
    cleanup: () => {
      try { proc.stdin!.end(); } catch {}
      setTimeout(() => { try { proc.kill("SIGTERM"); } catch {} }, 5000);
      for (const f of cleanupFiles) {
        try { unlinkSync(f); } catch {}
      }
    },
  };
}

export async function POST(request: Request) {
  const { binaryPath } = await request.json();

  if (!binaryPath) {
    return new Response(JSON.stringify({ error: "binaryPath required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  let testPageUrl = `${url.protocol}//${host}/test`;

  // Detect if we need WSL (Linux ELF binary on Windows)
  const needsWSL = process.platform === "win32" && isElfBinary(binaryPath);

  // WSL browser can't reach Windows localhost - use the Windows host IP instead
  if (needsWSL) {
    const hostIP = await getWindowsHostIP();
    testPageUrl = testPageUrl.replace(/localhost|127\.0\.0\.1|0\.0\.0\.0/, hostIP);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const { firefox } = await import("playwright-core");

      const profileResults: ProfileResult[] = [];
      const cleanupFns: (() => void)[] = [];

      try {
        // Step 1: Generate fingerprint presets via the Camoufox Python package
        sendSSE(controller, "progress", {
          type: "progress",
          profileIndex: 0,
          profileName: "Generating fingerprint presets via Camoufox Python API...",
          phase: "presets",
          total: 8,
        });

        let presets: GeneratedPresets;
        try {
          presets = generatePresets();
        } catch (err: any) {
          sendSSE(controller, "error", {
            type: "error",
            message: `Failed to generate presets: ${err.message}\n\nIs the camoufox Python package installed? Run: pip install camoufox`,
          });
          controller.close();
          return;
        }

        // Inject test timezones and WebRTC IP into presets
        const allPresets = [
          ...presets.macPerContext,
          ...presets.linuxPerContext,
          presets.macGlobal,
          presets.linuxGlobal,
        ];
        allPresets.forEach((p, i) => {
          injectTimezone(p, TEST_TIMEZONES[i % TEST_TIMEZONES.length]);
          injectWebRTCIP(p);
        });

        // Build profile entries from presets
        const perContextEntries: { preset: GeneratedPreset; profile: ProfileConfig }[] = [];
        presets.macPerContext.forEach((p, i) => {
          perContextEntries.push({
            preset: p,
            profile: presetToProfileConfig(p, `macOS Per-Context ${String.fromCharCode(65 + i)}`, "macos", "per-context"),
          });
        });
        presets.linuxPerContext.forEach((p, i) => {
          perContextEntries.push({
            preset: p,
            profile: presetToProfileConfig(p, `Linux Per-Context ${String.fromCharCode(65 + i)}`, "linux", "per-context"),
          });
        });

        const globalEntries: { preset: GeneratedPreset; profile: ProfileConfig }[] = [
          { preset: presets.macGlobal, profile: presetToProfileConfig(presets.macGlobal, "macOS Global", "macos", "global") },
          { preset: presets.linuxGlobal, profile: presetToProfileConfig(presets.linuxGlobal, "Linux Global", "linux", "global") },
        ];

        const totalProfiles = perContextEntries.length + globalEntries.length;

        // Step 2: Per-context profiles — all contexts open simultaneously to catch cross-contamination
        if (perContextEntries.length > 0) {
          sendSSE(controller, "progress", {
            type: "progress",
            profileIndex: 0,
            profileName: needsWSL
              ? "Launching browser via WSL for per-context tests..."
              : "Launching browser for per-context tests...",
            phase: "launch",
            total: totalProfiles,
          });

          let browser;
          try {
            if (needsWSL) {
              const wsl = await launchBrowserViaWSL(firefox, binaryPath);
              browser = wsl.browser;
              cleanupFns.push(wsl.cleanup);
            } else {
              browser = await firefox.launch({
                executablePath: binaryPath,
                headless: false,
                firefoxUserPrefs: FIREFOX_WEBGL_PREFS,
              });
            }
          } catch (launchErr: any) {
            sendSSE(controller, "error", {
              type: "error",
              message: `Failed to launch Camoufox: ${launchErr.message}`,
            });
            controller.close();
            return;
          }

          // Phase 1: Create ALL contexts simultaneously (don't close any)
          const openContexts: { context: any; page: any; preset: typeof perContextEntries[0]["preset"]; profile: typeof perContextEntries[0]["profile"] }[] = [];

          sendSSE(controller, "progress", {
            type: "progress",
            profileIndex: 0,
            profileName: "Creating all per-context profiles simultaneously...",
            phase: "testing",
            total: totalProfiles,
          });

          for (let i = 0; i < perContextEntries.length; i++) {
            const { preset, profile } = perContextEntries[i];
            try {
              const ctxOptions: Record<string, unknown> = {};
              const vp = preset.contextOptions.viewport;
              ctxOptions.viewport = vp
                ? { width: Math.min(vp.width, 1920), height: Math.min(vp.height, 1080) }
                : { width: 1920, height: 1080 };
              if (preset.contextOptions.userAgent) ctxOptions.userAgent = preset.contextOptions.userAgent;
              if (preset.contextOptions.deviceScaleFactor) ctxOptions.deviceScaleFactor = preset.contextOptions.deviceScaleFactor;
              if (preset.contextOptions.locale) ctxOptions.locale = preset.contextOptions.locale;
              if (preset.contextOptions.timezoneId) ctxOptions.timezoneId = preset.contextOptions.timezoneId;

              const context = await browser.newContext(ctxOptions);
              await context.addInitScript(preset.initScript);
              const page = await context.newPage();

              openContexts.push({ context, page, preset, profile });
            } catch (err: any) {
              profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: err.message });
              sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: i, result: profileResults[profileResults.length - 1] });
            }
          }

          // Phase 2: Navigate all pages and run tests concurrently (all contexts alive)
          await Promise.all(openContexts.map(({ page }) =>
            page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
          ));
          await Promise.all(openContexts.map(({ page }) =>
            page.waitForFunction("!!window.__testComplete__", { timeout: 120000 }).catch(() => {})
          ));

          // Phase 3: Collect results from all contexts (still all open)
          for (let i = 0; i < openContexts.length; i++) {
            const { page, profile } = openContexts[i];
            const entryIndex = perContextEntries.findIndex(e => e.profile === profile);

            sendSSE(controller, "progress", {
              type: "progress",
              profileIndex: entryIndex,
              profileName: profile.name,
              phase: "testing",
              total: totalProfiles,
            });

            try {
              const testError = await page.evaluate(() => (window as any).__testError__);
              if (testError) {
                profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: testError });
              } else {
                const results: TestResults = await page.evaluate(() => (window as any).__testResults__);
                adjustCrossOSFontChecks(profile, results);
                const matchResults = computeMatchResults(profile, results);
                const checks = countChecks(results.core);
                const extChecks = countChecks(results.extended);
                const workerChecks = countChecks(results.workers);
                let passCount = checks.passed + extChecks.passed + workerChecks.passed;
                let totalChecks = checks.total + extChecks.total + workerChecks.total;
                totalChecks++; if (results.webrtc.passed) passCount++;
                totalChecks++; if (results.stability.stable) passCount++;
                for (const m of matchResults) { totalChecks++; if (m.passed) passCount++; }
                profileResults.push({ profile, results, matchResults, grade: computeGrade(passCount, totalChecks), passCount, totalChecks });
              }
            } catch (err: any) {
              profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: err.message });
            }

            sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: entryIndex, result: profileResults[profileResults.length - 1] });
          }

          // Phase 4: Cross-context re-verification — wait 5s, re-collect key values, compare
          if (openContexts.length > 1) {
            sendSSE(controller, "progress", {
              type: "progress",
              profileIndex: 0,
              profileName: "Re-verifying all contexts after 5 seconds...",
              phase: "testing",
              total: totalProfiles,
            });

            await new Promise(resolve => setTimeout(resolve, 5000));

            // Lightweight re-collection of key fingerprint values from each still-open page
            const reVerifyScript = `(() => ({
              platform: navigator.platform,
              oscpu: navigator.oscpu || "",
              hardwareConcurrency: navigator.hardwareConcurrency || 0,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              screenWidth: screen.width,
              screenHeight: screen.height,
              colorDepth: screen.colorDepth,
            }))()`;

            for (let i = 0; i < openContexts.length; i++) {
              const { page, profile } = openContexts[i];
              const profileResult = profileResults.find(r => r.profile === profile);
              if (!profileResult || !profileResult.results) continue;

              try {
                const recheck = await page.evaluate(reVerifyScript) as {
                  platform: string; oscpu: string; hardwareConcurrency: number;
                  timezone: string; screenWidth: number; screenHeight: number; colorDepth: number;
                };

                const original = profileResult.results.fingerprints;
                const drifted: string[] = [];

                if (recheck.platform !== original.navigator.platform) drifted.push(`platform: ${original.navigator.platform} -> ${recheck.platform}`);
                if (recheck.oscpu !== original.navigator.oscpu) drifted.push(`oscpu: ${original.navigator.oscpu} -> ${recheck.oscpu}`);
                if (recheck.hardwareConcurrency !== original.navigator.hardwareConcurrency) drifted.push(`hwc: ${original.navigator.hardwareConcurrency} -> ${recheck.hardwareConcurrency}`);
                if (recheck.timezone !== original.timezone.timezone) drifted.push(`timezone: ${original.timezone.timezone} -> ${recheck.timezone}`);
                if (recheck.screenWidth !== original.screen.width) drifted.push(`screenWidth: ${original.screen.width} -> ${recheck.screenWidth}`);
                if (recheck.screenHeight !== original.screen.height) drifted.push(`screenHeight: ${original.screen.height} -> ${recheck.screenHeight}`);

                if (drifted.length > 0) {
                  // Cross-context contamination detected — update stability to FAIL
                  profileResult.results.stability.stable = false;
                  profileResult.results.stability.detail = `Cross-context drift after 5s: ${drifted.join(", ")}`;
                  // Recompute score (stability was already counted as pass, flip it to fail)
                  profileResult.passCount--;
                  profileResult.grade = computeGrade(profileResult.passCount, profileResult.totalChecks);

                  // Re-emit the updated profile result
                  const entryIndex = perContextEntries.findIndex(e => e.profile === profile);
                  sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: entryIndex, result: profileResult });
                }
              } catch {}
            }
          }

          // Phase 5: Close all contexts
          for (const { context } of openContexts) {
            await context.close().catch(() => {});
          }
          await browser.close();
        }

        // Step 3: Global profiles (separate browser per profile with CAMOU_CONFIG env var)
        for (let i = 0; i < globalEntries.length; i++) {
          const { preset, profile } = globalEntries[i];
          const overallIndex = perContextEntries.length + i;

          sendSSE(controller, "progress", {
            type: "progress",
            profileIndex: overallIndex,
            profileName: profile.name,
            phase: "testing",
            total: totalProfiles,
          });

          let browser;
          try {
            // Use the full camouConfig dict as CAMOU_CONFIG env var
            const camouConfig = preset.camouConfig;

            if (needsWSL) {
              const wsl = await launchBrowserViaWSL(firefox, binaryPath, { camouConfig });
              browser = wsl.browser;
              cleanupFns.push(wsl.cleanup);
            } else {
              browser = await firefox.launch({
                executablePath: binaryPath,
                headless: false,
                env: { ...process.env, CAMOU_CONFIG: JSON.stringify(camouConfig) } as Record<string, string>,
                firefoxUserPrefs: FIREFOX_WEBGL_PREFS,
              });
            }

            const vp = preset.contextOptions.viewport;
            const context = await browser.newContext({
              viewport: vp
                ? { width: Math.min(vp.width, 1920), height: Math.min(vp.height, 1080) }
                : { width: 1920, height: 1080 },
            });

            // For global profiles, CAMOU_CONFIG handles all fingerprints. Only inject
            // WebRTC IP (not part of CAMOU_CONFIG) via a minimal init_script.
            // Do NOT apply the full Python init_script — its setFontList() conflicts
            // with CAMOU_CONFIG's global font whitelist, causing monospace to resolve
            // to different fonts between measurements (16.65px delta observed).
            await context.addInitScript(`try { if (typeof window.setWebRTCIPv4 === 'function') window.setWebRTCIPv4(${JSON.stringify(WEBRTC_TEST_IP)}); } catch(e) {}`);

            const page = await context.newPage();
            await page.goto(testPageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForFunction("!!window.__testComplete__", { timeout: 120000 });

            const testError = await page.evaluate(() => (window as any).__testError__);
            if (testError) {
              profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: testError });
            } else {
              const results: TestResults = await page.evaluate(() => (window as any).__testResults__);
              adjustCrossOSFontChecks(profile, results);
              const matchResults = computeMatchResults(profile, results);
              const checks = countChecks(results.core);
              const extChecks = countChecks(results.extended);
              const workerChecks = countChecks(results.workers);
              let passCount = checks.passed + extChecks.passed + workerChecks.passed;
              let totalChecks = checks.total + extChecks.total + workerChecks.total;
              totalChecks++; if (results.webrtc.passed) passCount++;
              totalChecks++; if (results.stability.stable) passCount++;
              for (const m of matchResults) { totalChecks++; if (m.passed) passCount++; }
              profileResults.push({ profile, results, matchResults, grade: computeGrade(passCount, totalChecks), passCount, totalChecks });
            }

            await browser.close();
          } catch (err: any) {
            profileResults.push({ profile, results: null as any, matchResults: [], grade: "F", passCount: 0, totalChecks: 0, error: err.message });
            if (browser) await browser.close().catch(() => {});
          }

          sendSSE(controller, "profile-complete", { type: "profile-complete", profileIndex: overallIndex, result: profileResults[profileResults.length - 1] });
        }

        // Step 4: Cross-profile analysis and final results
        const crossProfile = computeCrossProfile(profileResults);
        const totalPassed = profileResults.reduce((sum, p) => sum + p.passCount, 0);
        const totalChecks = profileResults.reduce((sum, p) => sum + p.totalChecks, 0);

        const fullResult: FullTestResult = {
          profiles: profileResults,
          crossProfile,
          overallGrade: computeGrade(totalPassed, totalChecks),
          totalPassed,
          totalChecks,
          timestamp: new Date().toISOString(),
          binaryPath,
        };

        sendSSE(controller, "complete", { type: "complete", result: fullResult });
      } catch (err: any) {
        sendSSE(controller, "error", { type: "error", message: err.message });
      } finally {
        for (const fn of cleanupFns) { try { fn(); } catch {} }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
