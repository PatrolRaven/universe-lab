import type { ObjectSpec, Scenario } from './data'
import type { Body } from './physics'
import type { Layers } from './scene'
import { galaxyDestinations } from './galaxy'
import type { ExplorerQuality, ExplorerState } from './planet-explorer'
import { createLibrary, type CatalogAction, type CatalogEntry } from './library'
import { articleContent, handleMediaError, objectFigure } from './reference-view'

const icons = {
  logo: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="12" ry="4.4" transform="rotate(-38 12 12)"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  binary: '<circle cx="8" cy="13" r="4"/><circle cx="16.5" cy="8" r="3"/><path d="M3 20c4 2 15-2 18-10"/>',
  sandbox: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  focus: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  frame: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="2"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  trail: '<path d="M3 19c3-7 8-11 13-13M8 21c2-4 4-7 6-8"/><circle cx="18.5" cy="5.5" r="2.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  label: '<path d="M4 5h16M12 5v14M8.5 19h7M4 5v3m16-3v3"/>',
  effects: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  back: '<path d="m11 5-7 7 7 7M4 12h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
} as const

type Icon = keyof typeof icons
const icon = (name: Icon, size = 18) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>'

const displays: { key: keyof Layers, title: string, icon: Icon }[] = [
  { key: 'orbits', title: 'Орбиты', icon: 'orbit' },
  { key: 'trails', title: 'Следы движения', icon: 'trail' },
  { key: 'labels', title: 'Подписи тел', icon: 'label' },
  { key: 'effects', title: 'Свечение и туманности', icon: 'effects' },
]

export type LabView = 'galaxy' | 'simulation' | 'library'

interface Actions {
  scenario: (id: string) => void
  select: (id: string) => void
  focus: () => void
  overview: () => void
  layers: (layers: Layers) => void
  explore: (id: string) => void
  exitExplorer: () => void
  toggleExplorerPanel: () => void
  upgradePlanetSurface: () => void
  planetCameraKey: (key: string) => boolean
  escapeExplorer: () => boolean
  navigate: (view: LabView) => void
  enterSystem: (id: string) => void
  galaxyOverview: () => void
  locateSun: () => void
  galaxyKey: (key: string, shift: boolean) => boolean
  openCatalogEntry: (entry: CatalogEntry, action: CatalogAction) => void
  openReference: (id: string) => void
  closeReference: () => void
}

function referenceContent({ profile }: CatalogEntry) {
  const links = (items: readonly (readonly [string, string])[]) =>
    items.map(([label, url]) => '<li><a href="' + (/^https?:/.test(url) ? url : import.meta.env.BASE_URL + url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a></li>').join('')
  const section = (title: string, description?: string) =>
    description ? `<details><summary>${title}</summary><p>${description}</p></details>` : ''
  const sources = [...profile.references, ...(profile.imagery ?? [])]
  return `
      <details open><summary>Обзор</summary><p>${profile.overview}</p></details>
      <details><summary>Характеристики</summary>
        <dl class="planet-values">${profile.properties.map(([label, value]) =>
          '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('')}</dl>
      </details>
      ${section(profile.surfaceTitle ?? 'Поверхность', profile.surface)}
      ${section(profile.atmosphereTitle ?? 'Атмосфера', profile.atmosphere)}
      ${section(profile.interiorTitle ?? 'Внутреннее строение', profile.interior)}
      ${section('Естественные спутники', profile.moons)}
      ${section('Интересный факт', profile.fact)}
      ${profile.history?.length ? `<details><summary>История исследований</summary><dl class="planet-history">${profile.history.map(([date, description]) =>
        '<div><dt>' + date + '</dt><dd>' + description + '</dd></div>').join('')}</dl></details>
      ` : ''}
      ${sources.length ? `<details><summary>Источники и изображения</summary><ul>${links(sources)}</ul></details>` : ''}
    `
}

const stars = (kind: ObjectSpec['appearance']['kind']) => kind === 'star'
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const precise = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3, minimumFractionDigits: 3 })
const scientificFormat = new Intl.NumberFormat('ru-RU', { notation: 'scientific', maximumFractionDigits: 3, minimumFractionDigits: 3 })
const scientific = (value: number) => scientificFormat.format(value).replace('E', ' × 10')
const magnitude = (v: number[]) => Math.hypot(v[0], v[1], v[2])
const coordinate = (value: number) => precise.format(Math.abs(value) < 0.0005 ? 0 : value)

export function createUI(root: HTMLElement, scenarios: Scenario[], entries: CatalogEntry[], actions: Actions) {
  const scenarioIcons: Icon[] = ['sun', 'binary', 'sandbox']
  root.innerHTML = `
    <a class="skip-link" id="skip-region" href="#body-selector">Перейти к выбору небесных тел</a>
    <div class="laboratory">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">${icon('logo', 24)}</div>
          <div><h1>Universe<span> Lab</span></h1></div>
        </div>
        <div class="top-system">
          <span class="mode-label">${icon('orbit', 16)}<span class="mode-simulation">Симуляция</span><span class="mode-explorer">Исследователь планет</span></span>
          <span class="top-slash" aria-hidden="true">${icon('arrow', 12)}</span>
          <span id="top-system"></span>
        </div>
        <nav class="main-nav" id="main-nav" aria-label="Разделы лаборатории">
          <button class="planet-action" id="nav-galaxy" type="button" aria-current="page">Галактика</button>
          <button class="planet-action" id="nav-simulation" type="button" hidden>Система</button>
          <button class="planet-action" id="nav-library" type="button">Библиотека</button>
        </nav>
      </header>

      <main class="workspace" id="workspace" aria-label="Орбитальная симуляция">
        <aside class="galaxy-panel" id="galaxy-panel" aria-label="Объекты и модели" hidden>
          <section aria-labelledby="galaxy-targets">
            <h2 id="galaxy-targets">На карте</h2>
            <button type="button" class="scenario" id="galaxy-select" aria-expanded="false" aria-controls="galaxy-solar">
              <span class="scenario-icon">${icon('sun', 19)}</span>
              <span class="scenario-copy"><strong>Солнечная система</strong><small>Локальный рукав Ориона</small></span>
              <span class="scenario-arrow">${icon('arrow', 13)}</span>
            </button>
            <div class="galaxy-solar" id="galaxy-solar" hidden>
              <p><strong>≈ 8,18 кпк</strong> от центра Млечного Пути. Расстояние оценено по наблюдениям.</p>
              <button type="button" class="focus-button" data-galaxy-launch="solar">Открыть систему ${icon('arrow', 13)}</button>
            </div>
          </section>
          <section aria-labelledby="galaxy-models">
            <h2 id="galaxy-models">Модели вне карты</h2>
            <div class="scenario-list">
              ${galaxyDestinations.filter(item => item.kind !== 'observed').map(item => `
                <button type="button" class="scenario" data-galaxy-launch="${item.id}">
                  <span class="scenario-icon">${icon(item.id, 19)}</span>
                  <span class="scenario-copy"><strong>${scenarios.find(scenario => scenario.id === item.id)!.name}</strong><small>${item.kind === 'educational' ? 'Учебная модель' : 'Сценарий из пяти тел'}</small></span>
                  <span class="scenario-arrow">${icon('arrow', 13)}</span>
                </button>`).join('')}
            </div>
          </section>
          <details class="galaxy-sources">
            <summary>О карте и источниках</summary>
            <p>Рукава, балдж, бар, звёздное поле, газ и пыль показаны процедурно. Положение Солнца опирается на астрономические наблюдения.</p>
            <ul>
              <li><a href="https://doi.org/10.1051/0004-6361/201935656" target="_blank" rel="noopener noreferrer">Расстояние до центра · GRAVITY, 2019</a></li>
              <li><a href="https://arxiv.org/abs/1910.03357" target="_blank" rel="noopener noreferrer">Структура рукавов · Reid и соавторы, 2019</a></li>
            </ul>
          </details>
        </aside>
        <button type="button" class="planet-action scene-settings" id="scene-settings" aria-controls="scene-catalog" aria-expanded="true">${icon('orbit', 16)} Сценарии и слои</button>
        <aside class="catalog" id="scene-catalog" aria-label="Сценарии и слои">
          <section class="scenario-section">
            <h2 class="section-label">Сценарии</h2>
            <div class="scenario-list">${scenarios.map((scenario, i) => `
              <button type="button" class="scenario" data-scenario="${scenario.id}" aria-pressed="false">
                <span class="scenario-icon">${icon(scenarioIcons[i], 19)}</span>
                <span class="scenario-copy"><strong>${scenario.name}</strong><small>${scenario.subtitle}</small></span>
                <span class="scenario-arrow">${icon('arrow', 13)}</span>
              </button>`).join('')}</div>
          </section>
          <section class="display" id="display-layers" tabindex="-1" aria-labelledby="display-title">
            <h2 id="display-title" class="section-label">Визуальные слои</h2>
            ${displays.map(item => `
              <label class="display-row">
                <span class="layer-icon">${icon(item.icon, 16)}</span><span>${item.title}</span>
                <input type="checkbox" role="switch" data-layer="${item.key}" checked><span class="toggle"></span>
              </label>`).join('')}
          </section>
          <div class="scene-credits" aria-label="Источники изображений">
            <a href="https://www.eso.org/public/images/eso0932a/" target="_blank" rel="noopener noreferrer">Космос: ESO / S. Brunier</a>
            <a href="${import.meta.env.BASE_URL}planets/SOURCES.md" target="_blank" rel="noopener noreferrer">Источники карт планет</a>
          </div>
        </aside>

        <section id="viewport" class="viewport" aria-labelledby="view-title" tabindex="-1">
          <div class="galaxy-overlay" id="galaxy-overlay" hidden>
            <div class="galaxy-heading">
              <h2 id="galaxy-title">Млечный Путь</h2>
              <p>Процедурная 3D-карта</p>
            </div>
            <button type="button" class="galaxy-marker" id="galaxy-marker" aria-expanded="false" aria-controls="galaxy-solar" hidden>
              <span aria-hidden="true"></span><strong>Солнечная система</strong>
            </button>
            <div class="galaxy-tools" aria-label="Камера галактики">
              <button class="planet-action" id="galaxy-overview" type="button">${icon('frame', 17)} Общий вид</button>
              <button class="planet-action" id="galaxy-locate" type="button">${icon('focus', 17)} Найти Солнечную систему</button>
            </div>
            <p id="galaxy-key-help" class="galaxy-key-help">Стрелки — вращение · Shift + стрелки — панорама · + / − — масштаб</p>
          </div>
          <div class="viewport-labels" id="viewport-labels"></div>
          <div class="view-header">
            <button class="planet-action" id="galaxy-back" type="button">${icon('back', 16)} К галактике</button>
            <h2 id="view-title"></h2>
          </div>
          <div class="planet-toolbar" id="planet-toolbar" hidden>
            <div class="planet-toolbar-actions">
              <button class="planet-action" type="button" id="planet-back">${icon('back', 16)} <span id="planet-back-label">К системе</span></button>
              <button class="planet-action" type="button" id="planet-info-toggle" aria-controls="planet-panel" aria-expanded="false" hidden>${icon('info', 16)} Справка</button>
            </div>
            <h2 id="planet-view-title">Исследование планеты</h2>
            <p class="planet-key-help" id="planet-key-help" hidden><kbd>↑ ↓ ← →</kbd> Вращение <span aria-hidden="true">·</span> <kbd>+ / = / −</kbd> Масштаб</p>
            <p class="planet-status" id="planet-status" role="status" hidden></p>
            <button class="planet-action planet-quality" type="button" id="planet-quality" hidden>Загрузить поверхность 4K</button>
          </div>
          <div class="camera-tools">
            <button type="button" id="overview" class="overview" title="Вернуться к общему виду (H)" aria-label="Вернуться к общему виду">${icon('frame', 19)}</button>
          </div>
          <div class="view-footer">
            <div class="view-actions">
              <div class="view-help view-help-mouse">${icon('mouse', 14)} <span>Вращение</span><b>·</b><span>Колесо — масштаб</span><b>·</b><span>Правая кнопка — панорама</span></div>
              <div class="view-help view-help-touch"><span>Вращение</span><b>·</b><span>Сведение пальцев — масштаб</span></div>
              <button type="button" class="inspect-link" id="inspect-open" aria-controls="inspector" aria-expanded="false">${icon('info', 14)}<span id="inspect-label"></span></button>
            </div>
            <div class="view-axis" aria-hidden="true"><span></span><span></span><span></span><i>X</i><i>Y</i><i>Z</i></div>
          </div>
          <div class="scene-error" id="scene-error" role="status" hidden></div>
        </section>

        <aside class="inspector" id="inspector" aria-labelledby="object-name" tabindex="-1">
          <button type="button" class="planet-action inspector-close" id="inspect-close" aria-label="Закрыть сведения">${icon('close', 18)}</button>
          <div class="inspector-media" id="inspector-media"></div>
          <div class="object-card">
            <div class="object-heading" id="object-heading">
              <div><p class="object-type" id="object-type"></p><h3 id="object-name"></h3></div>
            </div>
            <p id="profile-overview" class="profile-overview" hidden></p>
            <dl id="object-key-values" class="properties"></dl>
            <div class="object-actions">
              <button type="button" class="focus-button" id="focus">${icon('focus', 16)} Навести камеру</button>
              <button type="button" class="focus-button explore-planet" id="explore-planet" hidden>${icon('orbit', 17)} <span id="explore-planet-label">Открыть глобус</span></button>
              <button type="button" class="planet-action" id="object-reference">${icon('info', 16)} Справка</button>
            </div>
            <p class="planet-entry-error" id="planet-entry-error" role="status" hidden></p>
          </div>
          <details class="statistics">
            <summary class="section-label">Показания симуляции</summary>
            <dl class="properties">
              <div><dt>Масса</dt><dd><span id="mass"></span> <small>M☉</small></dd></div>
              <div><dt>Радиус</dt><dd><span id="radius"></span> <small>км</small></dd></div>
              <div><dt>Скорость</dt><dd><span id="speed"></span> <small>км/с</small></dd></div>
              <div><dt>Ускорение</dt><dd><span id="acceleration"></span> <small>а.е./год²</small></dd></div>
            </dl>
            <h3 class="section-label coordinates-label">Положение <small>а.е.</small></h3>
            <dl class="coordinates">
              <div><dt>X</dt><dd id="coordinate-x"></dd></div>
              <div><dt>Y</dt><dd id="coordinate-y"></dd></div>
              <div><dt>Z</dt><dd id="coordinate-z"></dd></div>
            </dl>
          </details>
        </aside>
        <aside class="planet-panel" id="planet-panel" aria-labelledby="planet-panel-title" hidden></aside>
      </main>

      <main class="library" id="library" aria-labelledby="library-title" tabindex="-1" hidden></main>
      <main class="library" id="object-explorer" aria-labelledby="object-explorer-title" hidden>
        <div class="object-explorer-content">
          <button class="planet-action" type="button" id="reference-back">${icon('back', 16)} <span id="reference-back-label"></span></button>
          <div id="object-explorer-sections"></div>
        </div>
      </main>

      <footer class="body-selector" id="body-selector" aria-label="Небесные тела"></footer>
    </div>`

  function node<T extends HTMLElement = HTMLElement>(id: string) {
    const result = root.querySelector<T>('#' + id)
    if (!result) throw new Error('Missing UI element: ' + id)
    return result
  }

  const viewport = node('viewport')
  const workspace = node('workspace')
  const nav = node('main-nav')
  const navGalaxy = node<HTMLButtonElement>('nav-galaxy')
  const navSimulation = node<HTMLButtonElement>('nav-simulation')
  const navLibrary = node<HTMLButtonElement>('nav-library')
  const libraryElement = node('library')
  const referenceElement = node('object-explorer')
  const referenceSections = node('object-explorer-sections')
  const referenceBackLabel = node('reference-back-label')
  const skip = node<HTMLAnchorElement>('skip-region')
  const labels = node('viewport-labels')
  const error = node('scene-error')
  const bodySelector = node('body-selector')
  const topSystem = node('top-system')
  const viewTitle = node('view-title')
  const galaxyPanel = node('galaxy-panel')
  const galaxyOverlay = node('galaxy-overlay')
  const galaxySelect = node<HTMLButtonElement>('galaxy-select')
  const galaxyMarker = node<HTMLButtonElement>('galaxy-marker')
  const galaxySolar = node('galaxy-solar')
  const galaxyOverview = node<HTMLButtonElement>('galaxy-overview')
  const galaxyLocate = node<HTMLButtonElement>('galaxy-locate')
  const galaxyLaunches = galaxyPanel.querySelectorAll<HTMLButtonElement>('[data-galaxy-launch]')
  const objectType = node('object-type')
  const objectName = node('object-name')
  const profileOverview = node('profile-overview')
  const inspectLabel = node('inspect-label')
  const inspector = node('inspector')
  const inspectorMedia = node('inspector-media')
  const objectValues = node('object-key-values')
  const inspectOpen = node('inspect-open')
  const inspectClose = node('inspect-close')
  const settings = node('scene-settings')
  const sceneCatalog = node('scene-catalog')
  const mass = node('mass')
  const radius = node('radius')
  const speed = node('speed')
  const acceleration = node('acceleration')
  const x = node('coordinate-x')
  const y = node('coordinate-y')
  const z = node('coordinate-z')
  const focus = node<HTMLButtonElement>('focus')
  const overview = node<HTMLButtonElement>('overview')
  const explore = node<HTMLButtonElement>('explore-planet')
  const exploreLabel = node('explore-planet-label')
  const planetToolbar = node('planet-toolbar')
  const planetViewTitle = node('planet-view-title')
  const planetKeyHelp = node('planet-key-help')
  const planetBack = node<HTMLButtonElement>('planet-back')
  const planetBackLabel = node('planet-back-label')
  const planetToggle = node<HTMLButtonElement>('planet-info-toggle')
  const planetPanel = node('planet-panel')
  const planetQuality = node<HTMLButtonElement>('planet-quality')
  const planetStatus = node('planet-status')
  const planetEntryError = node('planet-entry-error')
  const scenarioButtons = root.querySelectorAll<HTMLButtonElement>('[data-scenario]')
  const layerInputs = root.querySelectorAll<HTMLInputElement>('[data-layer]')
  const layers: Layers = { orbits: true, trails: true, labels: true, effects: true }

  const lifecycle = new AbortController()
  const { signal } = lifecycle
  root.addEventListener('error', handleMediaError, { capture: true, signal })
  root.dataset.planetState = 'overview'
  root.dataset.view = 'simulation'
  const compact = matchMedia('(max-width: 720px)')
  let displayedMedia = ''
  let explorerState: ExplorerState = 'overview'
  let selectedId = ''
  let explorerError = ''
  let selectedSpec: ObjectSpec | undefined
  let libraryOpen = false
  let hasOpenedSystem = false
  const entriesById = new Map(entries.map(entry => [entry.id, entry]))
  const library = createLibrary(libraryElement, entries, actions.openCatalogEntry, signal)
  function selectSun(fromMap = false) {
    galaxySolar.hidden = false
    for (const button of [galaxySelect, galaxyMarker]) button.setAttribute('aria-expanded', 'true')
    if (fromMap && matchMedia('(max-width: 850px)').matches) {
      galaxySelect.focus()
      galaxySelect.scrollIntoView({ block: 'nearest' })
    }
  }
  galaxyMarker.addEventListener('click', () => selectSun(true), { signal })
  galaxySelect.addEventListener('click', () => selectSun(), { signal })
  for (const button of galaxyLaunches) {
    button.addEventListener('click', () => actions.enterSystem(button.dataset.galaxyLaunch!), { signal })
  }
  galaxyOverview.addEventListener('click', actions.galaxyOverview, { signal })
  galaxyLocate.addEventListener('click', () => {
    selectSun()
    actions.locateSun()
  }, { signal })
  navGalaxy.addEventListener('click', () => actions.navigate('galaxy'), { signal })
  node('galaxy-back').addEventListener('click', () => actions.navigate('galaxy'), { signal })
  navSimulation.addEventListener('click', () => actions.navigate('simulation'), { signal })
  navLibrary.addEventListener('click', () => actions.navigate('library'), { signal })

  function showSettings(open: boolean) {
    sceneCatalog.hidden = !open
    settings.setAttribute('aria-expanded', String(open))
  }
  function showInspector(open: boolean) {
    inspector.hidden = !open
    inspectOpen.setAttribute('aria-expanded', String(open))
    if (open && selectedId && displayedMedia !== selectedId) {
      const entry = entriesById.get(selectedId)
      inspectorMedia.innerHTML = entry ? objectFigure(entry) : ''
      displayedMedia = selectedId
    }
  }
  showSettings(!compact.matches)
  showInspector(!compact.matches)
  settings.addEventListener('click', () => {
    if (compact.matches && sceneCatalog.hidden) showInspector(false)
    showSettings(sceneCatalog.hidden)
  }, { signal })
  inspectOpen.addEventListener('click', () => {
    if (!inspector.hidden) {
      showInspector(false)
      return
    }
    if (compact.matches) showSettings(false)
    showInspector(true)
    inspectClose.focus({ preventScroll: true })
  }, { signal })
  inspectClose.addEventListener('click', () => {
    showInspector(false)
    inspectOpen.focus({ preventScroll: true })
  }, { signal })
  compact.addEventListener('change', event => {
    if (event.matches && !inspector.hidden) showSettings(false)
  }, { signal })

  function updateExploreButton() {
    explore.hidden = !selectedSpec?.detail?.surfaceMap || explorerState !== 'overview'
    const canRetry = !explore.hidden && Boolean(explorerError)
    exploreLabel.textContent = canRetry ? 'Повторить загрузку' : 'Открыть глобус'
    planetEntryError.textContent = canRetry ? explorerError : ''
    planetEntryError.hidden = !canRetry
  }
  for (const button of scenarioButtons) {
    button.addEventListener('click', () => actions.scenario(button.dataset.scenario!), { signal })
  }
  bodySelector.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-body]')
    if (button) actions.select(button.dataset.body!)
  }, { signal })
  for (const input of layerInputs) {
    input.addEventListener('change', () => {
      layers[input.dataset.layer as keyof Layers] = input.checked
      actions.layers(layers)
    }, { signal })
  }
  focus.addEventListener('click', () => {
    if (compact.matches) showInspector(false)
    actions.focus()
  }, { signal })
  overview.addEventListener('click', actions.overview, { signal })
  explore.addEventListener('click', () => actions.explore(selectedId), { signal })
  node('object-reference').addEventListener('click', () => actions.openReference(selectedId), { signal })
  node('reference-back').addEventListener('click', actions.closeReference, { signal })
  planetBack.addEventListener('click', () => {
    if (explorerState !== 'exiting') actions.exitExplorer()
  }, { signal })
  planetToggle.addEventListener('click', actions.toggleExplorerPanel, { signal })
  planetPanel.addEventListener('click', event => {
    if ((event.target as Element).closest('#planet-close')) actions.toggleExplorerPanel()
  }, { signal })
  planetQuality.addEventListener('click', () => {
    if (planetQuality.getAttribute('aria-disabled') !== 'true') actions.upgradePlanetSurface()
  }, { signal })

  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) return
    const handled = root.dataset.view === 'galaxy' ? actions.galaxyKey(event.key, event.shiftKey)
      : explorerState === 'exploring' && actions.planetCameraKey(event.key)
    if (handled) event.preventDefault()
  }, { signal })

  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape' && actions.escapeExplorer()) {
      event.preventDefault()
      return
    }
    if (event.target instanceof Element
      && event.target.closest('button, input, textarea, select, a, summary, [contenteditable]')) return
    if (event.code === 'KeyH' && referenceElement.hidden) {
      if (root.dataset.view === 'simulation') actions.overview()
      if (root.dataset.view === 'galaxy') actions.galaxyOverview()
    }
  }, { signal })

  return {
    viewport, labels, galaxyMarker,
    navigate(view: LabView, focusTarget?: 'navigation' | 'restore' | 'scene') {
      if (libraryOpen && view !== 'library') library.remember()
      libraryOpen = view === 'library'
      referenceElement.hidden = true
      root.dataset.view = view
      const galaxyOpen = view === 'galaxy'
      workspace.hidden = libraryOpen
      bodySelector.hidden = view !== 'simulation'
      libraryElement.hidden = !libraryOpen
      galaxyPanel.hidden = galaxyOverlay.hidden = !galaxyOpen
      if (view === 'simulation') hasOpenedSystem = true
      navSimulation.hidden = galaxyOpen || !hasOpenedSystem
      viewport.tabIndex = galaxyOpen ? 0 : -1
      viewport.setAttribute('aria-labelledby', galaxyOpen ? 'galaxy-title' : 'view-title')
      workspace.setAttribute('aria-label', galaxyOpen ? 'Галактический обзор' : 'Орбитальная симуляция')
      if (galaxyOpen) viewport.setAttribute('aria-describedby', 'galaxy-key-help')
      else viewport.removeAttribute('aria-describedby')
      const current = libraryOpen ? navLibrary : galaxyOpen ? navGalaxy : navSimulation
      for (const button of [navLibrary, navGalaxy, navSimulation]) button.removeAttribute('aria-current')
      current.setAttribute('aria-current', 'page')
      skip.href = libraryOpen ? '#library' : galaxyOpen ? '#viewport' : '#body-selector'
      skip.textContent = libraryOpen ? 'Перейти к библиотеке' : galaxyOpen ? 'Перейти к карте галактики' : 'Перейти к выбору небесных тел'
      if (focusTarget && libraryOpen) library.focus(focusTarget === 'restore')
      else if (focusTarget === 'navigation') current.focus({ preventScroll: true })
      else if (focusTarget === 'scene') {
        viewport.focus({ preventScroll: true })
        viewport.scrollIntoView({ block: 'nearest' })
      }
    },
    reference(entry: CatalogEntry, fromLibrary: boolean) {
      if (fromLibrary) library.remember()
      libraryOpen = false
      root.dataset.view = 'reference'
      workspace.hidden = bodySelector.hidden = libraryElement.hidden = true
      referenceElement.hidden = false
      referenceElement.scrollTop = 0
      navLibrary.removeAttribute('aria-current')
      navSimulation.removeAttribute('aria-current')
      navGalaxy.removeAttribute('aria-current')
      referenceSections.innerHTML = articleContent(entry, { titleId: 'object-explorer-title' })
      referenceBackLabel.textContent = fromLibrary ? 'К библиотеке' : 'К системе'
      skip.href = '#object-explorer-title'
      skip.textContent = 'Перейти к справке'
      node('object-explorer-title').focus({ preventScroll: true })
    },
    libraryError: library.error,
    scenario(scenario: Scenario) {
      topSystem.textContent = scenario.name
      viewTitle.textContent = scenario.name
      for (const button of scenarioButtons) button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario.id))
      bodySelector.innerHTML = scenario.objects.map(spec => {
        const map = spec.detail?.surfaceMap?.url ?? spec.appearance.thumbnail
        const image = map
          ? `url('${new URL(map, new URL(import.meta.env.BASE_URL, location.href)).href}')`
          : `radial-gradient(circle at 34% 28%, ${spec.appearance.color}, #07101b 76%)`
        return `<button type="button" class="body-choice" data-body="${spec.id}" aria-pressed="false" aria-label="Выбрать ${spec.profile.name}">
          <span class="body-thumbnail ${stars(spec.appearance.kind) ? 'stellar' : ''}" style="--body-color:${spec.appearance.color};--body-image:${image}"></span>
          <span>${spec.profile.name}</span>
        </button>`
      }).join('')
    },
    selected(spec: ObjectSpec, reveal: boolean) {
      if (selectedId !== spec.id) explorerError = ''
      selectedId = spec.id
      selectedSpec = spec
      const entry = entriesById.get(spec.id)
      planetPanel.innerHTML = entry ? `
        <div class="planet-panel-heading">
          <h2 id="planet-panel-title">${entry.name}</h2>
          <button class="planet-action planet-close" type="button" id="planet-close" aria-label="Закрыть справку">${icon('close', 18)}</button>
        </div>${referenceContent(entry)}` : ''
      updateExploreButton()
      for (const button of bodySelector.querySelectorAll<HTMLButtonElement>('[data-body]')) {
        button.setAttribute('aria-pressed', String(button.dataset.body === spec.id))
      }
      const { profile } = spec
      objectType.textContent = profile.classification
      objectName.textContent = profile.name
      inspectLabel.textContent = profile.name
      profileOverview.textContent = entry?.profile.overview ?? profile.overview ?? ''
      profileOverview.hidden = !profileOverview.textContent
      objectValues.innerHTML = (entry?.profile.properties ?? []).slice(0, 3).map(([key, value]) =>
        `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')
      if (reveal && compact.matches) showSettings(false)
      if (reveal || !inspector.hidden) showInspector(true)
      mass.textContent = scientific(spec.mass)
      radius.textContent = format.format(profile.radiusKm)
    },
    readings(body: Body) {
      speed.textContent = precise.format(magnitude(body.velocity) * 4.74047)
      acceleration.textContent = precise.format(magnitude(body.acceleration))
      x.textContent = coordinate(body.position[0])
      y.textContent = coordinate(body.position[1])
      z.textContent = coordinate(body.position[2])
    },
    explorer(state: ExplorerState, panelOpen: boolean, quality: ExplorerQuality, errorMessage = '', fromLibrary = false) {
      const previous = explorerState
      const wasInsidePanel = planetPanel.contains(document.activeElement)
      const wasInsideExplorer = wasInsidePanel || planetToolbar.contains(document.activeElement) || document.activeElement === viewport
      const qualityHadFocus = document.activeElement === planetQuality
      explorerState = state
      explorerError = errorMessage
      planetViewTitle.textContent = selectedSpec ? 'Исследование: ' + selectedSpec.profile.name : 'Исследование планеты'
      const active = state !== 'overview'
      nav.hidden = active
      skip.href = active ? '#viewport' : '#body-selector'
      skip.textContent = active ? 'Перейти к сцене планеты' : 'Перейти к выбору небесных тел'
      const panelVisible = state === 'exploring' && panelOpen
      root.dataset.planetState = state
      root.dataset.planet = selectedId
      root.dataset.planetPanel = panelVisible ? 'open' : 'closed'
      viewport.setAttribute('aria-labelledby', active ? 'planet-view-title' : 'view-title')
      viewport.tabIndex = state === 'exploring' ? 0 : -1
      if (state === 'exploring') viewport.setAttribute('aria-describedby', 'planet-key-help')
      else viewport.removeAttribute('aria-describedby')
      planetKeyHelp.hidden = state !== 'exploring'
      planetToolbar.hidden = !active
      planetPanel.hidden = !panelVisible
      planetToggle.hidden = state !== 'exploring'
      planetToggle.setAttribute('aria-expanded', String(panelVisible))
      planetBack.setAttribute('aria-disabled', String(state === 'exiting'))
      planetBackLabel.textContent = fromLibrary ? 'К библиотеке' : 'К системе'
      planetQuality.hidden = state !== 'exploring' || quality === 'unavailable' || quality === 'high'
      if (planetQuality.hidden && qualityHadFocus && state === 'exploring') planetToggle.focus({ preventScroll: true })
      planetQuality.setAttribute('aria-disabled', String(quality === 'loading'))
      planetQuality.textContent = quality === 'loading' ? 'Загрузка 4K…' : 'Загрузить поверхность 4K'
      const planet = selectedSpec?.profile.name ?? 'планеты'
      planetStatus.textContent = errorMessage
        || (state === 'entering' ? `Подготовка обзора: ${planet}…` : state === 'exiting' ? 'Возвращаемся к предыдущему разделу…' : '')
      planetStatus.hidden = !active || !planetStatus.textContent
      updateExploreButton()
      if (previous === 'overview' && active) {
        if (matchMedia('(max-width: 850px)').matches) viewport.scrollIntoView({ block: 'start' })
        planetBack.focus({ preventScroll: true })
      }
      if (previous === 'entering' && state === 'exploring' && document.activeElement === planetBack) {
        viewport.focus({ preventScroll: true })
      }
      if (wasInsidePanel && !panelVisible && state === 'exploring') planetToggle.focus({ preventScroll: true })
      if (previous !== 'exiting' && state === 'exiting') planetBack.focus({ preventScroll: true })
      if (previous !== 'overview' && !active && !fromLibrary && wasInsideExplorer && !explore.hidden) {
        explore.focus({ preventScroll: true })
        if (matchMedia('(max-width: 850px)').matches) explore.scrollIntoView({ block: 'nearest' })
      }
    },
    sceneError(message: string) {
      error.innerHTML = '<div>' + icon('info', 23) + '<strong>3D-сцена недоступна</strong><p></p></div>'
      error.querySelector('p')!.textContent = message
      error.hidden = false
      focus.disabled = true
      overview.disabled = true
      explore.disabled = true
      galaxyMarker.hidden = true
      for (const button of [galaxyOverview, galaxyLocate, ...galaxyLaunches]) button.disabled = true
      library.error(message)
      for (const input of layerInputs) input.disabled = true
    },
    dispose() { lifecycle.abort() },
  }
}
