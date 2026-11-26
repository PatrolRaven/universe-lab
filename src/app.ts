import './style.css'
import { SimulationClock } from './clock'
import { scenarios, type Scenario } from './data'
import { Simulation } from './physics'
import { SpaceScene } from './scene'
import { createUI } from './ui'

let scenario = scenarios[0]
let simulation = new Simulation(scenario.objects)
let selected = 0
const clock = new SimulationClock(performance.now(), !matchMedia('(prefers-reduced-motion: reduce)').matches, !document.hidden)
const lifecycle = new AbortController()
let scene: SpaceScene | undefined
let frame = 0

const ui = createUI(document.querySelector('#app')!, scenarios, {
  scenario: id => {
    const next = scenarios.find(item => item.id === id)
    if (next && next !== scenario) load(next)
  },
  select,
  play: () => {
    advanceClock(performance.now())
    clock.running = !clock.running
    ui.playing(clock.running)
    updateReadings()
  },
  reset: () => load(scenario),
  rate: value => {
    advanceClock(performance.now())
    clock.rate = value
  },
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
})

function updateReadings() {
  ui.readings(simulation.bodies[selected], simulation.elapsed)
}

function select(id: string) {
  const index = scenario.objects.findIndex(body => body.id === id)
  if (index < 0) return
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
    ui.sceneError('The graphics context was lost. Reload the page to restore the 3D view.')
    scene?.dispose()
    scene = undefined
  })
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'WebGL 2 is unavailable') throw error
  ui.sceneError('Enable hardware acceleration or open this lab in a browser with WebGL 2 support.')
}
load(scenario, true)
ui.playing(clock.running)

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
  if (clock.running && now - lastReadings > 75) {
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
