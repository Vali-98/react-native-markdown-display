import Foundation

/// All offsets are UTF-16, matching UITextInput, React Native, and C++ analysis.
struct SourceRange: Equatable {
  var start: Int
  var end: Int
  let kind: Int
  var range: NSRange { NSRange(location: start, length: end - start) }
  var isBlock: Bool { (21...23).contains(kind) }

  func projectedEdit(_ edit: NSRange, replacementLength: Int) -> SourceRange? {
    let delta = replacementLength - edit.length
    if end <= edit.location { return self }
    if start >= NSMaxRange(edit) { return SourceRange(start: start + delta, end: end + delta, kind: kind) }
    if !isBlock && start <= edit.location && end >= NSMaxRange(edit) && end + delta > start {
      return SourceRange(start: start, end: end + delta, kind: kind)
    }
    return nil
  }

  func intersectsSelection(_ selection: NSRange) -> Bool {
    if selection.length == 0 { return selection.location >= start && selection.location <= end }
    return selection.location < end && NSMaxRange(selection) > start
  }
}

struct EditorReplacement: Equatable {
  let source: SourceRange
  let text: String
}

/// A collapsed block occupies one attachment character. Source text remains in
/// the attachment and in the editor model; callbacks never expose placeholders.
struct EditorProjection {
  struct Segment {
    let source: SourceRange
    let display: NSRange
    let text: String
  }
  let text: String
  let segments: [Segment]
  let sourceLength: Int

  init(source: String, replacements: [EditorReplacement]) {
    let input = source as NSString
    sourceLength = input.length
    var output = ""
    var cursor = 0
    var result: [Segment] = []
    for replacement in replacements.sorted(by: { $0.source.start < $1.source.start }) {
      let r = replacement.source
      guard r.start >= cursor, r.end <= input.length, r.end > r.start else { continue }
      output += input.substring(with: NSRange(location: cursor, length: r.start - cursor))
      let display = NSRange(location: (output as NSString).length, length: 1)
      output += "\u{fffc}"
      result.append(Segment(source: r, display: display, text: replacement.text))
      cursor = r.end
    }
    output += input.substring(from: cursor)
    text = output
    segments = result
  }

  func sourceOffset(_ offset: Int) -> Int {
    var delta = 0
    for segment in segments {
      if offset <= segment.display.location { break }
      if offset < NSMaxRange(segment.display) { return segment.source.start }
      delta += segment.source.end - segment.source.start - segment.display.length
    }
    return min(sourceLength, max(0, offset + delta))
  }

  func displayOffset(_ offset: Int, trailing: Bool = false) -> Int {
    var delta = 0
    for segment in segments {
      if offset < segment.source.start { break }
      if offset < segment.source.end {
        return segment.display.location + (trailing && offset > segment.source.start ? 1 : 0)
      }
      delta += segment.source.end - segment.source.start - segment.display.length
    }
    return min((text as NSString).length, max(0, offset - delta))
  }

  func sourceSelection(_ selection: NSRange) -> NSRange {
    let start = sourceOffset(selection.location), end = sourceOffset(NSMaxRange(selection))
    return NSRange(location: start, length: max(0, end - start))
  }

  func displaySelection(_ selection: NSRange) -> NSRange {
    let start = displayOffset(selection.location)
    let end = displayOffset(NSMaxRange(selection), trailing: selection.length > 0)
    return NSRange(location: start, length: max(0, end - start))
  }
}

/// Apply a source length limit after an IME commits, preserving unchanged suffix
/// text and avoiding partial surrogate pairs or composed characters.
func limitedEditorSource(previous: String, proposed: String, maximum: Int) -> String {
  let old = previous as NSString, next = proposed as NSString
  guard maximum >= 0, next.length > maximum else { return proposed }
  let a = Array(previous.utf16), b = Array(proposed.utf16)
  var first = 0, tail = 0
  while first < min(a.count, b.count) && a[first] == b[first] { first += 1 }
  // Include the entire composed character at a boundary if its contents changed.
  if first < old.length { first = min(first, old.rangeOfComposedCharacterSequence(at: first).location) }
  if first < next.length { first = min(first, next.rangeOfComposedCharacterSequence(at: first).location) }
  while tail < min(a.count, b.count) - first && a[a.count - tail - 1] == b[b.count - tail - 1] { tail += 1 }
  if tail > 0 && tail < b.count && (0xdc00...0xdfff).contains(b[b.count - tail]) { tail -= 1 }
  let removed = NSRange(location: first, length: old.length - first - tail)
  let inserted = next.substring(with: NSRange(location: first, length: next.length - first - tail))
  let available = max(0, maximum - old.length + removed.length)
  var accepted = ""
  for character in inserted {
    let candidate = accepted + String(character)
    if (candidate as NSString).length > available { break }
    accepted = candidate
  }
  return old.replacingCharacters(in: removed, with: accepted)
}
