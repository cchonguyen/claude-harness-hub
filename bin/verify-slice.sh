#!/usr/bin/env bash
# ==============================================================================
# bin/verify-slice.sh
# Deterministic Epistemic Verification Runner for claude-harness-hub
#
# Executes the test command independently in a subshell, records the test exit
# code, stdout summary, and exact git HEAD SHA into .spec/STATE.json.
# Prevents agent self-certification of task completion.
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

# Running the gate is the claim that the slice is done, so move to Claimed first. Claimed needs no key.
node "$UPDATE_SCRIPT" --stage Claimed >/dev/null

echo "================================================================================"
echo " [VERIFICATION GATE] Running Deterministic Slice Verification"
echo "================================================================================"

# 1. Determine test command
TEST_CMD="${1:-}"
if [[ -z "$TEST_CMD" ]]; then
  if [[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then
    TEST_CMD="pnpm test -- --run"
  elif [[ -f "${REPO_ROOT}/package.json" ]]; then
    TEST_CMD="npm test -- --run"
  elif [[ -f "${REPO_ROOT}/Cargo.toml" ]]; then
    TEST_CMD="cargo test"
  elif [[ -f "${REPO_ROOT}/pyproject.toml" ]] || [[ -f "${REPO_ROOT}/pytest.ini" ]]; then
    TEST_CMD="pytest"
  else
    TEST_CMD="npm test"
  fi
fi

HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "uncommitted")"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TEMP_LOG="$(mktemp)"

echo "Repo Root : ${REPO_ROOT}"
echo "Git HEAD  : ${HEAD_SHA}"
echo "Command   : ${TEST_CMD}"
echo "--------------------------------------------------------------------------------"

# 2. Execute tests in a clean subshell and capture status
set +e
eval "$TEST_CMD" > "$TEMP_LOG" 2>&1
EXIT_CODE=$?
set -e

# Capture last 6 lines as evidence summary
EVIDENCE_SUMMARY="$(tail -n 6 "$TEMP_LOG" | tr '\n' ' ' | sed 's/"/\\"/g' | cut -c 1-250)"
rm -f "$TEMP_LOG"

echo "--------------------------------------------------------------------------------"
if [[ $EXIT_CODE -eq 0 ]]; then
  TESTS_PASSING="true"
  NEW_STAGE="Verified"
  echo ">>> STATUS: PASS (Exit Code 0)"
  echo ">>> Transitioning stage to: Verified"
else
  TESTS_PASSING="false"
  NEW_STAGE="Implementation"
  echo ">>> STATUS: FAIL (Exit Code ${EXIT_CODE})"
  echo ">>> Reverting stage to: Implementation (Fixes Required)"
fi
echo "================================================================================"

# 3. Construct verification JSON payload
VERIFICATION_JSON=$(cat <<EOF
{
  "testsPassing": ${TESTS_PASSING},
  "exitCode": ${EXIT_CODE},
  "testCommandRun": "${TEST_CMD}",
  "evidenceCommitSha": "${HEAD_SHA}",
  "verifiedAt": "${TIMESTAMP}",
  "evidenceSummary": "${EVIDENCE_SUMMARY}"
}
EOF
)

# 4. Atomically record evidence in .spec/STATE.json
node "$UPDATE_SCRIPT" \
  --set-verification "$VERIFICATION_JSON" \
  --stage "$NEW_STAGE" \
  --internal-key "$INTERNAL_SECRET"

exit $EXIT_CODE
