// Stack-based correction of the reference plugin. Each text fragment has balanced
// wrappers, so quote boundaries cannot cross Markdown emphasis/link token nesting.
module.exports = function doubleQuotePlugin(md) {
  md.core.ruler.after('inline', 'double_quote', function (state) {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      const stack = []
      const children = []
      const emit = (content, depth) => {
        if (!content) return
        for (let i = 0; i < depth; i++) children.push(new state.Token('double_quote_open', 'span', 1))
        const text = new state.Token('text', '', 0)
        text.content = content
        children.push(text)
        for (let i = 0; i < depth; i++) children.push(new state.Token('double_quote_close', 'span', -1))
      }
      for (const token of block.children) {
        if (token.type !== 'text') { children.push(token); continue }
        let start = 0
        for (let i = 0; i < token.content.length; i++) {
          const ch = token.content[i]
          if (!['“', '„', '‟', '”', '"', '«', '»'].includes(ch)) continue
          emit(token.content.slice(start, i), stack.length)
          const oldDepth = stack.length
          if (['“', '„', '‟'].includes(ch)) stack.push('curly')
          else if (ch === '«') stack.push('guillemet')
          else if (ch === '"') {
            if (stack[stack.length - 1] === 'ascii') stack.pop()
            else stack.push('ascii')
          } else if (stack[stack.length - 1] === (ch === '»' ? 'guillemet' : 'curly')) stack.pop()
          emit(ch, Math.max(oldDepth, stack.length))
          start = i + 1
        }
        emit(token.content.slice(start), stack.length)
      }
      block.children = children
    }
  })
}
