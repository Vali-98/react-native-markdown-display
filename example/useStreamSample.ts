import { useEffect, useRef, useState, type RefObject } from 'react'
declare const performance: { now(): number }
export interface SampleFrame { run: number; step: number; source: string; streaming: boolean; published: number }
export function useStreamSample(sample: string, delay: RefObject<number>) {
  const generation = useRef(0)
  const [frame, setFrame] = useState<SampleFrame>(() => ({ run: 0, step: 0, source: sample, streaming: false, published: performance.now() }))
  async function show(stream: boolean) {
    const run = ++generation.current
    const publish = (source: string, streaming: boolean, step: number) => setFrame({ run, step, source, streaming, published: performance.now() })
    if (!stream) { publish(sample, false, 0); return }
    publish('', true, 0)
    let step = 1
    for (let i = 0; i < sample.length && generation.current === run; i += 12) {
      publish(sample.slice(0, i + 12), true, step++)
      await new Promise<void>(resolve => setTimeout(resolve, delay.current))
    }
    if (generation.current === run) publish(sample, false, step)
  }
  useEffect(() => () => { ++generation.current }, [])
  return { frame, show }
}
