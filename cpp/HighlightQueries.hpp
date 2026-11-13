#pragma once
// Small, predicate-free highlight queries for the pinned grammars. No shelling
// out, language detection, WASM, injected languages or query predicates at runtime.
namespace vali::markdown {
inline constexpr auto javascriptQuery=R"query(
(identifier) @variable
(property_identifier) @property
(number) @number
(string) @string
(template_string) @string
(regex) @string
(comment) @comment
[(true) (false) (null) (undefined)] @constant
[(this) (super)] @keyword
["const" "let" "var" "function" "return" "if" "else" "for" "while" "do" "break" "continue" "switch" "case" "default" "class" "extends" "new" "import" "export" "from" "as" "async" "await" "try" "catch" "finally" "throw" "typeof" "instanceof" "in" "of" "delete" "void" "yield"] @keyword
["+" "-" "*" "/" "%" "=" "==" "===" "!=" "!==" "!" "&&" "||" "??" "+=" "-=" "=>" "<" ">" "<=" ">="] @operator
["(" ")" "[" "]" "{" "}" ";" "," "." ":"] @punctuation
(call_expression function: (identifier) @function)
(function_declaration name: (identifier) @function)
(method_definition name: (property_identifier) @function)
)query";
inline constexpr auto typescriptQuery=R"query(
(type_identifier) @type
(predefined_type) @type
["type" "interface" "enum" "declare" "namespace" "implements" "readonly" "keyof" "infer" "is" "asserts" "abstract"] @keyword
)query";
inline constexpr auto pythonQuery=R"query(
(identifier) @variable
(integer) @number
(float) @number
(string) @string
(comment) @comment
[(true) (false) (none)] @constant
["def" "class" "return" "if" "elif" "else" "for" "while" "break" "continue" "try" "except" "finally" "raise" "import" "from" "as" "with" "async" "await" "yield" "lambda" "pass" "global" "nonlocal" "assert" "del" "in" "is" "not" "and" "or"] @keyword
["+" "-" "*" "/" "//" "**" "%" "=" "==" "!=" "<" ">" "<=" ">=" "+=" "-=" "->"] @operator
["(" ")" "[" "]" "{" "}" ":" "," "."] @punctuation
(call function: (identifier) @function)
(function_definition name: (identifier) @function)
(class_definition name: (identifier) @type)
(attribute attribute: (identifier) @property)
)query";
inline constexpr auto jsonQuery=R"query(
(string) @string
(number) @number
(comment) @comment
[(true) (false) (null)] @constant
["{" "}" "[" "]" ":" ","] @punctuation
(pair key: (string) @property)
)query";
}
