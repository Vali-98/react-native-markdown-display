package com.margelo.nitro.valimarkdown

import android.graphics.Color
import android.util.TypedValue
import android.view.inputmethod.InputMethodManager
import android.content.Context
import com.facebook.react.uimanager.ThemedReactContext
import com.valimarkdown.MarkdownEditorView

class HybridMarkdownInputView(context: ThemedReactContext): HybridMarkdownInputViewSpec() {
  private val editor = MarkdownEditorView(context)
  override val view: android.view.View get() = editor
  override var state = EditorState("", 0.0)
    set(value) { field=value;editor.setSource(value.text,value.eventCount.toInt()) }
  override var previewSizes = EditorPreviewSizes(0.0, emptyArray())
    set(value) {field=value;editor.setPreviewSizes(value.eventCount.toInt(),value.sizes.map {Triple(it.start.toInt(),it.end.toInt(),it.height)})}
  override var placeholder = ""
    set(value) {field=value;editor.hint=value}
  override var textColor = "#202124"
    set(value) {field=value;editor.setTextColor(Color.parseColor(value))}
  override var delimiterColor = "#92979f"
    set(value) {field=value;editor.delimiterColorValue=Color.parseColor(value);editor.restyle()}
  override var fontSize = 16.0
    set(value) {field=value;editor.setTextSize(TypedValue.COMPLEX_UNIT_SP,value.toFloat());editor.restyle()}
  override var editable = true
    set(value) {field=value;editor.isEnabled=value}
  override var previews = true
    set(value) {field=value;editor.previewsEnabled=value;editor.restyle()}
  override var typographer = false
    set(value) {field=value;editor.typographerEnabled=value;editor.restyle()}
  override var quoteColor = "#8a4b9d"
    set(value) {field=value;editor.quoteColorValue=Color.parseColor(value);editor.restyle()}
  override var linkColor = "#2674d9"
    set(value) {field=value;editor.linkColorValue=Color.parseColor(value);editor.restyle()}
  override var onChange: ((EditorChange)->Unit)? = null
  override var onSelection: ((EditorSelection)->Unit)? = null
  override var onBlocks: ((EditorLayout)->Unit)? = null
  init {
    editor.change={onChange?.invoke(it)}
    editor.selection={onSelection?.invoke(it)}
    editor.blocksChanged={onBlocks?.invoke(it)}
  }
  override fun onDropView() {editor.dispose()}
  override fun focus() {editor.post {editor.requestFocus();keyboard().showSoftInput(editor,InputMethodManager.SHOW_IMPLICIT)}}
  override fun blur() {editor.post {editor.clearFocus();keyboard().hideSoftInputFromWindow(editor.windowToken,0)}}
  override fun activate(offset: Double) {editor.post {editor.requestFocus();editor.setSelection(offset.toInt().coerceIn(0,editor.text.length));keyboard().showSoftInput(editor,InputMethodManager.SHOW_IMPLICIT)}}
  private fun keyboard()=editor.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
}
