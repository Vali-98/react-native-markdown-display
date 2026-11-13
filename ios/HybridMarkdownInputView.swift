import UIKit
import NitroModules

final class HybridMarkdownInputView: HybridMarkdownInputViewSpec {
  let view = MarkdownEditorView()
  private var presentationDirty = true
  private let focusLock = NSLock()
  private var focused = false
  private var dropped = false
  private var selectionPending = false
  var state = EditorState(text: "", eventCount: 0)
  var selectionState = EditorSelection(start: -1, end: -1) { didSet { selectionPending = true } }
  var inlineStyles: [EditorInlineStyle] = [] { didSet { presentationDirty = true } }
  var configuration = EditorConfiguration(multiline: false, submitBehavior: "blurAndSubmit", returnKeyType: "default", autoCorrect: true, autoCapitalize: "sentences", keyboardType: "default", maxLength: -1, numberOfLines: 1, editable: true, selectTextOnFocus: false, caretHidden: false, contextMenuHidden: false, showSoftInputOnFocus: true, scrollEnabled: true) { didSet { presentationDirty = true } }
  var textAttributes = EditorTextAttributes(fontFamily: "", fontWeight: "normal", fontStyle: "normal", letterSpacing: 0, lineHeight: 0, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12, textAlign: "auto", textAlignVertical: "top", allowFontScaling: true, maxFontSizeMultiplier: 0, includeFontPadding: true) { didSet { presentationDirty = true } }
  var previewSizes = EditorPreviewSizes(eventCount: 0, sizes: [])
  var placeholder = "" { didSet { presentationDirty = true } }
  var textColor = 0xff202124 as Double { didSet { presentationDirty = true } }
  var placeholderColor = 0xff92979f as Double { didSet { presentationDirty = true } }
  var selectionColor = 0xff8876c0 as Double { didSet { presentationDirty = true } }
  var cursorColor = 0xff8876c0 as Double { didSet { presentationDirty = true } }
  var delimiterColor = 0xff92979f as Double { didSet { presentationDirty = true } }
  var fontSize = 16.0 { didSet { presentationDirty = true } }
  var previews = true { didSet { presentationDirty = true } }
  var typographer = false { didSet { presentationDirty = true } }
  var quoteColor = 0xff8a4b9d as Double { didSet { presentationDirty = true } }
  var linkColor = 0xff2674d9 as Double { didSet { presentationDirty = true } }
  var onChange: ((EditorChange) -> Void)?
  var onSelection: ((EditorSelection) -> Void)?
  var onBlocks: ((EditorLayout) -> Void)?
  var onFocusChanged: ((EditorFocus) -> Void)?
  var onSubmit: ((EditorEvent) -> Void)?
  var onTouch: ((EditorTouch) -> Void)?
  var onMetrics: ((EditorMetrics) -> Void)?

  override init() {
    super.init()
    view.owner = self
  }
  func afterUpdate() {
    if presentationDirty {
      presentationDirty = false
      view.applyProperties()
    }
    view.setSource(state.text, acknowledged: Int(state.eventCount))
    view.setPreviewSizes(previewSizes)
    if selectionPending {
      selectionPending = false
      if Int(state.eventCount) >= view.eventCount && selectionState.start >= 0 && selectionState.end >= 0 {
        view.selectSource(start: Int(selectionState.start), end: Int(selectionState.end))
      }
    }
  }
  func onDropView() { dropped = true; setFocused(false); view.dispose() }
  private func onMain(_ operation: @escaping (MarkdownEditorView) -> Void) {
    if Thread.isMainThread {
      if !dropped { operation(view) }
    } else {
      DispatchQueue.main.async { [weak self] in
        guard let self, !self.dropped else { return }
        operation(self.view)
      }
    }
  }
  func setFocused(_ value: Bool) {
    focusLock.lock(); focused = value; focusLock.unlock()
  }
  func focus() { onMain { $0.focusInput() } }
  func blur() { onMain { $0.resignFirstResponder() } }
  func isFocused() -> Bool {
    // Avoid a synchronous JS → main-thread dispatch just to read focus state.
    focusLock.lock(); defer { focusLock.unlock() }
    return focused
  }
  func clear() { onMain { $0.setSource("", acknowledged: $0.eventCount) } }
  func setSelection(start: Double, end: Double) { onMain { $0.selectSource(start: Int(start), end: Int(end)) } }
  func activate(offset: Double) { onMain { $0.focusInput(); $0.selectSource(start: Int(offset), end: Int(offset)) } }
}
