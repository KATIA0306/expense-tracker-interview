/**
 * Promptfoo assertion: score = fraction of expenses with valid amount and date.
 * Use with threshold: 0.95 to require ≥95% on amount and date.
 * Context: { output, vars, ... }
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function stripJsonMarkdown(s) {
  if (s == null || typeof s !== 'string') return s;
  const t = s.trim();
  const m = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return m ? m[1].trim() : t;
}

function assertExtractAmountDate(firstArg, secondArg) {
  const context = secondArg != null ? secondArg : firstArg;
  const raw =
    typeof firstArg === 'string'
      ? firstArg
      : context?.output ?? context?.providerResponse?.output ?? context?.response?.output;
  let output = raw;
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
  if (!parsed?.expenses || !Array.isArray(parsed.expenses)) {
    return { pass: false, score: 0, reason: 'expenses array missing' };
  }
  const expenses = parsed.expenses;
  if (expenses.length === 0) {
    return { pass: true, score: 1, reason: 'No expenses (amount/date N/A)' };
  }
  let ok = 0;
  for (const e of expenses) {
    const amountOk = typeof e.amount === 'number' && e.amount >= 0;
    const dateOk = DATE_REGEX.test(String(e.date ?? ''));
    if (amountOk && dateOk) ok++;
  }
  const score = ok / expenses.length;
  return {
    pass: score >= 0.95,
    score,
    reason: `Amount/date valid: ${ok}/${expenses.length} (${(score * 100).toFixed(0)}%)`,
  };
}

module.exports = assertExtractAmountDate;
