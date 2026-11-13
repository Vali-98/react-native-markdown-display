#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
/// Shares Android's C++/MD4C editor analysis. Results contain UTF-16 triples.
@interface MarkdownEditorAnalyzer : NSObject
+ (void)analyze:(NSString *)source completion:(void (^)(NSArray<NSNumber *> *ranges))completion;
@end
NS_ASSUME_NONNULL_END
