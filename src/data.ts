import { G, SOFTENING, type BodyInput, type Vector } from './physics'

interface Appearance {
  color: string
  dark: string
  accent: string
  size: number
  kind: 'star' | 'rock' | 'gas' | 'ice' | 'terrestrial'
  ring?: boolean
  thumbnail?: string
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
  highResolutionUrl?: string
  credit?: string
}

export interface DetailedAppearance {
  surfaceMap?: MapAsset
  elevationMap?: MapAsset & { minElevationKm: number; maxElevationKm: number }
  cloudMap?: MapAsset
  normalMap?: MapAsset
  nightMap?: MapAsset
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
    profile: { name, category: 'star', classification: 'Звезда главной последовательности', radiusKm: radius },
    position: [0, 0, 0], velocity: [0, 0, 0], period: 0,
    appearance: { size, color, dark: '#e06a16', accent: '#fff2ad', kind: 'star' },
  }
}

function orbit(
  parent: Pick<BodyInput, 'mass' | 'position' | 'velocity'>, id: string, name: string, mass: number, radius: number, distance: number,
  angle: number, inclination: number, appearance: Appearance, classification: string,
  details: Partial<Pick<BodyProfile, 'category' | 'overview'>> = {},
  detail?: DetailedAppearance,
): ObjectSpec {
  const speed = Math.sqrt(G * parent.mass * distance ** 2 / (distance ** 2 + SOFTENING ** 2) ** 1.5)
  const radial: Vector = [Math.cos(angle), Math.sin(angle) * Math.sin(inclination), Math.sin(angle) * Math.cos(inclination)]
  const tangent: Vector = [-Math.sin(angle), Math.cos(angle) * Math.sin(inclination), Math.cos(angle) * Math.cos(inclination)]
  return {
    id, mass, appearance, detail,
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

const sun = star('sun', 'Солнце', 1, 695700, 0.61, '#ffac39')
const solar = center([
  sun,
  orbit(sun, 'mercury', 'Меркурий', 1.66e-7, 2439.7, 0.97, 2.4, 0.06,
    { color: '#b69e91', dark: '#53484b', accent: '#dbb7a6', size: 0.102, kind: 'rock', thumbnail: 'planets/mercury.webp' }, 'Планета земной группы'),
  orbit(sun, 'venus', 'Венера', 2.45e-6, 6051.8, 1.68, 3.8, 0.04,
    { color: '#e7b674', dark: '#995231', accent: '#ffe4a2', size: 0.169, kind: 'gas', thumbnail: 'planets/venus.webp' }, 'Планета земной группы'),
  orbit(sun, 'earth', 'Земля', 3.003e-6, 6371, 2.49, 0.1, 0,
    { color: '#3b9aff', dark: '#123778', accent: '#77b091', size: 0.197, kind: 'terrestrial', thumbnail: 'planets/earth.webp' }, 'Планета земной группы',
    { overview: 'Третья планета от Солнца с океанами жидкой воды и богатой азотом атмосферой.' },
    {
      surfaceMap: { url: 'earth/albedo-2k.webp', highResolutionUrl: 'earth/albedo-4k.webp', credit: 'NASA Earth Observatory' },
      normalMap: { url: 'earth/normal-1k.webp', highResolutionUrl: 'earth/normal-2k.webp', credit: 'NOAA NCEI ETOPO 2022' },
      nightMap: { url: 'earth/night-1k.webp', credit: 'NASA Earth Observatory' },
    }),
  orbit(sun, 'mars', 'Марс', 3.227e-7, 3389.5, 3.49, 4.45, 0.025,
    { color: '#dd7756', dark: '#793530', accent: '#f9bc87', size: 0.145, kind: 'rock', thumbnail: 'planets/mars.webp' }, 'Планета земной группы',
    { overview: 'Четвёртая планета от Солнца, холодный пустынный мир с древними руслами и крупнейшими вулканами.' },
    { surfaceMap: { url: 'planets/mars.webp', credit: 'Solar System Scope / INOVE, CC BY 4.0' },
      atmosphere: { color: '#b87352', scaleHeightKm: 11.1 } }),
  orbit(sun, 'jupiter', 'Юпитер', 9.546e-4, 69911, 4.99, 2.8, 0.013,
    { color: '#dfaf8a', dark: '#885f58', accent: '#f3d4ac', size: 0.416, kind: 'gas', thumbnail: 'planets/jupiter.webp' }, 'Газовый гигант'),
  orbit(sun, 'saturn', 'Сатурн', 2.857e-4, 58232, 6.61, 0.98, 0.038,
    { color: '#e1b985', dark: '#987453', accent: '#f7dfad', size: 0.32, kind: 'gas', ring: true, thumbnail: 'planets/saturn.webp' }, 'Газовый гигант'),
  orbit(sun, 'uranus', 'Уран', 4.366e-5, 25362, 8.29, 3.53, 0.018,
    { color: '#8ccee1', dark: '#426f83', accent: '#c1e8ed', size: 0.24, kind: 'ice', thumbnail: 'planets/uranus.webp' }, 'Ледяной гигант'),
  orbit(sun, 'neptune', 'Нептун', 5.151e-5, 24622, 10.03, 5.46, 0.033,
    { color: '#6f92fa', dark: '#282a8b', accent: '#b4caff', size: 0.232, kind: 'ice', thumbnail: 'planets/neptune.webp' }, 'Ледяной гигант'),
])

const primary = star('atlas', 'Атлас A', 1.15, 770000, 0.51, '#ffb354')
const companion = star('atlas-b', 'Атлас B', 0.78, 590000, 0.39, '#92c4ff')
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
  }, 'vesper', 'Веспер', 5e-5, 21500, 8.1, 2.2, 0.09,
    { color: '#a9d9dc', dark: '#3e677e', accent: '#bfeee3', size: 0.31, kind: 'ice', ring: true }, 'Планета двойной звезды'),
])

const kepler = star('kepler', 'Кеплер', 0.88, 613000, 0.55, '#ffc165')
const dune = orbit(kepler, 'dune', 'Дюна', 0.014, 40100, 3.45, 0.35, -0.17,
  { color: '#ed9c75', dark: '#81516a', accent: '#f6d39a', size: 0.215, kind: 'gas', ring: true }, 'Газовый гигант',
  { overview: 'Вокруг этого газового гиганта с кольцами обращается спутник Эмбер.' })
const ember = orbit(dune, 'ember', 'Эмбер', 3e-6, 2160, 0.25, 1.3, 0.09,
  { color: '#ec9e6c', dark: '#663d40', accent: '#f6dac2', size: 0.063, kind: 'rock' }, 'Естественный спутник', { category: 'moon' })
// Its world-space prediction follows the host's orbit as well as the moon's.
ember.period = dune.period
const sandbox = center([
  kepler, dune, ember,
  orbit(kepler, 'pelagos', 'Пелагос', 4e-5, 8400, 5.89, 2.5, 0.33,
    { color: '#51d8cf', dark: '#23598d', accent: '#89b492', size: 0.24, kind: 'terrestrial' }, 'Океаническая планета'),
  orbit(kepler, 'nomad', 'Кочевник', 1e-9, 42, 9.15, 5.45, -0.48,
    { color: '#9eb8f8', dark: '#354e8c', accent: '#dceaff', size: 0.123, kind: 'ice' }, 'Наклонённая малая планета', { category: 'minor-body' }),
])

export const scenarios: Scenario[] = [
  { id: 'solar', name: 'Солнечная система', subtitle: '1 звезда · 8 планет',
    description: 'Исследуйте восемь планет в масштабной модели Солнечной системы.', objects: solar, selection: 'earth', frame: 10.6 },
  { id: 'binary', name: 'Двойная звезда', subtitle: '2 звезды · 1 планета',
    description: 'Наблюдайте, как две звезды обращаются вокруг общего центра масс.', objects: binary, selection: 'atlas', frame: 8.6 },
  { id: 'sandbox', name: 'Песочница', subtitle: '1 звезда · 4 тела',
    description: 'Изучайте спутник, наклонённые орбиты и массивный газовый гигант.', objects: sandbox, selection: 'dune', frame: 9.7 },
]
