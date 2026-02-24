/**
 * Promptfoo assertion for expense extraction evaluation.
 * Context: { output, vars, prompt, test, provider, providerResponse, ... }
 * Output is expected to be JSON: { expenses: Array<{ emailId, merchant, amount, date, category, description }> }
 */
const VALID_CATEGORIES = new Set([
  'Food',
  'Transport',
  'Entertainment',
  'Bills',
  'Shopping',
  'Other',
]);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function stripJsonMarkdown(s) {
  if (s == null || typeof s !== 'string') return s;
  const t = s.trim();
  const m = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return m ? m[1].trim() : t;
}

function assertExtractOutput(firstArg, secondArg) {
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
  if (!Array.isArray(parsed.expenses)) {
    return { pass: false, score: 0, reason: 'expenses must be an array' };
  }

  let score = 1;
  const reasons = [];

  for (let i = 0; i < parsed.expenses.length; i++) {
    const e = parsed.expenses[i];
    const required = ['emailId', 'merchant', 'amount', 'date', 'category', 'description'];
    const missing = required.filter((key) => e[key] === undefined || e[key] === null || e[key] === '');
    if (missing.length > 0) {
      reasons.push(`Expense ${i}: missing fields: ${missing.join(', ')}`);
      score -= 0.2;
      continue;
    }
    if (typeof e.amount !== 'number' || e.amount < 0) {
      reasons.push(`Expense ${i}: amount must be a non-negative number`);
      score -= 0.2;
    }
    if (!DATE_REGEX.test(String(e.date))) {
      reasons.push(`Expense ${i}: date must be YYYY-MM-DD, got ${e.date}`);
      score -= 0.2;
    }
    if (!VALID_CATEGORIES.has(String(e.category))) {
      reasons.push(`Expense ${i}: invalid category "${e.category}"`);
      score -= 0.1;
    }
  }

  // Optional: if test provides expectedMinExpenses, check count
  const expectedMin = vars.expectedMinExpenses;
  if (typeof expectedMin === 'number' && parsed.expenses.length < expectedMin) {
    reasons.push(`Expected at least ${expectedMin} expense(s), got ${parsed.expenses.length}`);
    score -= 0.2;
  }

  const pass = score >= 1;
  return {
    pass,
    score: Math.max(0, Math.min(1, score)),
    reason: reasons.length ? reasons.join('; ') : 'Extract output is valid',
  };
}

module.exports = assertExtractOutput;
