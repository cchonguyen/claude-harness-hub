#!/bin/bash
# Installs the harness plugin for every cloud thread in this environment.
# Claude Code loads any plugin folder under ~/.claude/skills/ as "<name>@skills-dir",
# with its agents (harness:gf-coder, harness:el-architect, ...) and its hooks.
# The hooks run each repo's own .harness/hooks/ and do nothing in repos without it.
set -u
DEST="$HOME/.claude/skills/harness"
TMP="$(mktemp -d)"
if curl -fsSL https://codeload.github.com/cchonguyen/claude-harness-hub/tar.gz/refs/heads/main \
     | tar -xz -C "$TMP" --strip-components=2 claude-harness-hub-main/plugins/harness 2>/dev/null \
   && [ -f "$TMP/harness/.claude-plugin/plugin.json" ]; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$DEST"
  mv "$TMP/harness" "$DEST"
  echo "harness plugin installed at $DEST"
  ver="$(grep -o '"version": *"[^"]*"' "$DEST/.claude-plugin/plugin.json" | sed 's/.*"\([^"]*\)"$/\1/')"
  echo "harness plugin version $ver"
elif [ -f "$DEST/.claude-plugin/plugin.json" ] && [ ! -f "$DEST/STANDIN" ]; then
  echo "harness plugin download failed; keeping the copy already installed at $DEST" >&2
else
  # No copy to fall back on. Install a stand-in whose only hook tells every thread the plugin is missing,
  # so the failure shows up in the thread instead of in a setup log nobody reads. Exit stays 0 so the
  # environment still starts. Version 0.0.0 lets refresh.mjs replace it from a hub checkout.
  echo "harness plugin download failed; installing a stand-in that warns each thread" >&2
  rm -rf "$DEST"
  mkdir -p "$DEST/.claude-plugin" "$DEST/hooks"
  : > "$DEST/STANDIN"
  printf '%s\n' '{ "name": "harness", "version": "0.0.0", "description": "Stand-in: the harness plugin download failed." }' \
    > "$DEST/.claude-plugin/plugin.json"
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"HARNESS PLUGIN MISSING: the cloud setup script could not download the harness plugin, so the harness:* agents and hooks are not loaded in this thread. Do each step yourself, and tell the operator once: open the environment settings in the Claude Code web app and start a new session so the setup script runs again."}}' \
    > "$DEST/hooks/warning.json"
  printf '%s\n' '{ "hooks": { "SessionStart": [ { "hooks": [ { "type": "command", "command": "cat \"${CLAUDE_PLUGIN_ROOT}/hooks/warning.json\"" } ] } ] } }' \
    > "$DEST/hooks/hooks.json"
fi
rm -rf "$TMP"
exit 0
