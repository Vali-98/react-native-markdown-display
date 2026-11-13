package com.valimarkdown;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.BaseReactPackage;
import com.margelo.nitro.valimarkdown.ValiMarkdownOnLoad;


public class ValiMarkdownPackage : BaseReactPackage() {
  override fun createViewManagers(reactContext: ReactApplicationContext): List<com.facebook.react.uimanager.ViewManager<*, *>> =
    listOf(com.margelo.nitro.valimarkdown.views.HybridMarkdownInputViewManager())

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { emptyMap() }

  companion object {
    init {
      ValiMarkdownOnLoad.initializeNative();
    }
  }
}
