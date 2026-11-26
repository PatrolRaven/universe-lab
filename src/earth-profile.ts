export const earthProfile = {
  overview: 'Earth is the third planet from the Sun. Its liquid ocean, active geology, and atmosphere shape a surface that supports life.',
  properties: [
    ['Mass', '5.9722 × 10²⁴ kg'],
    ['Mean radius', '6,371 km'],
    ['Mean density', '5,513 kg/m³'],
    ['Standard gravity', '9.80665 m/s²'],
    ['Mean solar day', '24 hours'],
    ['Sidereal year', '365.256 days'],
  ],
  surface: 'The Pacific, Atlantic, Indian, Southern, and Arctic oceans form one connected ocean covering about 71% of Earth. The continental and oceanic crusts sit above the mantle. Deeper down, a liquid outer core surrounds a solid inner core.',
  atmosphere: 'Near the surface, the atmosphere is about 78% nitrogen and 21% oxygen. Most of the rest is argon and other gases. Surface pressure is about 1,014 hPa in the NASA reference, and local pressure varies with elevation and weather.',
  history: [
    ['4.5 billion years ago', 'Earth formed as gravity brought together gas and dust in the young Solar System.'],
    ['1968', 'Apollo 8 astronaut Bill Anders photographed Earthrise from lunar orbit.'],
    ['1972', 'Landsat 1 began the long-running satellite record of changes to Earth’s land surface.'],
    ['1999', 'NASA launched Terra. Its MODIS instrument supplied observations used in Blue Marble: Next Generation.'],
  ],
  references: [
    ['NASA Earth overview', 'https://science.nasa.gov/earth/facts/'],
    ['NASA Earth Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html'],
    ['Apollo 8 Earthrise', 'https://science.nasa.gov/resource/the-story-behind-apollo-8s-famous-earthrise-photo/'],
    ['Landsat 1 mission', 'https://science.nasa.gov/mission/landsat-1/'],
    ['Terra mission', 'https://science.nasa.gov/mission/terra/'],
    ['NOAA overview of the global ocean', 'https://oceanservice.noaa.gov/facts/howmanyoceans.html'],
  ],
  imagery: [
    ['Daytime surface · NASA Earth Observatory, Reto Stöckli, NASA Goddard Space Flight Center', 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/'],
    ['Terrain normals · NOAA NCEI, ETOPO 2022', 'https://www.ncei.noaa.gov/products/etopo-global-relief-model'],
    ['Night lights · NASA Earth Observatory, VIIRS Black Marble', 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/'],
  ],
} as const
