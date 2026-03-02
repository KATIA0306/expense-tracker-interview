# Email Import LLM Evaluations (promptfoo)

Evaluations for the feature: **Upload a CSV of email data → LLM parses purchases/expenses → upload to database.**

These evals validate the two LLM steps used in the backend:

1. **Email filter** – Which emails are receipts/transaction confirmations (vs newsletters, marketing).
2. **Expense extraction** – From receipt emails, extract merchant, amount, date (YYYY-MM-DD), category, and description.

## Setup

1. **Install promptfoo** (from repo root):

   ```bash
   npm install -D promptfoo
   # or
   npx promptfoo@latest eval --help
   ```

2. **API key**  
   Pass your env file with `--env-path` so `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is loaded. Path is relative to where you run the command.

## Running evaluations

**One command (from repo root) — runs all filter + extract evals:**

```bash
npm run eval
```

This script runs promptfoo from the **evals** directory so that `file://` paths in tests (e.g. `file://assertions/...`) resolve correctly.

From the **evals** directory directly:

```bash
cd evals && npx promptfoo eval --env-path ../backend/.env
```

Optional: write results to a file and open the viewer:

```bash
npx promptfoo eval -c evals/promptfooconfig.yaml -o evals/output/
npx promptfoo view
```

## Pass rate requirements

- **Overall (filtering + extraction):** ≥90%. Enforced via `PROMPTFOO_PASS_RATE_THRESHOLD=90` (e.g. in `evals/.env`). The eval exits with code 100 if the pass rate is below 90%.
- **Amount and date (extraction):** ≥95%. Enforced per extract test via `assertions/extract-amount-date-assertions.js` with `threshold: 0.95`; at least 95% of extracted expenses must have valid amount and YYYY-MM-DD date.

## Layout

- **Tests** are in the `evals/tests/` directory: `filter.yaml` (email filter) and `extract.yaml` (expense extraction).
- **Prompts** are in `evals/prompts/`; **assertions** in `evals/assertions/`.

## What’s evaluated

| Suite              | Prompt              | Tests                                                                 | Assertions |
|--------------------|---------------------|-----------------------------------------------------------------------|------------|
| **Email filter**   | `prompts/email-filter.txt`   | Receipt identified; newsletter excluded; mixed batch; no false positives | `is-json`, custom JS (schema + expected IDs) |
| **Expense extract**| `prompts/expense-extract.txt`| Single receipt; grocery; transport; non-receipt → empty/minimal        | `is-json`, custom JS (schema, amount/date/category) |

- **Prompts** mirror the instructions in `backend/src/services/llmService.ts` (filter + extract).
- **Assertions**: Valid JSON, correct shape, and (for filter) expected receipt IDs included/excluded; (for extract) required fields, numeric amount, YYYY-MM-DD date, category in allowed set.

## Eval vs real data

Evals use sanitized test data; real CSV emails often have:
- **RFC 2822 dates** (e.g. "Thu, 22 Jan 2026 15:31:30 +0000") — prompts now instruct parsing to YYYY-MM-DD.
- **Amount formats**: $33.38, CA$56.51, CAD 305.08, or "Total $ 33 38" (spaces = decimal).
- **Missing amounts** — e.g. "Thank you for your payment! Invoice attached" — use 0 per prompt.
- **HTML entities** — filter prompt instructs ignoring formatting noise.

Tests include real CSV body samples (Reptilia, Amazon, Making Dream, Old Navy) to better match production.

## Best practices used

- **Two evaluation suites** (filter vs extract) with separate prompts and test cases.
- **Structured outputs** enforced via `is-json` and JavaScript assertions (schema + business rules).
- **Representative cases**: clear receipts, newsletters, mixed batches, transport/grocery, non-receipt emails.
- **Expected behavior** encoded in test `vars` (e.g. `expectedReceiptIds`, `expectedNotReceiptIds`, `expectedMinExpenses`) and checked in custom assertions.
- **Config**: `maxConcurrency`, `timeoutMs`, `cache`, and output paths for JSON/HTML.
- **No secrets in config**: API key from environment only.

## Output

- Results are written to `evals/output/results.json` and `evals/output/results.html` (if `outputPath` is set).
- Use `npx promptfoo view` to inspect pass/fail and assertion details.

## Adding tests

Add new test cases in the **`evals/tests/`** directory:

- **Filter**: Add a test in `evals/tests/filter.yaml` under `tests:` with `prompts: [email-filter]`, `vars.emailSummaries` (JSON string of `{id, from, subject, bodyPreview}`), and optionally `expectedReceiptIds` / `expectedNotReceiptIds`. Reuse `assertions/filter-assertions.js`.
- **Extract**: Add a test in `evals/tests/extract.yaml` with `prompts: [expense-extract]`, `vars.emails` (JSON string of full email objects), and optionally `expectedMinExpenses`. Reuse `assertions/extract-assertions.js`.
