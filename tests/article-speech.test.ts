import { describe, expect, it, vi } from 'vitest'
import { createArticleSpeech, speechChunks } from '../src/article-speech'
import { scenarios } from '../src/data'
import { catalogEntries } from '../src/library'
import { articleContent, articleSpeechText } from '../src/reference-view'

describe('Текст для озвучивания энциклопедии', () => {
  const entries = catalogEntries(scenarios)

  it('собирает заголовки и текст Нептуна в порядке статьи', () => {
    const neptune = entries.find(entry => entry.id === 'neptune')!
    const { profile } = neptune
    const targets = articleSpeechText(neptune)
    expect([...targets.keys()]).toEqual(['article', 'properties', 'surface', 'atmosphere', 'interior', 'moons', 'history', 'fact'])
    expect(targets.get('article')).toEqual([
      'Нептун.', profile.overview, ...[...targets.values()].slice(1).flat(),
    ])
    expect(targets.get('surface')).toEqual(['Облачные слои.', profile.surface])
    expect(targets.get('atmosphere')).toEqual(['Атмосфера.', profile.atmosphere])
    expect(targets.get('moons')).toEqual(['Естественные спутники.', profile.moons])
    expect(targets.get('properties')).toContain('Средний радиус: 24 622 км.')
    expect(targets.get('history')?.[1]).toBe(`1846 год: ${profile.history![0][1]}`)
    expect(targets.get('article')!.join(' ')).not.toMatch(/NASA|https?:|Источники|Показать в системе|Открыть глобус/)
  })

  it('даёт каждой статье и каждому непустому разделу одну кнопку, учитывая поддержку API', () => {
    for (const entry of entries) {
      const targets = [...articleSpeechText(entry).keys()]
      const markup = articleContent(entry, { speechAvailable: true })
      expect([...markup.matchAll(/data-speech-id="([^"]+)"/g)].map(match => match[1])).toEqual(targets)
    }
    const model = entries.find(entry => entry.id === 'atlas')!
    expect([...articleSpeechText(model).keys()]).toEqual(['article', 'properties'])
    const unsupported = articleContent(model, { speechAvailable: false })
    expect(unsupported).not.toContain('data-speech-action')
    expect(unsupported).toContain('В этом браузере озвучивание недоступно.')
  })

  it('делит длинный текст на короткие фрагменты, сохраняя порядок и слова', () => {
    const paragraph = Array.from({ length: 42 }, (_, index) => `фрагмент ${index}.`).join(' ')
    const chunks = speechChunks(['  ', paragraph])
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => chunk.length <= 200 && chunk.endsWith('.'))).toBe(true)
    expect(chunks.join(' ')).toBe(paragraph)
    const longWord = 'а'.repeat(201)
    expect(speechChunks([longWord]).join('')).toBe(longWord)
  })
})

function playback() {
  const engine = { speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(), cancel: vi.fn() }
  const onState = vi.fn()
  const player = createArticleSpeech(engine, text => ({ text }) as SpeechSynthesisUtterance, onState)
  const utterance = () => engine.speak.mock.lastCall![0]
  const emit = (target: SpeechSynthesisUtterance, name: 'start' | 'end' | 'boundary' | 'error', charIndex = 0) =>
    target[`on${name}`]?.({ charIndex } as SpeechSynthesisErrorEvent)
  return { engine, onState, player, utterance, emit }
}

describe('Управление озвучиванием энциклопедии', () => {
  it('ставит на паузу, продолжает с границы слова и читает следующий фрагмент', () => {
    const { engine, onState, player, utterance, emit } = playback()
    player.toggle('article', ['Первая фраза.', 'Вторая фраза.'])
    const first = utterance()
    expect(first.lang).toBe('ru-RU')
    expect(onState).toHaveBeenLastCalledWith({ id: 'article', status: 'starting' })
    emit(first, 'start')
    expect(onState).toHaveBeenLastCalledWith({ id: 'article', status: 'playing' })
    emit(first, 'boundary', 7)
    player.toggle('article', [])
    expect(engine.cancel).toHaveBeenCalledTimes(1)
    expect(onState).toHaveBeenLastCalledWith({ id: 'article', status: 'paused' })
    emit(first, 'end')
    expect(engine.speak).toHaveBeenCalledTimes(1)
    player.toggle('article', [])
    expect(utterance().text).toBe('фраза.')
    emit(utterance(), 'start')
    emit(utterance(), 'end')
    expect(utterance().text).toBe('Вторая фраза.')
    emit(utterance(), 'end')
    expect(onState).toHaveBeenLastCalledWith(undefined)
  })

  it('заменяет активную озвучку и игнорирует события отменённых фрагментов', () => {
    const { engine, onState, player, utterance, emit } = playback()
    player.toggle('article', ['Первая фраза.', 'Вторая фраза.'])
    const previous = utterance()
    engine.cancel.mockImplementationOnce(() => emit(previous, 'error'))
    player.toggle('atmosphere', ['Атмосфера.'])
    expect(engine.cancel.mock.invocationCallOrder[0]).toBeLessThan(engine.speak.mock.invocationCallOrder[1])
    emit(previous, 'end')
    expect(engine.speak).toHaveBeenCalledTimes(2)
    const active = utterance()
    expect(active.text).toBe('Атмосфера.')
    expect(onState).toHaveBeenLastCalledWith({ id: 'atmosphere', status: 'starting' })
    player.stop()
    emit(active, 'start')
    expect(engine.cancel).toHaveBeenCalledTimes(2)
    expect(onState).toHaveBeenLastCalledWith(undefined)
  })

  it('позволяет повторить запуск после ошибки синтеза', () => {
    const { engine, onState, player, utterance, emit } = playback()
    engine.speak.mockImplementationOnce(() => { throw new Error('Speech unavailable') })
    player.toggle('moons', ['Тритон.'])
    expect(onState).toHaveBeenLastCalledWith({ id: 'moons', status: 'error' })
    player.toggle('moons', ['Тритон.'])
    emit(utterance(), 'error')
    expect(onState).toHaveBeenLastCalledWith({ id: 'moons', status: 'error' })
    player.toggle('moons', ['Тритон.'])
    emit(utterance(), 'start')
    expect(onState).toHaveBeenLastCalledWith({ id: 'moons', status: 'playing' })
  })
})
