#pragma once
#include <string>
namespace vali::markdown {
// Preview-only completion. Never write this result into the document source.
std::string repairStreaming(const std::string& source);
}
