import UIKit

private extension UIColor {
  convenience init(markdown value: Double) {
    let bits = UInt32(truncatingIfNeeded: Int64(value))
    self.init(red: CGFloat((bits >> 16) & 255) / 255, green: CGFloat((bits >> 8) & 255) / 255,
              blue: CGFloat(bits & 255) / 255, alpha: CGFloat((bits >> 24) & 255) / 255)
  }
}
private let quoteAttribute = NSAttributedString.Key("ValiMarkdownQuote")

private final class SourceAttachment: NSTextAttachment {
  static let transparentImage = UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1)).image { _ in }
  let original: String
  let kind: Int
  init(original: String, kind: Int) {
    self.original = original; self.kind = kind
    super.init(data: nil, ofType: nil)
  }
  required init?(coder: NSCoder) {
    original = coder.decodeObject(of: NSString.self, forKey: "markdownSource") as String? ?? ""
    kind = coder.decodeInteger(forKey: "markdownKind")
    super.init(coder: coder)
  }
  override func encode(with coder: NSCoder) {
    super.encode(with: coder)
    coder.encode(original as NSString, forKey: "markdownSource")
    coder.encode(kind, forKey: "markdownKind")
  }
}

private final class QuoteLayoutManager: NSLayoutManager {
  override func drawBackground(forGlyphRange glyphsToShow: NSRange, at origin: CGPoint) {
    super.drawBackground(forGlyphRange: glyphsToShow, at: origin)
    guard let storage = textStorage, let context = UIGraphicsGetCurrentContext() else { return }
    let characters = characterRange(forGlyphRange: glyphsToShow, actualGlyphRange: nil)
    storage.enumerateAttribute(quoteAttribute, in: characters) { value, range, _ in
      guard let color = value as? UIColor else { return }
      let glyphs = self.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      context.setFillColor(color.cgColor)
      self.enumerateLineFragments(forGlyphRange: glyphs) { rect, _, _, _, _ in
        context.fill(CGRect(x: origin.x + rect.minX, y: origin.y + rect.minY, width: 3, height: rect.height))
      }
    }
  }
}

/// TextKit owns the actual input session. Markdown is kept separately from the
/// displayed attachment projection so external values, clipboard and offsets
/// always use the original source, including while blocks are folded.
final class MarkdownEditorView: UITextView, UITextViewDelegate, UIGestureRecognizerDelegate {
  weak var owner: HybridMarkdownInputView?
  private(set) var eventCount = 0
  private var source = ""
  private var projection = EditorProjection(source: "", replacements: [])
  private var ranges: [SourceRange] = []
  private var analyzedSource = ""
  private var serial = 0
  private var disposed = false
  private var styling = false
  private var nativeEditPending = false
  private var pendingExternal: (String, Int)?
  private var sizes: [String: CGFloat] = [:]
  private var emitPosted = false
  private var lastLayout = ""
  private var lastMetrics = ""
  private var lastWidth: CGFloat = 0
  private let placeholderLabel = UILabel()
  private let history = UndoManager()
  private struct Snapshot { let text: String; let selection: NSRange }
  private var beforeEdit: Snapshot?
  private var compositionStart: Snapshot?
  private var restoringHistory = false
  private var touchOrigin: CGPoint?
  private var touchMoved = false
  private var waitingForWindowFocus = false
  private var contentSizeObserver: NSKeyValueObservation?
  private var fontScale: CGFloat = 1
  // UITextView.font follows the selection and may become a heading font.
  // Source defaults must never be read back from that selection-dependent value.
  private var sourceFont = UIFont.systemFont(ofSize: 16)

  override var undoManager: UndoManager? { history }
  override var canBecomeFirstResponder: Bool { owner?.configuration.editable == true && super.canBecomeFirstResponder }
  private var sourceLength: Int { (source as NSString).length }
  private var sourceSelection: NSRange { projection.sourceSelection(selectedRange) }
  private var composing: Bool { markedTextRange != nil }
  private var target: Double {
    // Nitro embeds this UITextView in a Fabric component; its ancestor owns
    // the React tag used by findNodeHandle and synthetic event targets.
    var node: UIView? = self
    while let current = node {
      if current.tag != 0 { return Double(current.tag) }
      node = current.superview
    }
    return 0
  }
  private var availableWidth: CGFloat { max(1, bounds.width - textContainerInset.left - textContainerInset.right) }
  private func sizeKey(_ r: SourceRange) -> String { "\(r.start):\(r.end)" }

  init() {
    let storage = NSTextStorage()
    let manager = QuoteLayoutManager()
    storage.addLayoutManager(manager)
    let container = NSTextContainer(size: CGSize(width: 0, height: CGFloat.greatestFiniteMagnitude))
    container.lineFragmentPadding = 0
    container.widthTracksTextView = true
    manager.addTextContainer(container)
    super.init(frame: .zero, textContainer: container)
    delegate = self
    backgroundColor = .clear
    contentInsetAdjustmentBehavior = .never
    textContainerInset = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
    font = .systemFont(ofSize: 16)
    placeholderLabel.numberOfLines = 0
    placeholderLabel.isUserInteractionEnabled = false
    placeholderLabel.isAccessibilityElement = false
    addSubview(placeholderLabel)
    let tap = UITapGestureRecognizer(target: self, action: #selector(previewTapped(_:)))
    tap.cancelsTouchesInView = false
    tap.delegate = self
    addGestureRecognizer(tap)
    contentSizeObserver = observe(\.contentSize, options: [.new]) { [weak self] _, _ in self?.emitLayout() }
    NotificationCenter.default.addObserver(self, selector: #selector(fontScaleChanged), name: UIContentSizeCategory.didChangeNotification, object: nil)
  }
  required init?(coder: NSCoder) { fatalError("Use init()") }

  func applyProperties() {
    guard let p = owner else { return }
    let config = p.configuration, attrs = p.textAttributes
    let previousSelection = selectedRange
    let oldInputView = inputView
    isEditable = config.editable
    isSelectable = true
    isScrollEnabled = config.scrollEnabled
    autocorrectionType = config.autoCorrect ? .yes : .no
    // Smart punctuation is controlled by the display-only typographer option.
    smartQuotesType = .no; smartDashesType = .no; smartInsertDeleteType = .no
    autocapitalizationType = ["characters": UITextAutocapitalizationType.allCharacters, "words": .words, "sentences": .sentences][config.autoCapitalize] ?? .none
    keyboardType = ["numeric": UIKeyboardType.decimalPad, "number-pad": .numberPad, "decimal-pad": .decimalPad, "phone-pad": .phonePad, "email-address": .emailAddress, "url": .URL, "ascii-capable": .asciiCapable, "numbers-and-punctuation": .numbersAndPunctuation, "name-phone-pad": .namePhonePad, "twitter": .twitter, "web-search": .webSearch, "ascii-capable-number-pad": .asciiCapableNumberPad][config.keyboardType] ?? .default
    returnKeyType = ["go": UIReturnKeyType.go, "next": .next, "search": .search, "send": .send, "done": .done, "join": .join, "route": .route, "google": .google, "yahoo": .yahoo, "emergency-call": .emergencyCall, "continue": .continue][config.returnKeyType] ?? .default
    inputView = config.showSoftInputOnFocus ? nil : UIView(frame: .zero)
    if isFirstResponder && ((oldInputView == nil) != (inputView == nil)) { reloadInputViews() }
    tintColor = UIColor(markdown: p.cursorColor)
    textColor = UIColor(markdown: p.textColor)
    textContainerInset = UIEdgeInsets(top: attrs.paddingTop, left: attrs.paddingLeft, bottom: attrs.paddingBottom, right: attrs.paddingRight)
    textContainer.maximumNumberOfLines = config.multiline ? 0 : 1
    textContainer.lineBreakMode = config.multiline ? .byWordWrapping : .byClipping
    textContainer.widthTracksTextView = config.multiline
    if !config.multiline { textContainer.size = CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude) }
    fontScale = attrs.allowFontScaling ? UIFontMetrics.default.scaledValue(for: 1) : 1
    if attrs.maxFontSizeMultiplier >= 1 { fontScale = min(fontScale, CGFloat(attrs.maxFontSizeMultiplier)) }
    sourceFont = makeFont(family: attrs.fontFamily, weight: attrs.fontWeight, italic: attrs.fontStyle == "italic", size: CGFloat(p.fontSize) * fontScale)
    font = sourceFont
    placeholderLabel.text = p.placeholder
    placeholderLabel.font = sourceFont
    placeholderLabel.textColor = UIColor(markdown: p.placeholderColor)
    placeholderLabel.textAlignment = alignment(attrs.textAlign)
    if !config.editable && isFirstResponder { resignFirstResponder() }
    if previousSelection.location <= textStorage.length && NSMaxRange(previousSelection) <= textStorage.length { selectedRange = previousSelection }
    refreshPresentation()
    setNeedsLayout()
  }

  private func alignment(_ value: String) -> NSTextAlignment {
    switch value { case "left": return .left; case "right": return .right; case "center": return .center; case "justify": return .justified; default: return .natural }
  }
  private func makeFont(family: String, weight: String, italic: Bool, size: CGFloat, original: UIFont? = nil) -> UIFont {
    let base = original ?? UIFont.systemFont(ofSize: size)
    var descriptor = family.isEmpty ? base.fontDescriptor : (UIFont(name: family, size: size)?.fontDescriptor ?? base.fontDescriptor.withFamily(family))
    let numeric = Double(weight) ?? (weight == "bold" ? 700 : weight == "normal" ? 400 : 0)
    if numeric > 0 {
      let mapped: UIFont.Weight = numeric >= 900 ? .black : numeric >= 800 ? .heavy : numeric >= 700 ? .bold : numeric >= 600 ? .semibold : numeric >= 500 ? .medium : numeric >= 400 ? .regular : numeric >= 300 ? .light : .ultraLight
      let resolvedFamily = UIFont(descriptor: descriptor, size: size).familyName
      if resolvedFamily == UIFont.systemFont(ofSize: size).familyName {
        descriptor = UIFont.systemFont(ofSize: size, weight: mapped).fontDescriptor
      } else {
        descriptor = UIFontDescriptor(fontAttributes: [.family: resolvedFamily, .traits: [UIFontDescriptor.TraitKey.weight: mapped]])
      }
    }
    var traits = descriptor.symbolicTraits
    if italic { traits.insert(.traitItalic) } else { traits.remove(.traitItalic) }
    if traits != descriptor.symbolicTraits, let styled = descriptor.withSymbolicTraits(traits) { descriptor = styled }
    return UIFont(descriptor: descriptor, size: size)
  }
  private func baseAttributes() -> [NSAttributedString.Key: Any] {
    guard let p = owner else { return [.font: UIFont.systemFont(ofSize: 16)] }
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment(p.textAttributes.textAlign)
    paragraph.lineBreakMode = p.configuration.multiline ? .byWordWrapping : .byClipping
    if p.textAttributes.lineHeight > 0 {
      paragraph.minimumLineHeight = CGFloat(p.textAttributes.lineHeight)
      paragraph.maximumLineHeight = CGFloat(p.textAttributes.lineHeight)
    }
    return [.font: sourceFont, .foregroundColor: UIColor(markdown: p.textColor), .kern: p.textAttributes.letterSpacing, .paragraphStyle: paragraph]
  }

  func setSource(_ value: String, acknowledged: Int) {
    guard acknowledged >= eventCount, value != source else { return }
    if composing { pendingExternal = (value, acknowledged); return }
    let selection = sourceSelection
    source = value
    eventCount = max(eventCount, acknowledged)
    ranges = []; sizes = [:]; analyzedSource = value
    history.removeAllActions()
    refreshPresentation(selection: NSRange(location: min(selection.location, sourceLength), length: 0))
    analyze()
  }
  func selectSource(start: Int, end: Int) {
    guard !composing else { return }
    let lo = max(0, min(start, end, sourceLength)), hi = max(0, min(max(start, end), sourceLength))
    refreshPresentation(selection: NSRange(location: lo, length: hi - lo))
    scrollRangeToVisible(selectedRange)
    emitSelection()
  }
  func focusInput() {
    guard owner?.configuration.editable == true else { return }
    if window == nil { waitingForWindowFocus = true; return }
    becomeFirstResponder()
  }
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil && waitingForWindowFocus { waitingForWindowFocus = false; focusInput() }
  }
  func setPreviewSizes(_ values: EditorPreviewSizes) {
    guard Int(values.eventCount) == eventCount else { return }
    var changed = false
    for value in values.sizes {
      let key = "\(Int(value.start)):\(Int(value.end))"
      let height = max(1, CGFloat(value.height))
      if sizes[key] != height { sizes[key] = height; changed = true }
    }
    if changed { refreshPresentation() }
  }

  private func analyze() {
    let snapshot = source
    serial += 1
    let request = serial
    MarkdownEditorAnalyzer.analyze(snapshot) { [weak self] values in
      guard let self, !self.disposed, self.serial == request, self.source == snapshot else { return }
      var parsed: [SourceRange] = []
      for i in stride(from: 0, to: values.count - values.count % 3, by: 3) {
        let r = SourceRange(start: values[i].intValue, end: values[i + 1].intValue, kind: values[i + 2].intValue)
        if r.start >= 0 && r.end > r.start && r.end <= self.sourceLength { parsed.append(r) }
      }
      self.ranges = parsed; self.analyzedSource = snapshot
      let keys = Set(parsed.filter(\.isBlock).map { self.sizeKey($0) })
      self.sizes = self.sizes.filter { keys.contains($0.key) }
      self.refreshPresentation()
    }
  }

  private func refreshPresentation(selection requested: NSRange? = nil) {
    guard !disposed, !styling, !composing, !nativeEditPending, let p = owner else { return }
    let selection = requested ?? sourceSelection
    let blocks = ranges.filter { $0.isBlock }
    let folded = blocks.filter { p.previews && p.configuration.multiline && !(isFirstResponder && $0.intersectsSelection(selection)) }
    var replacements = folded.map { EditorReplacement(source: $0, text: "") }
    if p.previews && p.typographer {
      let substitutions = ["©", "®", "™", "§", "±", "…", "???", "!!!", ",", "–", "—", ".."]
      replacements += ranges.filter { r in (100...111).contains(r.kind) && !(isFirstResponder && r.intersectsSelection(selection)) && !blocks.contains { $0.start < r.end && $0.end > r.start } }.map { EditorReplacement(source: $0, text: substitutions[$0.kind - 100]) }
    }
    let next = EditorProjection(source: source, replacements: replacements)
    let styled = NSMutableAttributedString(string: next.text, attributes: baseAttributes())
    if p.previews {
      for r in ranges where r.kind < 20 || (200...213).contains(r.kind) {
        if next.segments.contains(where: { $0.source.start <= r.start && $0.source.end >= r.end }) { continue }
        let display = next.displaySelection(r.range)
        guard display.length > 0, NSMaxRange(display) <= styled.length else { continue }
        applyRangeStyle(r, display: display, text: styled)
      }
    }
    let raw = source as NSString
    for segment in next.segments {
      let attachment = SourceAttachment(original: raw.substring(with: segment.source.range), kind: segment.source.kind)
      if segment.source.isBlock {
        // A nil image makes UIKit draw its generic document placeholder.
        // Reserve transparent space for the React preview instead.
        attachment.image = SourceAttachment.transparentImage
        attachment.bounds = CGRect(x: 0, y: sourceFont.descender, width: availableWidth, height: sizes[sizeKey(segment.source)] ?? 80)
      } else {
        let attributes: [NSAttributedString.Key: Any] = [.font: sourceFont, .foregroundColor: UIColor(markdown: p.textColor)]
        let value = segment.text as NSString
        let size = value.size(withAttributes: attributes)
        attachment.image = UIGraphicsImageRenderer(size: CGSize(width: max(1, ceil(size.width)), height: max(1, ceil(size.height)))).image { _ in value.draw(at: .zero, withAttributes: attributes) }
        attachment.bounds = CGRect(x: 0, y: sourceFont.descender, width: ceil(size.width), height: ceil(size.height))
      }
      styled.setAttributes([.attachment: attachment, .font: sourceFont], range: segment.display)
    }
    styling = true
    history.disableUndoRegistration()
    let scroll = contentOffset
    // Change only the differing substring, preserving the native text storage,
    // input session, and unaffected text while asynchronous analysis completes.
    let old = Array(textStorage.string.utf16), new = Array(next.text.utf16)
    var prefix = 0
    while prefix < min(old.count, new.count) && old[prefix] == new[prefix] { prefix += 1 }
    var suffix = 0
    while suffix < min(old.count, new.count) - prefix && old[old.count - 1 - suffix] == new[new.count - 1 - suffix] { suffix += 1 }
    // Never split a UTF-16 surrogate pair at an edit boundary.
    if prefix > 0 && prefix < new.count && (0xdc00...0xdfff).contains(new[prefix]) { prefix -= 1 }
    if suffix > 0 && suffix < new.count - prefix && (0xdc00...0xdfff).contains(new[new.count - suffix]) { suffix -= 1 }
    textStorage.beginEditing()
    if old != new {
      textStorage.replaceCharacters(in: NSRange(location: prefix, length: old.count - prefix - suffix), with: (next.text as NSString).substring(with: NSRange(location: prefix, length: new.count - prefix - suffix)))
    }
    if styled.length > 0 {
      styled.enumerateAttributes(in: NSRange(location: 0, length: styled.length)) { attrs, range, _ in self.textStorage.setAttributes(attrs, range: range) }
    }
    textStorage.endEditing()
    projection = next
    selectedRange = next.displaySelection(selection)
    typingAttributes = baseAttributes()
    history.enableUndoRegistration()
    styling = false
    if isScrollEnabled { setContentOffset(scroll, animated: false) }
    placeholderLabel.isHidden = !source.isEmpty
    setNeedsLayout()
    emitLayout()
  }

  private func applyRangeStyle(_ r: SourceRange, display: NSRange, text: NSMutableAttributedString) {
    guard let p = owner else { return }
    let current = text.attribute(.font, at: display.location, effectiveRange: nil) as? UIFont ?? sourceFont
    switch r.kind {
    case 0: text.addAttribute(.foregroundColor, value: UIColor(markdown: p.delimiterColor), range: display)
    case 1, 2:
      var traits = current.fontDescriptor.symbolicTraits
      traits.insert(r.kind == 1 ? .traitBold : .traitItalic)
      if let descriptor = current.fontDescriptor.withSymbolicTraits(traits) { text.addAttribute(.font, value: UIFont(descriptor: descriptor, size: current.pointSize), range: display) }
    case 3: text.addAttribute(.strikethroughStyle, value: NSUnderlineStyle.single.rawValue, range: display)
    case 4, 8: text.addAttribute(.font, value: UIFont.monospacedSystemFont(ofSize: current.pointSize, weight: .regular), range: display)
    case 5: text.addAttribute(.foregroundColor, value: UIColor(markdown: p.quoteColor), range: display)
    case 6:
      text.addAttributes([.foregroundColor: UIColor(markdown: p.linkColor), .underlineStyle: NSUnderlineStyle.single.rawValue], range: display)
    case 7:
      let paragraph = (text.attribute(.paragraphStyle, at: display.location, effectiveRange: nil) as? NSParagraphStyle)?.mutableCopy() as? NSMutableParagraphStyle ?? NSMutableParagraphStyle()
      paragraph.headIndent = 14; paragraph.firstLineHeadIndent = 14
      text.addAttributes([quoteAttribute: UIColor(markdown: p.quoteColor), .paragraphStyle: paragraph], range: display)
    case 11...16:
      let scale: CGFloat = r.kind == 11 ? 1.8 : r.kind == 12 ? 1.5 : r.kind == 13 ? 1.3 : 1.1
      text.addAttribute(.font, value: current.withSize(current.pointSize * scale), range: display)
    default: break
    }
    guard let custom = p.inlineStyles.first(where: { Int($0.kind) == r.kind }) else { return }
    if custom.hasColor { text.addAttribute(.foregroundColor, value: UIColor(markdown: custom.color), range: display) }
    if r.kind == 7 && custom.hasColor { text.addAttribute(quoteAttribute, value: UIColor(markdown: custom.color), range: display) }
    if custom.hasBackground { text.addAttribute(.backgroundColor, value: UIColor(markdown: custom.backgroundColor), range: display) }
    if !custom.decoration.isEmpty {
      text.addAttribute(.underlineStyle, value: custom.decoration.contains("underline") ? 1 : 0, range: display)
      text.addAttribute(.strikethroughStyle, value: custom.decoration.contains("line-through") ? 1 : 0, range: display)
    }
    let original = text.attribute(.font, at: display.location, effectiveRange: nil) as? UIFont ?? current
    if custom.fontSize > 0 || !custom.fontFamily.isEmpty || !custom.fontWeight.isEmpty || !custom.fontStyle.isEmpty {
      text.addAttribute(.font, value: makeFont(family: custom.fontFamily, weight: custom.fontWeight, italic: custom.fontStyle.isEmpty ? original.fontDescriptor.symbolicTraits.contains(.traitItalic) : custom.fontStyle == "italic", size: custom.fontSize > 0 ? CGFloat(custom.fontSize) * fontScale : original.pointSize, original: original), range: display)
    }
  }

  private func decodePresentation() -> (String, EditorProjection) {
    let visible = textStorage.string as NSString
    var result = "", cursor = 0
    var replacements: [EditorReplacement] = []
    if visible.length > 0 {
      textStorage.enumerateAttribute(.attachment, in: NSRange(location: 0, length: visible.length)) { value, range, _ in
        guard let attachment = value as? SourceAttachment else { return }
        result += visible.substring(with: NSRange(location: cursor, length: range.location - cursor))
        let start = (result as NSString).length
        result += attachment.original
        replacements.append(EditorReplacement(source: SourceRange(start: start, end: (result as NSString).length, kind: attachment.kind), text: ""))
        cursor = NSMaxRange(range)
      }
    }
    result += visible.substring(from: cursor)
    return (result, EditorProjection(source: result, replacements: replacements))
  }
  private func snapshot() -> Snapshot { Snapshot(text: source, selection: sourceSelection) }
  private func registerUndo(_ previous: Snapshot) {
    guard !restoringHistory else { return }
    history.registerUndo(withTarget: self) { $0.restore(previous) }
    history.setActionName("Edit Markdown")
  }
  private func restore(_ previous: Snapshot) {
    let current = snapshot()
    history.registerUndo(withTarget: self) { $0.restore(current) }
    restoringHistory = true
    source = previous.text; ranges = []; sizes = [:]; analyzedSource = source
    eventCount += 1
    refreshPresentation(selection: previous.selection)
    changed(); analyze()
    restoringHistory = false
  }
  private func reenableNativeUndo() {
    if nativeEditPending { nativeEditPending = false; history.enableUndoRegistration() }
  }
  private func shiftedRanges(from previous: String, to next: String) {
    let a = Array(previous.utf16), b = Array(next.utf16)
    var first = 0, tail = 0
    while first < min(a.count, b.count) && a[first] == b[first] { first += 1 }
    while tail < min(a.count, b.count) - first && a[a.count - tail - 1] == b[b.count - tail - 1] { tail += 1 }
    let edit = NSRange(location: first, length: a.count - first - tail), added = b.count - first - tail
    var nextSizes: [String: CGFloat] = [:]
    for r in ranges where r.isBlock {
      if let shifted = r.projectedEdit(edit, replacementLength: added), let height = sizes[sizeKey(r)] { nextSizes[sizeKey(shifted)] = height }
    }
    sizes = nextSizes
    ranges = ranges.compactMap { $0.projectedEdit(edit, replacementLength: added) }
    analyzedSource = next
  }
  func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
    guard !styling, let p = owner, p.configuration.editable else { return false }
    if text == "\n" && p.configuration.submitBehavior != "newline" && !composing { submit(); return false }
    let sourceRange = projection.sourceSelection(range), limit = Int(p.configuration.maxLength)
    if limit >= 0 && !composing && sourceLength - sourceRange.length + (text as NSString).length > limit {
      let available = max(0, limit - sourceLength + sourceRange.length)
      var allowed = ""
      for character in text {
        let candidate = allowed + String(character)
        if (candidate as NSString).length > available { break }
        allowed = candidate
      }
      if !allowed.isEmpty || sourceRange.length > 0 { replaceSource(sourceRange, with: allowed) }
      return false
    }
    if !nativeEditPending {
      beforeEdit = snapshot(); nativeEditPending = true
      // Register undo in source coordinates; native projected offsets can move
      // when an earlier block folds. Composition is grouped on commit below.
      history.disableUndoRegistration()
    }
    return true
  }
  func textViewDidChange(_ textView: UITextView) {
    guard !styling else { return }
    reenableNativeUndo()
    let previous = beforeEdit ?? snapshot()
    beforeEdit = nil
    let (next, liveProjection) = decodePresentation()
    let changedSource = next != source
    if changedSource { shiftedRanges(from: source, to: next); source = next; eventCount += 1 }
    projection = liveProjection
    if composing {
      if compositionStart == nil { compositionStart = previous }
    } else if compositionStart == nil && changedSource { registerUndo(previous) }
    placeholderLabel.isHidden = !source.isEmpty
    if changedSource { changed(); analyze() }
    finishComposition(); refreshPresentation(); emitSelection()
  }
  func textViewDidChangeSelection(_ textView: UITextView) {
    guard !styling, !nativeEditPending else { return }
    // UIKit can report selection before didChange (programmatic insertText,
    // dictation, and replacement APIs need not call shouldChange first).
    // Never re-style against an older source while live storage has new text.
    if decodePresentation().0 != source { textViewDidChange(self); return }
    finishComposition()
    if !composing { refreshPresentation() }
    emitSelection()
  }
  private func finishComposition() {
    guard !composing else { return }
    if let start = compositionStart {
      compositionStart = nil
      let limited = limitedEditorSource(previous: start.text, proposed: source, maximum: Int(owner?.configuration.maxLength ?? -1))
      if limited != source {
        let selection = sourceSelection
        let removed = sourceLength - (limited as NSString).length
        shiftedRanges(from: source, to: limited)
        source = limited; eventCount += 1
        refreshPresentation(selection: NSRange(location: max(0, min(sourceLength, selection.location - removed)), length: 0))
        changed(); analyze()
      }
      if start.text != source { registerUndo(start) }
    }
    if let pending = pendingExternal { pendingExternal = nil; setSource(pending.0, acknowledged: pending.1) }
  }
  private func replaceSource(_ range: NSRange, with text: String) {
    let previous = snapshot(), next = (source as NSString).replacingCharacters(in: range, with: text)
    guard next != source else { return }
    registerUndo(previous); shiftedRanges(from: source, to: next)
    source = next; eventCount += 1
    refreshPresentation(selection: NSRange(location: range.location + (text as NSString).length, length: 0))
    changed(); emitSelection(); analyze()
  }
  private func changed() {
    let selection = sourceSelection
    owner?.onChange?(EditorChange(selectionStart: Double(selection.location), selectionEnd: Double(NSMaxRange(selection)), text: source, eventCount: Double(eventCount), target: target))
    emitLayout()
  }
  private func emitSelection() {
    let selection = sourceSelection
    owner?.onSelection?(EditorSelection(start: Double(selection.location), end: Double(NSMaxRange(selection))))
  }
  override var keyCommands: [UIKeyCommand]? {
    var commands = super.keyCommands ?? []
    if owner?.configuration.multiline == true {
      commands.append(UIKeyCommand(input: "\r", modifierFlags: .shift, action: #selector(insertSourceNewline(_:))))
    }
    return commands
  }
  @objc private func insertSourceNewline(_ command: UIKeyCommand) {
    guard let p = owner, p.configuration.editable, p.configuration.multiline else { return }
    let range = sourceSelection
    if p.configuration.maxLength >= 0 && sourceLength - range.length + 1 > Int(p.configuration.maxLength) { return }
    replaceSource(range, with: "\n")
  }
  private func submit() {
    guard let p = owner, p.configuration.editable else { return }
    p.onSubmit?(EditorEvent(text: source, eventCount: Double(eventCount), target: target))
    if p.configuration.submitBehavior == "blurAndSubmit" { resignFirstResponder() }
  }
  func textViewDidBeginEditing(_ textView: UITextView) {
    owner?.setFocused(true)
    owner?.onFocusChanged?(EditorFocus(focused: true, text: source, eventCount: Double(eventCount), target: target))
    if owner?.configuration.selectTextOnFocus == true { selectSource(start: 0, end: sourceLength) } else { refreshPresentation() }
  }
  func textViewDidEndEditing(_ textView: UITextView) {
    owner?.setFocused(false)
    reenableNativeUndo(); finishComposition()
    owner?.onFocusChanged?(EditorFocus(focused: false, text: source, eventCount: Double(eventCount), target: target))
    refreshPresentation()
  }
  override func unmarkText() {
    super.unmarkText()
    guard !styling else { return }
    finishComposition()
    refreshPresentation()
  }
  override func insertText(_ text: String) {
    if !nativeEditPending && !composing {
      guard self.textView(self, shouldChangeTextIn: selectedRange, replacementText: text) else { return }
    }
    super.insertText(text)
    if nativeEditPending { textViewDidChange(self) }
  }
  override func caretRect(for position: UITextPosition) -> CGRect {
    owner?.configuration.caretHidden == true ? .zero : super.caretRect(for: position)
  }
  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    if owner?.configuration.contextMenuHidden == true { return false }
    return super.canPerformAction(action, withSender: sender)
  }
  override func copy(_ sender: Any?) {
    let range = sourceSelection
    if range.length > 0 { UIPasteboard.general.string = (source as NSString).substring(with: range) }
  }
  override func cut(_ sender: Any?) {
    guard owner?.configuration.editable == true else { return }
    copy(sender); replaceSource(sourceSelection, with: "")
  }
  override func paste(_ sender: Any?) {
    guard owner?.configuration.editable == true, let text = UIPasteboard.general.string else { return }
    if self.textView(self, shouldChangeTextIn: selectedRange, replacementText: text) {
      reenableNativeUndo(); beforeEdit = nil
      replaceSource(sourceSelection, with: text)
    }
  }
  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool { true }
  @objc private func previewTapped(_ gesture: UITapGestureRecognizer) {
    guard gesture.state == .ended, layoutManager.numberOfGlyphs > 0 else { return }
    let point = gesture.location(in: self)
    let location = CGPoint(x: point.x - textContainerInset.left, y: point.y - textContainerInset.top)
    let glyph = layoutManager.glyphIndex(for: location, in: textContainer)
    let character = layoutManager.characterIndexForGlyph(at: glyph)
    guard let segment = projection.segments.first(where: { $0.source.isBlock && NSLocationInRange(character, $0.display) }) else { return }
    let rect = layoutManager.boundingRect(forGlyphRange: layoutManager.glyphRange(forCharacterRange: segment.display, actualCharacterRange: nil), in: textContainer)
    guard rect.contains(location) else { return }
    let original = (source as NSString).substring(with: segment.source.range) as NSString
    let newline = original.range(of: "\n")
    let offset = segment.source.kind == 23 ? segment.source.start + 1 : newline.location != NSNotFound ? segment.source.start + NSMaxRange(newline) : min(segment.source.end, segment.source.start + 2)
    focusInput(); selectSource(start: offset, end: offset)
  }
  private func emitTouch(_ phase: String, touch: UITouch) {
    let point = touch.location(in: self), page = touch.location(in: window)
    owner?.onTouch?(EditorTouch(phase: phase, x: point.x - contentOffset.x, y: point.y - contentOffset.y, pageX: page.x, pageY: page.y, timestamp: touch.timestamp * 1000, target: target))
  }
  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    if let touch = touches.first { touchOrigin = touch.location(in: self); touchMoved = false; emitTouch("start", touch: touch) }
    super.touchesBegan(touches, with: event)
  }
  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
    if let touch = touches.first, let origin = touchOrigin {
      let next = touch.location(in: self)
      if hypot(next.x - origin.x, next.y - origin.y) > 8 { touchMoved = true }
    }
    super.touchesMoved(touches, with: event)
  }
  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    if let touch = touches.first { emitTouch("end", touch: touch); if !touchMoved { emitTouch("press", touch: touch) } }
    touchOrigin = nil
    super.touchesEnded(touches, with: event)
  }
  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
    if let touch = touches.first { emitTouch("end", touch: touch) }
    touchOrigin = nil
    super.touchesCancelled(touches, with: event)
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    if abs(lastWidth - bounds.width) > 0.5 { lastWidth = bounds.width; refreshPresentation() }
    let width = max(0, bounds.width - textContainerInset.left - textContainerInset.right)
    let placeholderSize = placeholderLabel.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    placeholderLabel.frame = CGRect(x: textContainerInset.left, y: textContainerInset.top, width: width, height: placeholderSize.height)
    let contentHeight = layoutManager.usedRect(for: textContainer).height + textContainerInset.top + textContainerInset.bottom
    let surplus = max(0, bounds.height - contentHeight), vertical = owner?.textAttributes.textAlignVertical
    let top = vertical == "bottom" ? surplus : vertical == "center" ? surplus / 2 : 0
    if abs(contentInset.top - top) > 0.5 { contentInset.top = top }
    emitLayout()
  }
  func scrollViewDidScroll(_ scrollView: UIScrollView) { emitLayout() }
  private func emitLayout() {
    guard !disposed, !emitPosted else { return }
    emitPosted = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.emitPosted = false
      guard !self.disposed, self.bounds.width > 0, !self.styling else { return }
      self.layoutManager.ensureLayout(for: self.textContainer)
      let blocks = self.ranges.filter(\.isBlock).map { r -> EditorBlock in
        let segment = self.projection.segments.first { $0.source == r }
        let display = segment?.display ?? self.projection.displaySelection(r.range)
        var rect = CGRect.zero
        if display.length > 0 && NSMaxRange(display) <= self.textStorage.length {
          rect = self.layoutManager.boundingRect(forGlyphRange: self.layoutManager.glyphRange(forCharacterRange: display, actualCharacterRange: nil), in: self.textContainer)
        }
        return EditorBlock(kind: r.kind == 21 ? "fence" : r.kind == 22 ? "latex_block" : "table", start: Double(r.start), end: Double(r.end), active: segment == nil,
          x: self.textContainerInset.left - self.contentOffset.x, y: rect.minY + self.textContainerInset.top - self.contentOffset.y,
          width: self.availableWidth, height: self.sizes[self.sizeKey(r)] ?? 80)
      }
      let used = self.layoutManager.usedRect(for: self.textContainer), p = self.owner
      let lineHeight = p?.textAttributes.lineHeight ?? 0
      let preferred = (lineHeight > 0 ? lineHeight : Double(self.sourceFont.lineHeight)) * (p?.configuration.numberOfLines ?? 1) + Double(self.textContainerInset.top + self.textContainerInset.bottom)
      let width = Double(used.width + self.textContainerInset.left + self.textContainerInset.right)
      let height = Double(used.height + self.textContainerInset.top + self.textContainerInset.bottom)
      let metricKey = "\(width):\(height):\(preferred):\(self.target)"
      if metricKey != self.lastMetrics { self.lastMetrics = metricKey; p?.onMetrics?(EditorMetrics(width: width, height: height, preferredHeight: preferred, target: self.target)) }
      let key = "\(self.eventCount):\(self.source):" + blocks.map { "\($0.start):\($0.end):\($0.active):\($0.x):\($0.y):\($0.width):\($0.height)" }.joined(separator: "|")
      if key != self.lastLayout { self.lastLayout = key; p?.onBlocks?(EditorLayout(text: self.source, eventCount: Double(self.eventCount), blocks: blocks)) }
    }
  }
  @objc private func fontScaleChanged() { applyProperties() }
  func dispose() {
    disposed = true; serial += 1; contentSizeObserver = nil
    NotificationCenter.default.removeObserver(self)
    resignFirstResponder(); delegate = nil; owner = nil; history.removeAllActions()
  }
}
