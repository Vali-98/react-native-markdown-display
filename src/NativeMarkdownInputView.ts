import { Platform } from 'react-native'
import { getHostComponent } from 'react-native-nitro-modules'
import type { MarkdownInputViewMethods, MarkdownInputViewProps } from './specs/MarkdownInputView.nitro'
import viewConfig from '../nitrogen/generated/shared/json/MarkdownInputViewConfig.json'

// Keep native registration outside the component's Fast Refresh boundary.
export const NativeMarkdownInputView = Platform.OS === 'android'
  ? getHostComponent<MarkdownInputViewProps, MarkdownInputViewMethods>('MarkdownInputView', () => viewConfig)
  : undefined
