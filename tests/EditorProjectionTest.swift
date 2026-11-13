import Foundation

@main struct EditorProjectionTest {
  static func main() {
    let source = "😀 intro\n```ts\nlet x = 1\n```\nafter (c)!"
    let raw = source as NSString
    let block = raw.range(of: "```ts\nlet x = 1\n```")
    let symbol = raw.range(of: "(c)")
    let projection = EditorProjection(source: source, replacements: [
      EditorReplacement(source: SourceRange(start: block.location, end: NSMaxRange(block), kind: 21), text: ""),
      EditorReplacement(source: SourceRange(start: symbol.location, end: NSMaxRange(symbol), kind: 100), text: "©")
    ])
    precondition(projection.text == "😀 intro\n\u{fffc}\nafter \u{fffc}!")
    for offset in 0...raw.length {
      let inside = projection.segments.contains { offset > $0.source.start && offset < $0.source.end }
      if !inside { precondition(projection.sourceOffset(projection.displayOffset(offset)) == offset, "Round trip at \(offset)") }
    }
    let segment = projection.segments[0]
    precondition(projection.sourceSelection(segment.display) == block)
    precondition(projection.displaySelection(block) == segment.display)
    precondition(projection.displayOffset(block.location + 3) == segment.display.location)
    precondition(projection.displayOffset(block.location + 3, trailing: true) == NSMaxRange(segment.display))
    let whole = NSRange(location: 0, length: raw.length)
    precondition(projection.sourceSelection(projection.displaySelection(whole)) == whole)
    let selected = NSRange(location: block.location + 3, length: 2)
    precondition(projection.displaySelection(selected) == segment.display)
    let range = SourceRange(start: 10, end: 20, kind: 21)
    precondition(range.projectedEdit(NSRange(location: 0, length: 2), replacementLength: 5) == SourceRange(start: 13, end: 23, kind: 21))
    precondition(range.projectedEdit(NSRange(location: 12, length: 0), replacementLength: 1) == nil)
    let inline = SourceRange(start: 10, end: 20, kind: 1)
    precondition(inline.projectedEdit(NSRange(location: 12, length: 2), replacementLength: 3) == SourceRange(start: 10, end: 21, kind: 1))
    precondition(range.intersectsSelection(NSRange(location: 10, length: 0)))
    precondition(range.intersectsSelection(NSRange(location: 20, length: 0)))
    precondition(!range.intersectsSelection(NSRange(location: 20, length: 1)))
    let empty = EditorProjection(source: "", replacements: [])
    precondition(empty.sourceOffset(9) == 0 && empty.displayOffset(9) == 0)
    precondition(limitedEditorSource(previous: "ab!", proposed: "ab日本語!", maximum: 5) == "ab日本!")
    precondition(limitedEditorSource(previous: "a!", proposed: "a😀!", maximum: 3) == "a!")
    precondition(limitedEditorSource(previous: "a!", proposed: "a😀!", maximum: 4) == "a😀!")
    precondition(limitedEditorSource(previous: "ab", proposed: "ab🇯🇵", maximum: 5) == "ab")
    precondition(limitedEditorSource(previous: "ab", proposed: "a", maximum: 1) == "a")
    print("Editor projection: UTF-16 mapping, collapsed selection, edit projection, boundaries passed")
  }
}
