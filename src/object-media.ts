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

const media: Readonly<Record<string, ObjectMedia>> = { ...coreObjectMedia, ...moonObjectMedia, ...models }

export function objectMedia(id: string): ObjectMedia | undefined {
  return media[id]
}
