import XCTest
import UIKit
@testable import ValiMarkdown

@MainActor final class MarkdownInputTests: XCTestCase {
  private var hybrid: HybridMarkdownInputView!
  private var window: UIWindow!
  private var changes: [EditorChange] = []
  private var selections: [EditorSelection] = []

  override func setUp() {
    super.setUp()
    hybrid = HybridMarkdownInputView()
    hybrid.configuration = EditorConfiguration(multiline: true, submitBehavior: "newline", returnKeyType: "default", autoCorrect: true, autoCapitalize: "sentences", keyboardType: "default", maxLength: -1, numberOfLines: 4, editable: true, selectTextOnFocus: false, caretHidden: false, contextMenuHidden: false, showSoftInputOnFocus: false, scrollEnabled: true)
    window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 700))
    window.rootViewController = UIViewController()
    hybrid.view.frame = CGRect(x: 0, y: 0, width: 390, height: 600)
    window.rootViewController!.view.addSubview(hybrid.view)
    window.makeKeyAndVisible()
    hybrid.onChange = { [weak self] in self?.changes.append($0) }
    hybrid.onSelection = { [weak self] in self?.selections.append($0) }
    hybrid.afterUpdate()
  }
  override func tearDown() {
    hybrid.onDropView(); hybrid = nil
    window.isHidden = true; window = nil
    changes = []; selections = []
    super.tearDown()
  }
  private func load(_ text: String) {
    hybrid.state = EditorState(text: text, eventCount: Double(hybrid.view.eventCount))
    hybrid.afterUpdate()
    hybrid.view.layoutIfNeeded()
  }
  private func waitForBlocks(_ source: String, count: Int) async -> [EditorBlock] {
    let ready = expectation(description: "C++ analysis and TextKit block layout")
    var result: [EditorBlock] = [], done = false
    hybrid.onBlocks = { event in
      if event.text == source && event.blocks.count == count && !done {
        done = true; result = event.blocks; ready.fulfill()
      }
    }
    load(source)
    await fulfillment(of: [ready], timeout: 10)
    return result
  }
  func testInlineStylesAndRawToggle() async {
    let ready = expectation(description: "Analysis")
    let text = "**bold** and *italic* and [link](https://example.com)"
    hybrid.onBlocks = { event in if event.text == text { ready.fulfill() } }
    load(text)
    await fulfillment(of: [ready], timeout: 10)
    // Wait for the analyzer to update attributes; a source-layout event can
    // precede it, so explicitly wait for the resulting font trait.
    let bold = NSPredicate { [weak self] _, _ in
      let font = self?.hybrid.view.textStorage.attribute(.font, at: 2, effectiveRange: nil) as? UIFont
      return font?.fontDescriptor.symbolicTraits.contains(.traitBold) == true
    }
    await fulfillment(of: [expectation(for: bold, evaluatedWith: nil)], timeout: 10)
    hybrid.previews = false; hybrid.afterUpdate()
    let font = hybrid.view.textStorage.attribute(.font, at: 2, effectiveRange: nil) as? UIFont
    XCTAssertFalse(font!.fontDescriptor.symbolicTraits.contains(.traitBold))
    XCTAssertEqual(hybrid.view.text, text)
  }
  func testFoldedBlocksKeepSourceOffsetsAndClipboard() async {
    let text = "😀 start\n\n```ts\nconst x = 1\n```\n\n$$\nx^2\n$$\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nend"
    let blocks = await waitForBlocks(text, count: 3)
    XCTAssertTrue(blocks.allSatisfy { !$0.active && $0.width > 0 })
    XCTAssertEqual(hybrid.view.text.filter { $0 == "\u{fffc}" }.count, 3)
    let length = (text as NSString).length
    hybrid.setSelection(start: Double(length), end: Double(length))
    XCTAssertEqual(selections.last?.start, Double(length))
    hybrid.setSelection(start: 0, end: Double(length))
    hybrid.view.copy(nil)
    XCTAssertEqual(UIPasteboard.general.string, text)
    hybrid.activate(offset: blocks[0].start + 7)
    XCTAssertTrue(hybrid.isFocused())
    XCTAssertTrue(hybrid.view.text.contains("const x = 1"))
  }
  func testNativeTypingUndoAndStaleControlledValues() {
    load("😀 hello")
    hybrid.focus()
    hybrid.setSelection(start: 8, end: 8)
    hybrid.view.insertText("!")
    XCTAssertEqual(changes.last?.text, "😀 hello!")
    XCTAssertEqual(changes.last?.selectionEnd, 9)
    XCTAssertEqual(changes.last?.eventCount, 1)
    hybrid.state = EditorState(text: "stale", eventCount: 0); hybrid.afterUpdate()
    XCTAssertEqual(hybrid.view.text, "😀 hello!")
    hybrid.view.undoManager?.undo()
    XCTAssertEqual(changes.last?.text, "😀 hello")
    hybrid.view.undoManager?.redo()
    XCTAssertEqual(changes.last?.text, "😀 hello!")
  }
  func testCompositionKeepsSourceAndMarkedText() {
    load("Say "); hybrid.focus(); hybrid.setSelection(start: 4, end: 4)
    hybrid.view.setMarkedText("に", selectedRange: NSRange(location: 1, length: 0))
    XCTAssertNotNil(hybrid.view.markedTextRange)
    hybrid.view.setMarkedText("日本", selectedRange: NSRange(location: 2, length: 0))
    hybrid.view.unmarkText()
    XCTAssertNil(hybrid.view.markedTextRange)
    XCTAssertEqual(hybrid.view.text, "Say 日本")
    XCTAssertEqual(changes.last?.text, "Say 日本")
    hybrid.view.undoManager?.undo()
    XCTAssertEqual(changes.last?.text, "Say ")
  }
  func testDeletionAndReplacementPreserveSource() {
    load("a😀b"); hybrid.focus(); hybrid.setSelection(start: 3, end: 3)
    hybrid.view.deleteBackward()
    XCTAssertEqual(changes.last?.text, "ab")
    XCTAssertEqual(selections.last?.start, 1)
    let start = hybrid.view.position(from: hybrid.view.beginningOfDocument, offset: 0)!
    let end = hybrid.view.position(from: start, offset: 1)!
    hybrid.view.replace(hybrid.view.textRange(from: start, to: end)!, withText: "Hello")
    XCTAssertEqual(changes.last?.text, "Hellob")
  }
  func testPreferredHeightGrowsFromOneLineAndCapsAtLineLimit() async {
    var latest: EditorMetrics?
    hybrid.onMetrics = { latest = $0 }
    load("short")
    let first = NSPredicate { _, _ in latest != nil }
    await fulfillment(of: [expectation(for: first, evaluatedWith: nil)], timeout: 5)
    let one = latest!.preferredHeight
    XCTAssertLessThan(one, 50)
    latest = nil
    load("one\ntwo\nthree")
    await fulfillment(of: [expectation(for: NSPredicate { _, _ in latest != nil }, evaluatedWith: nil)], timeout: 5)
    let three = latest!.preferredHeight
    XCTAssertGreaterThan(three, one * 1.5)
    latest = nil
    load((0..<30).map { "line \($0)" }.joined(separator: "\n"))
    await fulfillment(of: [expectation(for: NSPredicate { _, _ in latest != nil }, evaluatedWith: nil)], timeout: 5)
    XCTAssertGreaterThan(latest!.height, latest!.preferredHeight)
    XCTAssertEqual(latest!.preferredHeight, (one - 24) * 4 + 24, accuracy: 1)
    latest = nil
    load("")
    await fulfillment(of: [expectation(for: NSPredicate { _, _ in latest != nil }, evaluatedWith: nil)], timeout: 5)
    XCTAssertEqual(latest!.preferredHeight, one, accuracy: 1)
  }
  func testCaretFollowsTypingAndSelectionInCappedViewport() async {
    hybrid.view.frame.size.height = 80
    let text = (0..<30).map { "line \($0)" }.joined(separator: "\n")
    load(text); hybrid.focus()
    let end = Double((text as NSString).length)
    hybrid.setSelection(start: end, end: end)
    hybrid.view.insertText("\nlast")
    let visible = NSPredicate { [weak self] _, _ in
      guard let view = self?.hybrid.view, let selection = view.selectedTextRange else { return false }
      view.layoutIfNeeded()
      return view.contentOffset.y > 0 && view.bounds.contains(view.caretRect(for: selection.end))
    }
    await fulfillment(of: [expectation(for: visible, evaluatedWith: nil)], timeout: 5)
    hybrid.setSelection(start: 0, end: 0)
    hybrid.view.layoutIfNeeded()
    XCTAssertLessThanOrEqual(hybrid.view.contentOffset.y, 1)
  }
  func testHeadingSelectionCannotChangeBodyFontOrCompoundHeadingSize() async {
    load("# Heading\n\nBody text")
    let ready = NSPredicate { [weak self] _, _ in
      let font = self?.hybrid.view.textStorage.attribute(.font, at: 2, effectiveRange: nil) as? UIFont
      return (font?.pointSize ?? 0) > 20
    }
    await fulfillment(of: [expectation(for: ready, evaluatedWith: nil)], timeout: 10)
    hybrid.focus()
    for _ in 0..<12 {
      hybrid.setSelection(start: 0, end: 1)
      hybrid.setSelection(start: 2, end: 2)
      hybrid.setSelection(start: 12, end: 12)
    }
    let heading = hybrid.view.textStorage.attribute(.font, at: 2, effectiveRange: nil) as! UIFont
    let body = hybrid.view.textStorage.attribute(.font, at: 12, effectiveRange: nil) as! UIFont
    XCTAssertEqual(heading.pointSize, 28.8, accuracy: 0.1)
    XCTAssertEqual(body.pointSize, 16, accuracy: 0.1)
    hybrid.view.insertText("x")
    let typed = hybrid.view.textStorage.attribute(.font, at: 12, effectiveRange: nil) as! UIFont
    XCTAssertEqual(typed.pointSize, 16, accuracy: 0.1)
  }
  func testImperativeRefCallsFromBackgroundThread() async {
    let focused = expectation(description: "Focus on main thread")
    hybrid.onFocusChanged = { event in
      if event.focused { XCTAssertTrue(Thread.isMainThread); focused.fulfill() }
    }
    let input = hybrid!
    DispatchQueue.global().async { input.focus() }
    await fulfillment(of: [focused], timeout: 5)
    XCTAssertTrue(input.isFocused())
    let blurred = expectation(description: "Blur on main thread")
    hybrid.onFocusChanged = { event in if !event.focused { blurred.fulfill() } }
    DispatchQueue.global().async { input.blur() }
    await fulfillment(of: [blurred], timeout: 5)
    XCTAssertFalse(input.isFocused())
  }
  func testCustomNumericFontWeightAndLinkStyle() async {
    hybrid.inlineStyles = [
      EditorInlineStyle(kind: 1, hasColor: false, color: 0, hasBackground: false, backgroundColor: 0, fontSize: 0, fontFamily: "", fontWeight: "700", fontStyle: "", decoration: ""),
      EditorInlineStyle(kind: 6, hasColor: true, color: 0xff123456, hasBackground: false, backgroundColor: 0, fontSize: 0, fontFamily: "", fontWeight: "", fontStyle: "", decoration: "underline")
    ]
    hybrid.afterUpdate()
    load("**bold** [link](https://example.com)")
    let styled = NSPredicate { [weak self] _, _ in
      guard let storage = self?.hybrid.view.textStorage else { return false }
      let font = storage.attribute(.font, at: 2, effectiveRange: nil) as? UIFont
      let color = storage.attribute(.foregroundColor, at: 10, effectiveRange: nil) as? UIColor
      return font?.fontDescriptor.symbolicTraits.contains(.traitBold) == true && color == UIColor(red: 0x12 / 255.0, green: 0x34 / 255.0, blue: 0x56 / 255.0, alpha: 1)
    }
    await fulfillment(of: [expectation(for: styled, evaluatedWith: nil)], timeout: 10)
  }
  func testTypographyDoesNotRewriteSource() async {
    hybrid.typographer = true; hybrid.afterUpdate()
    let text = "(c) ... +-"
    load(text)
    let folded = NSPredicate { [weak self] _, _ in
      self?.hybrid.view.text.filter { $0 == "\u{fffc}" }.count == 3
    }
    await fulfillment(of: [expectation(for: folded, evaluatedWith: nil)], timeout: 10)
    hybrid.setSelection(start: 0, end: Double((text as NSString).length))
    hybrid.view.copy(nil)
    XCTAssertEqual(UIPasteboard.general.string, text)
    hybrid.activate(offset: 1)
    XCTAssertTrue(hybrid.view.text.hasPrefix("(c)"))
    hybrid.view.insertText("x")
    XCTAssertEqual(changes.last?.text, "(xc) ... +-")
  }
  func testTypingAfterFoldedBlockAndMeasuredHeight() async {
    let text = "```js\nconst a = 1\n```\n\nafter"
    let blocks = await waitForBlocks(text, count: 1)
    guard let block = blocks.first else { return }
    hybrid.previewSizes = EditorPreviewSizes(eventCount: Double(hybrid.view.eventCount), sizes: [EditorPreviewSize(start: block.start, end: block.end, height: 160)])
    hybrid.afterUpdate()
    hybrid.focus()
    hybrid.setSelection(start: Double((text as NSString).length), end: Double((text as NSString).length))
    XCTAssertTrue(hybrid.view.text.contains("\u{fffc}"))
    hybrid.view.insertText("!")
    XCTAssertEqual(changes.last?.text, text + "!")
    XCTAssertEqual(changes.last?.selectionEnd, Double((text as NSString).length + 1))
    hybrid.view.undoManager?.undo()
    XCTAssertEqual(changes.last?.text, text)
  }
  func testSubmitAndLengthLimit() {
    hybrid.configuration = EditorConfiguration(multiline: true, submitBehavior: "blurAndSubmit", returnKeyType: "send", autoCorrect: false, autoCapitalize: "none", keyboardType: "default", maxLength: 5, numberOfLines: 2, editable: true, selectTextOnFocus: false, caretHidden: false, contextMenuHidden: false, showSoftInputOnFocus: false, scrollEnabled: true)
    hybrid.afterUpdate(); hybrid.focus()
    hybrid.view.insertText("abcd")
    hybrid.view.insertText("😀")
    XCTAssertEqual(hybrid.view.text, "abcd")
    hybrid.view.insertText("ef")
    XCTAssertEqual(hybrid.view.text, "abcde")
    var submitted: String?
    hybrid.onSubmit = { submitted = $0.text }
    hybrid.view.insertText("\n")
    XCTAssertEqual(submitted, "abcde")
    XCTAssertFalse(hybrid.isFocused())
    load("ab"); hybrid.focus(); hybrid.setSelection(start: 2, end: 2)
    if let command = hybrid.view.keyCommands?.first(where: { $0.input == "\r" && $0.modifierFlags == .shift }), let action = command.action {
      UIApplication.shared.sendAction(action, to: hybrid.view, from: command, for: nil)
    } else { XCTFail("Missing Shift+Return command") }
    XCTAssertEqual(changes.last?.text, "ab\n")
    XCTAssertTrue(hybrid.isFocused())
    load("ab"); hybrid.setSelection(start: 2, end: 2)
    hybrid.view.setMarkedText("日本語文", selectedRange: NSRange(location: 4, length: 0))
    hybrid.view.unmarkText()
    XCTAssertEqual(changes.last?.text, "ab日本語")
  }
}
