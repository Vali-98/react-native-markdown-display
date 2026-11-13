package com.valimarkdown

import com.margelo.nitro.valimarkdown.EditorConfiguration
import com.margelo.nitro.valimarkdown.EditorTextAttributes

internal object EditorDefaults {
  val configuration = EditorConfiguration(
    multiline=false,submitBehavior="blurAndSubmit",returnKeyType="default",autoCorrect=true,
    autoCapitalize="sentences",keyboardType="default",maxLength=-1.0,numberOfLines=1.0,
    editable=true,selectTextOnFocus=false,caretHidden=false,contextMenuHidden=false,
    showSoftInputOnFocus=true,scrollEnabled=true
  )
  val textAttributes = EditorTextAttributes(
    fontFamily="",fontWeight="normal",fontStyle="normal",letterSpacing=0.0,lineHeight=0.0,
    paddingTop=12.0,paddingBottom=12.0,paddingLeft=12.0,paddingRight=12.0,
    textAlign="auto",textAlignVertical="top",allowFontScaling=true,maxFontSizeMultiplier=0.0,includeFontPadding=true
  )
}
