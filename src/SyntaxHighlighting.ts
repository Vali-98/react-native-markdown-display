/** Syntax captures have stable names; override these in Markdown styles. */
export const syntaxStyles = {
  syntax_keyword: { color: '#a626a4' },
  syntax_string: { color: '#3a7b35' },
  syntax_comment: { color: '#777e87', fontStyle: 'italic' as const },
  syntax_number: { color: '#a86420' },
  syntax_function: { color: '#326ac5' },
  syntax_type: { color: '#986801' },
  syntax_property: { color: '#a14c29' },
  syntax_constant: { color: '#986801' },
  syntax_operator: { color: '#526875' },
  syntax_punctuation: { color: '#526875' },
  syntax_variable: {},
  syntax_tag: { color: '#22863a' },
  syntax_attribute: { color: '#a14c29' },
  syntax_embedded: {},
}
export const syntaxKinds = Object.fromEntries(Object.keys(syntaxStyles).map((type, index) => [type, 200 + index]))
