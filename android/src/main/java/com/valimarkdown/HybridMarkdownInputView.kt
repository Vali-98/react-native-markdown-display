package com.margelo.nitro.valimarkdown

import android.os.Build
import com.facebook.react.uimanager.ThemedReactContext
import com.valimarkdown.EditorDefaults
import com.valimarkdown.MarkdownEditorView

class HybridMarkdownInputView(context: ThemedReactContext): HybridMarkdownInputViewSpec() {
  internal val editor = MarkdownEditorView(context)
  override val view: android.view.View get() = editor
  override var state = EditorState("", 0.0)
    set(value) {field=value;editor.setSource(value.text,value.eventCount.toInt())}
  private var selectionPending=false
  override var selectionState = EditorSelection(-1.0,-1.0)
    set(value) {field=value;selectionPending=true}
  override var inlineStyles: Array<EditorInlineStyle> = emptyArray()
    set(value) {field=value;editor.inlineStyles=value.toList();editor.restyle()}
  override var configuration = EditorDefaults.configuration
  override var textAttributes = EditorDefaults.textAttributes
  override var previewSizes = EditorPreviewSizes(0.0, emptyArray())
    set(value) {field=value;editor.setPreviewSizes(value.eventCount.toInt(),value.sizes.map {Triple(it.start.toInt(),it.end.toInt(),it.height)})}
  override var placeholder = ""
    set(value) {field=value;editor.hint=value}
  override var textColor = -14671580.0
    set(value) {field=value;editor.setTextColor(value.toLong().toInt())}
  override var placeholderColor = -7178337.0
    set(value) {field=value;editor.setHintTextColor(value.toLong().toInt())}
  override var selectionColor = -7833920.0
    set(value) {field=value;editor.highlightColor=value.toLong().toInt()}
  override var cursorColor = -7833920.0
    set(value) {
      field=value
      if(Build.VERSION.SDK_INT>=29) {
        editor.textCursorDrawable=editor.textCursorDrawable?.mutate()?.apply {setTint(value.toLong().toInt())}
        editor.textSelectHandleLeft?.mutate()?.apply {setTint(value.toLong().toInt())}
        editor.textSelectHandleRight?.mutate()?.apply {setTint(value.toLong().toInt())}
        editor.textSelectHandle?.mutate()?.apply {setTint(value.toLong().toInt())}
      }
    }
  override var delimiterColor = -7178337.0
    set(value) {field=value;editor.delimiterColorValue=value.toLong().toInt();editor.restyle()}
  override var fontSize = 16.0
  override var previews = true
    set(value) {field=value;editor.previewsEnabled=value;editor.restyle()}
  override var typographer = false
    set(value) {field=value;editor.typographerEnabled=value;editor.restyle()}
  override var quoteColor = -7713891.0
    set(value) {field=value;editor.quoteColorValue=value.toLong().toInt();editor.restyle()}
  override var linkColor = -14256935.0
    set(value) {field=value;editor.linkColorValue=value.toLong().toInt();editor.restyle()}
  override var onChange: ((EditorChange)->Unit)? = null
  override var onSelection: ((EditorSelection)->Unit)? = null
  override var onBlocks: ((EditorLayout)->Unit)? = null
  override var onFocusChanged: ((EditorFocus)->Unit)? = null
  override var onSubmit: ((EditorEvent)->Unit)? = null
  override var onTouch: ((EditorTouch)->Unit)? = null
  override var onMetrics: ((EditorMetrics)->Unit)? = null
  init {
    editor.change={onChange?.invoke(it)}
    editor.selection={onSelection?.invoke(it)}
    editor.blocksChanged={onBlocks?.invoke(it)}
    editor.focusChanged={onFocusChanged?.invoke(it)}
    editor.submitted={onSubmit?.invoke(it)}
    editor.touched={onTouch?.invoke(it)}
    editor.measured={onMetrics?.invoke(it)}
  }
  override fun afterUpdate() {
    editor.applyInputProperties(configuration,textAttributes,fontSize)
    if(selectionPending) {
      selectionPending=false
      if(state.eventCount.toInt()>=editor.eventCount && selectionState.start>=0 && selectionState.end>=0) {
        editor.setSelection(selectionState.start.toInt().coerceIn(0,editor.text.length),selectionState.end.toInt().coerceIn(0,editor.text.length))
      }
    }
  }
  override fun onDropView() {editor.dispose()}
  override fun focus() {editor.post {editor.focusInput()}}
  override fun blur() {editor.post {editor.blurInput()}}
  override fun isFocused(): Boolean = editor.hasFocus()
  override fun clear() {editor.post {editor.setSource("",editor.eventCount)}}
  override fun setSelection(start: Double,end: Double) {editor.post {editor.setSelection(start.toInt().coerceIn(0,editor.text.length),end.toInt().coerceIn(0,editor.text.length))}}
  override fun activate(offset: Double) {editor.post {editor.focusInput();editor.setSelection(offset.toInt().coerceIn(0,editor.text.length))}}
}
