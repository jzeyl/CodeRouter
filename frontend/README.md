# MoveON

Ontario inter-city travel, with the **Quiet Ontario** visual identity. This repository contains **Phases 1–3 plus the Phase 4 frontend: journey search, maps, saved journeys, sharing, print and an administrator workspace**.

## Run locally

Use Node.js 22.12+ (developed with Node 24) and npm.

```sh
npm ci
npm run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`.

## What works now

- Responsive home screen and locally bundled DM Serif Display / DM Sans fonts.
- Light, dark, and system themes; saved preference and live system-theme changes.
- City selection, swap, date/time inputs, validation, and shareable search URLs.
- Direct journey results with transport, price, and duration filters, plus departure/price/duration sorting.
- Keyboard-accessible itinerary dialog with intermediate stops, no-transfer labels, update times, and theme menu.
- Loading, retry, empty-result, unavailable-fare, and stale-schedule states.
- MapLibre / OpenFreeMap maps with geographic road/rail reference shapes, labelled stops, linked selection and a text alternative.
- Local saved journeys, re-fetched data on revisit, copied itinerary links and mail-client email sharing.
- Dedicated printable itinerary with print / save PDF control.
- Ontario-inspired map colours and line styles in both themes.

**Search uses fictional operators and sample schedules/fares, not live services.** Sample journeys cannot be booked. Supabase Auth and a proposed live adapter/admin editor are implemented. Hosted schema activation is pending; the default traveller mode remains sample. See [Phase 4 status](docs/PHASE4.md). Map geography is real; sample routes and boarding points are not verified operator services. The app runs without credentials.

Try Toronto to Ottawa after 09:00 for four sample options. Other sample corridors: Toronto–Kingston, Toronto–London, Toronto–Niagara Falls, Toronto–Barrie, and Sudbury–North Bay, in both directions. Unsupported pairs and late departure times show the empty state. This is preview coverage, not actual transit availability.

## Stack

React + TypeScript + Vite; Tailwind CSS; React Router; TanStack Query; locally owned Radix-based UI components with shadcn configuration. MapLibre GL JS with OpenFreeMap basemaps. Supabase JS powers the Phase 4 Auth and data adapter.

## Checks

```sh
npm run build
npm run lint
npm run format:check
npm run test:e2e
npm run test:db
```

Browser tests use installed Microsoft Edge on Windows and Playwright Chromium elsewhere. On other platforms, run `npx playwright install chromium` once. Set `PLAYWRIGHT_CHANNEL` to override the browser channel.

Tests also cover local-storage/clipboard failures, refreshed favourites, expired share links, map selection/failure and print output. Tests cover themes, forms, sorting/filtering, missing fares, intermediate stops, stale data, URL restoration, loading/error/retry states, provider URL validation, keyboard focus, axe scans, and 320/390/768/1440-pixel layouts in both themes. Screenshots go into ignored `.qa/`; failure details go into ignored `test-results/`.

## Project layout

```text
src/
  components/          Theme control, journey illustration, reusable UI
  features/admin/      Sign-in, service inventory and journey editor
  features/journeys/   Search form, URL helpers, frontend data contracts
  lib/                 Theme and styling utilities
  index.css            Design tokens and responsive styles
docs/
  ROADMAP.md           Phase boundaries and future work
  DESIGN.md            Visual decisions and map palette provenance
  INTEGRATION.md       Backend interface and Supabase handoff
tests/                 Browser and accessibility checks
```

The admin workspace is at `/admin` (Service desk in the footer). [Phase 4 activation and outstanding work](docs/PHASE4.md). [Map sources and limitations](docs/MAPS.md). [Roadmap](docs/ROADMAP.md) · [Design](docs/DESIGN.md) · [Backend integration](docs/INTEGRATION.md).
