/** Display-only Markdown-it-style replacements; code, math and URLs bypass this. */
export function typographicText(text: string): string {
  const symbols: Record<string, string> = { c: '©', r: '®', tm: '™', p: '§' }
  return text.replace(/\((c|r|tm|p)\)/gi, (_, key: string) => symbols[key.toLowerCase()]!)
    .replace(/\+-/g, '±')
    .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
    .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
    .replace(/(^|[^-])---([^-]|$)/gm, '$1—$2')
    .replace(/(^|\s)--(\s|$)/gm, '$1–$2')
    .replace(/(^|[^-\s])--([^-\s]|$)/gm, '$1–$2')
}
