export function stripGeneratedCodeFences(content: string): string {
  let cleaned = String(content ?? '').trim();

  cleaned = cleaned
    .replace(/^```(?:html|xml|markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^'''(?:html|xml|markdown|md|text)?\s*/i, '')
    .replace(/\s*'''$/i, '')
    .trim();

  return cleaned;
}
