/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```) from LLM output
 * so is-json and custom assertions receive raw JSON.
 * Promptfoo may pass (output) or (context); we accept either.
 */
function stripJsonMarkdown(outputOrContext) {
  const output =
    outputOrContext != null && typeof outputOrContext === 'object' && 'output' in outputOrContext
      ? outputOrContext.output
      : outputOrContext;
  if (output == null || typeof output !== 'string') return output == null ? '' : String(output);
  const s = output.trim();
  const match = s.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  return match ? match[1].trim() : s;
}

module.exports = stripJsonMarkdown;
