#include "StreamingRepair.hpp"
#include <cctype>
#include <vector>
namespace vali::markdown {
namespace {
bool space(char c) { return std::isspace(static_cast<unsigned char>(c)); }
bool punct(char c) { return std::ispunct(static_cast<unsigned char>(c)); }
}
std::string repairStreaming(const std::string& source) {
  std::vector<std::string> delimiters;
  std::string literal;
  char fence=0;
  size_t fenceLength=0;
  size_t label=std::string::npos;
  size_t destination=std::string::npos;
  int parentheses=0;
  for(size_t i=0;i<source.size();) {
    if(i==0 || source[i-1]=='\n') {
      if(!fence && literal.empty() &&
         (source[i]=='\t' || source.compare(i,4,"    ")==0)) {
        auto end=source.find('\n',i);
        i=end==std::string::npos ? source.size() : end+1;
        continue;
      }
      size_t start=i;
      while(start<source.size() && start-i<3 && source[start]==' ') ++start;
      if(start<source.size() && (source[start]=='`' || source[start]=='~')) {
        size_t end=start;
        while(end<source.size() && source[end]==source[start]) ++end;
        if(end-start>=3) {
          auto eol=source.find('\n',end);
          const auto tail=source.substr(end,eol==std::string::npos ? eol : eol-end);
          if(fence && source[start]==fence && end-start>=fenceLength && tail.find_first_not_of(" \t\r")==std::string::npos) { fence=0; }
          else if(!fence && (source[start]!='`' || tail.find('`')==std::string::npos)) { fence=source[start]; fenceLength=end-start; delimiters.clear(); literal.clear(); label=destination=std::string::npos; }
          i=eol==std::string::npos ? source.size() : eol+1;
          continue;
        }
      }
      if(fence) { auto end=source.find('\n',i); i=end==std::string::npos ? source.size() : end+1; continue; }
      if(source[i]=='\n' || (i>0 && source[i-1]=='\n' && i>1 && source[i-2]=='\n')) {
        delimiters.clear(); literal.clear(); label=destination=std::string::npos;
      }
    }
    if(source[i]=='\\' && literal.empty()) { i+=i+1<source.size()?2:1; continue; }
    char c=source[i];
    if(!literal.empty()) {
      if(literal[0]=='$' && c=='\\' && i+1<source.size()) { i+=2; continue; }
      if(c==literal[0]) {
        size_t end=i; while(end<source.size() && source[end]==c) ++end;
        if(end-i==literal.size()) literal.clear();
        i=end;
      } else ++i;
      continue;
    }
    if(destination!=std::string::npos) {
      if(c=='(') ++parentheses;
      if(c==')' && --parentheses==0) { destination=label=std::string::npos; }
      ++i; continue;
    }
    if(c=='[') label=i;
    if(c==']' && label!=std::string::npos) {
      if(i+1<source.size() && source[i+1]=='(') { destination=i+2; parentheses=1; i+=2; continue; }
      label=std::string::npos;
    }
    if(c=='`' || c=='$') {
      size_t end=i; while(end<source.size() && source[end]==c) ++end;
      if(c=='`' || end-i<=2) literal=source.substr(i,end-i);
      i=end; continue;
    }
    if(c=='*' || c=='_' || c=='~') {
      size_t end=i; while(end<source.size() && source[end]==c) ++end;
      auto count=end-i;
      const char before=i?source[i-1]:'\n', after=end<source.size()?source[end]:'\n';
      const bool left=!space(after) && (!punct(after)||space(before)||punct(before));
      const bool right=!space(before) && (!punct(before)||space(after)||punct(after));
      bool open=left, close=right;
      if(c=='_') { open=left&&(!right||punct(before)); close=right&&(!left||punct(after)); }
      if(c=='~' && count!=2) { i=end; continue; }
      if(count<=3) {
        if(close) {
          while(count && !delimiters.empty() && delimiters.back()[0]==c && delimiters.back().size()<=count) { count-=delimiters.back().size(); delimiters.pop_back(); }
        }
        if(close && count && !delimiters.empty() && delimiters.back()[0]==c && count<delimiters.back().size()) {
          delimiters.back().resize(delimiters.back().size()-count); count=0;
        }
        if(open && count) delimiters.emplace_back(count,c);
      }
      i=end; continue;
    }
    ++i;
  }
  // MD4C already keeps an unclosed fenced block in its code container.
  if(fence) return source;
  std::string result=source;
  if(destination!=std::string::npos) {
    result.resize(destination); result+=')';
  } else if(label!=std::string::npos) {
    // Avoid constructing a speculative image request from an unfinished label.
    if(label && source[label-1]=='!') return source;
    result+="]()";
  }
  // A closing delimiter after trailing whitespace would not close emphasis.
  size_t tail=result.size();
  while(tail && space(result[tail-1])) --tail;
  const auto whitespace=result.substr(tail); result.resize(tail);
  if(!literal.empty()) result+=literal;
  for(auto it=delimiters.rbegin();it!=delimiters.rend();++it) result+=*it;
  return result+whitespace;
}
}
