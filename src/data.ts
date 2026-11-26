import { G, SOFTENING, type BodyInput, type Vector } from './physics'

interface Appearance {
  color: string
  dark: string
  accent: string
  size: number
  kind: 'star' | 'rock' | 'gas' | 'ice' | 'terrestrial'
  ring?: boolean
}

export interface BodyProfile {
  name: string
  category: 'star' | 'planet' | 'moon' | 'minor-body'
  classification: string
  radiusKm: number
  overview?: string
  science?: {
    surfaceAndStructure?: string
    atmosphere?: string
    explorationHistory?: string
  }
}

interface MapAsset {
  url: string
  credit?: string
}

export interface DetailedAppearance {
  surfaceMap?: MapAsset
  elevationMap?: MapAsset & { minElevationKm: number; maxElevationKm: number }
  cloudMap?: MapAsset
  atmosphere?: { color: string; scaleHeightKm: number }
}

export interface ObjectSpec extends BodyInput {
  profile: BodyProfile
  appearance: Appearance
  detail?: DetailedAppearance
  period: number
}

export interface Scenario {
  id: string
  name: string
  subtitle: string
  description: string
  objects: ObjectSpec[]
  selection: string
  frame: number
}

function star(id: string, name: string, mass: number, radius: number, size: number, color: string): ObjectSpec {
  return {
    id, mass,
    profile: { name, category: 'star', classification: 'Main-sequence star', radiusKm: radius },
    position: [0, 0, 0], velocity: [0, 0, 0], period: 0,
    appearance: { size, color, dark: '#e06a16', accent: '#fff2ad', kind: 'star' },
  }
}

function orbit(
  parent: Pick<BodyInput, 'mass' | 'position' | 'velocity'>, id: string, name: string, mass: number, radius: number, distance: number,
  angle: number, inclination: number, appearance: Appearance, classification: string,
  details: Partial<Pick<BodyProfile, 'category' | 'overview'>> = {},
): ObjectSpec {
  const speed = Math.sqrt(G * parent.mass * distance ** 2 / (distance ** 2 + SOFTENING ** 2) ** 1.5)
  const radial: Vector = [Math.cos(angle), Math.sin(angle) * Math.sin(inclination), Math.sin(angle) * Math.cos(inclination)]
  const tangent: Vector = [-Math.sin(angle), Math.cos(angle) * Math.sin(inclination), Math.cos(angle) * Math.cos(inclination)]
  return {
    id, mass, appearance,
    profile: { name, category: 'planet', classification, radiusKm: radius, ...details },
    position: radial.map((value, axis) => parent.position[axis] + distance * value) as Vector,
    velocity: tangent.map((value, axis) => parent.velocity[axis] + speed * value) as Vector,
    period: 2 * Math.PI * distance / speed,
  }
}

function center(objects: ObjectSpec[]) {
  const mass = objects.reduce((total, body) => total + body.mass, 0)
  for (let axis = 0; axis < 3; axis++) {
    const position = objects.reduce((total, body) => total + body.mass * body.position[axis], 0) / mass
    const velocity = objects.reduce((total, body) => total + body.mass * body.velocity[axis], 0) / mass
    for (const body of objects) {
      body.position[axis] -= position
      body.velocity[axis] -= velocity
    }
  }
  return objects
}

const sun = star('sun', 'Sun', 1, 695700, 0.61, '#ffac39')
const solar = center([
  sun,
  orbit(sun, 'mercury', 'Mercury', 1.66e-7, 2439.7, 0.97, 2.4, 0.06,
    { color: '#b69e91', dark: '#53484b', accent: '#dbb7a6', size: 0.102, kind: 'rock' }, 'Terrestrial planet'),
  orbit(sun, 'venus', 'Venus', 2.45e-6, 6051.8, 1.68, 3.8, 0.04,
    { color: '#e7b674', dark: '#995231', accent: '#ffe4a2', size: 0.169, kind: 'gas' }, 'Terrestrial planet'),
  orbit(sun, 'earth', 'Earth', 3.003e-6, 6371, 2.49, 0.1, 0,
    { color: '#3b9aff', dark: '#123778', accent: '#77b091', size: 0.197, kind: 'terrestrial' }, 'Terrestrial planet',
    { overview: 'The third planet from the Sun has liquid-water oceans and a nitrogen-rich atmosphere.' }),
  orbit(sun, 'mars', 'Mars', 3.227e-7, 3389.5, 3.49, 4.45, 0.025,
    { color: '#dd7756', dark: '#793530', accent: '#f9bc87', size: 0.145, kind: 'rock' }, 'Terrestrial planet'),
  orbit(sun, 'jupiter', 'Jupiter', 9.546e-4, 69911, 4.99, 2.8, 0.013,
    { color: '#dfaf8a', dark: '#885f58', accent: '#f3d4ac', size: 0.416, kind: 'gas' }, 'Gas giant'),
  orbit(sun, 'saturn', 'Saturn', 2.857e-4, 58232, 6.61, 0.98, 0.038,
    { color: '#e1b985', dark: '#987453', accent: '#f7dfad', size: 0.32, kind: 'gas', ring: true }, 'Gas giant'),
  orbit(sun, 'uranus', 'Uranus', 4.366e-5, 25362, 8.29, 3.53, 0.018,
    { color: '#8ccee1', dark: '#426f83', accent: '#c1e8ed', size: 0.24, kind: 'ice' }, 'Ice giant'),
  orbit(sun, 'neptune', 'Neptune', 5.151e-5, 24622, 10.03, 5.46, 0.033,
    { color: '#6f92fa', dark: '#282a8b', accent: '#b4caff', size: 0.232, kind: 'ice' }, 'Ice giant'),
])

const primary = star('atlas', 'Atlas A', 1.15, 770000, 0.51, '#ffb354')
const companion = star('atlas-b', 'Atlas B', 0.78, 590000, 0.39, '#92c4ff')
companion.appearance.dark = '#466fe6'
companion.appearance.accent = '#f0f9ff'
const separation = 2.65
const rotation = Math.sqrt(G * (primary.mass + companion.mass) / (separation ** 2 + SOFTENING ** 2) ** 1.5)
companion.position = [separation, 0, 0]
companion.velocity = [0, 0, rotation * separation]
primary.period = companion.period = 2 * Math.PI / rotation
const binary = center([primary, companion,
  orbit({ mass: primary.mass + companion.mass,
    position: [separation * companion.mass / (primary.mass + companion.mass), 0, 0],
    velocity: [0, 0, companion.velocity[2] * companion.mass / (primary.mass + companion.mass)],
  }, 'vesper', 'Vesper', 5e-5, 21500, 8.1, 2.2, 0.09,
    { color: '#a9d9dc', dark: '#3e677e', accent: '#bfeee3', size: 0.31, kind: 'ice', ring: true }, 'Circumbinary planet'),
])

const kepler = star('kepler', 'Kepler', 0.88, 613000, 0.55, '#ffc165')
const dune = orbit(kepler, 'dune', 'Dune', 0.014, 40100, 3.45, 0.35, -0.17,
  { color: '#ed9c75', dark: '#81516a', accent: '#f6d39a', size: 0.215, kind: 'gas', ring: true }, 'Gas giant',
  { overview: 'This ringed gas giant is orbited by Ember in the Sandbox system.' })
const ember = orbit(dune, 'ember', 'Ember', 3e-6, 2160, 0.25, 1.3, 0.09,
  { color: '#ec9e6c', dark: '#663d40', accent: '#f6dac2', size: 0.063, kind: 'rock' }, 'Natural satellite', { category: 'moon' })
// Its world-space prediction follows the host's orbit as well as the moon's.
ember.period = dune.period
const sandbox = center([
  kepler, dune, ember,
  orbit(kepler, 'pelagos', 'Pelagos', 4e-5, 8400, 5.89, 2.5, 0.33,
    { color: '#51d8cf', dark: '#23598d', accent: '#89b492', size: 0.24, kind: 'terrestrial' }, 'Ocean planet'),
  orbit(kepler, 'nomad', 'Nomad', 1e-9, 42, 9.15, 5.45, -0.48,
    { color: '#9eb8f8', dark: '#354e8c', accent: '#dceaff', size: 0.123, kind: 'ice' }, 'Inclined minor body', { category: 'minor-body' }),
])

export const scenarios: Scenario[] = [
  { id: 'solar', name: 'Solar System', subtitle: '1 star · 8 planets',
    description: 'Explore eight planets in a scaled model of the Solar System.', objects: solar, selection: 'earth', frame: 10.6 },
  { id: 'binary', name: 'Binary Star', subtitle: '2 stars · 1 planet',
    description: 'Watch two stars orbit a common center of mass.', objects: binary, selection: 'atlas', frame: 8.6 },
  { id: 'sandbox', name: 'Sandbox', subtitle: '1 star · 4 orbiting bodies',
    description: 'Follow a moon, tilted orbits and a massive gas giant.', objects: sandbox, selection: 'dune', frame: 9.7 },
]
