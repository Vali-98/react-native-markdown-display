#pragma once
#include <cstdint>
#include <memory>
#include <string>
#include <vector>
namespace vali::markdown {
// Stable categories shared by syntax_* nodes and editor range kinds (200 + kind).
enum class CodeKind { keyword, string, comment, number, function, type, property, constant, operator_, punctuation, variable, tag, attribute, embedded };
const char* codeKindName(CodeKind kind);
int codeKindIndex(const std::string& name);
struct CodeRange { uint32_t start, end; CodeKind kind; }; // UTF-8 bytes, block-relative.
struct CodeHighlightStats { uint64_t parses=0, cacheHits=0, incrementalParses=0; };
class CodeHighlighter {
 public:
  CodeHighlighter();
  ~CodeHighlighter();
  CodeHighlighter(const CodeHighlighter&)=delete;
  CodeHighlighter& operator=(const CodeHighlighter&)=delete;
  std::vector<CodeRange> highlight(const std::string& key,const std::string& language,const std::string& code);
  CodeHighlightStats stats() const;
  static bool supports(const std::string& language);
 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
}
