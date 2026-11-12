import React from 'react'
import { Image, Text, View } from 'react-native'
import { RaTeXView } from 'ratex-react-native'
import type { RenderRules } from 'react-native-markdown-display'

export const legacyRules: RenderRules = {
  fence: (node, _children, _parents, styles) => <View key={node.key}>
    <View style={styles.fenceHeader}><Text style={{ color: '#d7c8eb' }}>Code</Text></View>
    <Text selectable style={styles.fence}>{node.content}</Text>
  </View>,
  double_quote: (node, children, _parents, styles) => <Text key={node.key} style={styles.double_quote}>{children}</Text>,
  latex_block: (node, _children, _parents, styles) => <RaTeXView key={node.key} latex={node.content} displayMode fontSize={styles.latex_block?.fontSize ?? 16} color={styles.latex_block?.color ?? '#252337'} style={{ marginVertical: 8 }} />,
  latex_inline: (node, _children, _parents, styles) => <RaTeXView key={node.key} latex={node.content} displayMode={false} fontSize={styles.latex_inline?.fontSize ?? 16} color={styles.latex_inline?.color ?? '#252337'} style={{ alignSelf: 'baseline' }} />,
  textgroup: (node, children, _parents, styles) => <Text key={node.key} style={styles.textgroup}>{children}</Text>,
  inline: (node, children, _parents, styles) => <Text key={node.key} style={styles.inline}>{children}</Text>,
  image: (node) => <Image key={node.key} source={{ uri: node.attributes.src }} style={{ width: 240, height: 140, borderRadius: 8 }} resizeMode="contain" />,
}
