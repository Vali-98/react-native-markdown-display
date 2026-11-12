// Local substitutes for ChatterUI's theme and chat preference stores.
const theme = {
  spacing: { sm: 6, m: 12, l: 18 }, borderRadius: { m: 8 },
  color: {
    primary: { _500: '#7c6ee6' },
    chat: {
      text: '#252337', metadata: '#777185', markdown: {
        quote: '#d69224', emphasis: '#a64d79', link: '#5467bd',
        blockquote: { background: '#f0ecf8', border: '#b8a3d3', text: '#534465' },
        inlineCode: { text: '#85446c', background: '#f4edf3' },
        codeBlock: { text: '#e6def4', background: '#282333', headerBackground: '#3e354e', headerText: '#d7c8eb' },
        table: { border: '#d3c8df', headerBackground: '#e9e1f0', background: '#faf7fc' },
      },
    },
  },
}
export const Theme = { useTheme: () => theme }
export const ChatStyle = {
  MIN_FONT_SIZE: 10,
  sizeModifierMap: { normal: 0 }, weightModifierMap: { normal: 0 },
  useChatStyle: () => ({ fontSize: 'normal' as const, textWeight: 'normal' as const }),
}
