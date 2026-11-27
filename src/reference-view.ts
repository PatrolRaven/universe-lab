import type { CatalogEntry } from './library'
import { objectMedia } from './object-media'
import { createArticleSpeech, type SpeechState } from './article-speech'

const escape = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

function sourceLink(label: string, url: string) {
  const href = /^https?:\/\//.test(url) ? url : import.meta.env.BASE_URL + url
  return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
}

export function objectFigure(entry: CatalogEntry) {
  const media = objectMedia(entry.id)
  if (!media) return ''
  return `<figure class="object-figure">
    <div class="object-figure-frame">
      <img data-object-media src="${escape(import.meta.env.BASE_URL + media.file)}" alt="${escape(media.alt)}" decoding="async">
      <p class="object-figure-unavailable" hidden>Изображение недоступно</p>
    </div>
    <figcaption>
      <span>${escape(media.kind)}</span>
      ${media.source ? sourceLink(media.credit, media.source) : `<span>${escape(media.credit)}</span>`}
    </figcaption>
  </figure>`
}

export function handleMediaError(event: Event) {
  const image = event.target
  if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-object-media')) return
  image.hidden = true
  const fallback = image.nextElementSibling
  if (fallback instanceof HTMLElement) fallback.hidden = false
}

interface ArticleOptions {
  actions?: boolean
  titleId?: string
  speechAvailable?: boolean
}

function articleSections(profile: CatalogEntry['profile']) {
  return [
    ['properties', 'Характеристики', profile.properties],
    ['surface', profile.surfaceTitle ?? 'Поверхность', profile.surface],
    ['atmosphere', profile.atmosphereTitle ?? 'Атмосфера', profile.atmosphere],
    ['interior', profile.interiorTitle ?? 'Внутреннее строение', profile.interior],
    ['moons', 'Естественные спутники', profile.moons],
    ['history', 'История исследований', profile.history],
    ['fact', 'Интересный факт', profile.fact],
  ] as const
}

export function articleSpeechText({ name, profile }: CatalogEntry) {
  const all = [`${name}.`, profile.overview]
  const targets = new Map<string, string[]>([['article', all]])
  for (const [id, title, content] of articleSections(profile)) {
    if (!content?.length) continue
    const details = typeof content === 'string' ? [content] : content.map(([term, value]) =>
      `${term}: ${value}${/[.!?]$/.test(value) ? '' : '.'}`)
    const text = [`${title}.`, ...details]
    targets.set(id, text)
    all.push(...text)
  }
  return targets
}

const speechMessages = {
  starting: 'Запуск озвучивания…',
  playing: 'Идёт озвучивание',
  paused: 'На паузе',
  error: 'Не удалось воспроизвести озвучивание. Проверьте, доступен ли русский голос, и попробуйте снова.',
}

function speechLabel(action: string, id: string, title: string) {
  return id === 'article' ? action : `${action}. ${title}`
}

function speechControls(id: string, title: string) {
  const play = id === 'article' ? 'Озвучить всю статью' : 'Озвучить раздел'
  return `<div class="encyclopedia-speech" data-speech-id="${id}" data-speech-title="${escape(title)}">
    <button type="button" class="planet-action" data-speech-action="toggle" aria-label="${escape(speechLabel(play, id, title))}">${play}</button>
    <button type="button" class="planet-action" data-speech-action="stop" aria-label="${escape(speechLabel('Остановить озвучивание', id, title))}" hidden>Остановить</button>
    <span class="encyclopedia-speech-status" role="status" aria-atomic="true"></span>
  </div>`
}

export function createArticleNarration(root: HTMLElement, signal: AbortSignal) {
  const Utterance = window.SpeechSynthesisUtterance
  const engine = window.speechSynthesis
  const available = typeof Utterance === 'function' && typeof engine?.speak === 'function'
    && typeof engine.cancel === 'function'
  let article: HTMLElement | undefined
  let entry: CatalogEntry | undefined
  let targets = new Map<string, string[]>()
  let controls = new Map<string, HTMLElement>()
  let previous: SpeechState

  function render(state: SpeechState) {
    for (const id of new Set([previous?.id, state?.id])) {
      if (!id) continue
      const group = controls.get(id)!
      const status = state?.id === id ? state.status : undefined
      const active = status === 'starting' || status === 'playing' || status === 'paused'
      const toggle = group.querySelector<HTMLButtonElement>('[data-speech-action="toggle"]')!
      const stop = group.querySelector<HTMLButtonElement>('[data-speech-action="stop"]')!
      const label = status === 'paused' ? 'Продолжить'
        : active ? 'Пауза'
          : id === 'article' ? 'Озвучить всю статью' : 'Озвучить раздел'
      toggle.textContent = label
      toggle.setAttribute('aria-label', speechLabel(label, id, group.dataset.speechTitle!))
      if (!active && document.activeElement === stop) toggle.focus({ preventScroll: true })
      stop.hidden = !active
      group.querySelector('[role="status"]')!.textContent = status ? speechMessages[status] : ''
    }
    previous = state
  }

  const player = available ? createArticleSpeech(engine, text => new Utterance(text), render) : undefined
  const stop = () => player?.stop()
  signal.addEventListener('abort', stop, { once: true })
  window.addEventListener('pagehide', stop, { signal })
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('[data-speech-action]')
    if (!button || !article?.contains(button)) return
    const id = button.closest<HTMLElement>('[data-speech-id]')?.dataset.speechId
    const text = id && targets.get(id)
    if (!id || !text) return
    if (button.dataset.speechAction === 'stop') stop()
    else player?.toggle(id, text)
  }, { signal })

  return {
    available,
    attach(container: HTMLElement, selected: CatalogEntry | undefined) {
      if (!player || (article === container && entry === selected && controls.get('article')?.isConnected)) return
      stop()
      article = container
      entry = selected
      targets = selected ? articleSpeechText(selected) : new Map()
      controls = new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-speech-id]'),
        group => [group.dataset.speechId!, group]))
    },
    stop,
  }
}

export function articleContent(entry: CatalogEntry, { actions = false, titleId, speechAvailable }: ArticleOptions = {}) {
  const { name, englishName, classification, category, profile, scene } = entry
  const sources = [...profile.references, ...(profile.imagery ?? [])]
  return `
    <header class="encyclopedia-hero">
      ${objectFigure(entry)}
      <div class="encyclopedia-intro">
        <p class="encyclopedia-classification">${category === 'model' ? 'Учебная модель · ' : ''}${escape(classification)}</p>
        <h2${titleId ? ` id="${escape(titleId)}" tabindex="-1"` : ''}>${escape(name)}</h2>
        <p class="encyclopedia-english" lang="en">${escape(englishName)}</p>
        <p class="encyclopedia-overview">${escape(profile.overview)}</p>
        ${speechAvailable ? speechControls('article', name) : speechAvailable === false
          ? '<p class="encyclopedia-speech-unavailable">В этом браузере озвучивание недоступно.</p>' : ''}
        ${actions && scene ? `<div class="encyclopedia-actions">
          ${scene.body.detail?.surfaceMap ? '<button type="button" class="focus-button" data-library-action="globe">Открыть глобус</button>' : ''}
          <button type="button" class="planet-action" data-library-action="show">Показать в системе</button>
        </div>` : ''}
      </div>
    </header>
    <div class="encyclopedia-body">
      ${articleSections(profile).map(([id, heading, detail]) => detail?.length
        ? `<section class="encyclopedia-section${id === 'fact' ? ' encyclopedia-fact' : ''}">
          <div class="encyclopedia-section-heading">
            <h3>${escape(heading)}</h3>
            ${speechAvailable ? speechControls(id, heading) : ''}
          </div>
          ${typeof detail === 'string' ? `<p>${escape(detail)}</p>`
            : `<dl class="${id === 'history' ? 'encyclopedia-timeline' : 'encyclopedia-metrics'}">${detail.map(([label, value]) =>
              `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`}
        </section>` : '').join('')}
      ${sources.length ? `<section class="encyclopedia-section">
        <h3>Источники</h3>
        <ul class="encyclopedia-sources">${sources.map(([label, url]) => `<li>${sourceLink(label, url)}</li>`).join('')}</ul>
      </section>` : ''}
    </div>`
}
