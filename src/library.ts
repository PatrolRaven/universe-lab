import type { BodyProfile, Scenario } from './data'
import { explorerProfiles } from './planet-profiles'

export const categoryNames = {
  planet: 'Планеты',
  moon: 'Спутники',
  star: 'Звёзды',
  'minor-body': 'Малые тела',
} satisfies Record<BodyProfile['category'], string>

export function catalogEntries(scenarios: Scenario[]) {
  const entries = scenarios.flatMap(scenario => scenario.objects.flatMap(body => {
    const profile = explorerProfiles[body.id]
    const map = body.detail?.surfaceMap
    return profile && map ? [{ body, profile, image: body.appearance.thumbnail ?? map.url, scenario }] : []
  }))
  const seen = new Set<string>()
  return entries.filter(({ body }) => {
    if (seen.has(body.id)) return false
    seen.add(body.id)
    return true
  })
}

export type CatalogEntry = ReturnType<typeof catalogEntries>[number]

export function filterCatalog(entries: readonly CatalogEntry[], query: string, category: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return entries.filter(({ body, profile }) => {
    const { name, classification, category: kind } = body.profile
    const text = normalize(`${name} ${classification} ${categoryNames[kind]} ${profile.overview}`)
    return (category === 'all' || category === kind) && words.every(word => text.includes(word))
  })
}

function normalize(text: string) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()
}

export function createLibrary(element: HTMLElement, entries: CatalogEntry[], open: (entry: CatalogEntry, explore: boolean) => void, signal: AbortSignal) {
  const kinds = new Set(entries.map(entry => entry.body.profile.category))
  element.innerHTML = `
    <div class="library-content">
      <header class="library-heading">
        <h2 id="library-title" tabindex="-1">Библиотека небесных тел</h2>
        <p>Сравните характеристики и рассмотрите поверхность в трёхмерном исследователе.</p>
      </header>
      <div class="library-filters">
        <label>Поиск по библиотеке<input type="search" id="library-search" placeholder="Например, Марс" autocomplete="off"></label>
        <label>Категория<select id="library-category">
          <option value="all">Все категории</option>
          ${[...kinds].map(kind => `<option value="${kind}">${categoryNames[kind]}</option>`).join('')}
        </select></label>
      </div>
      <div id="library-results" class="library-results" aria-live="polite"></div>
      <ul class="library-list" aria-label="Небесные тела">
        ${entries.map(({ body, image, profile }) => `<li class="library-item" data-entry="${body.id}">
          <div class="library-map"><img src="${import.meta.env.BASE_URL + image}" alt="" loading="lazy" width="512" height="256"></div>
          <div class="library-copy">
            <h3>${body.profile.name}</h3>
            <p class="library-classification">${body.profile.classification}</p>
            <p>${profile.overview}</p>
            <dl class="planet-values library-values">${profile.properties.slice(0, 3).map(([label, value]) =>
              `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
            <div class="library-actions">
              <button type="button" class="focus-button explore-planet" data-library-action="explore" aria-label="Исследовать: ${body.profile.name}">Исследовать</button>
              <button type="button" class="planet-action" data-library-action="show" aria-label="Показать в системе: ${body.profile.name}">Показать в системе</button>
            </div>
          </div>
        </li>`).join('')}
      </ul>
      <p id="library-error" role="status" hidden></p>
    </div>`

  const search = element.querySelector<HTMLInputElement>('#library-search')!
  const category = element.querySelector<HTMLSelectElement>('#library-category')!
  const results = element.querySelector<HTMLElement>('#library-results')!
  const error = element.querySelector<HTMLElement>('#library-error')!
  const items = element.querySelectorAll<HTMLElement>('[data-entry]')
  let trigger: HTMLButtonElement | undefined

  function filter() {
    const matches = new Set(filterCatalog(entries, search.value, category.value).map(entry => entry.body.id))
    for (const item of items) item.hidden = !matches.has(item.dataset.entry!)
    results.textContent = matches.size ? `Найдено объектов: ${matches.size}` : 'Ничего не найдено. Измените запрос или категорию.'
  }
  search.addEventListener('input', filter, { signal })
  category.addEventListener('change', filter, { signal })
  element.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-library-action]')
    if (!button) return
    const entry = entries.find(item => item.body.id === button.closest<HTMLElement>('[data-entry]')?.dataset.entry)
    if (!entry) return
    trigger = button
    open(entry, button.dataset.libraryAction === 'explore')
  }, { signal })
  filter()

  return {
    focus(restore: boolean) {
      if (restore && trigger) {
        trigger.focus({ preventScroll: true })
        trigger.scrollIntoView({ block: 'nearest' })
      } else element.querySelector<HTMLElement>('#library-title')!.focus({ preventScroll: true })
    },
    error(message: string) {
      error.textContent = message
      error.hidden = !message
    },
  }
}
