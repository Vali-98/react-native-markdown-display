#include <jni.h>
#include "EditorAnalysis.hpp"
extern "C" JNIEXPORT jintArray JNICALL Java_com_valimarkdown_EditorNative_analyze(JNIEnv* env,jclass,jstring text) {
  const auto size=env->GetStringLength(text);
  const auto* chars=env->GetStringChars(text,nullptr);if(!chars)return nullptr;
  std::u16string source(reinterpret_cast<const char16_t*>(chars),size);env->ReleaseStringChars(text,chars);
  try {
    auto ranges=vali::markdown::analyzeEditor(source);std::vector<jint> values;values.reserve(ranges.size()*3);
    for(const auto& r:ranges){values.push_back(r.start);values.push_back(r.end);values.push_back(r.kind);}
    auto result=env->NewIntArray(static_cast<jsize>(values.size()));if(result)env->SetIntArrayRegion(result,0,static_cast<jsize>(values.size()),values.data());return result;
  } catch(const std::exception& error) {env->ThrowNew(env->FindClass("java/lang/RuntimeException"),error.what());return nullptr;}
}
