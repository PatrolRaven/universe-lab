import { describe, expect, it } from 'vitest'
import { scenarios } from '../src/data'
import { catalogEntries, filterCatalog } from '../src/library'

const planetIds = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
const dwarfPlanetIds = ['ceres', 'pluto', 'haumea', 'makemake', 'eris']
const moonIds = [
  'moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto',
  'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus',
  'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'nereid', 'charon',
]
const modelIds = ['atlas', 'atlas-b', 'vesper', 'kepler', 'dune', 'ember', 'pelagos', 'nomad']

describe('Библиотека небесных тел', () => {
  const entries = catalogEntries([...scenarios, scenarios[0]])

  it('включает все предусмотренные тела и не дублирует их при повторе сценария', () => {
    const idsFor = (category: string) => filterCatalog(entries, '', category).map(entry => entry.id).sort()
    expect(entries).toHaveLength(44)
    expect(new Set(idsFor('all')).size).toBe(entries.length)
    expect(idsFor('star')).toEqual(['sun'])
    expect(idsFor('planet')).toEqual([...planetIds].sort())
    expect(idsFor('dwarf-planet')).toEqual([...dwarfPlanetIds].sort())
    expect(idsFor('moon')).toEqual([...moonIds].sort())
    expect(idsFor('model')).toEqual([...modelIds].sort())
  })

  it('связывает со сценой все тела из симуляции, а остальным оставляет справку', () => {
    for (const scenario of scenarios) {
      for (const body of scenario.objects) {
        const entry = entries.find(item => item.id === body.id)
        expect(entry?.scene?.scenario).toBe(scenario)
        expect(entry?.scene?.body).toBe(body)
      }
    }
    for (const id of [...dwarfPlanetIds, ...moonIds]) {
      const entry = entries.find(item => item.id === id)
      expect(entry?.scene).toBeUndefined()
      expect(entry?.profile.overview).toBeTruthy()
      expect(entry?.profile.references.length).toBeGreaterThan(0)
    }
  })

  it.each(planetIds)('содержит основные научные данные и локальную карту для %s', async id => {
    // Vitest runs in Node, while the project does not require Node type definitions.
    const fileSystemModule = 'node:fs/promises'
    const { access } = await import(fileSystemModule) as { access: (path: URL) => Promise<void> }
    const entry = entries.find(item => item.id === id)!
    expect(entry.englishName).toMatch(/^[A-Z][a-z]+$/)
    const { overview, properties, surface, atmosphere, interior, moons, history, fact, references } = entry.profile
    for (const section of [overview, surface, atmosphere, interior, moons, fact]) expect(section).toBeTruthy()
    expect(history?.length).toBeGreaterThan(0)
    expect(references.length).toBeGreaterThan(0)
    const values = new Map(properties)
    const labels = ['Масса', 'Средний радиус', 'Средняя плотность', 'Большая полуось орбиты',
      'Период вращения', 'Период обращения', 'Температура']
    if (['mercury', 'venus', 'earth', 'mars'].includes(id)) labels.push('Солнечные сутки')
    for (const label of labels) expect(values.get(label), label).toBeTruthy()
    const map = entry.scene?.body.detail?.surfaceMap
    expect(map?.url).toMatch(/\.webp$/)
    await expect(access(new URL(`../public/${map?.url}`, import.meta.url))).resolves.toBeUndefined()
  })

  it('ищет по названиям на двух языках и совмещает запрос с категорией', () => {
    const find = (query: string, category: string) => filterCatalog(entries, query, category).map(entry => entry.id)
    expect(find('  МАРС  ', 'planet')).toEqual(['mars'])
    expect(find('MERCURY', 'planet')).toEqual(['mercury'])
    expect(find('планета Venus', 'all')).toEqual(['venus'])
    expect(find('плутон', 'dwarf-planet')).toEqual(['pluto'])
    expect(find('PLUTO', 'planet')).toEqual([])
    expect(find('ЭНЦЕЛАД', 'moon')).toEqual(['enceladus'])
    expect(find('charon', 'moon')).toEqual(['charon'])
    expect(find('звезды солнце', 'star')).toEqual(['sun'])
    expect(find('несуществующий объект', 'all')).toEqual([])
  })
})
