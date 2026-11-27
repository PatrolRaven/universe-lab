import type { CatalogEntry } from './library'
import { objectMedia } from './object-media'

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
}

export function articleContent(entry: CatalogEntry, { actions = false, titleId }: ArticleOptions = {}) {
  const { name, englishName, classification, category, profile, scene } = entry
  const sections = [
    [profile.surfaceTitle ?? 'Поверхность', profile.surface],
    [profile.atmosphereTitle ?? 'Атмосфера', profile.atmosphere],
    [profile.interiorTitle ?? 'Внутреннее строение', profile.interior],
    ['Естественные спутники', profile.moons],
  ] as const
  const sources = [...profile.references, ...(profile.imagery ?? [])]
  return `
    <header class="encyclopedia-hero">
      ${objectFigure(entry)}
      <div class="encyclopedia-intro">
        <p class="encyclopedia-classification">${category === 'model' ? 'Учебная модель · ' : ''}${escape(classification)}</p>
        <h2${titleId ? ` id="${escape(titleId)}" tabindex="-1"` : ''}>${escape(name)}</h2>
        <p class="encyclopedia-english" lang="en">${escape(englishName)}</p>
        <p class="encyclopedia-overview">${escape(profile.overview)}</p>
        ${actions && scene ? `<div class="encyclopedia-actions">
          ${scene.body.detail?.surfaceMap ? '<button type="button" class="focus-button" data-library-action="globe">Открыть глобус</button>' : ''}
          <button type="button" class="planet-action" data-library-action="show">Показать в системе</button>
        </div>` : ''}
      </div>
    </header>
    <div class="encyclopedia-body">
      ${profile.properties.length ? `<section class="encyclopedia-section">
        <h3>Характеристики</h3>
        <dl class="encyclopedia-metrics">${profile.properties.map(([label, value]) =>
          `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
      </section>` : ''}
      ${sections.map(([heading, detail]) => detail ? `<section class="encyclopedia-section">
        <h3>${escape(heading)}</h3><p>${escape(detail)}</p>
      </section>` : '').join('')}
      ${profile.history?.length ? `<section class="encyclopedia-section">
        <h3>История исследований</h3>
        <dl class="encyclopedia-timeline">${profile.history.map(([date, detail]) =>
          `<div><dt>${escape(date)}</dt><dd>${escape(detail)}</dd></div>`).join('')}</dl>
      </section>` : ''}
      ${profile.fact ? `<section class="encyclopedia-section encyclopedia-fact">
        <h3>Интересный факт</h3><p>${escape(profile.fact)}</p>
      </section>` : ''}
      ${sources.length ? `<section class="encyclopedia-section">
        <h3>Источники</h3>
        <ul class="encyclopedia-sources">${sources.map(([label, url]) => `<li>${sourceLink(label, url)}</li>`).join('')}</ul>
      </section>` : ''}
    </div>`
}
