import React from 'react'
import { Image, Text, View } from 'react-native'
import { RaTeXView } from 'ratex-react-native'
import type { RenderRules } from '@vali98/react-native-markdown-display'

// Adapted from the reference rules. App-specific components are replaced with
// RN primitives, with native RaTeX for math in this example only.
export const markdownRules: RenderRules = {
  fence: ({ children, styles }) => (
    <View>
      <View style={styles.fenceHeader}><Text style={{ color: '#d7c8eb' }}>Code</Text></View>
      <Text selectable style={styles.fence}>{children}</Text>
    </View>
  ),
  double_quote: ({ children, styles }) => <Text style={styles.double_quote}>{children}</Text>,
  latex_block: ({ node, styles }) => <RaTeXView latex={node.content} displayMode fontSize={styles.latex_block?.fontSize ?? 16} color={styles.latex_block?.color ?? '#252337'} style={{ marginVertical: 8 }} />,
  latex_inline: ({ node, styles }) => <RaTeXView latex={node.content} displayMode={false} fontSize={styles.latex_inline?.fontSize ?? 16} color={styles.latex_inline?.color ?? '#252337'} style={{ alignSelf: 'baseline' }} />,
  textgroup: ({ children, styles }) => <Text style={styles.textgroup}>{children}</Text>,
  inline: ({ children, styles }) => <Text style={styles.inline}>{children}</Text>,
  image: ({ node }) => <Image source={{ uri: node.destination }} style={{ width: 240, height: 140, borderRadius: 8 }} resizeMode="contain" />,
}
