# Cartographic Symbol Sources

The active material palette uses 18 original black SVGs from **UN OCHA Humanitarian Icons**.

- Repository: https://github.com/UN-OCHA/humanitarian-icons
- Gallery: https://un-ocha.github.io/humanitarian-icons/
- License: CC0-1.0; see `ocha-LICENSE.txt`.
- `sources.json` records the original download URL and SHA-256 for each SVG.
- Run `node scripts/vendor-cartography-symbols.mjs` to download the selected source files again. Review checksum changes before committing an update.

Original SVG files are unmodified. At runtime, `composition-symbols.ts` removes source-editor IDs/classes/styles, applies the selected fill color, and preserves the original viewBox and geometry in a square image with proportional fitting. The same renderer feeds the two palettes, composition canvas, geographic markers, and PNG capture. Assets are bundled locally and do not require network access at runtime.

The palette contains eight infrastructure/location symbols and ten disaster/emergency symbols. Labels reflect the source subjects: Earthquake is not a precise epicenter symbol, Heatwave is not a measured thermal anomaly, and Satellite-dish depicts an antenna, not an orbiting satellite. These are illustrative humanitarian symbols, not a national cartographic standard or evidence of UN endorsement.

The old epicenter, anomaly, mountain, waterway, and flag IDs remain available only for restoring existing annotations; they are not offered as new OCHA materials. Their original IconPark rendering is retained to avoid silently changing the meaning of saved work.
