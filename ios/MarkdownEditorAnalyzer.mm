#import "MarkdownEditorAnalyzer.h"
#include "EditorAnalysis.hpp"

@implementation MarkdownEditorAnalyzer
+ (void)analyze:(NSString *)source completion:(void (^)(NSArray<NSNumber *> *))completion {
  static dispatch_queue_t queue;
  static dispatch_once_t once;
  dispatch_once(&once, ^{ queue = dispatch_queue_create("com.vali.markdown.editor", DISPATCH_QUEUE_SERIAL); });
  NSString *snapshot = [source copy];
  dispatch_async(queue, ^{
    @autoreleasepool {
      std::u16string input(snapshot.length, u'\0');
      [snapshot getCharacters:reinterpret_cast<unichar *>(input.data()) range:NSMakeRange(0, snapshot.length)];
      NSMutableArray<NSNumber *> *values = [NSMutableArray new];
      try {
        for (const auto &range : vali::markdown::analyzeEditor(input)) {
          [values addObject:@(range.start)]; [values addObject:@(range.end)]; [values addObject:@(range.kind)];
        }
      } catch (const std::exception &error) {
        NSLog(@"[ValiMarkdownInput] Analysis failed: %s", error.what());
      }
      dispatch_async(dispatch_get_main_queue(), ^{ completion(values); });
    }
  });
}
@end
