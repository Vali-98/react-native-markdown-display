#pragma once
#include <string>
#include <vector>
namespace vali::markdown {
// UTF-16 offsets. 0 delimiter; 1 bold; 2 italic; 3 strike; 4 code;
// 8 block-source monospace; 11..16 headings; 21 fenced code; 22 block math; 23 table.
struct EditorRange { int start, end, kind; };
std::vector<EditorRange> analyzeEditor(const std::u16string& source);
}
