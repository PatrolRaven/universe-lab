import { coreObjectMedia } from './core-object-media'
import { moonObjectMedia } from './moon-object-media'

export interface ObjectMedia {
  file: string
  alt: string
  kind: string
  credit: string
  source?: string
  license: string
}

const modelNames: Readonly<Record<string, string>> = {
  atlas: 'Атлас A', 'atlas-b': 'Атлас B', vesper: 'Веспер', kepler: 'Кеплер',
  dune: 'Дюна', ember: 'Эмбер', pelagos: 'Пелагос', nomad: 'Кочевник',
}

const models = Object.fromEntries(Object.entries(modelNames).map(([id, name]) => [id, {
  file: `objects/${id}.webp`,
  alt: `${name}, изображение из учебного сценария Universe Lab`,
  kind: 'Учебная модель',
  credit: 'Universe Lab',
  license: 'Оригинальный рендер из существующей симуляции Universe Lab',
}]))

const media: Readonly<Record<string, ObjectMedia>> = {
  ...coreObjectMedia, ...moonObjectMedia, ...models,
  'orion-nebula': {
    file: 'objects/orion-nebula.jpg', alt: 'Газ и молодые звёзды туманности Ориона',
    kind: 'Наблюдение · Hubble', credit: 'NASA, ESA, M. Robberto и команда Hubble Treasury',
    source: 'https://esahubble.org/images/heic0601a/', license: 'ESA/Hubble · CC BY 4.0',
  },
  'crab-nebula': {
    file: 'objects/crab-nebula.jpg', alt: 'Волокна газа в Крабовидной туманности',
    kind: 'Наблюдение · Hubble', credit: 'NASA, ESA, J. Hester и A. Loll (ASU)',
    source: 'https://esahubble.org/images/heic0515a/', license: 'ESA/Hubble · CC BY 4.0',
  },
  'trappist-1': {
    file: 'objects/trappist-1.jpg', alt: 'Сравнение размеров семи планет TRAPPIST-1 с условным изображением поверхностей',
    kind: 'Художественная реконструкция', credit: 'NASA, R. Hurt, T. Pyle',
    source: 'https://www.eso.org/public/images/eso1706o/', license: 'ESO · CC BY 4.0',
  },
}

export function objectMedia(id: string): ObjectMedia | undefined {
  return media[id]
}
