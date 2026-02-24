/**
 * Promptfoo assertion for email filter evaluation.
 * Context: { output, vars, prompt, test, provider, providerResponse, ... }
 * Output is expected to be JSON: { receiptEmailIds: string[] }
 */
function stripJsonMarkdown(s) {
  if (s == null || typeof s !== 'string') return s;
  const t = s.trim();
  const m = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return m ? m[1].trim() : t;
}

function assertFilterOutput(firstArg, secondArg) {
  const context = secondArg != null ? secondArg : firstArg;
  const raw =
    typeof firstArg === 'string'
      ? firstArg
      : context?.output ?? context?.providerResponse?.output ?? context?.response?.output;
  let output = raw;
  const vars = context?.vars || {};
  if (output != null && typeof output === 'string') output = stripJsonMarkdown(output);
  if (output == null || (typeof output === 'string' && output.trim() === '')) {
    return { pass: false, score: 0, reason: 'No output from provider' };
  }
  let parsed;
  try {
    parsed = typeof output === 'string' ? JSON.parse(output) : output;
  } catch {
    return { pass: false, score: 0, reason: 'Output is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { pass: false, score: 0, reason: 'Output is not a valid object' };
  }
  if (!Array.isArray(parsed.receiptEmailIds)) {
    return { pass: false, score: 0, reason: 'receiptEmailIds must be an array' };
  }
  const ids = new Set(parsed.receiptEmailIds);
  let score = 1;
  const reasons = [];

  // If test defines expected receipt IDs, they should be included
  const expectedReceiptIds = vars.expectedReceiptIds;
  if (Array.isArray(expectedReceiptIds) && expectedReceiptIds.length > 0) {
    const missing = expectedReceiptIds.filter((id) => !ids.has(id));
    if (missing.length > 0) {
      score -= 0.5;
      reasons.push(`Missing expected receipt IDs: ${missing.join(', ')}`);
    }
  }

  // If test defines IDs that must NOT be receipts (e.g. newsletter), they should be excluded
  const expectedNotReceiptIds = vars.expectedNotReceiptIds;
  if (Array.isArray(expectedNotReceiptIds) && expectedNotReceiptIds.length > 0) {
    const wronglyIncluded = expectedNotReceiptIds.filter((id) => ids.has(id));
    if (wronglyIncluded.length > 0) {
      score -= 0.5;
      reasons.push(`Should not be marked as receipt: ${wronglyIncluded.join(', ')}`);
    }
  }

  const pass = score >= 1;
  return {
    pass,
    score: Math.max(0, score),
    reason: reasons.length ? reasons.join('; ') : 'Filter output is valid',
  };
}

// Promptfoo expects a default export or the named function as assertion value
module.exports = assertFilterOutput;
