#include "CodeHighlighter.hpp"
#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <unordered_map>
#include <set>
#include <tuple>
#include <chrono>
#ifdef VALI_CODE_HIGHLIGHT
#include <tree_sitter/api.h>
#include "HighlightQueries.hpp"
#ifdef VALI_TS_HTML
extern "C" const TSLanguage* tree_sitter_html();
#endif
#ifdef VALI_TS_CSS
extern "C" const TSLanguage* tree_sitter_css();
#endif
#ifdef VALI_TS_GO
extern "C" const TSLanguage* tree_sitter_go();
#endif
#ifdef VALI_TS_JAVA
extern "C" const TSLanguage* tree_sitter_java();
#endif
#ifdef VALI_TS_C
extern "C" const TSLanguage* tree_sitter_c();
#endif
#ifdef VALI_TS_RUST
extern "C" const TSLanguage* tree_sitter_rust();
#endif
#ifdef VALI_TS_BASH
extern "C" const TSLanguage* tree_sitter_bash();
#endif
#ifdef VALI_TS_CPP
extern "C" const TSLanguage* tree_sitter_cpp();
#endif
#ifdef VALI_TS_YAML
extern "C" const TSLanguage* tree_sitter_yaml();
#endif
#ifdef VALI_TS_MARKDOWN
extern "C" const TSLanguage* tree_sitter_markdown();
extern "C" const TSLanguage* tree_sitter_markdown_inline();
#endif

#ifdef VALI_TS_JAVASCRIPT
extern "C" const TSLanguage* tree_sitter_javascript();
#endif
#ifdef VALI_TS_TYPESCRIPT
extern "C" const TSLanguage* tree_sitter_typescript();
#endif
#ifdef VALI_TS_TSX
extern "C" const TSLanguage* tree_sitter_tsx();
#endif
#ifdef VALI_TS_PYTHON
extern "C" const TSLanguage* tree_sitter_python();
#endif
#ifdef VALI_TS_JSON
extern "C" const TSLanguage* tree_sitter_json();
#endif
#endif
namespace vali::markdown {
namespace {
const char* names[]={"keyword","string","comment","number","function","type","property","constant","operator","punctuation","variable","tag","attribute","embedded"};
std::string normalize(std::string language) {
  const auto first=language.find_first_not_of(" \t\r\n");if(first==std::string::npos)return {};
  language=language.substr(first);language=language.substr(0,language.find_first_of(" \t\r\n"));
  std::transform(language.begin(),language.end(),language.begin(),[](unsigned char c){return std::tolower(c);});
  if(language=="js"||language=="jsx"||language=="mjs"||language=="cjs")return "javascript";
  if(language=="ts")return "typescript";
  if(language=="py"||language=="python3")return "python";
  if(language=="jsonc")return "json";
  if(language=="md")return "markdown";
  if(language=="yml")return "yaml";
  if(language=="golang")return "go";
  if(language=="rs")return "rust";
  if(language=="sh"||language=="shell"||language=="zsh")return "bash";
  if(language=="cc"||language=="cxx")return "cpp";
  return language;
}
#ifdef VALI_CODE_HIGHLIGHT
const TSLanguage* grammar(const std::string& language) {
#ifdef VALI_TS_JAVASCRIPT
  if(language=="javascript")return tree_sitter_javascript();
#endif
#ifdef VALI_TS_TYPESCRIPT
  if(language=="typescript")return tree_sitter_typescript();
#endif
#ifdef VALI_TS_TSX
  if(language=="tsx")return tree_sitter_tsx();
#endif
#ifdef VALI_TS_PYTHON
  if(language=="python")return tree_sitter_python();
#endif
#ifdef VALI_TS_JSON
  if(language=="json")return tree_sitter_json();
#endif
#ifdef VALI_TS_HTML
  if(language=="html")return tree_sitter_html();
#endif
#ifdef VALI_TS_CSS
  if(language=="css")return tree_sitter_css();
#endif
#ifdef VALI_TS_GO
  if(language=="go")return tree_sitter_go();
#endif
#ifdef VALI_TS_JAVA
  if(language=="java")return tree_sitter_java();
#endif
#ifdef VALI_TS_C
  if(language=="c")return tree_sitter_c();
#endif
#ifdef VALI_TS_RUST
  if(language=="rust")return tree_sitter_rust();
#endif
#ifdef VALI_TS_BASH
  if(language=="bash")return tree_sitter_bash();
#endif
#ifdef VALI_TS_CPP
  if(language=="cpp")return tree_sitter_cpp();
#endif
#ifdef VALI_TS_YAML
  if(language=="yaml")return tree_sitter_yaml();
#endif
#ifdef VALI_TS_MARKDOWN
  if(language=="markdown")return tree_sitter_markdown();
  if(language=="markdown_inline")return tree_sitter_markdown_inline();
#endif
  return nullptr;
}
std::string genericQuery(const TSLanguage* language,const std::string& name) {
  // Only emit patterns for symbols this pinned grammar actually provides.
  // This avoids version-specific invalid-node queries across language families.
  static const std::unordered_map<std::string,std::string> named={
    {"identifier","variable"},{"ident","variable"},{"variable_name","variable"},
    {"property_identifier","property"},{"field_identifier","property"},{"property_name","property"},
    {"type_identifier","type"},{"primitive_type","type"},{"integral_type","type"},{"floating_point_type","type"},{"predefined_type","type"},
    {"function_name","function"},{"function_identifier","function"},{"command_name","function"},
    {"string","string"},{"string_literal","string"},{"raw_string_literal","string"},{"interpreted_string_literal","string"},{"rune_literal","string"},{"char_literal","string"},{"character_literal","string"},{"system_lib_string","string"},
    {"double_quote_scalar","string"},{"single_quote_scalar","string"},{"string_scalar","string"},{"block_scalar","string"},{"quoted_attribute_value","string"},{"attribute_value","string"},
    {"number","number"},{"integer","number"},{"float","number"},{"number_literal","number"},{"int_literal","number"},{"float_literal","number"},{"integer_literal","number"},{"decimal_integer_literal","number"},{"hex_integer_literal","number"},{"decimal_floating_point_literal","number"},{"float_scalar","number"},{"integer_scalar","number"},{"integer_value","number"},{"float_value","number"},
    {"comment","comment"},{"line_comment","comment"},{"block_comment","comment"},
    {"true","constant"},{"false","constant"},{"null","constant"},{"nil","constant"},{"null_literal","constant"},{"boolean_literal","constant"},{"boolean_scalar","constant"},{"null_scalar","constant"},{"color_value","constant"},
    {"tag_name","tag"},{"erroneous_end_tag_name","tag"},{"attribute_name","attribute"},{"tag","tag"},
    {"raw_text","embedded"},{"code_fence_content","embedded"},{"code_span","embedded"},
    {"atx_h1_marker","keyword"},{"atx_h2_marker","keyword"},{"atx_h3_marker","keyword"},{"atx_h4_marker","keyword"},{"atx_h5_marker","keyword"},{"atx_h6_marker","keyword"},{"setext_h1_underline","keyword"},{"setext_h2_underline","keyword"},{"fenced_code_block_delimiter","punctuation"},{"code_span_delimiter","punctuation"},{"emphasis_delimiter","punctuation"},{"link_destination","string"},{"link_title","string"},{"block_quote_marker","punctuation"},{"directive_name","keyword"}
  };
  static const std::set<std::string> keywords={"if","else","for","while","do","break","continue","switch","case","default","return","class","struct","enum","union","typedef","namespace","using","template","typename","public","private","protected","virtual","override","final","const","constexpr","static","extern","volatile","inline","auto","new","delete","this","super","try","catch","finally","throw","throws","import","export","from","as","package","func","go","defer","range","select","chan","map","interface","implements","extends","var","let","fn","pub","mod","crate","use","mut","impl","trait","where","match","ref","move","async","await","unsafe","loop","in","of","type","sizeof","operator","instanceof","synchronized","abstract","native","transient","assert","record","sealed","permits","then","fi","elif","done","esac","function","local","declare","readonly","unset","until","with","yield","null","true","false","nil","#include","#define","#if","#ifdef","#ifndef","#else","#elif","#endif","@media","@import","@supports","@keyframes"};
  static const std::set<std::string> operators={"+","-","*","/","%","=","==","!=","===","!==","<",">","<=",">=","!","&&","||","&","|","^","~","++","--","+=","-=","*=","/=","->","=>","?","??","::",":="};
  static const std::set<std::string> punctuation={"(",")","[","]","{","}",";",",",".",":","$","@"};
  std::string query;std::set<std::string> added;
  for(uint32_t i=0;i<ts_language_symbol_count(language);++i) {
    const auto kind=ts_language_symbol_type(language,static_cast<TSSymbol>(i));
    const std::string symbol=ts_language_symbol_name(language,static_cast<TSSymbol>(i));
    if(kind==TSSymbolTypeRegular) {
      auto found=named.find(symbol);if(found!=named.end()&&added.insert("n:"+symbol).second)query+="("+symbol+") @"+found->second+"\n";
    } else if(kind==TSSymbolTypeAnonymous && added.insert("a:"+symbol).second) {
      const char* category=keywords.count(symbol)?"keyword":operators.count(symbol)?"operator":punctuation.count(symbol)?"punctuation":nullptr;
      if(category)query+="\""+symbol+"\" @"+category+"\n";
    }
  }
  if(name=="c"||name=="cpp")query+="(function_declarator declarator: (identifier) @function)\n(call_expression function: (identifier) @function)\n";
  if(name=="go")query+="(function_declaration name: (identifier) @function)\n(call_expression function: (identifier) @function)\n";
  if(name=="java")query+="(method_declaration name: (identifier) @function)\n(method_invocation name: (identifier) @function)\n";
  if(name=="rust")query+="(function_item name: (identifier) @function)\n(call_expression function: (identifier) @function)\n";
  return query;
}

std::string queryFor(const std::string& language) {
  if(language=="typescript"||language=="tsx")return std::string(javascriptQuery)+typescriptQuery;
  if(language=="javascript")return std::string(javascriptQuery)+"(class_declaration name: (identifier) @type)";
  if(language=="python")return pythonQuery;
  if(language=="json")return jsonQuery;
  return genericQuery(grammar(language),language);
}
TSPoint point(const std::string& source,size_t end) {
  TSPoint result{};for(size_t i=0;i<end;++i){if(source[i]=='\n'){++result.row;result.column=0;}else ++result.column;}return result;
}
// Capture ranges overlap (e.g. identifiers inside function calls). Resolve them
// to non-overlapping spans; comments/strings beat generic identifiers, and later
// query patterns refine generic captures such as variables and object keys.
struct Capture { uint32_t start,end;CodeKind kind;int priority; };
std::vector<CodeRange> flatten(const std::vector<Capture>& captures) {
  struct Event {uint32_t offset;size_t id;bool start;};
  std::vector<Event> events;events.reserve(captures.size()*2);
  for(size_t i=0;i<captures.size();++i){events.push_back({captures[i].start,i,true});events.push_back({captures[i].end,i,false});}
  std::sort(events.begin(),events.end(),[](auto a,auto b){return a.offset<b.offset;});
  using Rank=std::tuple<int,int64_t,size_t>;
  std::set<Rank> active;std::vector<CodeRange> result;
  auto rank=[&](size_t id){const auto& c=captures[id];return Rank(c.priority,-static_cast<int64_t>(c.end-c.start),id);};
  size_t i=0;
  while(i<events.size()) {
    const auto start=events[i].offset;
    while(i<events.size()&&events[i].offset==start){const auto& e=events[i++];if(e.start)active.insert(rank(e.id));else active.erase(rank(e.id));}
    if(i==events.size()||active.empty()||events[i].offset<=start)continue;
    const auto end=events[i].offset;const auto kind=captures[std::get<2>(*active.rbegin())].kind;
    if(!result.empty()&&result.back().end==start&&result.back().kind==kind)result.back().end=end;
    else result.push_back({start,end,kind});
  }
  return result;
}
#endif
}
const char* codeKindName(CodeKind kind){return names[static_cast<int>(kind)];}
int codeKindIndex(const std::string& name){for(int i=0;i<14;++i)if(name==names[i])return i;return -1;}
#ifdef VALI_CODE_HIGHLIGHT
struct CodeHighlighter::Impl {
  struct Language {
    TSParser* parser=nullptr;TSQuery* query=nullptr;
    ~Language(){if(parser)ts_parser_delete(parser);if(query)ts_query_delete(query);}
  };
  struct Entry {
    std::string language,source;TSTree* tree=nullptr;std::vector<CodeRange> ranges;uint64_t used=0;
    ~Entry(){if(tree)ts_tree_delete(tree);}
  };
  std::unordered_map<std::string,std::unique_ptr<Language>> languages;
  std::unordered_map<std::string,std::unique_ptr<Entry>> entries;
  CodeHighlightStats stats;uint64_t tick=0;
  void trim(const std::string& key) {
    size_t bytes=0;for(const auto& item:entries)bytes+=item.second->source.size();
    while(entries.size()>32 || bytes>2*1024*1024) {
      auto oldest=entries.end();
      for(auto it=entries.begin();it!=entries.end();++it)if(it->first!=key && (oldest==entries.end()||it->second->used<oldest->second->used))oldest=it;
      if(oldest==entries.end())break;
      bytes-=oldest->second->source.size();entries.erase(oldest);
    }
  }
  Language& load(const std::string& name) {
    auto& slot=languages[name];if(slot)return *slot;
    auto language=std::make_unique<Language>();language->parser=ts_parser_new();
    if(!ts_parser_set_language(language->parser,grammar(name)))throw std::runtime_error("Incompatible tree-sitter grammar: "+name);
    const auto source=queryFor(name);uint32_t offset=0;TSQueryError error{};
    language->query=ts_query_new(grammar(name),source.data(),static_cast<uint32_t>(source.size()),&offset,&error);
    if(!language->query)throw std::runtime_error("Invalid "+name+" highlight query at byte "+std::to_string(offset)+": "+source.substr(offset,50));
    slot=std::move(language);return *slot;
  }
};
#else
struct CodeHighlighter::Impl {};
#endif
CodeHighlighter::CodeHighlighter() {
#ifdef VALI_CODE_HIGHLIGHT
  impl_=std::make_unique<Impl>();
#endif
}
CodeHighlighter::~CodeHighlighter()=default;
bool CodeHighlighter::supports(const std::string& language) {
#ifdef VALI_CODE_HIGHLIGHT
  return grammar(normalize(language))!=nullptr;
#else
  (void)language;return false;
#endif
}
CodeHighlightStats CodeHighlighter::stats() const {
#ifdef VALI_CODE_HIGHLIGHT
  return impl_->stats;
#else
  return {};
#endif
}
std::vector<CodeRange> CodeHighlighter::highlight(const std::string& key,const std::string& info,const std::string& code) {
#ifdef VALI_CODE_HIGHLIGHT
  const auto language=normalize(info);
  if(!grammar(language)||code.empty()||code.size()>512*1024)return {};
  auto& state=*impl_;auto& engine=state.load(language);
  auto& slot=state.entries[key];if(!slot)slot=std::make_unique<Impl::Entry>();
  auto& entry=*slot;entry.used=++state.tick;
  if(entry.language==language && entry.source==code && entry.tree){++state.stats.cacheHits;return entry.ranges;}
  const bool incremental=entry.tree && entry.language==language;
  if(incremental) {
    size_t start=0;while(start<entry.source.size()&&start<code.size()&&entry.source[start]==code[start])++start;
    // Tree edits must not split a UTF-8 scalar when code points share a prefix.
    while(start>0&&start<entry.source.size()&&(static_cast<unsigned char>(entry.source[start])&0xc0)==0x80)--start;
    size_t oldEnd=entry.source.size(),newEnd=code.size();
    while(oldEnd>start&&newEnd>start&&entry.source[oldEnd-1]==code[newEnd-1]){--oldEnd;--newEnd;}
    while(oldEnd<entry.source.size()&&newEnd<code.size()&&((static_cast<unsigned char>(entry.source[oldEnd])&0xc0)==0x80||(static_cast<unsigned char>(code[newEnd])&0xc0)==0x80)){++oldEnd;++newEnd;}
    TSInputEdit edit{static_cast<uint32_t>(start),static_cast<uint32_t>(oldEnd),static_cast<uint32_t>(newEnd),point(entry.source,start),point(entry.source,oldEnd),point(code,newEnd)};
    ts_tree_edit(entry.tree,&edit);++state.stats.incrementalParses;
  }
  auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(40);
  TSInput input{};input.payload=const_cast<std::string*>(&code);input.encoding=TSInputEncodingUTF8;
  input.read=[](void* payload,uint32_t offset,TSPoint,uint32_t* size)->const char* {
    const auto& source=*static_cast<const std::string*>(payload);
    *size=offset<source.size()?static_cast<uint32_t>(source.size()-offset):0;
    return *size?source.data()+offset:"";
  };
  TSParseOptions options{};options.payload=&deadline;
  options.progress_callback=[](TSParseState* parse){return std::chrono::steady_clock::now()>*static_cast<std::chrono::steady_clock::time_point*>(parse->payload);};
  auto* tree=ts_parser_parse_with_options(engine.parser,incremental?entry.tree:nullptr,input,options);++state.stats.parses;
  if(entry.tree)ts_tree_delete(entry.tree);entry.tree=tree;entry.source=code;entry.language=language;
  if(!tree){ts_parser_reset(engine.parser);entry.ranges.clear();state.trim(key);return {};}
  auto* cursor=ts_query_cursor_new();ts_query_cursor_set_match_limit(cursor,8192);
  TSQueryCursorOptions queryOptions{};queryOptions.payload=&deadline;
  queryOptions.progress_callback=[](TSQueryCursorState* query){return std::chrono::steady_clock::now()>*static_cast<std::chrono::steady_clock::time_point*>(query->payload);};
  ts_query_cursor_exec_with_options(cursor,engine.query,ts_tree_root_node(tree),&queryOptions);
  std::vector<Capture> captures;TSQueryMatch match{};
  while(captures.size()<4096 && ts_query_cursor_next_match(cursor,&match)) {
    for(uint16_t i=0;i<match.capture_count;++i) {
      const auto& capture=match.captures[i];uint32_t size=0;
      const auto* name=ts_query_capture_name_for_id(engine.query,capture.index,&size);
      const int kind=codeKindIndex(std::string(name,size));
      const auto start=ts_node_start_byte(capture.node),end=ts_node_end_byte(capture.node);
      if(kind<0||end<=start||end>code.size())continue;
      const int priority=(kind==6?2000:kind==1||kind==2?1000:0)+match.pattern_index;
      captures.push_back({start,end,static_cast<CodeKind>(kind),priority});
    }
  }
  if(language=="markdown") {
    auto& inlineEngine=state.load("markdown_inline");
    std::vector<TSNode> pending{ts_tree_root_node(tree)};
    while(!pending.empty()&&captures.size()<4096&&std::chrono::steady_clock::now()<deadline) {
      const auto node=pending.back();pending.pop_back();
      if(std::string(ts_node_type(node))=="inline" || std::string(ts_node_type(node))=="pipe_table_cell") {
        const auto base=ts_node_start_byte(node),end=ts_node_end_byte(node);
        auto source=code.substr(base,end-base);TSInput inlineInput=input;inlineInput.payload=&source;
        auto* inlineTree=ts_parser_parse_with_options(inlineEngine.parser,nullptr,inlineInput,options);
        if(!inlineTree){ts_parser_reset(inlineEngine.parser);continue;}
        ts_query_cursor_exec_with_options(cursor,inlineEngine.query,ts_tree_root_node(inlineTree),&queryOptions);
        while(captures.size()<4096 && ts_query_cursor_next_match(cursor,&match)) {
          for(uint16_t i=0;i<match.capture_count;++i) {
            const auto& capture=match.captures[i];uint32_t length=0;
            const auto* name=ts_query_capture_name_for_id(inlineEngine.query,capture.index,&length);
            const int kind=codeKindIndex(std::string(name,length));
            const auto start=base+ts_node_start_byte(capture.node),stop=base+ts_node_end_byte(capture.node);
            if(kind>=0&&stop>start&&stop<=end)captures.push_back({start,stop,static_cast<CodeKind>(kind),500+match.pattern_index});
          }
        }
        ts_tree_delete(inlineTree);
      } else for(uint32_t i=0;i<ts_node_named_child_count(node);++i)pending.push_back(ts_node_named_child(node,i));
    }
  }
  const bool limited=captures.size()>=4096||ts_query_cursor_did_exceed_match_limit(cursor)||std::chrono::steady_clock::now()>deadline;
  ts_query_cursor_delete(cursor);entry.ranges=limited?std::vector<CodeRange>{}:flatten(captures);auto result=entry.ranges;
  state.trim(key);
  return result;
#else
  (void)key;(void)info;(void)code;return {};
#endif
}
}
