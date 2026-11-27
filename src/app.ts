import './style.css'
import { SimulationClock } from './clock'
import { scenarios, type Scenario } from './data'
import { Simulation } from './physics'
import { SpaceScene } from './scene'
import { createUI } from './ui'
import type { ExplorerQuality, ExplorerState } from './planet-explorer'
import { catalogEntries, type CatalogAction, type CatalogEntry } from './library'

let scenario = scenarios[0]
let simulation = new Simulation(scenario.objects)
let selected = 0
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const clock = new SimulationClock(performance.now(), reducedMotion.matches, !document.hidden)
const lifecycle = new AbortController()
let scene: SpaceScene | undefined
let explorerState: ExplorerState = 'overview'
let explorerQuality: ExplorerQuality = 'unavailable'
let explorerError: string | undefined
let explorerPanel = false
let view: 'simulation' | 'library' = 'simulation'
let reference: { trigger: HTMLElement | null; scrollX: number; scrollY: number } | undefined
let libraryLaunch: { scenario: Scenario; simulation: Simulation; selectedId: string } | undefined
let frame = 0

const entries = catalogEntries(scenarios)
const ui = createUI(document.querySelector('#app')!, scenarios, entries, {
  scenario: id => {
    const next = scenarios.find(item => item.id === id)
    if (next && next !== scenario) load(next)
  },
  select,
  focus: () => {
    if (!scene) return
    if (matchMedia('(max-width: 850px)').matches) {
      ui.viewport.focus({ preventScroll: true })
      ui.viewport.scrollIntoView({ block: 'start' })
    }
    scene.focus(simulation.bodies[selected].id)
  },
  overview: () => scene?.overview(),
  layers: layers => scene?.setLayers(layers),
  explore: id => scene?.explorePlanet(id),
  exitExplorer: () => scene?.exitExplorer(),
  toggleExplorerPanel,
  upgradePlanetSurface: () => scene?.upgradePlanetSurface(),
  planetCameraKey: key => scene?.planetCameraKey(key) ?? false,
  navigate,
  openCatalogEntry,
  openReference: id => {
    const entry = entries.find(item => item.id === id)
    if (entry) openReference(entry)
  },
  closeReference,
  escapeExplorer: () => {
    if (reference) {
      closeReference()
      return true
    }
    if (explorerState === 'overview') return false
    if (explorerState === 'exploring' && explorerPanel) toggleExplorerPanel()
    else scene?.exitExplorer()
    return true
  },
})

function navigate(next: typeof view, focusTarget: 'navigation' | 'restore' | 'scene' = 'navigation') {
  if (explorerState !== 'overview') return
  if (next === view) {
    if (reference) closeReference()
    return
  }
  reference = undefined
  view = next
  ui.navigate(next, focusTarget)
  if (next === 'simulation') scene?.resize()
}

function openReference(entry: CatalogEntry) {
  reference = {
    trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    scrollX: window.scrollX, scrollY: window.scrollY,
  }
  ui.reference(entry, view === 'library')
}

function closeReference() {
  const previous = reference
  if (!previous) return
  reference = undefined
  ui.navigate(view, view === 'library' ? 'restore' : undefined)
  if (view === 'simulation') {
    scene?.resize()
    previous.trigger?.focus({ preventScroll: true })
  }
  window.scrollTo(previous.scrollX, previous.scrollY)
}

function openCatalogEntry(entry: CatalogEntry, action: CatalogAction) {
  if (action === 'reference') {
    openReference(entry)
    return
  }
  const target = entry.scene
  if (!target) return
  if (!scene) {
    ui.libraryError('Для 3D-сцены нужен WebGL 2. Справка об объекте доступна в карточке.')
    return
  }
  if (action === 'globe') libraryLaunch = { scenario, simulation, selectedId: scenario.objects[selected].id }
  ui.libraryError('')
  navigate('simulation', 'scene')
  if (target.scenario !== scenario) load(target.scenario)
  select(target.body.id)
  if (action === 'globe') scene.explorePlanet(target.body.id)
  else scene.focus(target.body.id)
}

function toggleExplorerPanel() {
  if (explorerState !== 'exploring') return
  explorerPanel = !explorerPanel
  ui.explorer(explorerState, explorerPanel, explorerQuality, explorerError, Boolean(libraryLaunch))
}

function updateExplorer(state: ExplorerState, quality: ExplorerQuality, error?: string) {
  if (state === 'exploring' && explorerState === 'entering') {
    explorerPanel = !matchMedia('(max-width: 850px)').matches
  }
  if (state !== 'exploring') explorerPanel = false
  explorerState = state
  explorerQuality = quality
  explorerError = error
  ui.explorer(state, explorerPanel, quality, error, Boolean(libraryLaunch))
  if (state === 'overview' && libraryLaunch) {
    const previous = libraryLaunch
    libraryLaunch = undefined
    if (previous.scenario !== scenario) load(previous.scenario, previous.simulation)
    select(previous.selectedId)
    navigate('library', 'restore')
    ui.libraryError(error ?? '', Boolean(error))
  }
}

function updateReadings() {
  ui.readings(simulation.bodies[selected])
}

function select(id: string) {
  const index = scenario.objects.findIndex(body => body.id === id)
  if (index < 0) return
  if (explorerState !== 'overview') return
  selected = index
  ui.selected(scenario.objects[index])
  scene?.select(id)
  updateReadings()
}

function load(next: Scenario, state = new Simulation(next.objects)) {
  scenario = next
  simulation = state
  ui.scenario(scenario)
  scene?.load(scenario, simulation)
  select(scenario.selection)
  clock.rebase(performance.now())
}

try {
  scene = new SpaceScene(ui.viewport, ui.labels, select, () => {
    scene?.dispose()
    scene = undefined
    if (explorerState !== 'overview') updateExplorer('overview', 'unavailable')
    ui.sceneError('Графический контекст потерян. Перезагрузите страницу, чтобы восстановить 3D-сцену.')
  }, updateExplorer)
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'WebGL 2 is unavailable') throw error
  ui.sceneError('Включите аппаратное ускорение или откройте лабораторию в браузере с поддержкой WebGL 2.')
}
load(scenario, simulation)

function sampleTrails() {
  scene?.sampleTrails(simulation)
}

function advanceClock(now: number) {
  const years = clock.sample(now)
  if (years > 0) simulation.advance(years, sampleTrails)
}

let previousFrame = performance.now()
let lastReadings = 0
function animate(now: number) {
  const cameraDelta = Math.min(Math.max(0, (now - previousFrame) / 1000), 0.06)
  previousFrame = now
  advanceClock(now)
  const simulationVisible = view === 'simulation' && !reference
  if (simulationVisible) scene?.render(simulation, cameraDelta)
  if (simulationVisible && now - lastReadings > 75) {
    updateReadings()
    lastReadings = now
  }
  frame = requestAnimationFrame(animate)
}
frame = requestAnimationFrame(animate)

function dispose() {
  cancelAnimationFrame(frame)
  lifecycle.abort()
  scene?.dispose()
  ui.dispose()
}

const { signal } = lifecycle
reducedMotion.addEventListener('change', event => {
  clock.setReducedMotion(event.matches, performance.now())
}, { signal })
document.addEventListener('visibilitychange', () => {
  clock.setVisible(!document.hidden, performance.now())
}, { signal })
window.addEventListener('pagehide', event => {
  if (event.persisted) clock.setVisible(false, performance.now())
  else dispose()
}, { signal })
window.addEventListener('pageshow', event => {
  if (event.persisted) clock.setVisible(!document.hidden, performance.now())
}, { signal })
