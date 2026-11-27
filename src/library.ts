import type { ObjectSpec, Scenario } from './data'
import { explorerProfiles, type ExplorerProfile } from './planet-profiles'
import { solarCatalog } from './solar-catalog'
import { articleContent, handleMediaError, type createArticleNarration } from './reference-view'
import './encyclopedia.css'

export const categoryNames = {
  planet: 'Планеты',
  'dwarf-planet': 'Карликовые планеты',
  moon: 'Спутники',
  star: 'Звёзды',
  'minor-body': 'Малые тела',
  model: 'Учебные модели',
}

export interface CatalogEntry {
  id: string
  name: string
  englishName: string
  category: keyof typeof categoryNames
  classification: string
  profile: ExplorerProfile
  image?: string
  scene?: { body: ObjectSpec; scenario: Scenario }
}

const englishNames: Readonly<Record<string, string>> = {
  mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  atlas: 'Atlas A', 'atlas-b': 'Atlas B', vesper: 'Vesper', kepler: 'Kepler',
  dune: 'Dune', ember: 'Ember', pelagos: 'Pelagos', nomad: 'Nomad',
}

const modelDescriptions: Readonly<Record<string, string>> = {
  atlas: 'Более массивный компонент пары. Наблюдайте, как оба компонента движутся вокруг общего центра масс.',
  'atlas-b': 'Менее массивный компонент пары с более широкой орбитой вокруг общего центра масс.',
  vesper: 'Планета на внешней орбите, охватывающей обе звезды. Её начальная скорость задана относительно центра масс пары.',
  kepler: 'Центральная звезда песочницы. Её притяжение задаёт основное движение планет, а их массы тоже влияют на звезду.',
  dune: 'Газовый гигант с кольцами и спутником Эмбер. Следы показывают движение обоих тел в общей системе координат.',
  ember: 'Спутник Дюны. Сравните его движение вокруг планеты с движением пары вокруг звезды.',
  pelagos: 'Учебная океаническая планета. Наклон её орбиты заметнее при повороте камеры к плоскости системы.',
  nomad: 'Малое тело на сильно наклонённой орбите. Поверните камеру, чтобы сравнить плоскость его орбиты с орбитой Дюны.',
}

export function catalogEntries(scenarios: readonly Scenario[]): CatalogEntry[] {
  const solarExtras = new Map(solarCatalog.map(entry => [entry.id, entry]))
  const entries = new Map<string, CatalogEntry>()
  for (const scenario of scenarios) {
    for (const body of scenario.objects) {
      const { id, profile } = body
      if (entries.has(id)) continue
      const real = solarExtras.get(id)
      const scene = { body, scenario }
      if (real) {
        entries.set(id, { ...real, scene })
        continue
      }
      const science = explorerProfiles[id]
      entries.set(id, {
        id, name: profile.name, englishName: englishNames[id] ?? profile.name,
        category: science ? 'planet' : 'model',
        classification: profile.classification,
        profile: science ?? {
          overview: modelDescriptions[id] ?? profile.overview ?? scenario.description,
          properties: [
            ['Масса в модели', `${body.mass.toLocaleString('ru-RU', { maximumSignificantDigits: 4 })} M☉`],
            ['Радиус в модели', `${profile.radiusKm.toLocaleString('ru-RU')} км`],
          ],
          references: [],
        },
        image: body.appearance.thumbnail ?? body.detail?.surfaceMap?.url,
        scene,
      })
    }
  }
  return [
    ...[...entries.values()].filter(entry => entry.category !== 'model'),
    ...solarCatalog.filter(entry => !entries.has(entry.id)),
    ...[...entries.values()].filter(entry => entry.category === 'model'),
  ]
}

export function filterCatalog(entries: readonly CatalogEntry[], query: string, category: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return entries.filter(({ name, englishName, classification, category: kind }) => {
    const text = normalize(`${name} ${englishName} ${classification} ${categoryNames[kind]}`)
    return (category === 'all' || category === kind) && words.every(word => text.includes(word))
  })
}

function normalize(text: string) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()
}

export type CatalogAction = 'reference' | 'globe' | 'show'

export function createLibrary(element: HTMLElement, entries: CatalogEntry[], open: (entry: CatalogEntry, action: CatalogAction) => void, narration: ReturnType<typeof createArticleNarration>, signal: AbortSignal) {
  const kinds = (Object.keys(categoryNames) as CatalogEntry['category'][])
    .filter(kind => entries.some(entry => entry.category === kind))
  const narrow = matchMedia('(max-width: 700px)')
  element.dataset.libraryPane = 'article'
  element.innerHTML = `
    <div class="encyclopedia">
      <aside class="encyclopedia-index" aria-labelledby="library-title">
        <div class="encyclopedia-search">
          <h2 id="library-title" tabindex="-1">Библиотека</h2>
          <label>Поиск<input type="search" id="library-search" placeholder="Например, Марс или Mars" autocomplete="off"></label>
          <label>Категория<select id="library-category">
            <option value="all">Все категории</option>
            ${kinds.map(kind => `<option value="${kind}">${categoryNames[kind]}</option>`).join('')}
          </select></label>
          <p id="library-results" aria-live="polite"></p>
          <button class="planet-action" type="button" data-library-reset hidden>Сбросить фильтры</button>
        </div>
        <div class="encyclopedia-index-list">
          ${kinds.map(kind => `<section data-entry-group="${kind}" aria-labelledby="entry-group-${kind}">
            <h3 id="entry-group-${kind}">${categoryNames[kind]}</h3>
            <ul>${entries.filter(entry => entry.category === kind).map(({ id, name }) =>
              `<li data-entry="${id}"><button type="button" data-library-select="${id}">${name}</button></li>`).join('')}</ul>
          </section>`).join('')}
        </div>
      </aside>
      <div class="encyclopedia-reading">
        <button class="planet-action encyclopedia-list-back" type="button" data-library-list>К списку объектов</button>
        <article class="encyclopedia-entry"></article>
        <p id="library-error" role="status" hidden></p>
      </div>
    </div>`

  const search = element.querySelector<HTMLInputElement>('#library-search')!
  const category = element.querySelector<HTMLSelectElement>('#library-category')!
  const results = element.querySelector<HTMLElement>('#library-results')!
  const error = element.querySelector<HTMLElement>('#library-error')!
  const reset = element.querySelector<HTMLButtonElement>('[data-library-reset]')!
  const index = element.querySelector<HTMLElement>('.encyclopedia-index-list')!
  const reading = element.querySelector<HTMLElement>('.encyclopedia-reading')!
  const article = element.querySelector<HTMLElement>('.encyclopedia-entry')!
  const groups = index.querySelectorAll<HTMLElement>('[data-entry-group]')
  const items = index.querySelectorAll<HTMLElement>('[data-entry]')
  let selected = entries.find(entry => entry.id === 'earth') ?? entries[0]
  let renderedId: string | undefined
  let trigger: HTMLButtonElement | undefined
  let indexScroll = 0
  let articleScroll = 0
  let failedGlobe: HTMLButtonElement | undefined

  function renderArticle() {
    if (element.hidden) return
    if (narrow.matches && element.dataset.libraryPane === 'index') {
      narration.stop()
      return
    }
    const id = selected?.id ?? ''
    if (id !== renderedId) {
      narration.stop()
      renderedId = id
      article.innerHTML = selected
        ? articleContent(selected, { actions: true, titleId: 'library-object-title', speechAvailable: narration.available })
        : '<div class="encyclopedia-empty"><h2 id="library-object-title" tabindex="-1">Объекты не найдены</h2><p>Измените запрос или выберите другую категорию.</p></div>'
      article.setAttribute('aria-labelledby', 'library-object-title')
      reading.scrollTop = 0
    }
    narration.attach(article, selected)
  }

  function markSelection() {
    for (const item of items) {
      const button = item.querySelector('button')!
      if (item.dataset.entry === selected?.id) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
  }

  function filter() {
    clearError()
    const matches = filterCatalog(entries, search.value, category.value)
    const visible = new Set(matches.map(entry => entry.id))
    for (const item of items) item.hidden = !visible.has(item.dataset.entry!)
    for (const group of groups) group.hidden = !group.querySelector('[data-entry]:not([hidden])')
    if (!selected || !visible.has(selected.id)) selected = matches[0]
    markSelection()
    reset.hidden = matches.length > 0
    results.textContent = matches.length
      ? `Найдено объектов: ${matches.length}`
      : 'Найдено объектов: 0. Измените запрос или категорию.'
    renderArticle()
  }

  function clearError() {
    if (failedGlobe) failedGlobe.textContent = 'Открыть глобус'
    failedGlobe = undefined
    error.textContent = ''
    error.hidden = true
  }
  search.addEventListener('input', filter, { signal })
  category.addEventListener('change', filter, { signal })
  narrow.addEventListener('change', renderArticle, { signal })
  element.addEventListener('error', handleMediaError, { capture: true, signal })
  reset.addEventListener('click', () => {
    search.value = ''
    category.value = 'all'
    filter()
    search.focus()
  }, { signal })
  element.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('[data-library-list]')) {
      narration.stop()
      articleScroll = reading.scrollTop
      element.dataset.libraryPane = 'index'
      index.scrollTop = indexScroll
      const current = index.querySelector<HTMLButtonElement>('[aria-current="true"]')
      if (current) current.focus({ preventScroll: true })
      else search.focus({ preventScroll: true })
      return
    }
    const choice = event.target.closest<HTMLButtonElement>('[data-library-select]')
    if (choice) {
      const entry = entries.find(item => item.id === choice.dataset.librarySelect)
      if (!entry) return
      const sameEntry = renderedId === entry.id
      clearError()
      selected = entry
      markSelection()
      indexScroll = index.scrollTop
      element.dataset.libraryPane = 'article'
      renderArticle()
      if (narrow.matches) {
        reading.scrollTop = sameEntry ? articleScroll : 0
        article.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      }
      return
    }
    const button = event.target.closest<HTMLButtonElement>('[data-library-action]')
    if (!button || !selected) return
    trigger = button
    open(selected, button.dataset.libraryAction as CatalogAction)
  }, { signal })
  filter()

  return {
    remember() {
      if (index.clientHeight > 0) indexScroll = index.scrollTop
      if (reading.clientHeight > 0) articleScroll = reading.scrollTop
    },
    focus(restore: boolean) {
      renderArticle()
      index.scrollTop = indexScroll
      reading.scrollTop = articleScroll
      if (restore && trigger?.isConnected) trigger.focus({ preventScroll: true })
      else {
        const target = narrow.matches && element.dataset.libraryPane === 'article' ? '#library-object-title' : '#library-title'
        element.querySelector<HTMLElement>(target)?.focus({ preventScroll: true })
      }
    },
    error(message: string, retry = false) {
      clearError()
      if (!message) return
      const actions = trigger?.isConnected && trigger.closest('.encyclopedia-actions')
      if (actions) actions.after(error)
      else reading.prepend(error)
      failedGlobe = retry && trigger?.dataset.libraryAction === 'globe' ? trigger : undefined
      if (failedGlobe) failedGlobe.textContent = 'Повторить загрузку глобуса'
      error.textContent = message
      error.hidden = false
    },
  }
}
