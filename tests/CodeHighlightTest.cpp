#include "CodeHighlighter.hpp"
#include "Document.hpp"
#include "EditorAnalysis.hpp"
#include <iostream>
#include <stdexcept>
using namespace vali::markdown;
void require(bool value,const std::string& message){if(!value)throw std::runtime_error(message);}
bool captures(const std::vector<CodeRange>& ranges,const std::string& code,const std::string& text,CodeKind kind) {
  for(auto range:ranges)if(range.kind==kind&&code.substr(range.start,range.end-range.start)==text)return true;return false;
}
int main() {
  CodeHighlighter highlighter;
  require(highlighter.highlight("unknown","unknown-language","const x = 1;").empty(),"unsupported languages are plain text");
  const bool enabled=CodeHighlighter::supports("js")||CodeHighlighter::supports("ts")||CodeHighlighter::supports("py")||CodeHighlighter::supports("json")||CodeHighlighter::supports("tsx");
  if(!enabled) {
    require(highlighter.highlight("disabled","js","const x = 1;").empty(),"disabled engine has no captures");
    Document document;const auto parsed=document.replace("```ts\nconst x = 1;\n```");
    bool metadata=false;for(const auto& node:parsed.nodes){metadata|=node.type=="fence"&&node.language=="ts";require(node.type.rfind("syntax_",0)!=0,"disabled build emits no syntax nodes");}
    require(metadata,"language metadata retained without highlighting");
    std::cout<<"Highlight-disabled build passed\n";return 0;
  }
  if(CodeHighlighter::supports("js")) {
  const std::string js="const greeting = \"hello\";\n// comment\nfunction greet() { return 42; }\ngreet();";
  auto first=highlighter.highlight("js","js",js);
  require(captures(first,js,"const",CodeKind::keyword),"JS keyword");
  require(captures(first,js,"\"hello\"",CodeKind::string),"JS string");
  require(captures(first,js,"// comment",CodeKind::comment),"JS comment");
  require(captures(first,js,"greet",CodeKind::function),"JS function");
  require(captures(first,js,"42",CodeKind::number),"JS number");
  for(size_t i=0;i<first.size();++i)require(first[i].start<first[i].end&&first[i].end<=js.size()&&(i==0||first[i-1].end<=first[i].start),"ordered non-overlapping byte ranges");
  highlighter.highlight("js","javascript",js);require(highlighter.stats().parses==1&&highlighter.stats().cacheHits==1,"unchanged block does not reparse");
  const std::string edited=js+"\nconst emoji = \"😀\";";
  highlighter.highlight("js","javascript",edited);require(highlighter.stats().incrementalParses==1,"edits reuse previous syntax tree");
  }
  if(CodeHighlighter::supports("ts")) {
    const std::string ts="interface User { name: string }\nconst user: User = { name: 'Ada' };";
    auto spans=highlighter.highlight("ts","ts",ts);
    require(captures(spans,ts,"interface",CodeKind::keyword),"TS interface keyword");
    require(captures(spans,ts,"User",CodeKind::type),"TS type");
    require(captures(spans,ts,"string",CodeKind::type),"TS predefined type");
  }
  if(CodeHighlighter::supports("py")) {
    const std::string py="def greet(name):\n    # example\n    return \"Hello\"\ngreet(42)";
    auto spans=highlighter.highlight("py","py",py);
    require(captures(spans,py,"def",CodeKind::keyword),"Python keyword");
    require(captures(spans,py,"greet",CodeKind::function),"Python function");
  }
  if(CodeHighlighter::supports("json")) {
    const std::string json="{\"answer\": 42, \"ok\": true}";auto spans=highlighter.highlight("json","json",json);
    require(captures(spans,json,"\"answer\"",CodeKind::property),"JSON keys refine string capture");
    require(captures(spans,json,"true",CodeKind::constant),"JSON boolean");
  }
  if(CodeHighlighter::supports("tsx")) {
    const std::string tsx="const App = () => <View enabled={true} />;";
    auto spans=highlighter.highlight("tsx","tsx",tsx);
    require(captures(spans,tsx,"const",CodeKind::keyword),"TSX keyword");
    require(captures(spans,tsx,"true",CodeKind::constant),"TSX embedded expression");
  }
  if(CodeHighlighter::supports("js")) {
  // A changed block may be unfinished or temporarily invalid while streaming.
  for(const auto& source:{"const x = ","const x = \"unfinished","function f( {"})highlighter.highlight("incomplete","js",source);
  Document document;
  const auto parsed=document.replace("```js\nconst emoji = \"😀\";\n```");
  bool syntax=false;std::string visible;
  for(const auto& node:parsed.nodes){syntax|=node.type=="syntax_keyword";if(node.type=="text")visible+=node.content;}
  require(syntax&&visible=="const emoji = \"😀\";\n","highlighting preserves exact code text");
  auto editor=analyzeEditor(u"```js\nconst emoji = \"😀\";\n```");
  bool keyword=false,string=false;
  for(auto range:editor){require(range.kind!=4,"fenced source must not inherit inline-code styles");keyword|=range.kind==200&&range.start==6&&range.end==11;string|=range.kind==201&&range.start==20&&range.end==24;}
  require(keyword&&string,"native editor captures use UTF16 source offsets");
  for(const auto& source:{std::string("const café = 'α';"),std::string("const café = 'β';"),std::string("const café = '😀';")}) {
    const auto incremental=highlighter.highlight("unicode","js",source);
    CodeHighlighter fresh;const auto full=fresh.highlight("fresh","js",source);
    require(incremental.size()==full.size(),"Unicode incremental capture count");
    for(size_t i=0;i<full.size();++i)require(incremental[i].start==full[i].start&&incremental[i].end==full[i].end&&incremental[i].kind==full[i].kind,"Unicode incremental parse matches fresh parse");
  }
  const auto huge=highlighter.highlight("large","js",std::string(512*1024+1,'x'));require(huge.empty(),"oversized blocks degrade to plain code");
  }
  for(const auto& sample:std::vector<std::pair<std::string,std::string>>{
    {"html","<div class=\"greeting\">Hello</div>"},{"css","div { color: red; font-size: 12px; }"},
    {"markdown","# Heading\n\nSome **bold** and `code`."},{"yaml","enabled: true\ncount: 42\nname: \"hello\""},
    {"go","package main\nfunc greet() string { return \"hello\" }"},
    {"java","class Hello { String greet() { return \"hello\"; } }"},
    {"c","int main(void) { return 42; }"},{"cpp","template<class T> T twice(T x) { return x + x; }"},
    {"rust","fn greet() -> i32 { let count = 42; count }"},{"bash","# comment\necho \"hello\""}
  })if(CodeHighlighter::supports(sample.first))require(!highlighter.highlight(sample.first,sample.first,sample.second).empty(),"captures for "+sample.first);
  std::cout<<"Code highlights passed\n";
}
