# Earth Explorer textures

These are static, equirectangular textures. North is up, the prime meridian is in the middle, and the outer columns meet at the antimeridian. Source files are not included in the application. The dates describe the source composites.

## Daytime surface

- **Source.** NASA Earth Observatory, Blue Marble: Next Generation, July 2004 global Base Map (Terra MODIS), produced by Reto Stöckli, NASA Goddard Space Flight Center. [Original source catalog](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/).
- **Upstream asset.** [NASA JPEG, 5400 × 2700](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg). The direct NASA image hosts did not complete TLS in the environment used to prepare these textures. The upstream file’s hash was therefore not verified.
- **Actual input.** Documented, unshaded 4096 × 2048 RGB JPEG derivative from [a pinned source repository](https://raw.githubusercontent.com/MaxwellLee/physics-lab/71807f8e5f3f8cfd29630ea46e4cf00d15693bc5/assets/textures/earth_4096.jpg), 943,204 bytes, SHA-256 `6b9f97f319066f676f4953fe0914a6da0748dc651d88036eea951d2b68de8153`. The mirror records the original NASA file and its resampling. [Mirror provenance](https://github.com/MaxwellLee/physics-lab/blob/71807f8e5f3f8cfd29630ea46e4cf00d15693bc5/assets/textures/SOURCES.md).
- **Preparation.** Convert to RGB. Retain the 4096 × 2048 grid for 4K, and resize to 2048 × 1024 with Lanczos for 2K. Encode lossy WebP with libwebp method 6 and quality 88 (4K) or 85 (2K). Treat both maps as sRGB on upload.

## Nighttime lights

- **Source.** NASA Earth Observatory, Black Marble 2016 global color mosaic, from Suomi NPP VIIRS nighttime observations. [Original source catalog](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/) and [NASA visualization credits](https://svs.gsfc.nasa.gov/30876/).
- **Upstream asset.** [NASA JPEG, 3600 × 1800](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg). Direct access failed during preparation, so independent comparison with the upstream bytes was unavailable.
- **Actual input.** [Pinned copy](https://raw.githubusercontent.com/pjcigan/skyplothelper/b705d63627dd90e6f193cd47ddace02e92c79220/examples/data/BlackMarble_2016_01deg.jpg), 3600 × 1800 RGB JPEG, 779,638 bytes, SHA-256 `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1`. [Mirror provenance](https://github.com/pjcigan/skyplothelper/blob/b705d63627dd90e6f193cd47ddace02e92c79220/examples/data/README.md).
- **Preparation.** For original RGB channel values on a 0–255 scale, encode the rounded scalar `255 × clamp((R − 0.8 × B − 8) / 120, 0, 1)`. The blue term suppresses the blue basemap embedded in the color composite. Resize to 1024 × 512 with Lanczos, encode lossless WebP with libwebp method 6, and treat the result as a scalar emission mask.

## Terrain normals

- **Source.** NOAA National Centers for Environmental Information (NCEI), ETOPO 2022 global relief model. [Dataset and DOI](https://doi.org/10.25921/fd45-gt74). [Technical description and CC0 1.0 terms](https://essd.copernicus.org/articles/17/1835/2025.html).
- **Actual input.** NOAA NCEI's [official cached elevation layer](https://www.arcgis.com/sharing/rest/content/items/55965af563f14462886a361819be9a73?f=json), published by `ncei_noaa`, supplies the model as WGS84 LERC tiles. Use zoom 2, rows 0–3 and columns 0–7. Each LERC file stores a 257 × 257 single-band floating-point grid. The [tile manifest](etopo-inputs.json) records the URL pattern, exact byte size and SHA-256 of each input. Together the 32 input files occupy 4,225,881 bytes.
- **Preparation.** Decode with Esri Lerc. Average each 2 × 2 node neighborhood into a pixel, dividing the values by 10 to undo the service’s documented vertical exaggeration. Assemble the resulting 256 × 256 chunks into a 2048 × 1024 global grid. Clamp ocean depth to zero and bilinearly resample for 1K. For the tangent normals, use central differences with longitude wrapping and clamped latitude edges. Use the 6371 km reference radius for sample spacing and floor the east–west cosine factor at 0.22. Multiply the slopes by `2.5 × clamp(height / 150 m, 0, 1)`, zero the polar rows, and normalize the vectors `(−eastGradient, southGradient, 1)`. Encode the vector components into 8-bit RGB and save lossless WebP with libwebp method 6. Read these maps as linear data.
- **Usage.** NOAA identifies the source data as CC0 1.0, and the presentation service labels it unsuitable for navigation. The normal maps are qualitative visualization derivatives.

## Rights and output verification

NASA Earth Science allows public and commercial reuse of most NASA imagery, with NASA credited, subject to third-party rights and the agency's rules against implied endorsement. These composites contain no NASA marks or identifiable people. [NASA Earth Science reuse guidance](https://science.nasa.gov/earth/faq/) · [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

| Runtime file | Resolution | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `albedo-2k.webp` | 2048 × 1024 | 143,994 | `0daa07c9755f07be6a0a7df782471bed9564cce30043820030628c5cbd55deb4` |
| `albedo-4k.webp` | 4096 × 2048 | 547,368 | `d0d13a7156066cf6119dcc5ae233d8d96cb69ff915b205436919d948cc76f33e` |
| `normal-1k.webp` | 1024 × 512 | 59,216 | `8141361c7bfd79e057a2e3fe5399cd6707f4d66bb66009f94d84e53a6e9a2011` |
| `normal-2k.webp` | 2048 × 1024 | 218,284 | `8ed762ca0eb6b033e7bcb77e3f990b75295e8d95e8c716341ab63f9ec15b89d7` |
| `night-1k.webp` | 1024 × 512 | 20,554 | `3e83441ebf7fa78778933447d8db532346ddfa4c91de4b1a414b376425003802` |

The complete 2K set with 1K normals is 223,764 bytes. A 4K session that fetches both sizes of albedo and normals transfers 989,416 bytes of imagery. Estimated resident GPU allocation with RGBA8 and mipmaps is 16 MiB for 2K albedo + 1K normals + 1K night lights, or 56 MiB for 4K albedo + 2K normals + 1K night lights. The figures exclude the renderer, scene geometry and transient decode buffers.
