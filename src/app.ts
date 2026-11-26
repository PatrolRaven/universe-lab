import './style.css'
import { SimulationClock } from './clock'
import { scenarios, type Scenario } from './data'
import { Simulation } from './physics'
import { SpaceScene } from './scene'
import { createUI } from './ui'
import type { ExplorerQuality, ExplorerState } from './planet-explorer'

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
let frame = 0

const ui = createUI(document.querySelector('#app')!, scenarios, {
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
  escapeExplorer: () => {
    if (explorerState === 'overview') return false
    if (explorerState === 'exploring' && explorerPanel) toggleExplorerPanel()
    else scene?.exitExplorer()
    return true
  },
})

function toggleExplorerPanel() {
  if (explorerState !== 'exploring') return
  explorerPanel = !explorerPanel
  ui.explorer(explorerState, explorerPanel, explorerQuality, explorerError)
}

function updateExplorer(state: ExplorerState, quality: ExplorerQuality, error?: string) {
  if (state === 'exploring' && explorerState === 'entering') {
    explorerPanel = !matchMedia('(max-width: 850px)').matches
  }
  if (state !== 'exploring') explorerPanel = false
  explorerState = state
  explorerQuality = quality
  explorerError = error
  ui.explorer(state, explorerPanel, quality, error)
}

function updateReadings() {
  ui.readings(simulation.bodies[selected])
}

function select(id: string) {
  const index = scenario.objects.findIndex(body => body.id === id)
  if (index < 0) return
  if (id !== 'earth' && id !== 'mars' && explorerState !== 'overview') scene?.exitExplorer()
  selected = index
  ui.selected(scenario.objects[index])
  scene?.select(id)
  updateReadings()
}

function load(next: Scenario, initial = false) {
  const changed = initial || next !== scenario
  scenario = next
  if (!initial) simulation = new Simulation(scenario.objects)
  if (changed) ui.scenario(scenario)
  scene?.load(scenario, simulation)
  select(scenario.selection)
  clock.rebase(performance.now())
}

try {
  scene = new SpaceScene(ui.viewport, ui.labels, select, () => {
    scene?.dispose()
    scene = undefined
    ui.sceneError('Графический контекст потерян. Перезагрузите страницу, чтобы восстановить 3D-сцену.')
  }, updateExplorer)
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'WebGL 2 is unavailable') throw error
  ui.sceneError('Включите аппаратное ускорение или откройте лабораторию в браузере с поддержкой WebGL 2.')
}
load(scenario, true)

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
  scene?.render(simulation, cameraDelta)
  if (now - lastReadings > 75) {
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
