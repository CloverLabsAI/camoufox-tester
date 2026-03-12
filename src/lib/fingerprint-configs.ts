import type { ProfileConfig } from "./types";

// macOS fonts: common cross-platform + macOS-specific. NO Linux/Windows marker fonts.
const MACOS_FONTS = [
  // Cross-platform
  "Arial", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS",
  "Verdana", "Comic Sans MS", "Impact",
  // macOS system
  "Helvetica", "Helvetica Neue", "Menlo", "Monaco", "Geneva", "Lucida Grande",
  "Palatino", "Futura", "Optima", "Avenir", "Avenir Next", "Didot",
  "Gill Sans", "Copperplate", "American Typewriter", "Baskerville", "Garamond",
  "Apple Chancery", "Hoefler Text", "Marker Felt", "Papyrus", "Phosphate",
  "Skia", "Snell Roundhand", "Zapfino",
  // macOS CJK / marker fonts
  "PingFang HK", "PingFang SC", "PingFang TC", "Apple SD Gothic Neo",
  "Hiragino Sans", "Hiragino Kaku Gothic ProN",
  // macOS version markers
  "Kohinoor Devanagari", "Luminari", "InaiMathi", "Galvji", "MuktaMahee",
  "STIX Two Math", "STIX Two Text", "Noto Sans Canadian Aboriginal",
];

// Linux fonts: common cross-platform + Linux-specific. NO macOS/Windows marker fonts.
const LINUX_FONTS = [
  // Cross-platform
  "Arial", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS",
  "Verdana", "Comic Sans MS", "Impact",
  // Linux system (croscore / bundled)
  "Arimo", "Cousine", "Tinos",
  // Noto family
  "Noto Sans", "Noto Serif", "Noto Mono", "Noto Color Emoji",
  "Noto Sans CJK SC", "Noto Sans CJK TC", "Noto Sans CJK HK",
  // Liberation
  "Liberation Sans", "Liberation Serif", "Liberation Mono",
  // DejaVu
  "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono",
  // Ubuntu
  "Ubuntu", "Ubuntu Mono",
  // Other Linux
  "Cantarell", "Droid Sans", "FreeSans", "FreeSerif", "FreeMono",
];

const MACOS_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0";
const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0";

export const MAC_PER_CONTEXT_PROFILES: ProfileConfig[] = [
  {
    name: "macOS Profile A",
    os: "macos",
    mode: "per-context",
    platform: "MacIntel",
    oscpu: "Intel Mac OS X 10.15",
    userAgent: MACOS_UA,
    hardwareConcurrency: 8,
    screenWidth: 2560,
    screenHeight: 1600,
    colorDepth: 30,
    timezone: "America/New_York",
    webglVendor: "Apple",
    webglRenderer: "Apple M1 Pro",
    audioSeed: 1234567,
    canvasSeed: 2345678,
    fontSpacingSeed: 3456789,
    fontList: MACOS_FONTS,
  },
  {
    name: "macOS Profile B",
    os: "macos",
    mode: "per-context",
    platform: "MacIntel",
    oscpu: "Intel Mac OS X 10.15",
    userAgent: MACOS_UA,
    hardwareConcurrency: 10,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    timezone: "America/Chicago",
    webglVendor: "Intel Inc.",
    webglRenderer: "Intel Iris Plus Graphics 655",
    audioSeed: 4567890,
    canvasSeed: 5678901,
    fontSpacingSeed: 6789012,
    fontList: MACOS_FONTS,
  },
  {
    name: "macOS Profile C",
    os: "macos",
    mode: "per-context",
    platform: "MacIntel",
    oscpu: "Intel Mac OS X 10.15",
    userAgent: MACOS_UA,
    hardwareConcurrency: 12,
    screenWidth: 2560,
    screenHeight: 1440,
    colorDepth: 30,
    timezone: "America/Los_Angeles",
    webglVendor: "ATI Technologies Inc.",
    webglRenderer: "AMD Radeon Pro 5500M OpenGL Engine",
    audioSeed: 7890123,
    canvasSeed: 8901234,
    fontSpacingSeed: 9012345,
    fontList: MACOS_FONTS,
  },
];

export const LINUX_PER_CONTEXT_PROFILES: ProfileConfig[] = [
  {
    name: "Linux Profile A",
    os: "linux",
    mode: "per-context",
    platform: "Linux x86_64",
    oscpu: "Linux x86_64",
    userAgent: LINUX_UA,
    hardwareConcurrency: 4,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    timezone: "Europe/London",
    webglVendor: "Intel",
    webglRenderer: "Mesa Intel(R) UHD Graphics 630 (CFL GT2)",
    audioSeed: 1111111,
    canvasSeed: 2222222,
    fontSpacingSeed: 3333333,
    fontList: LINUX_FONTS,
  },
  {
    name: "Linux Profile B",
    os: "linux",
    mode: "per-context",
    platform: "Linux x86_64",
    oscpu: "Linux x86_64",
    userAgent: LINUX_UA,
    hardwareConcurrency: 8,
    screenWidth: 2560,
    screenHeight: 1440,
    colorDepth: 24,
    timezone: "Asia/Tokyo",
    webglVendor: "NVIDIA Corporation",
    webglRenderer: "NVIDIA GeForce GTX 1660/PCIe/SSE2",
    audioSeed: 4444444,
    canvasSeed: 5555555,
    fontSpacingSeed: 6666666,
    fontList: LINUX_FONTS,
  },
  {
    name: "Linux Profile C",
    os: "linux",
    mode: "per-context",
    platform: "Linux x86_64",
    oscpu: "Linux x86_64",
    userAgent: LINUX_UA,
    hardwareConcurrency: 16,
    screenWidth: 3840,
    screenHeight: 2160,
    colorDepth: 24,
    timezone: "Europe/Berlin",
    webglVendor: "AMD",
    webglRenderer: "AMD Radeon RX 580 (polaris10, LLVM 15.0.7, DRM 3.49, 6.1.0)",
    audioSeed: 7777777,
    canvasSeed: 8888888,
    fontSpacingSeed: 9999999,
    fontList: LINUX_FONTS,
  },
];

export const MAC_GLOBAL_PROFILE: ProfileConfig = {
  name: "macOS Global",
  os: "macos",
  mode: "global",
  platform: "MacIntel",
  oscpu: "Intel Mac OS X 10.15",
  userAgent: MACOS_UA,
  hardwareConcurrency: 8,
  screenWidth: 1440,
  screenHeight: 900,
  colorDepth: 30,
  timezone: "America/Denver",
  webglVendor: "Apple",
  webglRenderer: "Apple M2",
  audioSeed: 0,
  canvasSeed: 0,
  fontSpacingSeed: 0,
  fontList: MACOS_FONTS,
};

export const LINUX_GLOBAL_PROFILE: ProfileConfig = {
  name: "Linux Global",
  os: "linux",
  mode: "global",
  platform: "Linux x86_64",
  oscpu: "Linux x86_64",
  userAgent: LINUX_UA,
  hardwareConcurrency: 4,
  screenWidth: 1920,
  screenHeight: 1080,
  colorDepth: 24,
  timezone: "UTC",
  webglVendor: "Intel",
  webglRenderer: "Mesa Intel(R) UHD Graphics 630 (CFL GT2)",
  audioSeed: 0,
  canvasSeed: 0,
  fontSpacingSeed: 0,
  fontList: LINUX_FONTS,
};

export const ALL_PROFILES: ProfileConfig[] = [
  ...MAC_PER_CONTEXT_PROFILES,
  ...LINUX_PER_CONTEXT_PROFILES,
  MAC_GLOBAL_PROFILE,
  LINUX_GLOBAL_PROFILE,
];

export function buildInitScript(profile: ProfileConfig): string {
  const calls: string[] = [];

  calls.push(`if (typeof window.setNavigatorPlatform === 'function') window.setNavigatorPlatform(${JSON.stringify(profile.platform)});`);
  calls.push(`if (typeof window.setNavigatorOscpu === 'function') window.setNavigatorOscpu(${JSON.stringify(profile.oscpu)});`);
  calls.push(`if (typeof window.setNavigatorUserAgent === 'function') window.setNavigatorUserAgent(${JSON.stringify(profile.userAgent)});`);
  calls.push(`if (typeof window.setNavigatorHardwareConcurrency === 'function') window.setNavigatorHardwareConcurrency(${profile.hardwareConcurrency});`);
  calls.push(`if (typeof window.setScreenDimensions === 'function') window.setScreenDimensions(${profile.screenWidth}, ${profile.screenHeight});`);
  calls.push(`if (typeof window.setScreenColorDepth === 'function') window.setScreenColorDepth(${profile.colorDepth});`);
  calls.push(`if (typeof window.setTimezone === 'function') window.setTimezone(${JSON.stringify(profile.timezone)});`);
  calls.push(`if (typeof window.setWebGLVendor === 'function') window.setWebGLVendor(${JSON.stringify(profile.webglVendor)});`);
  calls.push(`if (typeof window.setWebGLRenderer === 'function') window.setWebGLRenderer(${JSON.stringify(profile.webglRenderer)});`);

  if (profile.fontList.length > 0) {
    calls.push(`if (typeof window.setFontList === 'function') window.setFontList(${JSON.stringify(profile.fontList.join(","))});`);
  }

  if (profile.audioSeed > 0) {
    calls.push(`if (typeof window.setAudioFingerprintSeed === 'function') window.setAudioFingerprintSeed(${profile.audioSeed});`);
  }
  if (profile.canvasSeed > 0) {
    calls.push(`if (typeof window.setCanvasSeed === 'function') window.setCanvasSeed(${profile.canvasSeed});`);
  }
  if (profile.fontSpacingSeed > 0) {
    calls.push(`if (typeof window.setFontSpacingSeed === 'function') window.setFontSpacingSeed(${profile.fontSpacingSeed});`);
  }

  return calls.join("\n");
}

export function buildCamouConfig(profile: ProfileConfig): Record<string, unknown> {
  return {
    "navigator.platform": profile.platform,
    "navigator.oscpu": profile.oscpu,
    "navigator.userAgent": profile.userAgent,
    "navigator.hardwareConcurrency": profile.hardwareConcurrency,
    "screen.width": profile.screenWidth,
    "screen.height": profile.screenHeight,
    "screen.colorDepth": profile.colorDepth,
    "timezone": profile.timezone,
    "fonts": profile.fontList,
  };
}
