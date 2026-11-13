const {test} = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript'), fs = require('node:fs')
const native = {
  I18nManager: {isRTL: false},
  StyleSheet: {flatten: style => Array.isArray(style) ? Object.assign({}, ...style.map(nativeStyle => native.StyleSheet.flatten(nativeStyle))) : style},
  processColor: color => typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16),
}
const output = ts.transpileModule(fs.readFileSync('src/InputCompatibility.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText
const syntax = {}
new Function('exports', ts.transpileModule(fs.readFileSync('src/SyntaxHighlighting.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText)(syntax)
const api = {}
new Function('exports', 'require', output)(api, name => {if(name === './SyntaxHighlighting')return syntax;assert.equal(name, 'react-native'); return native})
const {inputConfiguration: config, inputStyle: style, inputInlineStyles: inline, inputEvent: event} = api

test('single and multiline submit defaults and explicit precedence match TextInput', () => {
  assert.equal(config({}).submitBehavior, 'blurAndSubmit')
  assert.equal(config({multiline: true}).submitBehavior, 'newline')
  assert.equal(config({multiline: true, blurOnSubmit: true}).submitBehavior, 'blurAndSubmit')
  assert.equal(config({blurOnSubmit: false}).submitBehavior, 'submit')
  assert.equal(config({multiline: true, blurOnSubmit: true, submitBehavior: 'submit'}).submitBehavior, 'submit')
})
test('line count, readOnly and native length limits are normalized', () => {
  assert.equal(config({numberOfLines: 8}).numberOfLines, 1)
  assert.equal(config({multiline: true, numberOfLines: 8}).numberOfLines, 8)
  assert.equal(config({editable: true, readOnly: true}).editable, false)
  assert.equal(config({maxLength: 5.7}).maxLength, 5)
  assert.equal(config({}).maxLength, -1)
})
test('text and padding go to the input while borders/background remain view styles', () => {
  const result = style({color: '#123456', backgroundColor: '#ffffff', fontSize: 22, padding: 8, paddingHorizontal: 12, paddingLeft: 18, borderWidth: 2, flex: 1}, {})
  assert.equal(result.color, '#123456')
  assert.equal(result.fontSize, 22)
  assert.equal(result.attributes.paddingLeft, 18)
  assert.equal(result.attributes.paddingRight, 12)
  assert.equal(result.attributes.paddingTop, 8)
  assert.deepEqual(result.outer, {backgroundColor: '#ffffff', borderWidth: 2, flex: 1})
})
test('logical padding follows writing direction and percentage padding uses layout size', () => {
  const result = style({direction: 'rtl', paddingStart: 20, paddingEnd: 4, paddingVertical: '10%'}, {}, 200, 100)
  assert.equal(result.attributes.paddingLeft, 4)
  assert.equal(result.attributes.paddingRight, 20)
  assert.equal(result.attributes.paddingTop, 10)
})
test('Markdown inline styles carry color, background and font decorations independently', () => {
  const styles = inline({double_quote: {color: '#abcdef', fontStyle: 'italic'}, link: {backgroundColor: '#eeeeee', fontWeight: '700', textDecorationLine: 'none'}})
  assert.equal(styles.find(style => style.kind === 5).color, 0xabcdef)
  assert.equal(styles.find(style => style.kind === 5).fontStyle, 'italic')
  const link = styles.find(style => style.kind === 6)
  assert.equal(link.hasColor, false)
  assert.equal(link.hasBackground, true)
  assert.equal(link.fontWeight, '700')
  assert.equal(link.decoration, 'none')
  assert.ok(inline(undefined).every(style => style.kind >= 200))
})
test('callbacks use nativeEvent and preserve text, selection and target', () => {
  const change = event({text: 'hello', eventCount: 3}, 42)
  assert.equal(change.nativeEvent.text, 'hello')
  assert.equal(change.nativeEvent.target, 42)
  const selected = event({selection: {start: 1, end: 4}}, 42)
  assert.deepEqual(selected.nativeEvent.selection, {start: 1, end: 4})
  change.preventDefault();change.stopPropagation()
  assert.equal(change.defaultPrevented, true)
  assert.equal(change.isDefaultPrevented(), true)
  assert.equal(change.isPropagationStopped(), true)
})

test('the component isolates source styling from previews and uses RN focus registration', () => {
  const registryCalls = []
  const registry = Object.fromEntries(['registerInput', 'unregisterInput', 'focusInput', 'blurInput'].map(key => [key, host => registryCalls.push([key, host])]))
  const React = {
    forwardRef: fn => fn, useCallback: fn => fn, useMemo: fn => fn(), useRef: current => ({current}),
    useImperativeHandle: (ref, create) => {ref.current = create()},
    useState: initial => [initial && Array.isArray(initial.blocks) ? {
      text: '$$x$$', eventCount: 0, blocks: [{kind: 'latex_block', start: 0, end: 5, active: false, x: 0, y: 0, width: 100, height: 20}],
    } : initial, () => {}],
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
  }
  const ui = {...native, View: 'View', PixelRatio: {getFontScale: () => 1}, findNodeHandle: () => 42, StyleSheet: {...native.StyleSheet, create: value => value}}
  const output = ts.transpileModule(fs.readFileSync('src/MarkdownInput.tsx', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText
  const module = {}
  new Function('exports', 'require', output)(module, name => {
    if (name === 'react') return React
    if (name === 'react-native') return ui
    if (name === 'react-native/Libraries/Components/TextInput/TextInputState') return {default: registry}
    if (name === 'react-native-nitro-modules') return {callback: f => ({f})}
    if (name === './Markdown') return {Markdown: 'Markdown'}
    if (name === './InputCompatibility') return api
    if (name === './NativeMarkdownInputView') return {NativeMarkdownInputView: 'NativeInput'}
    throw new Error(name)
  })
  const markdownStyle = {paragraph: {fontSize: 32, color: '#abcdef'}}
  const ref = {current: null}
  const tree = module.MarkdownInput({value: '$$x$$', multiline: true, numberOfLines: 8, style: {flex: 1}, textStyle: {color: '#123456', fontSize: 27}, markdownStyle}, ref)
  // A horizontal flex input still needs its own vertical, one-line height.
  assert.equal(native.StyleSheet.flatten(tree.props.style).height, 27 * 1.2 + 24)
  const fixed = module.MarkdownInput({value: '', multiline: true, numberOfLines: 8, viewStyle: {height: 180}}, {current: null})
  assert.equal(native.StyleSheet.flatten(fixed.props.style).height, 180)
  const elements = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    elements.push(value);visit(value.props.children)
  }
  visit(tree)
  const input = elements.find(value => value.type === 'NativeInput')
  const preview = elements.find(value => value.type === 'Markdown')
  assert.equal(input.props.fontSize, 27)
  assert.equal(input.props.textColor, 0x123456)
  assert.equal(preview.props.style, markdownStyle)
  const host = {}
  input.props.ref(host)
  input.props.onFocusChanged.f({focused: true, text: '$$x$$', eventCount: 0, target: 42})
  input.props.onFocusChanged.f({focused: false, text: '$$x$$', eventCount: 0, target: 42})
  input.props.ref(null)
  assert.deepEqual(registryCalls.map(([name]) => name), ['registerInput', 'focusInput', 'blurInput', 'blurInput', 'unregisterInput'])
  assert.equal(typeof ref.current.isFocused, 'function')
  assert.equal(typeof ref.current.getAnimatableRef, 'function')
})
