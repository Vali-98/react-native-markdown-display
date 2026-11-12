import React, { useState, type RefObject } from 'react'
import { Text, View } from 'react-native'
import Slider from '@react-native-community/slider'

export function StreamDelayControl({ delay }: { delay: RefObject<number> }) {
  const [value, setValue] = useState(delay.current)
  return <View>
    <Text style={{ color: '#777185', fontSize: 12 }}>Chunk delay · {value} ms{value === 0 ? ' (fastest)' : ''}</Text>
    <Slider
      style={{ height: 26 }}
      accessibilityLabel="Stream chunk delay"
      accessibilityValue={{ min: 0, max: 500, now: value, text: `${value} milliseconds` }}
      minimumValue={0}
      maximumValue={500}
      step={10}
      value={value}
      minimumTrackTintColor="#7c6ee6"
      maximumTrackTintColor="#ccc"
      thumbTintColor="#7c6ee6"
      onValueChange={next => {
        const rounded = Math.round(next)
        delay.current = rounded
        setValue(rounded)
      }}
    />
  </View>
}
