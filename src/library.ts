import type { ObjectSpec, Scenario } from './data'
import { explorerProfiles, type ExplorerProfile } from './planet-profiles'
import { solarCatalog } from './solar-catalog'

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

export function createLibrary(element: HTMLElement, entries: CatalogEntry[], open: (entry: CatalogEntry, action: CatalogAction) => void, signal: AbortSignal) {
  const kinds = new Set(entries.map(entry => entry.category))
  element.innerHTML = `
    <div class="library-content">
      <header class="library-heading">
        <h2 id="library-title" tabindex="-1">Библиотека небесных тел</h2>
      </header>
      <div class="library-filters">
        <label>Поиск по библиотеке<input type="search" id="library-search" placeholder="Например, Марс" autocomplete="off"></label>
        <label>Категория<select id="library-category">
          <option value="all">Все категории</option>
          ${[...kinds].map(kind => `<option value="${kind}">${categoryNames[kind]}</option>`).join('')}
        </select></label>
      </div>
      <div id="library-results" class="library-results" aria-live="polite"></div>
      <p id="library-error" role="status" hidden></p>
      <ul class="library-list" aria-label="Небесные тела">
        ${entries.map(({ id, name, englishName, category, classification, image, profile, scene }) => `<li class="library-item" data-entry="${id}">
          ${image ? `<div class="library-map"><img src="${import.meta.env.BASE_URL + image}" alt="" loading="lazy" width="1024" height="512"></div>` : ''}
          <div class="library-copy">
            <h3>${name}</h3>
            <p class="library-classification"><span lang="en">${englishName}</span> · ${category === 'model' ? 'Учебная модель · ' : ''}${classification}</p>
            <p>${profile.overview}</p>
            <dl class="planet-values library-values">${profile.properties.slice(0, 3).map(([label, value]) =>
              `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
            <div class="library-actions">
              <button type="button" class="focus-button" data-library-action="reference" aria-label="Открыть справку: ${name}">Справка</button>
              ${scene?.body.detail?.surfaceMap ? `<button type="button" class="planet-action" data-library-action="globe" aria-label="Открыть глобус: ${name}">Открыть глобус</button>` : ''}
              ${scene ? `<button type="button" class="planet-action" data-library-action="show" aria-label="Показать в системе: ${name}">Показать в системе</button>` : ''}
            </div>
          </div>
        </li>`).join('')}
      </ul>
    </div>`

  const search = element.querySelector<HTMLInputElement>('#library-search')!
  const category = element.querySelector<HTMLSelectElement>('#library-category')!
  const results = element.querySelector<HTMLElement>('#library-results')!
  const error = element.querySelector<HTMLElement>('#library-error')!
  const items = element.querySelectorAll<HTMLElement>('[data-entry]')
  let trigger: HTMLButtonElement | undefined
  let scrollTop = 0
  let failedGlobe: HTMLButtonElement | undefined

  function filter() {
    if (!error.hidden) clearError()
    const matches = new Set(filterCatalog(entries, search.value, category.value).map(entry => entry.id))
    for (const item of items) item.hidden = !matches.has(item.dataset.entry!)
    results.textContent = matches.size ? `Найдено объектов: ${matches.size}` : 'Ничего не найдено. Измените запрос или категорию.'
  }

  function clearError() {
    if (failedGlobe) {
      failedGlobe.textContent = 'Открыть глобус'
      failedGlobe.setAttribute('aria-label', failedGlobe.getAttribute('aria-label')!.replace('Повторить загрузку глобуса', 'Открыть глобус'))
    }
    failedGlobe = undefined
    error.textContent = ''
    error.hidden = true
  }
  search.addEventListener('input', filter, { signal })
  category.addEventListener('change', filter, { signal })
  element.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-library-action]')
    if (!button) return
    const entry = entries.find(item => item.id === button.closest<HTMLElement>('[data-entry]')?.dataset.entry)
    if (!entry) return
    trigger = button
    open(entry, button.dataset.libraryAction as CatalogAction)
  }, { signal })
  filter()

  return {
    remember() { scrollTop = element.scrollTop },
    focus(restore: boolean) {
      element.scrollTop = scrollTop
      if (restore && trigger && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true })
      else element.querySelector<HTMLElement>('#library-title')!.focus({ preventScroll: true })
    },
    error(message: string, retry = false) {
      clearError()
      if (!message) return
      const actions = trigger?.closest('.library-actions')
      if (actions) actions.before(error)
      else results.after(error)
      failedGlobe = retry && trigger?.dataset.libraryAction === 'globe' ? trigger : undefined
      if (failedGlobe) {
        failedGlobe.textContent = 'Повторить загрузку глобуса'
        failedGlobe.setAttribute('aria-label', failedGlobe.getAttribute('aria-label')!.replace('Открыть глобус', 'Повторить загрузку глобуса'))
      }
      error.textContent = message
      error.hidden = false
    },
  }
}
