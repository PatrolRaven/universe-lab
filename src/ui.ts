import type { ObjectSpec, Scenario } from './data'
import type { Body } from './physics'
import type { Layers } from './scene'

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
  label: '<path d="M4 5h16M12 5v14M8.5 19h7M4 5v3m16-3v3"/>',
  effects: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/>',
  play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="2.8"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
} as const

type Icon = keyof typeof icons
const icon = (name: Icon, size = 18) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>'

const displays: { key: keyof Layers, title: string, icon: Icon }[] = [
  { key: 'orbits', title: 'Orbital paths', icon: 'orbit' },
  { key: 'trails', title: 'Motion trails', icon: 'trail' },
  { key: 'labels', title: 'Object labels', icon: 'label' },
  { key: 'effects', title: 'Glow & nebula', icon: 'effects' },
]

export const rates = [0.25, 0.5, 1, 2, 4, 8]

interface Actions {
  scenario: (id: string) => void
  select: (id: string) => void
  play: () => void
  reset: () => void
  rate: (rate: number) => void
  focus: () => void
  overview: () => void
  layers: (layers: Layers) => void
}

const stars = (kind: ObjectSpec['appearance']['kind']) => kind === 'star'
const format = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const precise = new Intl.NumberFormat('en', { maximumFractionDigits: 3, minimumFractionDigits: 3 })
const scientific = (value: number) => value >= 0.01 ? value.toFixed(3) : value.toExponential(3).replace('e-', 'e−')
const magnitude = (v: number[]) => Math.hypot(v[0], v[1], v[2])
const coordinate = (value: number) => precise.format(Math.abs(value) < 0.0005 ? 0 : value)

export function createUI(root: HTMLElement, scenarios: Scenario[], actions: Actions) {
  const scenarioIcons: Icon[] = ['sun', 'binary', 'sandbox']
  root.innerHTML = `
    <a class="skip-link" href="#simulation">Skip to simulation controls</a>
    <div class="laboratory">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">${icon('logo', 24)}</div>
          <div><h1>Universe<span> Lab</span></h1><p>ORBITAL SIMULATOR</p></div>
        </div>
        <div class="top-system"><span class="top-slash">/</span> <span id="top-system"></span></div>
        <div class="top-status">
          <span class="run-status"><i></i><span id="run-label">Simulation live</span></span>
          <span class="header-divider"></span>
          <span class="model-status">${icon('orbit', 15)} Newtonian N-body</span>
        </div>
      </header>

      <main class="workspace" aria-label="Orbital simulation">
        <aside class="catalog" aria-label="Scenarios and objects">
          <section>
            <h2 class="section-label">Scenarios</h2>
            <div class="scenario-list">${scenarios.map((scenario, i) => `
              <button type="button" class="scenario" data-scenario="${scenario.id}" aria-pressed="false">
                <span class="scenario-icon">${icon(scenarioIcons[i], 19)}</span>
                <span class="scenario-copy"><strong>${scenario.name}</strong><small>${scenario.subtitle}</small></span>
                <span class="scenario-arrow">${icon('arrow', 13)}</span>
              </button>`).join('')}</div>
          </section>
          <section class="object-section">
            <div class="section-heading"><h2 class="section-label">Celestial bodies</h2><span id="object-count" class="count"></span></div>
            <div class="object-list" id="object-list"></div>
          </section>
        </aside>

        <section id="viewport" class="viewport" aria-labelledby="view-title" tabindex="-1">
          <div class="viewport-labels" id="viewport-labels"></div>
          <div class="view-header" data-enter>
            <div class="view-kicker"><span></span> SYSTEM VIEW</div>
            <h2 id="view-title"></h2>
            <p id="view-description"></p>
          </div>
          <button type="button" id="overview" class="overview" title="Return to system view (H)" aria-label="Return to system view">${icon('frame', 19)}</button>
          <div class="frame-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="view-footer">
            <div class="view-actions">
              <div class="view-help view-help-mouse">${icon('mouse', 14)} <span>Drag to rotate</span><b>·</b><span>Scroll to zoom</span><b>·</b><span>Right-drag to pan</span></div>
              <div class="view-help view-help-touch"><span>Drag to rotate</span><b>·</b><span>Pinch to zoom</span></div>
              <a class="inspect-link" href="#inspector">${icon('info', 14)}<span id="inspect-label"></span>${icon('arrow', 12)}</a>
            </div>
            <div class="view-axis" aria-hidden="true"><span></span><span></span><span></span><i>X</i><i>Y</i><i>Z</i></div>
          </div>
          <div class="scene-error" id="scene-error" role="status" hidden></div>
        </section>

        <aside class="inspector" id="inspector" aria-label="Object inspector and display" tabindex="-1">
          <div class="section-heading"><h2 class="section-label">Object inspector</h2>${icon('focus', 16)}</div>
          <div class="object-heading" id="object-heading">
            <div class="object-emblem" id="object-emblem" aria-hidden="true"><i></i></div>
            <div><p class="object-type" id="object-type"></p><h3 id="object-name"></h3></div>
          </div>
          <p id="profile-overview" class="profile-overview" hidden></p>
          <button type="button" class="focus-button" id="focus">${icon('focus', 17)} Focus camera</button>
          <section class="statistics" aria-labelledby="physical-title">
            <h3 id="physical-title" class="section-label">Physical properties</h3>
            <dl class="properties">
              <div><dt>Mass</dt><dd><span id="mass"></span> <small>M☉</small></dd></div>
              <div><dt>Radius</dt><dd><span id="radius"></span> <small>km</small></dd></div>
              <div><dt>Speed</dt><dd><span id="speed"></span> <small>km/s</small></dd></div>
              <div><dt>Acceleration</dt><dd><span id="acceleration"></span> <small>AU/yr²</small></dd></div>
            </dl>
            <h3 class="section-label coordinates-label">Position <small>AU</small></h3>
            <dl class="coordinates">
              <div><dt>X</dt><dd id="coordinate-x"></dd></div>
              <div><dt>Y</dt><dd id="coordinate-y"></dd></div>
              <div><dt>Z</dt><dd id="coordinate-z"></dd></div>
            </dl>
          </section>
          <section class="display" aria-labelledby="display-title">
            <h3 id="display-title" class="section-label">Display layers</h3>
            ${displays.map(item => `
              <label class="display-row">
                <span class="layer-icon">${icon(item.icon, 16)}</span><span>${item.title}</span>
                <input type="checkbox" role="switch" data-layer="${item.key}" checked><span class="toggle"></span>
              </label>`).join('')}
          </section>
        </aside>
      </main>

      <footer class="timebar" id="simulation" tabindex="-1" aria-label="Simulation controls">
        <div class="transport">
          <button type="button" id="play" class="play-button" aria-label="Pause simulation" title="Play or pause (Space)">${icon('pause', 23)}</button>
          <button type="button" id="reset" class="reset-button" aria-label="Reset simulation" title="Reset simulation (R)">${icon('reset', 19)}</button>
          <div class="time-readout"><span class="section-label">Simulation time</span><strong><span id="elapsed">0.00</span><small> days</small></strong></div>
        </div>
        <div class="rate-control">
          <div class="rate-meta"><label class="section-label" for="rate">Time scale</label><output for="rate" id="rate-value">1×</output></div>
          <input id="rate" type="range" min="0" max="5" step="1" value="2" aria-valuetext="1×">
          <div class="rate-ticks" aria-hidden="true"><span>0.25×</span><span>0.5×</span><span>1×</span><span>2×</span><span>4×</span><span>8×</span></div>
        </div>
        <div class="keyboard"><kbd>Space</kbd> <span>Play / pause</span></div>
      </footer>
    </div>`

  function node<T extends HTMLElement = HTMLElement>(id: string) {
    const result = root.querySelector<T>('#' + id)
    if (!result) throw new Error('Missing UI element: ' + id)
    return result
  }

  const viewport = node('viewport')
  const labels = node('viewport-labels')
  const error = node('scene-error')
  const list = node('object-list')
  const objectCount = node('object-count')
  const topSystem = node('top-system')
  const viewTitle = node('view-title')
  const description = node('view-description')
  const objectType = node('object-type')
  const objectName = node('object-name')
  const profileOverview = node('profile-overview')
  const inspectLabel = node('inspect-label')
  const emblem = node('object-emblem')
  const mass = node('mass')
  const radius = node('radius')
  const speed = node('speed')
  const acceleration = node('acceleration')
  const x = node('coordinate-x')
  const y = node('coordinate-y')
  const z = node('coordinate-z')
  const elapsed = node('elapsed')
  const rate = node<HTMLInputElement>('rate')
  const rateValue = node('rate-value')
  const play = node<HTMLButtonElement>('play')
  const reset = node<HTMLButtonElement>('reset')
  const focus = node<HTMLButtonElement>('focus')
  const overview = node<HTMLButtonElement>('overview')
  const runLabel = node('run-label')
  const scenarioButtons = root.querySelectorAll<HTMLButtonElement>('[data-scenario]')
  const layerInputs = root.querySelectorAll<HTMLInputElement>('[data-layer]')
  const layers: Layers = { orbits: true, trails: true, labels: true, effects: true }

  const lifecycle = new AbortController()
  const { signal } = lifecycle
  for (const button of scenarioButtons) {
    button.addEventListener('click', () => actions.scenario(button.dataset.scenario!), { signal })
  }
  list.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-body]')
    if (button) actions.select(button.dataset.body!)
  }, { signal })
  for (const input of layerInputs) {
    input.addEventListener('change', () => {
      layers[input.dataset.layer as keyof Layers] = input.checked
      actions.layers(layers)
    }, { signal })
  }
  rate.addEventListener('input', () => {
    const index = Number(rate.value)
    const value = rates[index]
    rateValue.textContent = value + '×'
    rate.setAttribute('aria-valuetext', value + '×')
    rate.style.setProperty('--progress', index / (rates.length - 1) * 100 + '%')
    actions.rate(value)
  }, { signal })
  play.addEventListener('click', actions.play, { signal })
  reset.addEventListener('click', actions.reset, { signal })
  focus.addEventListener('click', actions.focus, { signal })
  overview.addEventListener('click', actions.overview, { signal })

  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey
      || (event.target as HTMLElement).closest('button, input, textarea, select, a, [contenteditable]')) return
    if (event.code === 'Space') {
      event.preventDefault()
      actions.play()
    }
    if (event.code === 'KeyR') actions.reset()
    if (event.code === 'KeyH') actions.overview()
  }, { signal })

  return {
    viewport, labels,
    scenario(scenario: Scenario) {
      topSystem.textContent = scenario.name
      viewTitle.textContent = scenario.name
      description.textContent = scenario.description
      objectCount.textContent = String(scenario.objects.length).padStart(2, '0')
      for (const button of scenarioButtons) button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario.id))
      list.innerHTML = scenario.objects.map(spec => `
        <button type="button" class="object-row" data-body="${spec.id}" aria-pressed="false">
          <span class="object-dot${stars(spec.appearance.kind) ? ' stellar' : ''}" style="--body-color:${spec.appearance.color}"></span>
          <span>${spec.profile.name}</span><span class="object-chevron">${icon('arrow', 12)}</span>
        </button>`).join('')
    },
    selected(spec: ObjectSpec) {
      for (const button of list.querySelectorAll<HTMLButtonElement>('[data-body]')) {
        button.setAttribute('aria-pressed', String(button.dataset.body === spec.id))
      }
      const { profile } = spec
      objectType.textContent = profile.classification
      objectName.textContent = profile.name
      inspectLabel.textContent = 'Inspect ' + profile.name
      profileOverview.textContent = profile.overview ?? ''
      profileOverview.hidden = !profile.overview
      emblem.dataset.kind = spec.appearance.kind
      emblem.style.setProperty('--body-color', spec.appearance.color)
      emblem.style.setProperty('--body-dark', spec.appearance.dark)
      emblem.style.setProperty('--body-accent', spec.appearance.accent)
      mass.textContent = scientific(spec.mass)
      radius.textContent = format.format(profile.radiusKm)
    },
    readings(body: Body, years: number) {
      elapsed.textContent = (years * 365.25).toFixed(2)
      speed.textContent = (magnitude(body.velocity) * 4.74047).toFixed(2)
      acceleration.textContent = precise.format(magnitude(body.acceleration))
      x.textContent = coordinate(body.position[0])
      y.textContent = coordinate(body.position[1])
      z.textContent = coordinate(body.position[2])
    },
    playing(playing: boolean) {
      root.classList.toggle('paused', !playing)
      runLabel.textContent = playing ? 'Simulation live' : 'Simulation paused'
      play.innerHTML = icon(playing ? 'pause' : 'play', 23)
      play.setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation')
    },
    sceneError(message: string) {
      error.innerHTML = '<div>' + icon('info', 23) + '<strong>3D view unavailable</strong><p></p></div>'
      error.querySelector('p')!.textContent = message
      error.hidden = false
      focus.disabled = true
      overview.disabled = true
      for (const input of layerInputs) input.disabled = true
    },
    dispose() { lifecycle.abort() },
  }
}
