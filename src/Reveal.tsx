import React, { memo, useEffect, type ReactNode } from 'react'
import Animated, { cancelAnimation, Easing, ReduceMotion, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
declare const performance: { now(): number }
function useFade(startedAt: number, duration: number, color?: string) {
  const remaining = startedAt > 0 && duration > 0 ? Math.max(0, duration - (performance.now() - startedAt)) : 0
  const opacity = useSharedValue(remaining ? 1 - (remaining / duration) ** 2 : 1)
  const style = useAnimatedStyle(() => color
    ? { color: interpolateColor(opacity.value, [0, 1], ['transparent', color]) }
    : { opacity: opacity.value })
  useEffect(() => {
    const left = startedAt > 0 && duration > 0 ? Math.max(0, duration - (performance.now() - startedAt)) : 0
    if (left) opacity.value = withTiming(1, { duration: left, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System })
    else opacity.value = 1
    return () => cancelAnimation(opacity)
  }, [opacity, startedAt, duration])
  return style
}
export const RevealText = memo(function RevealText({ startedAt, duration, children, color }: { startedAt: number; duration: number; children: string; color: string }) {
  const style = useFade(startedAt, duration, color)
  // Text stays inline: no View wrappers to disturb wrapping/baselines/selection.
  return <Animated.Text style={style}>{children}</Animated.Text>
})
export const RevealBlock = memo(function RevealBlock({ startedAt, duration, children }: { startedAt: number; duration: number; children: ReactNode }) {
  const style = useFade(startedAt, duration)
  return <Animated.View style={style}>{children}</Animated.View>
})
