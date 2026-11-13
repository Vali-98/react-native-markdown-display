#include "Document.hpp"
#include "StreamingRepair.hpp"
#include "md4c.h"
#include <stdexcept>
#include <limits>
#include <chrono>
#include <algorithm>
#include <unordered_map>
namespace vali::markdown {
namespace {
using Clock=std::chrono::steady_clock;
double elapsed(Clock::time_point start) { return std::chrono::duration<double,std::milli>(Clock::now()-start).count(); }
struct Builder {
  std::vector<Node> nodes;
  std::vector<char> quoteStack;
  struct List { bool ordered; uint64_t next; char delimiter; };
  std::vector<List> lists;
  const char* input=nullptr;
  size_t originalSize=0;
  std::vector<int64_t> utf16;
  void ranges(const std::string& preview,size_t sourceSize) {
    input=preview.data();originalSize=sourceSize;
    utf16.resize(preview.size()+1);
    int64_t offset=0;
    for(size_t i=0;i<preview.size();) {
      const auto c=static_cast<unsigned char>(preview[i]);
      size_t length=c<0x80?1:(c<0xe0?2:(c<0xf0?3:4));
      length=std::min(length,preview.size()-i);
      for(size_t j=0;j<length;++j) utf16[i+j]=offset;
      offset+=length==4?2:1;i+=length;
    }
    utf16[preview.size()]=offset;
  }
  void range(Node& node,int64_t start,size_t length) {
    if(start>=0 && static_cast<size_t>(start)+length<=originalSize) {
      node.sourceStart=utf16[start];node.sourceEnd=utf16[start+length];
    }
  }
  std::vector<size_t> stack;
  std::vector<size_t> counts{0};
  void enter(std::string type, std::string destination = {}) {
    const auto parent = stack.empty() ? std::string{} : nodes[stack.back()].id;
    auto id = parent + "/" + std::to_string(counts.back()++);
    nodes.push_back({id, parent, std::move(type), {}, std::move(destination)});
    stack.push_back(nodes.size()-1);
    counts.push_back(0);
  }
  void leave() { stack.pop_back(); counts.pop_back(); }
  void emitText(std::string content, size_t depth = 0, int64_t sourceOffset = -1) {
    if(content.empty()) return;
    for(size_t i=0;i<depth;++i) enter("double_quote");
    enter("text"); range(nodes.back(),sourceOffset,content.size()); nodes.back().content=std::move(content); leave();
    for(size_t i=0;i<depth;++i) leave();
  }
  void emitQuotedText(const std::string& content,int64_t sourceOffset) {
    size_t start=0;
    auto emit=[&](size_t end,size_t depth) {
      emitText(content.substr(start,end-start),depth,sourceOffset<0?-1:sourceOffset+start);
      start=end;
    };
    for(size_t i=0;i<content.size();) {
      const auto rest=content.substr(i,3);
      const bool opening=rest=="“" || rest=="„" || rest=="‟";
      const bool closing=rest=="”";
      const bool ascii=content[i]=='"';
      const bool left=content.compare(i,2,"«")==0, right=content.compare(i,2,"»")==0;
      if(!opening && !closing && !ascii && !left && !right) { ++i; continue; }
      const size_t length=opening || closing?3:(ascii?1:2);
      emit(i,quoteStack.size());
      const auto oldDepth=quoteStack.size();
      if(opening || left) quoteStack.push_back(left?'g':'c');
      else if(ascii) {
        if(!quoteStack.empty() && quoteStack.back()=='a') quoteStack.pop_back();
        else quoteStack.push_back('a');
      } else if(!quoteStack.empty() && quoteStack.back()==(right?'g':'c')) quoteStack.pop_back();
      i+=length; emit(i,std::max(oldDepth,quoteStack.size()));
    }
    emit(content.size(),quoteStack.size());
  }
};
std::string attribute(const MD_ATTRIBUTE& value) {
  return value.text ? std::string(value.text, value.size) : std::string{};
}
int enterBlock(MD_BLOCKTYPE t, void* detail, void* data) {
  auto& b = *static_cast<Builder*>(data);
  b.quoteStack.clear();
  std::string type;
  switch(t) {
    case MD_BLOCK_DOC: type="body"; break;
    case MD_BLOCK_P: type="paragraph"; break;
    case MD_BLOCK_H: type="heading"+std::to_string(static_cast<MD_BLOCK_H_DETAIL*>(detail)->level); break;
    case MD_BLOCK_QUOTE: type="blockquote"; break;
    case MD_BLOCK_UL: type="bullet_list"; break;
    case MD_BLOCK_OL: type="ordered_list"; break;
    case MD_BLOCK_LI: type="list_item"; break;
    case MD_BLOCK_CODE: type="fence"; break;
    case MD_BLOCK_HR: type="hr"; break;
    case MD_BLOCK_TABLE: type="table"; break;
    case MD_BLOCK_THEAD: type="thead"; break;
    case MD_BLOCK_TBODY: type="tbody"; break;
    case MD_BLOCK_TR: type="tr"; break;
    case MD_BLOCK_TH: type="th"; break;
    case MD_BLOCK_TD: type="td"; break;
    default: type="unknown";
  }
  if(t==MD_BLOCK_UL) b.lists.push_back({false,0,'.'});
  if(t==MD_BLOCK_OL) {
    const auto& list=*static_cast<MD_BLOCK_OL_DETAIL*>(detail);
    b.lists.push_back({true,list.start,list.mark_delimiter});
  }
  b.enter(type);
  if(t==MD_BLOCK_CODE) b.nodes.back().language=attribute(static_cast<MD_BLOCK_CODE_DETAIL*>(detail)->lang);
  if(t==MD_BLOCK_LI && !b.lists.empty()) {
    auto& list=b.lists.back();
    const auto& item=*static_cast<MD_BLOCK_LI_DETAIL*>(detail);
    auto& marker=b.nodes.back().marker;
    marker=list.ordered ? std::to_string(list.next++)+list.delimiter : "•";
    if(item.is_task) marker=item.task_mark==' ' ? "☐" : "☑";
  }
  return 0;
}
int leaveBlock(MD_BLOCKTYPE type, void*, void* data) { auto& b=*static_cast<Builder*>(data); b.leave(); b.quoteStack.clear(); if(type==MD_BLOCK_UL || type==MD_BLOCK_OL) b.lists.pop_back(); return 0; }
int enterSpan(MD_SPANTYPE t, void* detail, void* data) {
  auto& b = *static_cast<Builder*>(data);
  std::string type, destination;
  switch(t) {
    case MD_SPAN_EM: type="em"; break;
    case MD_SPAN_STRONG: type="strong"; break;
    case MD_SPAN_DEL: type="s"; break;
    case MD_SPAN_CODE: type="code_inline"; break;
    case MD_SPAN_A: type="link"; destination=attribute(static_cast<MD_SPAN_A_DETAIL*>(detail)->href); break;
    case MD_SPAN_IMG: type="image"; destination=attribute(static_cast<MD_SPAN_IMG_DETAIL*>(detail)->src); break;
    case MD_SPAN_LATEXMATH: type="latex_inline"; break;
    case MD_SPAN_LATEXMATH_DISPLAY: type="latex_block"; break;
    default: type="unknown";
  }
  b.enter(type, destination); return 0;
}
int leaveSpan(MD_SPANTYPE, void*, void* data) { static_cast<Builder*>(data)->leave(); return 0; }
int text(MD_TEXTTYPE t, const MD_CHAR* value, MD_SIZE size, void* data) {
  auto& b=*static_cast<Builder*>(data);
  std::string content = t==MD_TEXT_NULLCHAR ? "\xEF\xBF\xBD" :
    (t==MD_TEXT_BR || t==MD_TEXT_SOFTBR ? "\n" : std::string(value,size));
  if (t == MD_TEXT_LATEXMATH && !b.stack.empty()) {
    b.nodes[b.stack.back()].content += content;
  }
  const auto address=reinterpret_cast<uintptr_t>(value), base=reinterpret_cast<uintptr_t>(b.input);
  const int64_t offset=address>=base && address-base<=b.originalSize && size<=b.originalSize-(address-base)
    ? static_cast<int64_t>(address-base) : -1;
  if(t==MD_TEXT_NORMAL) b.emitQuotedText(content,offset);
  else b.emitText(std::move(content),false,(t==MD_TEXT_CODE || t==MD_TEXT_LATEXMATH)?offset:-1);
  return 0;
}
}
#ifdef VALI_CODE_HIGHLIGHT
namespace {
size_t utf16Units(const std::string& text,size_t start,size_t end) {
  size_t units=0;
  for(size_t i=start;i<end;) {
    const auto c=static_cast<unsigned char>(text[i]);const size_t length=c<0x80?1:c<0xe0?2:c<0xf0?3:4;
    units+=length==4?2:1;i+=length;
  }
  return units;
}
void highlightFences(std::vector<Node>& nodes,CodeHighlighter& highlighter) {
  std::vector<Node> result;result.reserve(nodes.size());
  for(size_t i=0;i<nodes.size();) {
    const auto& fence=nodes[i];
    if(fence.type!="fence" || !CodeHighlighter::supports(fence.language)){result.push_back(std::move(nodes[i++]));continue;}
    size_t end=i+1;std::string code;
    while(end<nodes.size()&&nodes[end].parentId==fence.id&&nodes[end].type=="text")code+=nodes[end++].content;
    const auto ranges=highlighter.highlight(fence.id,fence.language,code);
    result.push_back(fence);size_t offset=0;
    for(size_t j=i+1;j<end;++j) {
      const auto& text=nodes[j];size_t cursor=0,part=0;
      auto emit=[&](size_t stop,const CodeRange* highlight) {
        if(stop<=cursor)return;
        Node leaf=text;leaf.id=text.id+"/segment"+std::to_string(part++);leaf.content=text.content.substr(cursor,stop-cursor);
        if(text.sourceStart>=0) {
          leaf.sourceStart=text.sourceStart+utf16Units(text.content,0,cursor);
          leaf.sourceEnd=leaf.sourceStart+utf16Units(text.content,cursor,stop);
        }
        if(highlight) {
          Node span;span.id=leaf.id+"/syntax";span.parentId=text.parentId;span.type=std::string("syntax_")+codeKindName(highlight->kind);
          leaf.parentId=span.id;leaf.id=span.id+"/0";result.push_back(std::move(span));
        }
        result.push_back(std::move(leaf));cursor=stop;
      };
      for(const auto& range:ranges) {
        if(range.end<=offset||range.start>=offset+text.content.size())continue;
        const size_t start=std::max<size_t>(range.start,offset)-offset;
        const size_t stop=std::min<size_t>(range.end,offset+text.content.size())-offset;
        emit(start,nullptr);emit(stop,&range);
      }
      emit(text.content.size(),nullptr);offset+=text.content.size();
    }
    i=end;
  }
  nodes=std::move(result);
}
}
#endif
Snapshot Document::setSource(std::string source,bool streaming,bool includeSource) {
  source_=std::move(source);streaming_=streaming;finished_=!streaming;++revision_;return parse(includeSource);
}
Snapshot Document::replace(std::string source,bool includeSource) {
  source_=std::move(source); finished_=false; streaming_=false; ++revision_; return parse(includeSource);
}
Snapshot Document::append(const std::string& chunk,bool includeSource) {
  if(finished_) throw std::logic_error("Cannot append to a finished document; replace it first");
  streaming_=true; source_+=chunk; ++revision_; return parse(includeSource);
}
Snapshot Document::finish(bool includeSource) { finished_=true; ++revision_; return parse(includeSource); }
Snapshot Document::parse(bool includeSource) {
  if(source_.size()>std::numeric_limits<MD_SIZE>::max()) throw std::length_error("Markdown source exceeds MD4C size limit");
  const auto repairStart=Clock::now();
  const auto preview=streaming_ && !finished_ ? repairStreaming(source_) : source_;
  if(preview.size()>std::numeric_limits<MD_SIZE>::max()) throw std::length_error("Markdown preview exceeds MD4C size limit");
  const auto repairMs=elapsed(repairStart);
  const auto parseStart=Clock::now();
  Builder b;
  b.ranges(preview,source_.size());
  MD_PARSER parser{};
  parser.flags=MD_DIALECT_GITHUB | MD_FLAG_NOHTML | MD_FLAG_LATEXMATHSPANS;
  parser.enter_block=enterBlock; parser.leave_block=leaveBlock;
  parser.enter_span=enterSpan; parser.leave_span=leaveSpan; parser.text=text;
  if(md_parse(preview.data(),static_cast<MD_SIZE>(preview.size()),&parser,&b)!=0)
    throw std::runtime_error("MD4C parsing failed");
#ifdef VALI_CODE_HIGHLIGHT
  highlightFences(b.nodes,highlighter_);
#endif
  return {{repairMs,elapsed(parseStart)},revision_,includeSource?source_:std::string{},finished_,std::move(b.nodes)};
}
namespace {
bool same(const Block& a,const Block& b,bool ranges=true) {
  if(a.nodes.size()!=b.nodes.size()) return false;
  for(size_t i=0;i<a.nodes.size();++i) {
    const auto& x=a.nodes[i];const auto& y=b.nodes[i];
    if((ranges && (x.sourceStart!=y.sourceStart || x.sourceEnd!=y.sourceEnd)) || x.id!=y.id || x.parentId!=y.parentId || x.type!=y.type || x.content!=y.content || x.destination!=y.destination || x.marker!=y.marker || x.language!=y.language) return false;
  }
  return true;
}
uint64_t utf16Length(const std::string& text) {
  uint64_t count=0;
  for(unsigned char c:text) if((c&0xc0)!=0x80) count+=c>=0xf0?2:1;
  return count;
}
size_t fingerprint(const Block& b) {
  size_t hash=0;
  for(const auto& n:b.nodes) for(const auto* s:{&n.type,&n.content,&n.destination,&n.marker,&n.language})
    hash^=std::hash<std::string>{}(*s)+0x9e3779b9+(hash<<6)+(hash>>2);
  return hash;
}
}
Update Document::update(Snapshot snapshot,bool reset) {
  const auto start=Clock::now();
  Update result; result.revision=snapshot.revision;result.finished=snapshot.finished;result.reset=reset;result.timings=snapshot.timings;
  std::vector<Block> next;
  // MD4C's document root is omitted from transport; top-level blocks own local paths.
  for(auto& node:snapshot.nodes) {
    if(node.type=="body" && node.parentId.empty()) continue;
    if(node.parentId=="/0") next.emplace_back();
    if(next.empty()) continue;
    auto& block=next.back();
    if(node.type=="text") block.text+=node.content;
    const auto rootEnd=node.id.find('/',3);
    const auto root=node.id.substr(0,rootEnd);
    node.id=node.id.substr(root.size());
    node.parentId=node.parentId=="/0" ? std::string{} : node.parentId.substr(root.size());
    // Local root is 'root'; descendants keep their relative paths.
    node.id="root"+node.id;
    if(!node.parentId.empty() || block.nodes.size()>0) node.parentId="root"+node.parentId;
    block.nodes.push_back(std::move(node));
  }
  std::vector<bool> used(blocks_.size(),false);
  std::unordered_multimap<size_t,size_t> matches;
  if(!reset) for(size_t i=0;i<blocks_.size();++i) matches.emplace(fingerprint(blocks_[i]),i);
  std::vector<int64_t> previous(next.size(),-1);
  // Exact matches first protect unchanged blocks across insertions/deletions.
  for(size_t i=0;i<next.size()&&!reset;++i) {
    auto range=matches.equal_range(fingerprint(next[i]));
    size_t best=blocks_.size();
    for(auto it=range.first;it!=range.second;++it)
      if(!used[it->second] && same(next[i],blocks_[it->second],false) &&
         (best==blocks_.size() || std::abs(static_cast<int64_t>(it->second)-static_cast<int64_t>(i))<std::abs(static_cast<int64_t>(best)-static_cast<int64_t>(i)))) best=it->second;
    if(best!=blocks_.size()) { previous[i]=best;used[best]=true; }
  }
  for(size_t i=0;i<next.size();++i) {
    auto& b=next[i];
    if(previous[i]<0 && !reset && i<blocks_.size() && !used[i]) {previous[i]=i;used[i]=true;}
    if(previous[i]>=0) {
      const auto& old=blocks_[previous[i]];
      b.id=old.id;b.revision=old.revision;
      if(!same(b,old)) {
        ++b.revision;
        // Only an actual append to visible text creates a reveal event.
        if(streaming_ && !finished_ && b.text.starts_with(old.text)) { b.revealStart=utf16Length(old.text);b.revealLength=utf16Length(b.text)-b.revealStart; }
        result.changed.push_back(b);
      }
    } else {
      b.id=nextBlockId_++;
      if(!reset && streaming_ && !finished_) b.revealLength=utf16Length(b.text);
      result.changed.push_back(b);
    }
    result.order.push_back(b.id);
  }
  if(!reset) for(size_t i=0;i<blocks_.size();++i) if(!used[i]) result.removed.push_back(blocks_[i].id);
  bool reordered=reset || blocks_.size()!=next.size();
  if(!reordered) for(size_t i=0;i<next.size();++i) if(next[i].id!=blocks_[i].id) {reordered=true;break;}
  result.orderChanged=reordered;
  if(!reordered) result.order.clear();
  blocks_=std::move(next);
  result.timings.reconcileMs=elapsed(start);
  return result;
}

}
