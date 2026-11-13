#include "EditorAnalysis.hpp"
#include <stdexcept>
#include <iostream>
using namespace vali::markdown;
void check(bool value,const char* name) {if(!value)throw std::runtime_error(name);}
bool has(const std::vector<EditorRange>& ranges,int kind,int start,int end) {
  for(const auto& r:ranges)if(r.kind==kind&&r.start==start&&r.end==end)return true;
  return false;
}
int main() {
  check(has(analyzeEditor(u"**bold**"),1,0,8),"strong range");
  check(has(analyzeEditor(u"**bold**"),0,0,2),"muted opening");
  check(has(analyzeEditor(u"**bold**"),0,6,8),"muted closing");
  check(has(analyzeEditor(u"`code`"),4,0,6),"inline code");
  check(has(analyzeEditor(u"😀 *hi*"),2,3,7),"UTF16 offsets");
  const auto escaped=analyzeEditor(u"\\*literal\\*");
  for(auto r:escaped)check(r.kind!=2,"escaped emphasis");
  check(has(analyzeEditor(u"\"hello\""),5,0,1),"quoted delimiter styling");
  check(has(analyzeEditor(u"[label](example.com)"),6,1,6),"link label styling");
  check(has(analyzeEditor(u"[label](example.com)"),0,6,20),"link syntax muted");
  check(has(analyzeEditor(u"> quoted"),7,2,8),"blockquote styling");
  const auto typography=analyzeEditor(u"(c) (C) (r) (R) (tm) (TM) (p) (P) +- test.. test?..... !!!!!! ???? ,, -- ---");
  for(int kind:{100,101,102,103,104,105,106,107,108,109,110,111}) {
    bool found=false;for(auto r:typography)found|=r.kind==kind;
    check(found,"typography replacement kind");
  }
  for(auto r:analyzeEditor(u"`(c) ...` $x--y$ [x](https://a--b.com)"))check(r.kind<100,"literal code, math and URLs bypass typography");
  const auto code=analyzeEditor(u"```md\n**literal**\n```");
  check(has(code,21,0,21),"complete fence");
  for(auto r:code)check(r.kind!=1,"no inline styling in fence");
  check(has(analyzeEditor(u"```ts\nx"),21,0,7),"incomplete fence");
  check(has(analyzeEditor(u"$$x$$\nend"),22,0,5),"single line math");
  check(has(analyzeEditor(u"$$\nx\n$$\nend"),22,0,7),"multiline math");
  check(has(analyzeEditor(u"|a|b|\n|-|-|\n|1|2|\nend"),23,0,17),"table");
  for(const auto& source:{u"",u"😀",u"# Header",u"~~~\nx\n~~~",u"\\[\nx\n\\]"}) {
    std::u16string s(source);
    for(auto r:analyzeEditor(s))check(r.start>=0&&r.end>r.start&&r.end<=static_cast<int>(s.size()),"range bounds");
  }
  std::cout<<"Editor analysis passed\n";
}
