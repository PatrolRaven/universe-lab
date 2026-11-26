export interface ExplorerProfile {
  overview: string
  properties: readonly (readonly [string, string])[]
  surface: string
  atmosphere: string
  interior: string
  fact: string
  history: readonly (readonly [string, string])[]
  references: readonly (readonly [string, string])[]
  imagery: readonly (readonly [string, string])[]
}

// Explorer content is keyed by the same stable body IDs used in ObjectSpec.
// Adding another planet requires a profile entry and a surface map in its detail data.
export const explorerProfiles: Readonly<Record<string, ExplorerProfile>> = {
  earth: {
    overview: 'Земля — третья планета от Солнца. Жидкая вода, активная геология и атмосфера формируют поверхность, на которой существует жизнь.',
    properties: [
      ['Масса', '5,9722 × 10²⁴ кг'], ['Средний радиус', '6 371 км'], ['Средняя плотность', '5 513 кг/м³'],
      ['Средняя гравитация на поверхности', '9,82 м/с²'], ['Солнечные сутки', '24 часа'], ['Период обращения', '365,256 суток'],
    ],
    surface: 'Мировой океан покрывает около 71% поверхности Земли. Земная кора и верхняя часть мантии образуют тектонические плиты. Их движение формирует горы и океанические впадины и вызывает землетрясения.',
    atmosphere: 'Сухой воздух у поверхности примерно на 78% состоит из азота и на 21% из кислорода. Почти всё остальное — аргон и другие газы. Стандартное давление на уровне моря составляет 1 013,25 гПа. Фактическое давление зависит от высоты и погоды.',
    interior: 'Под корой лежит горячая, преимущественно твёрдая мантия. На протяжении миллионов лет её породы текут очень медленно. Глубже жидкое внешнее ядро окружает твёрдое внутреннее ядро. Движение электропроводящего металла во внешнем ядре создаёт основную часть магнитного поля Земли.',
    fact: 'Полярное сияние возникает, когда быстрые электроны сталкиваются с частицами верхней атмосферы. Кислород может светиться зелёным или красным, а азот — синим или розовым.',
    history: [
      ['Около 4,5 млрд лет назад', 'Земля сформировалась, когда гравитация собрала газ и пыль молодой Солнечной системы.'],
      ['1968 год', 'Астронавт «Аполлона-8» Билл Андерс снял восход Земли с лунной орбиты.'],
      ['1972 год', 'Спутник Landsat 1 начал многолетнюю серию наблюдений за изменениями суши.'],
      ['1999 год', 'NASA запустило спутник Terra. Его прибор MODIS получил наблюдения для карты Blue Marble: Next Generation.'],
    ],
    references: [
      ['Обзор Земли NASA', 'https://science.nasa.gov/earth/facts/'],
      ['Справочник NASA: Земля', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html'],
      ['История снимка «Восход Земли»', 'https://science.nasa.gov/resource/the-story-behind-apollo-8s-famous-earthrise-photo/'],
      ['Миссия Landsat 1', 'https://science.nasa.gov/mission/landsat-1/'], ['Миссия Terra', 'https://science.nasa.gov/mission/terra/'],
      ['Обзор Мирового океана NOAA', 'https://oceanservice.noaa.gov/facts/howmanyoceans.html'],
      ['Внутреннее строение Земли · USGS', 'https://pubs.usgs.gov/gip/dynamic/inside.html'],
      ['Давление воздуха · NOAA', 'https://www.noaa.gov/jetstream/atmosphere/air-pressure'],
      ['Полярные сияния · NASA', 'https://science.nasa.gov/sun/auroras/'],
    ],
    imagery: [
      ['Дневная поверхность · NASA Earth Observatory, Reto Stöckli, NASA Goddard', 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/'],
      ['Рельеф · NOAA NCEI, ETOPO 2022', 'https://www.ncei.noaa.gov/products/etopo-global-relief-model'],
      ['Ночные огни · NASA Earth Observatory, VIIRS Black Marble', 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/'],
    ],
  },
  mars: {
    overview: 'Марс — четвёртая планета от Солнца. Его красный цвет придают богатые железом минералы, а древние русла и минералы указывают на более влажное прошлое.',
    properties: [
      ['Масса', '6,4169 × 10²³ кг'], ['Средний радиус', '3 389,5 км'], ['Средняя плотность', '3 934 кг/м³'],
      ['Средняя гравитация на поверхности', '3,73 м/с²'], ['Солнечные сутки', '24 ч 40 мин'], ['Период обращения', '687 земных суток'],
    ],
    surface: 'На Марсе находятся вулкан Олимп — крупнейший известный вулкан Солнечной системы — и каньонная система долин Маринер. Роботизированные аппараты изучают породы, кратеры, пыль и признаки древней воды. Жидкая вода сегодня нестабильна на открытой поверхности.',
    atmosphere: 'Разреженная атмосфера Марса примерно на 95% состоит из углекислого газа. Остальное — преимущественно азот и аргон. Средняя температура у поверхности — около −59 °C, но она сильно зависит от места, сезона и времени суток. Пылевые бури иногда охватывают всю планету.',
    interior: 'У Марса есть твёрдая кора, каменистая мантия и ядро, богатое железом. Сейсмометр аппарата InSight записывал марсотрясения. По тому, как проходили их волны, учёные оценили толщину слоёв и установили, что по меньшей мере часть ядра находится в жидком состоянии.',
    fact: 'На Марсе небо рядом с Солнцем на закате может быть голубым. Мелкая пыль рассеивает свет так, что голубые лучи остаются ближе к направлению на Солнце, чем лучи других цветов.',
    history: [
      ['1965 год', 'Mariner 4 передал первые снимки Марса крупным планом во время пролёта.'],
      ['1976 год', 'Посадочные аппараты Viking впервые успешно провели длительные исследования непосредственно на поверхности.'],
      ['1997 год', 'Mars Pathfinder доставил марсоход Sojourner и показал возможность мобильных исследований поверхности.'],
      ['2021 год', 'Perseverance начал изучать кратер Езеро, а Ingenuity выполнил первые управляемые полёты на другой планете.'],
    ],
    references: [
      ['Факты о Марсе · NASA', 'https://science.nasa.gov/mars/facts/'],
      ['Справочник NASA: Марс', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
      ['Вода на Марсе · NASA', 'https://science.nasa.gov/mars/the-red-planet/water-on-mars/'],
      ['Исследование Марса · NASA', 'https://science.nasa.gov/mars/exploration/'],
      ['Кратер Езеро · NASA', 'https://science.nasa.gov/mission/mars-2020-perseverance/'],
      ['Строение Марса по данным InSight · NASA JPL', 'https://www.jpl.nasa.gov/news/nasas-insight-reveals-the-deep-interior-of-mars/'],
      ['Восходы и закаты на Марсе · NASA', 'https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/'],
    ],
    imagery: [
      ['Глобальная карта Марса · Solar System Scope / INOVE', 'https://www.solarsystemscope.com/textures/'],
      ['Происхождение и контрольные суммы локальной карты', 'planets/SOURCES.md'],
    ],
  },
}
