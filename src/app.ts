import './style.css'
import { SimulationClock } from './clock'
import { scenarios, type Scenario } from './data'
import { Simulation } from './physics'
import { SpaceScene } from './scene'
import { createUI, type LabView } from './ui'
import type { ExplorerQuality, ExplorerState } from './planet-explorer'
import { catalogEntries, type CatalogAction, type CatalogEntry } from './library'
import { atlasMap, atlasScenarios } from './stellar-atlas'

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
let view: LabView = 'galaxy'
let reference: { trigger: HTMLElement | null; scrollX: number; scrollY: number } | undefined
let libraryLaunch: { scenario: Scenario; simulation: Simulation; selectedId: string } | undefined
const visited = new Map<string, { simulation: Simulation; selectedId: string }>()
let loaded = false
let sceneFade: Animation | undefined
let frame = 0

const entries = catalogEntries(scenarios)
const availableScenarios = [...scenarios, ...atlasScenarios]
const ui = createUI(document.querySelector('#app')!, scenarios, entries, {
  scenario: id => {
    const next = availableScenarios.find(item => item.id === id)
    if (next && next !== scenario) openScenario(next)
  },
  enterSystem: id => {
    const next = availableScenarios.find(item => item.id === id)
    if (!next || !scene) return
    navigate('simulation', 'scene')
    openScenario(next)
  },
  galaxyOverview: () => scene?.galaxyOverview(),
  atlas: (ids, selected, nearby, focus) => scene?.setAtlas(ids, selected, nearby, focus),
  locateSun: () => scene?.locateSun(),
  galaxyKey: (key, shift) => scene?.galaxyKey(key, shift) ?? false,
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
  const previous = view
  view = next
  ui.navigate(next, focusTarget)
  sceneFade?.cancel()
  scene?.setGalaxy(next === 'galaxy')
  if (previous !== 'library' && next !== 'library' && !reducedMotion.matches) {
    sceneFade = ui.viewport.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' })
  }
  clock.rebase(performance.now())
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
  if (view !== 'library') {
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
    ui.libraryError('Для 3D-сцены нужен WebGL 2. Статья об объекте доступна.')
    return
  }
  if (action === 'globe') libraryLaunch = { scenario, simulation, selectedId: scenario.objects[selected].id }
  ui.libraryError('')
  navigate('simulation', 'scene')
  openScenario(target.scenario)
  select(target.body.id, action === 'show')
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
    select(previous.selectedId, false)
    navigate('library', 'restore')
    ui.libraryError(error ?? '', Boolean(error))
  }
}

function updateReadings() {
  ui.readings(simulation.bodies[selected])
}

function select(id: string, reveal = true) {
  const index = scenario.objects.findIndex(body => body.id === id)
  if (index < 0) return
  if (explorerState !== 'overview') return
  selected = index
  ui.selected(scenario.objects[index], reveal)
  scene?.select(id)
  updateReadings()
}

function load(next: Scenario, state = new Simulation(next.objects, next.stepSize, undefined, next.softening)) {
  if (loaded) visited.set(scenario.id, { simulation, selectedId: scenario.objects[selected].id })
  scenario = next
  simulation = state
  loaded = true
  ui.scenario(scenario)
  scene?.load(scenario, simulation)
  select(scenario.selection, false)
  clock.rebase(performance.now())
}

function openScenario(next: Scenario) {
  if (loaded && next === scenario) return
  const saved = visited.get(next.id)
  load(next, saved?.simulation)
  if (saved) select(saved.selectedId, false)
}

ui.navigate(view)
try {
  scene = new SpaceScene(ui.viewport, ui.labels, select, () => {
    scene?.dispose()
    scene = undefined
    if (explorerState !== 'overview') updateExplorer('overview', 'unavailable')
    ui.sceneError('Графический контекст потерян. Перезагрузите страницу, чтобы восстановить 3D-сцену.')
  }, updateExplorer, ui.galaxyMarker, ui.atlasMarkers)
  scene.setGalaxy(true)
  scene.setAtlas(atlasMap.map(point => point.id), '', false)
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'WebGL 2 is unavailable') throw error
  ui.sceneError('Включите аппаратное ускорение или откройте лабораторию в браузере с поддержкой WebGL 2.')
}

function sampleTrails() {
  scene?.sampleTrails(simulation)
}

function advanceClock(now: number) {
  const years = clock.sample(now)
  if (years > 0) simulation.advance(years * (scenario.timeScale ?? 1), sampleTrails)
}

let previousFrame = performance.now()
let lastReadings = 0
function animate(now: number) {
  const cameraDelta = Math.min(Math.max(0, (now - previousFrame) / 1000), 0.06)
  previousFrame = now
  const simulationVisible = view === 'simulation' && !reference
  if (simulationVisible) advanceClock(now)
  else clock.rebase(now)
  if (view === 'galaxy' && !reference) scene?.renderGalaxy()
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
  sceneFade?.cancel()
  scene?.dispose()
  ui.dispose()
}

const { signal } = lifecycle
reducedMotion.addEventListener('change', event => {
  clock.setReducedMotion(event.matches, performance.now())
  if (event.matches) sceneFade?.cancel()
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
