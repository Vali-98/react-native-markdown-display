#import <React/RCTViewComponentView.h>

// Nitro's Fabric component embeds the UITextView as its contentView. RN's
// TextInputState dispatches these commands to the Fabric host for Keyboard.dismiss
// and ScrollView keyboard handling, independently of the Nitro imperative ref.
@interface HybridMarkdownInputViewComponent : RCTViewComponentView
@end
@implementation HybridMarkdownInputViewComponent (TextInputCommands)
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  if ([commandName isEqualToString:@"focus"]) {
    [self.contentView becomeFirstResponder];
  } else if ([commandName isEqualToString:@"blur"]) {
    [self.contentView resignFirstResponder];
  } else {
    [super handleCommand:commandName args:args];
  }
}
@end
