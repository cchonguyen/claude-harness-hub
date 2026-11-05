#!/usr/bin/env bash
# ==============================================================================
# bin/accept-slice.sh
# Human Acceptance Gate Runner for claude-harness-hub
#
# Strictly requires human interaction and confirms that:
# 1. Tests have passed via verify-slice.sh
# 2. The evidenceCommitSha strictly matches current git HEAD
# 3. The human operator explicitly confirms acceptance
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_FILE="${REPO_ROOT}/.spec/STATE.json"
UPDATE_SCRIPT="${SCRIPT_DIR}/update-state.mjs"
INTERNAL_SECRET="${HARNESS_VERIFY_SECRET:-$(cat "$HOME/.config/vibe-command-center/verify-secret" 2>/dev/null || true)}"
if [[ -z "$INTERNAL_SECRET" ]]; then
  echo "[ERROR] No verify secret. Set HARNESS_VERIFY_SECRET or create ~/.config/vibe-command-center/verify-secret (chmod 600)." >&2
  exit 1
fi

if [[ ! -f "$STATE_FILE" ]]; then
  echo "[ERROR] .spec/STATE.json not found in repository root."
  exit 1
fi

CURRENT_HEAD="$(git rev-parse --short HEAD)"
STAGE="$(node -e "const s = JSON.parse(fs.readFileSync('$STATE_FILE')); console.log(s.stage || '');")"
TESTS_PASSING="$(node -e "const s = JSON.parse(fs.readFileSync('$STATE_FILE')); console.log(s.verification?.testsPassing ?? false);")"
EVIDENCE_SHA="$(node -e "const s = JSON.parse(fs.readFileSync('$STATE_FILE')); console.log(s.verification?.evidenceCommitSha || '');")"
SLICE_ID="$(node -e "const s = JSON.parse(fs.readFileSync('$STATE_FILE')); console.log(s.activeSlice?.id || 'unspecified');")"
SLICE_TITLE="$(node -e "const s = JSON.parse(fs.readFileSync('$STATE_FILE')); console.log(s.activeSlice?.title || '');")"

echo "================================================================================"
echo " [HUMAN ACCEPTANCE GATE] Slice Review & Final Gate"
echo "================================================================================"
echo "Slice ID         : ${SLICE_ID} (${SLICE_TITLE})"
echo "Current Stage    : ${STAGE}"
echo "Current Git HEAD : ${CURRENT_HEAD}"
echo "Evidence Git SHA : ${EVIDENCE_SHA}"
echo "Tests Passing    : ${TESTS_PASSING}"
echo "--------------------------------------------------------------------------------"

# Verification preconditions
if [[ "$TESTS_PASSING" != "true" ]]; then
  echo "[REJECTED] Cannot accept slice: automated tests have not passed."
  echo "Run 'bin/verify-slice.sh' first."
  exit 1
fi

if [[ "$CURRENT_HEAD" != "$EVIDENCE_SHA" ]]; then
  echo "[REJECTED] Drift detected: Git HEAD (${CURRENT_HEAD}) does not match verified SHA (${EVIDENCE_SHA})."
  echo "New commits were made after testing. Re-run 'bin/verify-slice.sh' to re-verify current HEAD."
  exit 1
fi

echo "Recent git commit for this slice:"
git log -1 --stat
echo "--------------------------------------------------------------------------------"

read -p "Are you satisfied with the implementation and evidence to accept this slice? [y/N]: " CONFIRM
if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  node "$UPDATE_SCRIPT" \
    --stage "Accepted" \
    --internal-key "$INTERNAL_SECRET"
  echo ""
  echo ">>> [SUCCESS] Slice '${SLICE_ID}' marked as 'Accepted'."
  echo ">>> Next step: Run '/wrap' to log architectural decisions and close the slice."
else
  echo ""
  echo "[ABORTED] Acceptance canceled by operator. Stage remains '${STAGE}'."
  exit 0
fi
