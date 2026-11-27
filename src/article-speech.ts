type SpeechStatus = 'starting' | 'playing' | 'paused' | 'error'
export type SpeechState = { id: string; status: SpeechStatus } | undefined

export function speechChunks(parts: readonly string[]) {
  // Bound each utterance and prefer sentence or word boundaries.
  return parts.flatMap(part => part.trim().replace(/\s+/g, ' ')
    .match(/.{1,199}[.!?](?= |$)|.{1,200}(?= |$)|\S{1,200}/g) ?? [])
    .map(chunk => chunk.trim()).filter(Boolean)
}

export function createArticleSpeech(
  engine: Pick<SpeechSynthesis, 'speak' | 'cancel'>,
  createUtterance: (text: string) => SpeechSynthesisUtterance,
  onState: (state: SpeechState) => void,
) {
  let state: SpeechState
  let chunks: string[] = []
  let index = 0
  let offset = 0
  let current: SpeechSynthesisUtterance | undefined

  function update(next: SpeechState) {
    state = next
    onState(next)
  }

  function cancelCurrent() {
    if (!current) return
    current = undefined
    engine.cancel()
  }

  function stop() {
    cancelCurrent()
    chunks = []
    if (state) update(undefined)
  }

  function speak(id: string, starting = true) {
    if (starting) update({ id, status: 'starting' })
    const startOffset = offset
    try {
      const utterance = createUtterance(chunks[index].slice(startOffset))
      current = utterance
      utterance.lang = 'ru-RU'
      utterance.onstart = () => {
        if (current === utterance && state?.status === 'starting') update({ id, status: 'playing' })
      }
      utterance.onboundary = ({ charIndex }) => {
        if (current === utterance && startOffset + charIndex < chunks[index].length) {
          offset = Math.max(offset, startOffset + charIndex)
        }
      }
      utterance.onend = () => {
        if (current !== utterance) return
        current = undefined
        offset = 0
        if (++index < chunks.length) speak(id, false)
        else stop()
      }
      utterance.onerror = () => {
        if (current !== utterance) return
        current = undefined
        update({ id, status: 'error' })
      }
      engine.speak(utterance)
    } catch {
      cancelCurrent()
      update({ id, status: 'error' })
    }
  }

  return {
    toggle(id: string, text: readonly string[]) {
      if (state?.id === id) {
        if (state.status === 'paused') {
          speak(id)
          return
        }
        if (state.status !== 'error') {
          // Some browsers cancel on native pause. Retain the last reported position instead.
          cancelCurrent()
          update({ id, status: 'paused' })
          return
        }
      }
      cancelCurrent()
      chunks = speechChunks(text)
      index = offset = 0
      if (chunks.length) speak(id)
      else stop()
    },
    stop,
  }
}
