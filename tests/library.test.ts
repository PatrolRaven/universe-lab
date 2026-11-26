import { describe, expect, it } from 'vitest'
import { scenarios } from '../src/data'
import { catalogEntries, filterCatalog } from '../src/library'

describe('Библиотека небесных тел', () => {
  const entries = catalogEntries([...scenarios, scenarios[0]])

  it('показывает только поддерживаемые тела и не дублирует их из других сценариев', () => {
    expect(entries.map(entry => [entry.body.id, entry.scenario.id])).toEqual([
      ['earth', 'solar'], ['mars', 'solar'],
    ])
  })

  it('ищет без учёта регистра и лишних пробелов и применяет категорию', () => {
    expect(filterCatalog(entries, '  МАРС  ', 'planet').map(entry => entry.body.id)).toEqual(['mars'])
    expect(filterCatalog(entries, 'планета марс', 'all').map(entry => entry.body.id)).toEqual(['mars'])
    expect(filterCatalog(entries, 'земля', 'moon')).toEqual([])
    expect(filterCatalog(entries, 'венера', 'all')).toEqual([])
  })
})
