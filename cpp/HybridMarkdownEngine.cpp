#include "HybridMarkdownEngine.hpp"
#include <chrono>
namespace margelo::nitro::markdown {
HybridMarkdownEngine::HybridMarkdownEngine() : HybridObject(TAG), worker_([this]{ run(); }) {}
HybridMarkdownEngine::~HybridMarkdownEngine() {
  { std::lock_guard lock(mutex_); stopping_=true; }
  wake_.notify_one();
  worker_.join();
}
void HybridMarkdownEngine::run() {
  for(;;) {
    std::function<void()> job;
    {
      std::unique_lock lock(mutex_);
      wake_.wait(lock,[this]{ return stopping_ || !jobs_.empty(); });
      if(jobs_.empty() && stopping_) return;
      job=std::move(jobs_.front()); jobs_.pop_front();
    }
    job();
  }
}
std::shared_ptr<Promise<MarkdownUpdate>> HybridMarkdownEngine::enqueue(std::function<vali::markdown::Update()> operation) {
  auto promise=Promise<MarkdownUpdate>::create();
  const auto submitted=std::chrono::steady_clock::now();
  {
    std::lock_guard lock(mutex_);
    jobs_.push_back([promise, submitted, operation=std::move(operation)] {
      try {
        const auto workerStart=std::chrono::steady_clock::now();
        auto value=operation();
        const auto prepareStart=std::chrono::steady_clock::now();
        MarkdownUpdate result;
        result.revision=static_cast<double>(value.revision);
        result.finished=value.finished;result.reset=value.reset;result.orderChanged=value.orderChanged;
        result.changed.reserve(value.changed.size());
        for(auto& b:value.changed) {
          MarkdownBlock block;
          block.id=static_cast<double>(b.id);block.revision=static_cast<double>(b.revision);
          block.revealStart=static_cast<double>(b.revealStart);block.revealLength=static_cast<double>(b.revealLength);
          block.nodes.reserve(b.nodes.size());
          for(auto& n:b.nodes) {
            MarkdownNode node;
            node.id=std::move(n.id);node.parentId=std::move(n.parentId);node.type=std::move(n.type);
            node.sourceStart=static_cast<double>(n.sourceStart);node.sourceEnd=static_cast<double>(n.sourceEnd);
            if(!n.language.empty())node.language=std::move(n.language);
            node.marker=std::move(n.marker);node.content=std::move(n.content);node.destination=std::move(n.destination);
            block.nodes.push_back(std::move(node));
          }
          result.changed.push_back(std::move(block));
        }
        result.order.assign(value.order.begin(),value.order.end());
        result.removed.assign(value.removed.begin(),value.removed.end());
        result.timings.repairMs=value.timings.repairMs;result.timings.parseMs=value.timings.parseMs;
        result.timings.reconcileMs=value.timings.reconcileMs;
        result.timings.queueMs=std::chrono::duration<double,std::milli>(workerStart-submitted).count();
        result.timings.prepareMs=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-prepareStart).count();
        promise->resolve(std::move(result));
      } catch(...) { promise->reject(std::current_exception()); }
    });
  }
  wake_.notify_one(); return promise;
}
std::shared_ptr<Promise<MarkdownUpdate>> HybridMarkdownEngine::setSource(const std::string& source,bool streaming) {
  return enqueue([this,source,streaming]{ return document_.update(document_.setSource(source,streaming,false),false); });
}
std::shared_ptr<Promise<MarkdownUpdate>> HybridMarkdownEngine::replace(const std::string& source) {
  return enqueue([this,source]{ return document_.update(document_.replace(source,false),true); });
}
std::shared_ptr<Promise<MarkdownUpdate>> HybridMarkdownEngine::append(const std::string& chunk) {
  return enqueue([this,chunk]{ return document_.update(document_.append(chunk,false),false); });
}
std::shared_ptr<Promise<MarkdownUpdate>> HybridMarkdownEngine::finish() {
  return enqueue([this]{ return document_.update(document_.finish(false),false); });
}
}
