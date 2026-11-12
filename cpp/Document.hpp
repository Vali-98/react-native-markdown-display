#pragma once
#include <cstdint>
#include <string>
#include <vector>
namespace vali::markdown {
struct Timings { double repairMs=0, parseMs=0, reconcileMs=0, queueMs=0, prepareMs=0; };
struct Node {
  std::string id, parentId, type, content, destination;
  int64_t sourceStart=-1, sourceEnd=-1;
  std::string marker;
};
struct Snapshot {
  Timings timings;
  uint64_t revision;
  std::string source;
  bool finished;
  std::vector<Node> nodes;
};
struct Block {
  uint64_t id=0, revision=1;
  std::vector<Node> nodes;
  std::string text;
  uint64_t revealStart=0, revealLength=0;
};
struct Update {
  uint64_t revision=0;
  bool finished=false, reset=false, orderChanged=false;
  std::vector<Block> changed;
  std::vector<uint64_t> removed, order;
  Timings timings;
};
// Confined to one worker; no JSI/runtime objects enter this layer.
class Document {
 public:
  Snapshot setSource(std::string source, bool streaming, bool includeSource=true);
  Snapshot replace(std::string source, bool includeSource=true);
  Snapshot append(const std::string& chunk, bool includeSource=true);
  Snapshot finish(bool includeSource=true);
  Update update(Snapshot snapshot, bool reset);
 private:
  Snapshot parse(bool includeSource);
  std::vector<Block> blocks_;
  uint64_t nextBlockId_=1;
  std::string source_;
  uint64_t revision_ = 0;
  bool finished_ = false;
  bool streaming_ = false;
};
}
