#include "EditorAnalysis.hpp"
#include "Document.hpp"
#include <algorithm>
#include <unordered_map>
#include <limits>
namespace vali::markdown {
namespace {
std::string utf8(const std::u16string& source) {
  std::string result;result.reserve(source.size());
  for(size_t i=0;i<source.size();++i) {
    uint32_t c=source[i];
    if(c>=0xd800 && c<=0xdbff && i+1<source.size() && source[i+1]>=0xdc00 && source[i+1]<=0xdfff) c=0x10000+((c-0xd800)<<10)+(source[++i]-0xdc00);
    else if(c>=0xd800 && c<=0xdfff) c=0xfffd;
    if(c<0x80) result+=static_cast<char>(c);
    else if(c<0x800) {result+=static_cast<char>(0xc0|(c>>6));result+=static_cast<char>(0x80|(c&63));}
    else if(c<0x10000) {result+=static_cast<char>(0xe0|(c>>12));result+=static_cast<char>(0x80|((c>>6)&63));result+=static_cast<char>(0x80|(c&63));}
    else {result+=static_cast<char>(0xf0|(c>>18));result+=static_cast<char>(0x80|((c>>12)&63));result+=static_cast<char>(0x80|((c>>6)&63));result+=static_cast<char>(0x80|(c&63));}
  }
  return result;
}
struct Line { int start,end; };
bool blank(char16_t c) {return c==' '||c=='\t'||c=='\r';}
int first(const std::u16string& s,Line l) {int p=l.start;while(p<l.end&&blank(s[p]))++p;return p;}
bool separator(const std::u16string& s,Line l) {
  bool dash=false;
  for(int i=l.start;i<l.end;++i) {const auto c=s[i];if(c=='-')dash=true;else if(!blank(c)&&c!='|'&&c!=':')return false;}
  return dash;
}
}
std::vector<EditorRange> analyzeEditor(const std::u16string& source) {
  std::vector<EditorRange> result,blocks;
  std::vector<Line> lines;
  for(int start=0;start<static_cast<int>(source.size());) {
    auto end=source.find(u'\n',start);if(end==std::u16string::npos)end=source.size();
    lines.push_back({start,static_cast<int>(end)});start=static_cast<int>(end)+1;
  }
  auto add=[&](int start,int end,int kind) {if(end>start)result.push_back({start,end,kind});};
  for(size_t i=0;i<lines.size();++i) {
    const auto line=lines[i];int p=first(source,line);
    if(p==line.end)continue;
    const auto ch=source[p];int run=p;while(run<line.end&&source[run]==ch)++run;
    const bool fence=(ch=='`'||ch=='~')&&run-p>=3&&p-line.start<=3;
    const bool dollars=source.compare(p,2,u"$$")==0;
    const bool brackets=source.compare(p,2,u"\\[")==0;
    if(fence||dollars||brackets) {
      const int opener=fence?run-p:2;const auto close=brackets?u"\\]":u"$$";
      size_t last=i;bool closed=false;int closeStart=-1;
      if(!fence) { auto at=source.find(close,p+opener);if(at!=std::u16string::npos&&at<static_cast<size_t>(line.end)) {closed=true;closeStart=static_cast<int>(at);} }
      if(!closed) for(last=i+1;last<lines.size();++last) {
        const auto next=lines[last];int q=first(source,next);
        if(fence) {int e=q;while(e<next.end&&source[e]==ch)++e;int tail=e;while(tail<next.end&&blank(source[tail]))++tail;if(q-next.start<=3&&e-q>=opener&&tail==next.end) {closed=true;closeStart=q;break;}}
        else {auto at=source.find(close,q);if(at!=std::u16string::npos&&at<static_cast<size_t>(next.end)){closed=true;closeStart=static_cast<int>(at);break;}}
      }
      if(closed&&last>=lines.size())last=i;
      if(!closed)last=lines.size()-1;
      const int end=lines[last].end;
      blocks.push_back({line.start,end,fence?21:22});add(line.start,end,8);add(p,p+opener,0);
      if(closeStart>=0)add(closeStart,fence?lines[last].end:closeStart+2,0);
      i=last;continue;
    }
    if(i+1<lines.size()&&source.substr(line.start,line.end-line.start).find(u'|')!=std::u16string::npos&&separator(source,lines[i+1])) {
      size_t last=i+1;
      while(last+1<lines.size()&&source.substr(lines[last+1].start,lines[last+1].end-lines[last+1].start).find(u'|')!=std::u16string::npos)++last;
      blocks.push_back({line.start,lines[last].end,23});add(line.start,lines[last].end,8);add(lines[i+1].start,lines[i+1].end,0);i=last;continue;
    }
    if(p-line.start<=3&&ch=='#'&&run-p<=6&&run<line.end&&blank(source[run])) {add(line.start,line.end,10+run-p);add(p,run,0);}
  }
  // Use MD4C's actual inline grammar, rather than a competing regex parser.
  static thread_local Document document;const auto parsed=document.replace(utf8(source),false);
  struct Range {int start=std::numeric_limits<int>::max(),end=-1;};
  std::unordered_map<std::string,Range> ranges;
  for(auto it=parsed.nodes.rbegin();it!=parsed.nodes.rend();++it) {
    auto& range=ranges[it->id];
    if(it->sourceStart>=0) {range.start=std::min(range.start,static_cast<int>(it->sourceStart));range.end=std::max(range.end,static_cast<int>(it->sourceEnd));}
    if(range.end>=0&&!it->parentId.empty()) {auto& parent=ranges[it->parentId];parent.start=std::min(parent.start,range.start);parent.end=std::max(parent.end,range.end);}
  }
  for(const auto& node:parsed.nodes) {
    int kind=node.type=="strong"?1:node.type=="em"?2:node.type=="s"?3:node.type=="code_inline"?4:node.type=="double_quote"?5:node.type=="link"?6:node.type=="blockquote"?7:0;
    if(node.type.rfind("syntax_",0)==0) {
      const auto r=ranges[node.id];const int category=codeKindIndex(node.type.substr(7));
      if(category>=0&&r.end>=0)add(r.start,r.end,200+category);
      continue;
    }
    if(!kind)continue;
    const auto r=ranges[node.id];if(r.end<0)continue;
    bool protectedBlock=false;for(const auto& b:blocks)if(r.start<b.end&&r.end>b.start){protectedBlock=true;break;}
    if(protectedBlock)continue;
    if(kind==5 || kind==6 || kind==7) {
      add(r.start,r.end,kind);
      if(kind==6 && r.start>0 && source[r.start-1]=='[') {
        add(r.start-1,r.start,0);
        if(r.end<static_cast<int>(source.size()) && source[r.end]==']') {
          int end=r.end+1;
          if(end<static_cast<int>(source.size()) && source[end]=='(') {
            int depth=1;++end;
            while(end<static_cast<int>(source.size()) && source[end]!='\n' && depth) {
              if(source[end]=='\\' && end+1<static_cast<int>(source.size())){end+=2;continue;}
              if(source[end]=='(')++depth;
              if(source[end]==')')--depth;
              ++end;
            }
          }
          add(r.end,end,0);
        }
      }
      continue;
    }
    int start=r.start,end=r.end;const int count=kind==1||kind==3?2:1;
    const auto mark=kind==3?u'~':kind==4?u'`':u'*';
    // Immediate delimiters are reliable; complex nesting remains styled by its
    // content ranges without guessing non-adjacent source characters.
    int open=start;while(open>0&&start-open<count&&(source[open-1]==mark||(kind<=2&&source[open-1]=='_')))--open;
    int close=end;while(close<static_cast<int>(source.size())&&close-end<count&&(source[close]==mark||(kind<=2&&source[close]=='_')))++close;
    add(open,close,kind);add(open,start,0);add(end,close,0);
  }
  // Typography is represented as source ranges; the editor never rewrites input.
  // Only normal text leaves participate, excluding code, math and link URLs.
  std::unordered_map<std::string,const Node*> byId;
  for(const auto& node:parsed.nodes)byId[node.id]=&node;
  for(const auto& node:parsed.nodes) {
    if(node.type!="text" || node.sourceStart<0)continue;
    bool literal=false;std::string parent=node.parentId;
    while(byId.count(parent)) {
      const auto* ancestor=byId[parent];
      if(ancestor->type=="fence" || ancestor->type=="code_inline" || ancestor->type=="latex_inline" || ancestor->type=="latex_block" || ancestor->type=="link")literal=true;
      parent=ancestor->parentId;
    }
    if(literal)continue;
    const int end=static_cast<int>(node.sourceEnd);
    for(int i=static_cast<int>(node.sourceStart);i<end;) {
      int length=0,kind=0;
      auto lower=[](char16_t c){return c>='A'&&c<='Z'?c+32:c;};
      if(i+2<end&&source[i]=='('&&source[i+2]==')') {
        const auto c=lower(source[i+1]);kind=c=='c'?100:c=='r'?101:c=='p'?103:0;if(kind)length=3;
      }
      if(i+3<end&&source[i]=='('&&lower(source[i+1])=='t'&&lower(source[i+2])=='m'&&source[i+3]==')'){kind=102;length=4;}
      if(i+1<end&&source[i]=='+'&&source[i+1]=='-'){kind=104;length=2;}
      const auto c=source[i];
      if(!kind&&(c=='.'||c=='?'||c=='!'||c==','||c=='-')) {
        int last=i+1;
        while(last<end&&(source[last]==c||((c=='?'||c=='!')&&(source[last]=='?'||source[last]=='!'))))++last;
        const int run=last-i;
        if(c=='.'&&run>=2){kind=i>0&&(source[i-1]=='?'||source[i-1]=='!')?111:105;length=run;}
        if((c=='?'||c=='!')&&run>=4){kind=source[last-1]=='?'?106:107;length=run;}
        if(c==','&&run>=2){kind=108;length=run;}
        if(c=='-'&&run==3){kind=110;length=run;}
        if(c=='-'&&run==2) {
          const bool left=i==static_cast<int>(node.sourceStart)||blank(source[i-1])||source[i-1]=='\n';
          const bool right=last==end||blank(source[last])||source[last]=='\n';
          if(left==right){kind=109;length=run;}
        }
        if(!kind && c=='-'){i=last;continue;}
      }
      if(kind){add(i,i+length,kind);i+=length;}else ++i;
    }
  }
  result.insert(result.end(),blocks.begin(),blocks.end());return result;
}
}
