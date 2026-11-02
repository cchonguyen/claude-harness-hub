#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { appendBatchEvent, resolveRoot } from './status-batch.mjs';

const root = resolveRoot();
const progressPath = path.join(root, '.spec', 'PROGRESS.md');
const specPath = path.join(root, '.spec', 'SYSTEM_SPEC.md');
const strikePath = path.join(root, '.spec', '.strike-counter.json');
const authPath = path.join(root, '.spec', '.upshift-auth.json');

const mode = (process.argv[2] || 'implement').toLowerCase(); // 'implement' | 'spec'
const rawArg = (process.argv[3] || '').trim().toLowerCase();

const parseTargets = (line) => {
  const match = line?.match(/Target files:\s*(.+)$/i);
  if (!match) return [];
  return match[1].replace(/[`*]/g, '').split(',').map((s) => s.trim().replace(/^\.\//, '')).filter(Boolean);
};

const writeAuth = (tier, subagent, slice) => {
  fs.mkdirSync(path.dirname(authPath), { recursive: true });
  fs.writeFileSync(
    authPath,
    JSON.stringify({ tier, subagent, slice, authorizedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
};

export const clearUpshiftAuth = (projectRoot = root) => {
  const p = path.join(projectRoot, '.spec', '.upshift-auth.json');
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
};

export const verifyUpshiftAuth = (projectRoot, requestedAgent) => {
  const gated = {
    'engineer-sonnet': 'sonnet',
    'architect-opus': 'opus'
  };
  const requiredTier = gated[requestedAgent];
  if (!requiredTier) return { allowed: true };
  const p = path.join(projectRoot, '.spec', '.upshift-auth.json');
  if (!fs.existsSync(p)) {
    return {
      allowed: false,
      reason: `SILENT UPSHIFT BLOCKED: Subagent "${requestedAgent}" (${requiredTier}) requires explicit operator approval. Run "/implement sonnet" or "/spec opus" to authorize.`
    };
  }
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.subagent === requestedAgent || data.tier === requiredTier) {
      return { allowed: true };
    }
  } catch {}
  return {
    allowed: false,
    reason: `SILENT UPSHIFT BLOCKED: Authorization in .spec/.upshift-auth.json does not match "${requestedAgent}".`
  };
};

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('evaluate-upshift.mjs')) {
  const progressLines = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8').split('\n') : [];
  const activeOrNextLine =
    progressLines.find((l) => /^\s*-\s*\[.\].*\[IN_PROGRESS\]/.test(l)) ||
    progressLines.find((l) => /^\s*-\s*\[\s\]/.test(l)) ||
    '';
  const sliceMatch = activeOrNextLine.match(/\*\*Slice\s+([^*]+)\*\*/);
  const sliceLabel = sliceMatch ? `Slice ${sliceMatch[1].trim()}` : 'next slice';

  // 1. Check if operator passed an explicit tier override argument (e.g. `/implement haiku`, `/implement sonnet`, `/spec opus`)
  if (mode === 'implement' && (rawArg === 'haiku' || rawArg === 'sonnet')) {
    const subagent = rawArg === 'sonnet' ? 'engineer-sonnet' : 'engineer';
    if (rawArg === 'sonnet') {
      writeAuth('sonnet', 'engineer-sonnet', sliceLabel);
      appendBatchEvent(root, {
        actor: 'operator',
        event: 'upshift_authorized',
        slice: sliceLabel,
        summary: `Operator authorized Sonnet upshift (engineer-sonnet) for ${sliceLabel}`
      });
    } else {
      clearUpshiftAuth(root);
    }
    console.log(`✓ AUTHORIZED_TIER: ${rawArg} -> Proceed immediately using the "${subagent}" subagent for ${sliceLabel}.`);
    process.exit(0);
  }

  if (mode === 'spec' && (rawArg === 'sonnet' || rawArg === 'opus')) {
    const subagent = rawArg === 'opus' ? 'architect-opus' : 'architect';
    if (rawArg === 'opus') {
      writeAuth('opus', 'architect-opus', sliceLabel);
      appendBatchEvent(root, {
        actor: 'operator',
        event: 'upshift_authorized',
        slice: sliceLabel,
        summary: 'Operator authorized Opus upshift (architect-opus) for /spec'
      });
    } else {
      clearUpshiftAuth(root);
    }
    console.log(`✓ AUTHORIZED_TIER: ${rawArg} -> Proceed immediately using the "${subagent}" subagent.`);
    process.exit(0);
  }

  // 2. Conservative Threshold Evaluation ("Silent When Green")
  const reasons = [];

  // Signal A: Target file blast radius >= 5 files on the target slice
  const targets = parseTargets(activeOrNextLine);
  if (targets.length >= 5) {
    reasons.push(`High file blast radius (${targets.length} target files/paths >= 5 threshold: ${targets.join(', ')})`);
  }

  // Signal B: Unresolved spec blockers or missing SYSTEM_SPEC.md
  if (!fs.existsSync(specPath)) {
    reasons.push('.spec/SYSTEM_SPEC.md is missing');
  } else {
    const specText = fs.readFileSync(specPath, 'utf8');
    const hasOpenBlocker = /blocking questions\s*:\s*(?!none\b|_none_|\s*$).+/i.test(specText) || /\bTODO:\s*BLOCKER\b/i.test(specText);
    if (hasOpenBlocker) {
      reasons.push('Unresolved Blocking Questions detected in .spec/SYSTEM_SPEC.md');
    }
  }

  // Signal C: 2-Strike Circuit Breaker active
  if (fs.existsSync(strikePath)) {
    try {
      const strikesObj = JSON.parse(fs.readFileSync(strikePath, 'utf8'));
      const maxStrikes = Math.max(0, ...Object.values(strikesObj).map((s) => Number(s?.strikes || 0)));
      if (maxStrikes >= 2) {
        reasons.push(`2-Strike Circuit Breaker is active (${maxStrikes} consecutive test/build failures)`);
      }
    } catch {}
  }

  const baselineTier = mode === 'spec' ? 'sonnet' : 'haiku';
  const baselineAgent = mode === 'spec' ? 'architect' : 'engineer';
  const upshiftCmd = mode === 'spec' ? '/spec opus' : '/implement sonnet';
  const forceBaselineCmd = mode === 'spec' ? '/spec sonnet' : '/implement haiku';
  const auditCmd = mode === 'spec' ? '/prep-audit spec' : '/prep-audit diff';

  if (reasons.length === 0) {
    // Silent When Green: single-line green light, zero friction
    clearUpshiftAuth(root);
    console.log(`✓ TIER_OK (${baselineTier}): Below upshift threshold. Proceed immediately with the "${baselineAgent}" subagent.`);
    process.exit(0);
  }

  // Threshold crossed: log advisory to batch and instruct Claude to PAUSE and ask the operator
  appendBatchEvent(root, {
    actor: 'evaluator',
    event: 'upshift_advisory',
    slice: sliceLabel,
    summary: `Complexity threshold reached before /${mode}`,
    details: reasons.join('; ')
  });

  console.log([
    `⚠ UPSHIFT_THRESHOLD_REACHED (${sliceLabel}): STOP. Do NOT spawn any subagent yet.`,
    `Reasons: ${reasons.join(' | ')}`,
    `Output ONLY the following "Needed from you:" block so the operator can choose the execution tier:`,
    `---`,
    `Needed from you (Complexity Threshold Reached on ${sliceLabel}):`,
    `- Trigger: ${reasons.join('; ')}`,
    `1. **Option A — Free Gemini / Antigravity Review (0% Claude Quota):** Run \`${auditCmd}\` (or switch to Antigravity) to resolve the complexity/blocker at zero Claude cost.`,
    `2. **Option B — Stay on Baseline (${baselineTier.toUpperCase()}):** Run \`${forceBaselineCmd}\` to execute with \`${baselineAgent}\` anyway.`,
    `3. **Option C — Authorize Upshift:** Run \`${upshiftCmd}\` to unlock the higher model tier for this step.`
  ].join('\n'));
}
