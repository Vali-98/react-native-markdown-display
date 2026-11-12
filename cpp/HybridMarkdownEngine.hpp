#pragma once
#include "HybridMarkdownEngineSpec.hpp"
#include "Document.hpp"
#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
namespace margelo::nitro::markdown {
class HybridMarkdownEngine final : public HybridMarkdownEngineSpec {
 public:
  HybridMarkdownEngine();
  ~HybridMarkdownEngine() override;
  std::shared_ptr<Promise<MarkdownUpdate>> setSource(const std::string& source, bool streaming) override;
  std::shared_ptr<Promise<MarkdownUpdate>> replace(const std::string& source) override;
  std::shared_ptr<Promise<MarkdownUpdate>> append(const std::string& chunk) override;
  std::shared_ptr<Promise<MarkdownUpdate>> finish() override;
 private:
  std::shared_ptr<Promise<MarkdownUpdate>> enqueue(std::function<vali::markdown::Update()> operation);
  void run();
  vali::markdown::Document document_;
  std::mutex mutex_;
  std::condition_variable wake_;
  std::deque<std::function<void()>> jobs_;
  bool stopping_ = false;
  std::thread worker_;
};
}
