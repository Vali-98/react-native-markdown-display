package com.valimarkdown

import android.view.View
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.R.id.associated_hybrid_view_tag
import com.margelo.nitro.valimarkdown.HybridMarkdownInputView
import com.margelo.nitro.valimarkdown.views.HybridMarkdownInputViewStateUpdater

/** Nitro's generated prop updater plus TextInput's standard focus commands.
 * RN TextInputState dispatches these commands for Keyboard.dismiss/ScrollView.
 */
class MarkdownInputViewManager: SimpleViewManager<View>() {
  private class Holder(val hybrid: HybridMarkdownInputView,var state: StateWrapper? = null)
  override fun getName() = "MarkdownInputView"
  override fun createViewInstance(context: ThemedReactContext): View {
    val hybrid=HybridMarkdownInputView(context)
    return hybrid.view.apply {setTag(associated_hybrid_view_tag,Holder(hybrid))}
  }
  override fun updateState(view: View,props: ReactStylesDiffMap,state: StateWrapper): Any? {
    val holder=view.getTag(associated_hybrid_view_tag) as Holder
    holder.hybrid.beforeUpdate()
    HybridMarkdownInputViewStateUpdater.updateViewProps(holder.hybrid,state,holder.state)
    holder.hybrid.afterUpdate()
    holder.state=state
    return super.updateState(view,props,state)
  }
  override fun onDropViewInstance(view: View) {
    val holder=view.getTag(associated_hybrid_view_tag) as? Holder
    holder?.hybrid?.onDropView();holder?.state=null
    super.onDropViewInstance(view)
  }
  override fun getCommandsMap(): Map<String,Int> = mapOf("focus" to 1,"blur" to 2)
  override fun receiveCommand(view: View,commandId: Int,args: ReadableArray?) {
    when(commandId){1->receiveCommand(view,"focus",args);2->receiveCommand(view,"blur",args);else->super.receiveCommand(view,commandId,args)}
  }
  override fun receiveCommand(view: View,commandId: String,args: ReadableArray?) {
    val hybrid=(view.getTag(associated_hybrid_view_tag) as? Holder)?.hybrid ?: return
    when(commandId){"focus"->hybrid.focus();"blur"->hybrid.blur();else->super.receiveCommand(view,commandId,args)}
  }
}
