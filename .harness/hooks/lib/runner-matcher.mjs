// Shared by post-tool-scrub.mjs and post-tool-failure.mjs so both agree on what counts as a test/build run
const RUNNER = /\b(vitest|jest|tsc|eslint|typecheck|pytest|mypy|pyright)\b|\bruff\s+(check|format\s+--check)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|typecheck)\b/i;
const INSTALL = /\b(pip3?|uv\s+pip|uv|npm|pnpm|yarn|bun)\s+(install|add|i|sync)\b/i;
export const isTestOrBuild = (cmd) => RUNNER.test(cmd) && !INSTALL.test(cmd);
