#include "Document.hpp"
#include <stdexcept>
#include <iostream>
#include <map>
using namespace vali::markdown;
void check(bool ok) { if(!ok) throw std::runtime_error("Check failed"); }
int main() {
  const std::string source="# Hello\n\n**world** and $x^2$\n\n```cpp\nint x;\n```";
  Document baseline; auto expected=baseline.replace(source);
  bool math=false, strong=false;
  for(auto& n:expected.nodes) { math |= n.type=="latex_inline" && n.content=="x^2"; strong |= n.type=="strong"; }
  check(math && strong);
  for(size_t split=0;split<=source.size();++split) {
    Document d; d.append(source.substr(0,split)); d.append(source.substr(split)); auto final=d.finish();
    check(final.source==source && final.finished && final.nodes.size()==expected.nodes.size());
    for(size_t i=0;i<final.nodes.size();++i) {
      const auto& a=final.nodes[i]; const auto& b=expected.nodes[i];
      check(a.id==b.id && a.parentId==b.parentId && a.type==b.type && a.content==b.content && a.destination==b.destination);
    }
    bool rejected=false; try { d.append("x"); } catch(const std::logic_error&) { rejected=true; } check(rejected);
    check(!d.replace("reset").finished);
  }
  for (const auto& fixture : std::vector<std::pair<std::string,std::string>>{
    {"**bold", "strong"}, {"*italic", "em"}, {"~~deleted", "s"},
    {"`code", "code_inline"}, {"$x^2", "latex_inline"}, {"$$x^2", "latex_block"},
    {"[label](https://exa", "link"}, {"[label", "link"},
    {"```cpp\n**literal", "fence"}, {"**bold*", "strong"},
    {"**bold ", "strong"}, {"**bold *nested", "em"}
  }) {
    Document streamed; auto preview=streamed.append(fixture.first);
    check(preview.source==fixture.first);
    bool found=false; for(const auto& n:preview.nodes) found |= n.type==fixture.second;
    if(!found) throw std::runtime_error("Missing preview container for: "+fixture.first);
    Document ordinary; auto expectedFinal=ordinary.replace(fixture.first); auto final=streamed.finish();
    check(final.nodes.size()==expectedFinal.nodes.size());
    for(size_t i=0;i<final.nodes.size();++i) check(final.nodes[i].type==expectedFinal.nodes[i].type && final.nodes[i].content==expectedFinal.nodes[i].content);
  }
  for (const std::string input : {"escaped \\*star", "snake_case_word", "* list item", "```\n**literal", "`**literal", "$**literal", "    **literal"}) {
    Document d; auto preview=d.append(input);
    for(const auto& n:preview.nodes) check(n.type!="strong" && n.type!="em");
  }
  for(const std::string input : {"before \"quoted\" after", "“curly”", "„low”", "‟reverse”", "«guillemet»", "\"dangling"}) {
    Document d; auto preview=d.append(input);
    bool quoted=false; std::string visible;
    for(const auto& n:preview.nodes) { quoted |= n.type=="double_quote"; if(n.type=="text") visible+=n.content; }
    check(quoted && visible==input);
  }
  {
    Document d; auto value=d.replace("\"before **bold** after\"");
    bool quotedBold=false;
    for(const auto& n:value.nodes) if(n.type=="double_quote") {
      for(const auto& parent:value.nodes) quotedBold |= parent.id==n.parentId && parent.type=="strong";
    }
    check(quotedBold);
  }
  for(const std::string input : {"`\"code\"`", "```\n\"code\"\n```", "$\"math\"$"}) {
    Document d; auto value=d.replace(input);
    for(const auto& n:value.nodes) check(n.type!="double_quote");
  }
  {
    Document d; auto value=d.replace("\"open\n\nplain");
    bool plainUnquoted=false;
    for(const auto& n:value.nodes) if(n.content=="plain") {
      for(const auto& parent:value.nodes) plainUnquoted |= parent.id==n.parentId && parent.type=="paragraph";
    }
    check(plainUnquoted);
  }
  {
    Document d;
    auto first=d.update(d.replace("first\n\nsecond"),true);
    check(first.reset && first.changed.size()==2 && first.order.size()==2);
    const auto id=first.order[1];
    auto tail=d.update(d.append(" grows"),false);
    check(tail.order.empty() && tail.removed.empty() && tail.changed.size()==1);
    check(tail.changed[0].id==id && tail.changed[0].revision==2);
    check(tail.changed[0].revealStart==6 && tail.changed[0].revealLength==6);
    auto done=d.update(d.finish(),false);
    check(done.changed.empty() && done.order.empty());
  }
  {
    Document d;
    auto first=d.update(d.append("hello"),false);
    const auto id=first.order[0];
    auto heading=d.update(d.append("\n---"),false);
    check(heading.changed.size()==1 && heading.changed[0].id==id);
    check(heading.changed[0].revealLength==0); // formatting does not replay a reveal
  }
  {
    Document d;
    auto first=d.update(d.replace("same\n\nsame"),true);
    check(first.order[0]!=first.order[1]);
    auto empty=d.update(d.replace(""),true);
    check(empty.reset && empty.changed.empty() && empty.order.empty());
  }
  {
    Document d;
    auto value=d.update(d.append("😀 hello"),false);
    check(value.changed[0].revealLength==8);
    const auto& text=value.changed[0].nodes.back();
    check(text.sourceStart==0 && text.sourceEnd==8);
  }
  {
    Document d;
    auto first=d.update(d.replace("A\n\nB"),true);
    auto inserted=d.update(d.replace("insert\n\nA\n\nB"),false);
    check(inserted.order.size()==3 && inserted.order[1]==first.order[0] && inserted.order[2]==first.order[1]);
    auto deleted=d.update(d.replace("B"),false);
    check(deleted.order.size()==1 && deleted.order[0]==first.order[1] && deleted.removed.size()==2);
  }
  for(const std::string fixture : {source, std::string("- one\n- two **bold**\n\n| a | b |\n|---|---|\n| 😀 | z |"), std::string("a [reference]\n\n[reference]: https://example.com")}) {
    Document d, baseline;
    std::map<uint64_t,Block> materialized;
    std::vector<uint64_t> order;
    auto apply=[&](Update update) {
      if(update.reset) materialized.clear();
      for(auto id:update.removed) materialized.erase(id);
      for(auto& b:update.changed) materialized[b.id]=b;
      if(update.reset || update.orderChanged) order=update.order;
    };
    for(size_t i=0;i<fixture.size();i+=3) apply(d.update(d.append(fixture.substr(i,3)),false));
    apply(d.update(d.finish(),false));
    auto expected=baseline.update(baseline.replace(fixture),true);
    check(order.size()==expected.changed.size());
    for(size_t i=0;i<order.size();++i) {
      const auto& a=materialized.at(order[i]);const auto& b=expected.changed[i];
      check(a.nodes.size()==b.nodes.size());
      for(size_t j=0;j<a.nodes.size();++j) {
        const auto& x=a.nodes[j];const auto& y=b.nodes[j];
        check(x.id==y.id && x.parentId==y.parentId && x.type==y.type && x.content==y.content && x.destination==y.destination && x.sourceStart==y.sourceStart && x.sourceEnd==y.sourceEnd);
      }
    }
  }
  {
    Document d;
    std::string longSource;
    for(int i=0;i<100;++i) longSource+="paragraph "+std::to_string(i)+"\n\n";
    longSource+="tail";
    auto first=d.update(d.replace(longSource),true);
    auto tail=d.update(d.append(" grows"),false);
    check(first.changed.size()==101 && tail.changed.size()==1 && !tail.orderChanged);
  }
  {
    Document d;
    auto first=d.update(d.append("[label]:"),false);
    auto definition=d.update(d.append(" https://example.com"),false);
    check(!first.order.empty() && definition.orderChanged && definition.order.empty() && !definition.removed.empty());
  }
  {
    const std::string input="“1 “2 “3 “4” 3” 2” 1” end";
    Document d; auto value=d.replace(input);
    std::map<std::string,const Node*> byId;
    for(const auto& n:value.nodes) byId[n.id]=&n;
    size_t deepest=0; std::string visible;
    for(const auto& n:value.nodes) if(n.type=="text") {
      visible+=n.content;
      size_t depth=0; auto parent=n.parentId;
      while(!parent.empty()) { const auto* p=byId.at(parent); depth+=p->type=="double_quote"; parent=p->parentId; }
      deepest=std::max(deepest,depth);
      if(n.content==" 1") check(depth==1);
      if(n.content==" end") check(depth==0);
    }
    check(deepest==4 && visible==input);
  }
  {
    Document d; auto value=d.replace("5. five\n6. six\n   - nested\n\n- [ ] todo\n- [x] done");
    std::vector<std::string> markers;
    for(const auto& n:value.nodes) if(n.type=="list_item") markers.push_back(n.marker);
    check(markers==std::vector<std::string>({"5.","6.","•","☐","☑"}));
  }
  {
    Document d;
    auto first=d.update(d.setSource("fixed\n\n**tail",true),false);
    const auto fixed=first.order[0], tail=first.order[1];
    auto growing=d.update(d.setSource("fixed\n\n**tail grows",true),false);
    check(growing.changed.size()==1 && growing.changed[0].id==tail && growing.order.empty());
    auto finished=d.update(d.setSource("fixed\n\n**tail grows",false),false);
    check(finished.finished && finished.changed.size()==1 && finished.changed[0].id==tail);
    auto edited=d.update(d.setSource("fixed\n\nother",false),false);
    check(edited.changed.size()==1 && edited.changed[0].id==tail && edited.changed[0].revealLength==0);
    check(fixed!=tail);
  }
  Document d; auto first=d.replace("first\n\nsecond"); auto next=d.append(" grows");
  check(first.nodes[1].id==next.nodes[1].id && next.revision>first.revision);
  std::cout<<"Document tests passed\n";
}
