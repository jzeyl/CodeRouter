# Quiet Ontario design system

The chosen direction pairs warm ivory, forest green, editorial serif headings, and readable interface text. Dark mode uses deep green surfaces and pale sage actions. All component colours are semantic CSS variables in `src/index.css`.

## Typography and interaction

- DM Serif Display for editorial headings; DM Sans for forms, navigation, and data.
- Font files are bundled locally. No Google Fonts request is required.
- Restrained motion with reduced-motion support, visible keyboard focus, labelled form controls, native date/time inputs, and Radix focus management.
- The mobile layout places the search form directly after the introduction; decorative journey artwork is omitted to keep the primary task near the top.

## Map palette

Source: [Ontario Design System colours](https://designsystem.ontario.ca/components/detail/colours.html), reviewed October 7, 2026.

This is palette inspiration, not a claim that MoveON is an Ontario government service or a complete implementation of the Ontario Design System.

| Token           | Light     | Dark      | Intended use           |
| --------------- | --------- | --------- | ---------------------- |
| `--map-coach`   | `#2B8737` | `#8DC63F` | Coach route identity   |
| `--map-rail`    | `#0369AC` | `#69BAE5` | Rail route identity    |
| `--map-shuttle` | `#367A76` | `#7AC4BF` | Shuttle route identity |
| `--map-water`   | `#DBE9F5` | `#1D3544` | Water background       |
| `--map-park`    | `#D1EFD4` | `#2B4231` | Park background        |
| `--map-land`    | `#EBE7DB` | `#293329` | Land background        |

Light values come from the Ontario accent palettes. Dark values mix Ontario accents and custom adaptations. Route colours must be used with text labels, differing line styles, and selection halos. MapLibre uses labelled reference markers and an equivalent text stop list. Both themes receive browser accessibility checks; a palette alone does not guarantee map accessibility.

## Current preview boundaries

The hero ticket is decorative and labelled as a sample journey. Search now opens Phase 2's comparison screen, backed by local JSON fixtures. Operators, schedules, stops, and fares are explicitly fictional. Itineraries are direct only, including some intermediate stops. The details dialog includes the travel date, Eastern times, and freshness information. No bookable service is implied by these fixtures. URLs retain search criteria, filters, sort order, and selected itinerary.

Phase 3 adds the map-and-list view, local saved journeys, sharing actions and a separate printable itinerary. OpenFreeMap provides the basemap; see [geographic sources](MAPS.md). Map resources load on demand.
