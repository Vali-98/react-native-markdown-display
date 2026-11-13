package com.valimarkdown

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.text.*
import android.text.method.TransformationMethod
import android.text.style.*
import android.util.Log
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.Gravity
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import android.widget.EditText
import androidx.annotation.Keep
import com.margelo.nitro.valimarkdown.EditorBlock
import com.margelo.nitro.valimarkdown.EditorChange
import com.margelo.nitro.valimarkdown.EditorLayout
import com.margelo.nitro.valimarkdown.EditorSelection
import java.util.concurrent.Executors
import java.util.concurrent.Future
import kotlin.math.max
import kotlin.math.min

@Keep
internal object EditorNative { @JvmStatic external fun analyze(source: String): IntArray }
internal data class SourceRange(val start: Int, val end: Int, val kind: Int)
private interface EditorSpan
private class EditorColor(color: Int): ForegroundColorSpan(color), EditorSpan
private class EditorStyle(style: Int): StyleSpan(style), EditorSpan
private class EditorSize(size: Float): RelativeSizeSpan(size), EditorSpan
private class EditorFont: TypefaceSpan("monospace"), EditorSpan
private class EditorUnderline: UnderlineSpan(), EditorSpan
private class EditorQuote(color: Int): QuoteSpan(color), EditorSpan
private class EditorStrike: StrikethroughSpan(), EditorSpan
private class LayoutPulse: MetricAffectingSpan() {
  override fun updateDrawState(paint: android.text.TextPaint) {}
  override fun updateMeasureState(paint: android.text.TextPaint) {}
}

internal class MarkdownEditorView(context: Context): EditText(context) {
  companion object { private val analyzer = Executors.newFixedThreadPool(2) }
  var change: ((EditorChange) -> Unit)? = null
  var selection: ((EditorSelection) -> Unit)? = null
  var blocksChanged: ((EditorLayout) -> Unit)? = null
  var delimiterColorValue = android.graphics.Color.GRAY
  var previewsEnabled = true
  var typographerEnabled = false
  var quoteColorValue = android.graphics.Color.rgb(138,75,157)
  var linkColorValue = android.graphics.Color.rgb(38,116,217)
  var eventCount = 0
    private set
  private var ready = false
  private var suppress = false
  private var styling = false
  private var previewTouch: SourceRange? = null
  private var touchX = 0f
  private var touchY = 0f
  private var touchMoved = false
  private var oldSelection = 0 to 0
  private var request = 0
  private var work: Future<*>? = null
  private var ranges: List<SourceRange> = emptyList()
  private var analyzedSource = ""
  private val sizes = mutableMapOf<Pair<Int, Int>, Int>()
  private val pulse = LayoutPulse()
  private var previews: List<PreviewSpan> = emptyList()
  private var substitutions: List<TypographySpan> = emptyList()
  private val replacements get() = previews + substitutions
  private var emitPosted = false
  private var lastLayout: EditorLayout? = null
  private val density get() = resources.displayMetrics.density
  private val composing get() = BaseInputConnection.getComposingSpanStart(text) >= 0

  init {
    ready = true
    gravity = Gravity.TOP or Gravity.START
    setPadding((12*density).toInt(),(12*density).toInt(),(12*density).toInt(),(12*density).toInt())
    setSingleLine(false)
    inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    background = null
    transformationMethod = object: TransformationMethod {
      override fun getTransformation(source: CharSequence, view: View): CharSequence = FoldedSource(source)
      override fun onFocusChanged(view: View?, source: CharSequence?, focused: Boolean, direction: Int, rect: Rect?) {}
    }
    addTextChangedListener(object: TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
        if(suppress || styling)return
        val delta=count-before
        fun shifted(range: SourceRange): SourceRange? = when {
          range.end<=start -> range
          range.start>=start+before -> range.copy(start=range.start+delta,end=range.end+delta)
          range.kind !in 21..23 && range.start<=start && range.end>=start+before && range.end+delta>range.start -> range.copy(end=range.end+delta)
          else -> null
        }
        val nextSizes=mutableMapOf<Pair<Int,Int>,Int>()
        for(range in ranges.filter {it.kind in 21..23}) {
          val mapped=shifted(range)
          val height=sizes[range.start to range.end]
          if(mapped!=null && height!=null)nextSizes[mapped.start to mapped.end]=height
        }
        ranges=ranges.mapNotNull {shifted(it)}
        previews=previews.mapNotNull {shifted(it.range)?.let {r -> PreviewSpan(r)}}
        substitutions=substitutions.mapNotNull {shifted(it.range)?.let {r -> TypographySpan(r)}}
        sizes.clear();sizes.putAll(nextSizes)
        analyzedSource=s.toString()
      }
      override fun afterTextChanged(s: Editable?) {
        if(suppress || styling) return
        ++eventCount
        // Present projected ranges immediately, then reconcile with C++ results.
        refreshPresentation()
        emitBlocks()
        change?.invoke(EditorChange(s.toString(),eventCount.toDouble(),selectionStart.toDouble(),selectionEnd.toDouble()))
        analyze()
      }
    })
  }
  fun setSource(value: String, acknowledged: Int) {
    if(acknowledged < eventCount || value == text.toString()) return
    if(composing) { // Delay external replacement until the native composition ends.
      pendingExternal = value to acknowledged; return
    }
    suppress=true
    val cursor=selectionStart.coerceAtLeast(0)
    setText(value)
    setSelection(min(cursor,value.length))
    suppress=false
    eventCount=max(eventCount,acknowledged)
    ranges=emptyList();previews=emptyList();substitutions=emptyList()
    analyze()
  }
  private var pendingExternal: Pair<String,Int>? = null
  fun setPreviewSizes(count: Int, values: List<Triple<Int,Int,Double>>) {
    if(count!=eventCount) return
    var changed=false
    for((start,end,height) in values) {
      val pixels=max(1,(height*density).toInt())
      if(sizes[start to end]!=pixels) {sizes[start to end]=pixels;changed=true}
    }
    if(changed) refreshPresentation()
  }
  fun restyle() { if(analyzedSource==text.toString()) refreshPresentation() else analyze() }
  private fun analyze() {
    val source=text.toString();val serial=++request
    work?.cancel(false)
    work=analyzer.submit {
      try {
        val values=EditorNative.analyze(source)
        val parsed=values.asList().chunked(3).filter { it.size==3 }.map { SourceRange(it[0],it[1],it[2]) }
        post {
          if(serial==request && source==text.toString()) {
            analyzedSource=source;ranges=parsed
            // React need not emit onLayout when later edits leave a preview's
            // size unchanged, so retain measurements for surviving ranges.
            val blockKeys=parsed.filter {it.kind in 21..23}.map {it.start to it.end}.toSet()
            sizes.keys.retainAll(blockKeys)
            refreshPresentation()
          }
        }
      } catch(error: Exception) { Log.e("ValiMarkdownInput","Analysis failed",error) }
    }
  }
  private fun isActive(range: SourceRange): Boolean {
    if(!hasFocus()) return false
    val start=selectionStart.coerceAtLeast(0);val end=selectionEnd.coerceAtLeast(start)
    return if(start==end) start in range.start..range.end else start<range.end && end>range.start
  }
  private fun refreshPresentation() {
    if(styling || previewTouch != null || composing || analyzedSource!=text.toString()) return
    val editable=text ?: return
    styling=true
    try {
      editable.getSpans(0,editable.length,EditorSpan::class.java).forEach { editable.removeSpan(it) }
      for(range in if(previewsEnabled)ranges else emptyList()) {
        if(range.start<0 || range.end>editable.length || range.end<=range.start || range.kind>=20)continue
        val span: Any = when(range.kind) {
          0 -> EditorColor(delimiterColorValue)
          1 -> EditorStyle(Typeface.BOLD)
          2 -> EditorStyle(Typeface.ITALIC)
          3 -> EditorStrike()
          4 -> EditorFont()
          5 -> EditorColor(quoteColorValue)
          6 -> EditorColor(linkColorValue)
          7 -> EditorQuote(quoteColorValue)
          in 11..16 -> EditorSize(when(range.kind){11->1.8f;12->1.5f;13->1.3f;else->1.1f})
          else -> continue
        }
        editable.setSpan(span,range.start,range.end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        if(range.kind==6)editable.setSpan(EditorUnderline(),range.start,range.end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      previews=ranges.filter { previewsEnabled && it.kind in 21..23 && !isActive(it) }.map { PreviewSpan(it) }
      substitutions=if(previewsEnabled && typographerEnabled)ranges.filter {range -> range.kind>=100 && !isActive(range) && ranges.none {it.kind in 21..23 && range.start<it.end && range.end>it.start}}.map {TypographySpan(it)} else emptyList()
      // Metric-only span invalidation reflows the transformed text, preserving the
      // actual Editable, selection, native undo history and composing spans.
      editable.removeSpan(pulse)
      if(editable.isNotEmpty())editable.setSpan(pulse,0,editable.length,Spanned.SPAN_INCLUSIVE_INCLUSIVE)
      requestLayout();invalidate();emitBlocks()
    } finally { styling=false }
  }
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if(event.actionMasked==MotionEvent.ACTION_DOWN) {
      val currentLayout=layout
      previewTouch=previews.firstOrNull { span ->
        val line=currentLayout?.getLineForOffset(span.range.start) ?: return@firstOrNull false
        val top=currentLayout.getLineTop(line)+paddingTop-scrollY
        val height=sizes[span.range.start to span.range.end] ?: (80*density).toInt()
        event.y>=top && event.y<top+height
      }?.range
      touchX=event.x;touchY=event.y;touchMoved=false
      oldSelection=selectionStart to selectionEnd
    }
    if(event.actionMasked==MotionEvent.ACTION_MOVE) {
      val slop=ViewConfiguration.get(context).scaledTouchSlop
      if(kotlin.math.abs(event.x-touchX)>slop || kotlin.math.abs(event.y-touchY)>slop)touchMoved=true
    }
    // Let EditText own dragging/scrolling, including gestures over React previews.
    val handled=super.onTouchEvent(event)
    if(event.actionMasked==MotionEvent.ACTION_UP || event.actionMasked==MotionEvent.ACTION_CANCEL) {
      val range=previewTouch
      previewTouch=null
      if(range!=null) {
        if(!touchMoved && event.actionMasked==MotionEvent.ACTION_UP) {
          val source=text.toString()
          val newline=source.indexOf('\n',range.start).takeIf {it>=0 && it<range.end}
          val offset=if(range.kind==23)range.start+1 else newline?.plus(1) ?: (range.start+2)
          setSelection(offset.coerceIn(0,text.length))
        } else if(oldSelection.first>=0 && oldSelection.second>=0) {
          setSelection(oldSelection.first.coerceAtMost(text.length),oldSelection.second.coerceAtMost(text.length))
        }
        refreshPresentation()
      }
    }
    return handled
  }
  override fun onSelectionChanged(start: Int,end: Int) {
    super.onSelectionChanged(start,end)
    // EditText invokes this during construction, before Kotlin fields initialize.
    if(start<0 || end<0 || !ready) return
    selection?.invoke(EditorSelection(start.toDouble(),end.toDouble()))
    refreshPresentation()
  }
  override fun onFocusChanged(focused: Boolean,direction: Int,rect: Rect?) {
    super.onFocusChanged(focused,direction,rect)
    if(ready) post { refreshPresentation() }
  }
  override fun onScrollChanged(x: Int,y: Int,oldX: Int,oldY: Int) {super.onScrollChanged(x,y,oldX,oldY);emitBlocks()}
  override fun onSizeChanged(w: Int,h: Int,oldW: Int,oldH: Int) {super.onSizeChanged(w,h,oldW,oldH);if(ready)emitBlocks()}
  override fun onLayout(changed: Boolean,left: Int,top: Int,right: Int,bottom: Int) {
    super.onLayout(changed,left,top,right,bottom);if(ready)emitBlocks()
  }
  fun dispose() {++request;work?.cancel(false);change=null;selection=null;blocksChanged=null}
  private fun compositionEnded() {
    val pending=pendingExternal
    pendingExternal=null
    if(pending!=null && pending.second>=eventCount)setSource(pending.first,pending.second)
    refreshPresentation()
  }
  override fun onCreateInputConnection(info: EditorInfo): InputConnection? {
    val original=super.onCreateInputConnection(info) ?: return null
    return object: InputConnectionWrapper(original,false) {
      override fun finishComposingText(): Boolean {val result=super.finishComposingText();post {compositionEnded()};return result}
      override fun commitText(value: CharSequence?,position: Int): Boolean {val result=super.commitText(value,position);post {compositionEnded()};return result}
    }
  }
  private fun emitBlocks() {
    if(emitPosted || !ready) return
    emitPosted=true
    post {
      emitPosted=false
      val layout=layout ?: return@post
      if(analyzedSource!=text.toString())return@post
      val values=ranges.filter {it.kind in 21..23}.map { range ->
        val line=layout.getLineForOffset(range.start.coerceAtMost(text.length))
        val height=sizes[range.start to range.end] ?: (80*density).toInt()
        EditorBlock(when(range.kind){21->"fence";22->"latex_block";else->"table"},range.start.toDouble(),range.end.toDouble(),previews.none {it.range==range},
          paddingLeft/density.toDouble(),(layout.getLineTop(line)+paddingTop-scrollY)/density.toDouble(),max(0,width-paddingLeft-paddingRight)/density.toDouble(),height/density.toDouble())
      }.toTypedArray()
      val event=EditorLayout(text.toString(),eventCount.toDouble(),values)
      if(event!=lastLayout){lastLayout=event;blocksChanged?.invoke(event)}
    }
  }
  private abstract inner class SourceReplacement(val range: SourceRange): ReplacementSpan()
  private inner class TypographySpan(range: SourceRange): SourceReplacement(range) {
    private val value=when(range.kind){100->"©";101->"®";102->"™";103->"§";104->"±";105->"…";106->"???";107->"!!!";108->",";109->"–";110->"—";111->"..";else->""}
    override fun getSize(paint: Paint,text: CharSequence,start: Int,end: Int,fm: Paint.FontMetricsInt?): Int = kotlin.math.ceil(paint.measureText(value).toDouble()).toInt()
    override fun draw(canvas: Canvas,text: CharSequence,start: Int,end: Int,x: Float,top: Int,y: Int,bottom: Int,paint: Paint) {canvas.drawText(value,x,y.toFloat(),paint)}
  }
  private inner class PreviewSpan(range: SourceRange): SourceReplacement(range) {
    override fun getSize(paint: Paint,text: CharSequence,start: Int,end: Int,fm: Paint.FontMetricsInt?): Int {
      val height=sizes[range.start to range.end] ?: (80*density).toInt()
      fm?.apply {ascent=-height;top=-height;descent=0;bottom=0}
      return max(1,width-paddingLeft-paddingRight)
    }
    override fun draw(canvas: Canvas,text: CharSequence,start: Int,end: Int,x: Float,top: Int,y: Int,bottom: Int,paint: Paint) {}
  }
  // Offset-preserving transformation: suppress internal newlines only in inactive
  // ranges. IME, selection and undo continue to operate on the original source.
  private inner class FoldedSource(val source: CharSequence): Spanned, GetChars {
    override val length get()=source.length
    override fun get(index: Int): Char = if(source[index]=='\n' && previews.any { index>=it.range.start&&index<it.range.end }) '\u2060' else source[index]
    override fun getChars(start: Int,end: Int,dest: CharArray,destoff: Int) {for(i in start until end)dest[destoff+i-start]=get(i)}
    override fun toString(): String=CharArray(length){get(it)}.concatToString()
    override fun subSequence(startIndex: Int,endIndex: Int): CharSequence {
      val result=SpannableStringBuilder(source.subSequence(startIndex,endIndex))
      for(i in startIndex until endIndex)if(source[i]=='\n'&&previews.any {i>=it.range.start&&i<it.range.end})result.replace(i-startIndex,i-startIndex+1,"\u2060")
      for(span in replacements)if(span.range.start<endIndex&&span.range.end>startIndex)result.setSpan(span,max(0,span.range.start-startIndex),min(result.length,span.range.end-startIndex),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      return result
    }
    @Suppress("UNCHECKED_CAST")
    override fun <T> getSpans(start: Int,end: Int,type: Class<T>): Array<T> {
      val values=((source as? Spanned)?.getSpans(start,end,type)?.toList() ?: emptyList()).toMutableList()
      for(span in replacements)if(type.isInstance(span)&&span.range.start<end&&span.range.end>start)values.add(span as T)
      val result=java.lang.reflect.Array.newInstance(type,values.size) as Array<T>
      values.forEachIndexed {i,value->result[i]=value};return result
    }
    override fun getSpanStart(tag: Any?): Int=if(tag is SourceReplacement)tag.range.start.coerceIn(0,length) else (source as? Spanned)?.getSpanStart(tag) ?: -1
    override fun getSpanEnd(tag: Any?): Int=if(tag is SourceReplacement)tag.range.end.coerceIn(0,length) else (source as? Spanned)?.getSpanEnd(tag) ?: -1
    override fun getSpanFlags(tag: Any?): Int=if(tag is SourceReplacement)Spanned.SPAN_EXCLUSIVE_EXCLUSIVE else (source as? Spanned)?.getSpanFlags(tag) ?: 0
    override fun nextSpanTransition(start: Int,limit: Int,type: Class<*>?): Int {
      var next=(source as? Spanned)?.nextSpanTransition(start,limit,type) ?: limit
      for(span in replacements)if(type==null||type.isInstance(span)) {if(span.range.start>start)next=min(next,span.range.start);if(span.range.end>start)next=min(next,span.range.end)}
      return next
    }
  }
}
