import type { CatalogEntry } from './library'
import type { ObjectSpec, Scenario } from './data'
import type { Vector } from './physics'
import { G } from './physics'

export const atlasKinds = {
  star: 'Звёзды',
  'multiple-star': 'Кратные системы',
  exoplanet: 'Экзопланеты',
  nebula: 'Туманности',
  cluster: 'Скопления',
  'black-hole': 'Чёрные дыры',
} as const

export type AtlasKind = keyof typeof atlasKinds
type Source = readonly [string, string]
type Coordinates = readonly [ra: number, dec: number, distance: number]

export interface AtlasObject {
  id: string
  name: string
  englishName: string
  category: AtlasKind
  classification: string
  coordinates: Coordinates
  overview: string
  sources: readonly Source[]
  properties?: readonly Source[]
  systemId?: string
  hostId?: string
}

const nasa = (name: string): Source => ['NASA Exoplanet Archive · PSCompPars',
  'https://exoplanetarchive.ipac.caltech.edu/overview/' + encodeURIComponent(name)]
const simbad = (name: string): Source => ['SIMBAD · CDS',
  'https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + encodeURIComponent(name)]

export const orionImage: Source = ['NASA, ESA, M. Robberto и команда Hubble Treasury', 'https://science.nasa.gov/asset/hubble/orion-nebula/']
export const trappistImage: Source = ['NASA, ESA, CSA, Joseph Olmsted (STScI)', 'https://science.nasa.gov/asset/webb/trappist-1-system-artists-concept/']
const gravity: Source = ['GRAVITY Collaboration · A&A 625, L10', 'https://doi.org/10.1051/0004-6361/201935656']
export const galacticCenterDistance = 8.178
export const nearbyRadius = 30

export interface AtlasMapPoint {
  id: string
  name: string
  category?: AtlasKind
  local: Vector
  galactic: Vector
  hostId?: string
}

// ICRS to Galactic, using the IAU Galactic axes expressed in ICRS.
export function localPosition([ra, dec, distance]: Coordinates): Vector {
  const a = ra * Math.PI / 180
  const d = dec * Math.PI / 180
  const x = Math.cos(a) * Math.cos(d) * distance
  const y = Math.sin(a) * Math.cos(d) * distance
  const z = Math.sin(d) * distance
  return [
    0.4941094279 * x - 0.4448296300 * y + 0.7469822445 * z,
    -0.8676661490 * x - 0.1980763734 * y + 0.4559837762 * z,
    0.0548755604 * x + 0.8734370902 * y + 0.4838350155 * z,
  ]
}

const records: AtlasObject[] = [
  { id: 'alpha-centauri', name: 'Альфа Центавра', englishName: 'Alpha Centauri AB · Rigil Kentaurus · Toliman',
    category: 'multiple-star', classification: 'Кратная звёздная система', coordinates: [219.902, -60.835, 1.34],
    overview: 'Альфа Центавра A и B образуют тесную пару. Проксима находится значительно дальше от этой пары и имеет собственную планетную систему. Маркер отмечает пару AB.',
    sources: [simbad('alf Cen A'), simbad('alf Cen B')] },
  { id: 'sirius', name: 'Сириус', englishName: 'Sirius A/B · Alpha Canis Majoris',
    category: 'multiple-star', classification: 'Двойная звезда', coordinates: [101.287, -16.716, 2.64],
    overview: 'Яркий Сириус A и белый карлик Сириус B обращаются вокруг общего центра масс. Пара показывает, как различаются стадии эволюции звёзд.',
    sources: [simbad('Sirius A'), simbad('Sirius B')] },
  { id: 'vega', name: 'Вега', englishName: 'Vega · Alpha Lyrae',
    category: 'star', classification: 'Звезда спектрального класса A', coordinates: [279.235, 38.784, 7.68],
    overview: 'Яркая звезда созвездия Лиры. Быстрое вращение влияет на её форму и температуру поверхности.',
    sources: [simbad('Vega')] },
  { id: 'wolf-359', name: 'Вольф 359', englishName: 'Wolf 359 · CN Leo',
    category: 'star', classification: 'Красный карлик', coordinates: [164.120, 7.015, 2.41],
    overview: 'Одна из ближайших звёзд. Несмотря на близость, малосветимый красный карлик требует телескопа для наблюдений.',
    sources: [simbad('Wolf 359')] },
  { id: 'barnard', name: 'Звезда Барнарда', englishName: "Barnard’s Star · GJ 699",
    category: 'star', classification: 'Красный карлик', coordinates: [269.449, 4.738, 1.827],
    overview: 'Близкий красный карлик с большим собственным движением. Его угловое положение среди далёких звёзд заметно меняется на снимках разных эпох.',
    sources: [simbad('GJ 699'), nasa("Barnard's star")] },
  { id: 'orion-nebula', name: 'Туманность Ориона', englishName: 'Orion Nebula · M42 · NGC 1976',
    category: 'nebula', classification: 'Область ионизованного водорода', coordinates: [83.822, -5.391, 414],
    overview: 'Одна из ближайших областей активного звездообразования. Ультрафиолет молодых звёзд Трапеции ионизует окружающий газ. Точка показывает приблизительный центр области.',
    sources: [simbad('M 42'), ['Параллакс области Ориона · Menten и др.', 'https://doi.org/10.1051/0004-6361:20078247'], orionImage] },
  { id: 'crab-nebula', name: 'Крабовидная туманность', englishName: 'Crab Nebula · M1 · NGC 1952',
    category: 'nebula', classification: 'Остаток сверхновой', coordinates: [83.633, 22.014, 2000],
    overview: 'Расширяющийся остаток сверхновой 1054 года. В его центре находится пульсар, питающий излучение туманности.',
    sources: [simbad('M 1'), ['Hubble · обзор M1', 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/']] },
  { id: 'pleiades', name: 'Плеяды', englishName: 'Pleiades · M45 · Seven Sisters',
    category: 'cluster', classification: 'Рассеянное звёздное скопление', coordinates: [56.75, 24.117, 136],
    overview: 'Молодое рассеянное скопление в Тельце. Маркер указывает примерный центр группы, а её члены занимают объём в пространстве.',
    sources: [simbad('M 45'), ['Расстояние по VLBI · Melis и др.', 'https://doi.org/10.1126/science.1256101']] },
  { id: 'm13', name: 'Скопление Геркулеса', englishName: 'Hercules Globular Cluster · M13 · NGC 6205',
    category: 'cluster', classification: 'Шаровое звёздное скопление', coordinates: [250.422, 36.460, 7100],
    overview: 'Плотное шаровое скопление в гало Млечного Пути. Его положение на карте помогает увидеть, что звёздные системы Галактики лежат и вне диска.',
    sources: [simbad('M 13'), ['Hubble · обзор M13', 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-13/']] },
  { id: 'sagittarius-a', name: 'Стрелец A*', englishName: 'Sagittarius A* · Sgr A*',
    category: 'black-hole', classification: 'Сверхмассивная чёрная дыра', coordinates: [266.4168, -29.0078, 8178],
    overview: 'Компактный радиоисточник в центре Млечного Пути. Орбиты ближайших звёзд позволяют измерить расстояние до центра и ограничить массу компактного объекта.',
    sources: [simbad('Sgr A*'), gravity, ['Изображение EHT · ESO', 'https://www.eso.org/public/images/eso2208-eht-mwa/']] },
  { id: 'cygnus-x1', name: 'Лебедь X-1', englishName: 'Cygnus X-1 · Cyg X-1',
    category: 'black-hole', classification: 'Чёрная дыра звёздной массы', coordinates: [299.59036, 35.20158, 2220],
    overview: 'Рентгеновская двойная система с чёрной дырой и массивной звездой-компаньоном. Горячее вещество, перетекающее к чёрной дыре, излучает в рентгеновском диапазоне.',
    sources: [simbad('Cygnus X-1'), ['Параллакс и масса · Miller-Jones и др.', 'https://doi.org/10.1126/science.abb3363']] },
]

type PlanetRow = readonly [letter: string, days: number, au: number, eccentricity: number, earthMass: number, earthRadius?: number]
const trappistPlanets: readonly PlanetRow[] = [
  ['b', 1.510826, .01154, .00622, 1.374, 1.116], ['c', 2.421937, .01580, .00654, 1.308, 1.097],
  ['d', 4.049219, .02227, .00837, .388, .788], ['e', 6.101013, .02925, .00510, .692, .920],
  ['f', 9.20754, .03849, .01007, 1.039, 1.045], ['g', 12.352446, .04683, .00208, 1.321, 1.129],
  ['h', 18.772866, .06189, .00567, .326, .755],
]
const format = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 7 })

function planetarySystem(host: AtlasObject, solarMass: number, solarRadius: number, planets: readonly PlanetRow[], minimumMass = false): Scenario {
  const method = minimumMass ? 'радиальных скоростей' : 'транзитов'
  const orbitNote = 'Большие полуоси и эксцентриситеты взяты из каталога. Начальные фазы и направления перицентров условны, орбиты показаны в общей плоскости. Размеры и цвета в сцене иллюстративны.'
  records.push({
    ...host,
    systemId: host.id,
    properties: [['Оценка массы звезды', format.format(solarMass) + ' M☉'], ['Оценка радиуса звезды', format.format(solarRadius) + ' R☉']],
  })
  const objects: ObjectSpec[] = [{
    id: host.id, position: [0, 0, 0], velocity: [0, 0, 0], mass: solarMass, period: 0,
    profile: { name: host.name, category: 'star', classification: host.classification, radiusKm: Math.round(solarRadius * 695700) },
    appearance: { kind: 'star', size: .006, color: '#ffac78', accent: '#ffe1b4', dark: '#ab3c24' },
  }]
  planets.forEach(([letter, days, au, eccentricity, earthMass, earthRadius], index) => {
    const id = host.id + '-' + letter
    const name = host.name + ' ' + letter
    const englishName = host.englishName.split(' · ')[0] + ' ' + letter
    records.push({
      id, name, englishName, category: 'exoplanet', classification: 'Подтверждённая экзопланета',
      hostId: host.id, systemId: host.id, coordinates: host.coordinates,
      overview: `Планета в системе «${host.name}», обнаруженная методом ${method}. На звёздной карте используется положение звезды. ${orbitNote}`,
      sources: [nasa(englishName)],
      properties: [
        ['Период по каталогу', format.format(days) + ' сут.'],
        ['Большая полуось · оценка', format.format(au) + ' а.е.'],
        ['Эксцентриситет · модель каталога', format.format(eccentricity)],
        [minimumMass ? 'Оценка минимальной массы (m sin i)' : 'Оценка массы', format.format(earthMass) + ' M⊕'],
        ...(earthRadius === undefined ? [] : [['Оценка радиуса', format.format(earthRadius) + ' R⊕'] as const]),
      ],
    })
    const mass = earthMass * 3.00349e-6
    const angle = index * 2.39996
    const periapsis = au * (1 - eccentricity)
    const speed = Math.sqrt(G * (solarMass + mass) * (1 + eccentricity) / periapsis)
    objects.push({
      id, mass, period: Math.sqrt(au ** 3 / (solarMass + mass)),
      position: [Math.cos(angle) * periapsis, 0, Math.sin(angle) * periapsis],
      velocity: [-Math.sin(angle) * speed, 0, Math.cos(angle) * speed],
      profile: { name, category: 'planet', classification: 'Подтверждённая экзопланета', radiusKm: earthRadius === undefined ? 0 : Math.round(earthRadius * 6371) },
      appearance: { kind: 'rock', size: .0013, dark: '#39323d', color: '#ab9690', accent: '#d9c8b2' },
    })
  })
  return {
    id: host.id, name: host.name, subtitle: `${planets.length} экзопл. · модель орбит`,
    description: orbitNote + (minimumMass ? ' Для планет использованы минимальные массы, неизвестные радиусы не указаны.' : ''),
    objects, frame: .078, selection: objects[1].id, timeScale: .035, softening: .000001, stepSize: 1 / 32768,
  }
}

function siriusSystem(): Scenario {
  const pair = records.find(object => object.id === 'sirius')!
  const source: Source = ['Динамические массы и орбита · Bond и др.', 'https://arxiv.org/abs/1703.10625']
  const period = 50.1284
  const eccentricity = .59142
  const totalMass = 2.063 + 1.018
  const axis = Math.cbrt(totalMass * period ** 2)
  const distance = axis * (1 - eccentricity)
  const speed = Math.sqrt(G * totalMass * (1 + eccentricity) / distance)
  const description = 'Орбита пары построена по опубликованным массам, периоду и эксцентриситету. Большая полуось рассчитана по третьему закону Кеплера. Начальная фаза, ориентация и размеры тел в сцене условны.'
  pair.sources = [...pair.sources, source]
  pair.systemId = pair.id
  pair.properties = [['Период пары', '50,1284 года'], ['Эксцентриситет', '0,59142'], ['Большая полуось · расчёт', format.format(axis) + ' а.е.']]

  const objects = ([
    ['a', 2.063, 1.018, -1, 'Звезда главной последовательности', '#c9eaff', .64],
    ['b', 1.018, 2.063, 1, 'Белый карлик', '#e4f3ff', .31],
  ] as const).map(([letter, mass, companionMass, sign, classification, color, size]): ObjectSpec => {
    const id = 'sirius-' + letter
    const label = letter.toUpperCase()
    const name = 'Сириус ' + label
    const fraction = sign * companionMass / totalMass
    records.push({
      id, name, englishName: 'Sirius ' + label, category: 'star', classification, coordinates: pair.coordinates,
      hostId: pair.id, systemId: pair.id, overview: `Компонент двойной системы Сириуса. ${description}`,
      sources: [simbad('Sirius ' + label), source], properties: [['Динамическая масса', format.format(mass) + ' M☉']],
    })
    return {
      id, mass, period, position: [distance * fraction, 0, 0], velocity: [0, 0, speed * fraction],
      profile: { name, classification, category: 'star', radiusKm: 0 },
      appearance: { kind: 'star', color, dark: '#577aae', accent: '#f2faff', size },
    }
  })
  return { id: pair.id, name: pair.name, subtitle: '2 звезды · модель орбит', description, objects, frame: 23, selection: objects[0].id, timeScale: 22, stepSize: .02 }
}

export const atlasScenarios = [
  siriusSystem(),
  planetarySystem({
    id: 'trappist-1', name: 'TRAPPIST-1', englishName: 'TRAPPIST-1', category: 'star',
    classification: 'Ультрахолодный красный карлик', coordinates: [346.6263919, -5.0434618, 12.42988881],
    overview: 'Семь небольших планет образуют компактную систему. Транзиты позволяют определить размеры планет и изучать их атмосферы.',
    sources: [nasa('TRAPPIST-1'), ['Массы и орбиты · Agol и др.', 'https://doi.org/10.3847/PSJ/abd022'], trappistImage],
  }, .0898, .1192, trappistPlanets),
  planetarySystem({
    id: 'proxima-centauri', name: 'Проксима Центавра', englishName: 'Proxima Cen · Proxima Centauri', category: 'star',
    classification: 'Красный карлик', coordinates: [217.3934657, -62.6761821, 1.30119],
    overview: 'Ближайшая к Солнцу звезда. В этой модели показаны подтверждённые архивом NASA планеты b и d, обнаруженные по изменениям радиальной скорости.',
    sources: [nasa('Proxima Cen'), simbad('Proxima Cen')],
  }, .1221, .141, [['b', 11.18465, .04848, 0, 1.055], ['d', 5.12338, .02881, 0, .260]], true),
]

export const atlasObjects: readonly AtlasObject[] = records
export const atlasMap: readonly AtlasMapPoint[] = [
  { id: 'solar', name: 'Солнечная система', local: [0, 0, 0], galactic: [0, 0, galacticCenterDistance] },
  ...records.map(({ id, name, category, coordinates, hostId }): AtlasMapPoint => {
    const local = localPosition(coordinates)
    const [x, y, z] = local
    return { id, name, category, local, hostId,
      galactic: id === 'sagittarius-a' ? [0, 0, 0] : [x / 1000, y / 1000, galacticCenterDistance + z / 1000] }
  }),
]

export function atlasCatalogEntries(): CatalogEntry[] {
  return records.map(object => {
    const scenario = atlasScenarios.find(item => item.id === object.systemId)
    const body = scenario?.objects.find(item => item.id === object.id) ?? scenario?.objects[0]
    const [ra, dec, distance] = object.coordinates
    return {
      id: object.id, name: object.name, englishName: object.englishName, category: object.category, classification: object.classification,
      scene: scenario && body ? { body, scenario } : undefined,
      profile: {
        overview: object.overview,
        references: object.sources,
        properties: [
          ['Координаты ICRS' + (object.hostId ? ' · система' : ''), `α ${ra.toFixed(3)}°, δ ${dec.toFixed(3)}°`],
          ['Расстояние от Солнца · оценка', format.format(distance) + ' пк'],
          ...(object.properties ?? []),
        ],
      },
    }
  })
}
