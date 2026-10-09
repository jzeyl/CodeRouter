# MoveON implementation phases

Build and review one phase at a time. Phases 1–3 are implemented. Phase 4 frontend is implemented; hosted database activation, approved feeds and external backups remain pending. See [Phase 4 status](PHASE4.md). The user chose direct services only for Phase 2.

## Phase 1 — Foundation and home screen

- React, TypeScript, Vite, Tailwind, React Router, TanStack Query foundation.
- Locally owned, Radix-based Button, Dialog, and appearance control; shadcn configuration for future components.
- Responsive Quiet Ontario home with self-hosted fonts and original decorative journey artwork.
- Light, dark, and system appearance; persistent manual preference; no theme flash.
- Native city/date/time fields, swap control, validation, and shareable search URLs (now connected to Phase 2 results).
- Light/dark map colour tokens inspired by the Ontario Design System. Used by the map introduced in Phase 3.
- TypeScript journey contract and an environment-variable example for later integration.
- Browser, keyboard, accessibility, responsive, type, build, and lint checks.

Phase 1 was reviewed and the user requested Phase 2.

## Phase 2 — Journey search and details

- Search results, route cards, filters, sorting, itinerary/stop details, provider handoff.
- Deterministic sample dataset behind JourneyRepository, explicitly identified as sample data.
- Loading, unavailable fare, empty-result, outdated-data, and error states.
- Validate responsive layouts and state changes in both themes.
- Direct services only, as requested. Intermediate stops do not require changing vehicles. Transfer planning is deferred.
- Detail selection, filters, and sorting persist in the URL, with back/forward and refresh support.
- Provider handoff supports validated HTTPS destinations for future verified records. Fictional sample operators have no booking links.

Phase 2 was reviewed and the user requested Phase 3.

## Phase 3 — Maps and saved journeys

- MapLibre, a chosen basemap provider, real geographic geometry, stop markers, selection linked to results.
- Ontario-inspired palette, differentiated line styles, labels, and a usable non-map alternative.
- Local favourites with fresh data when revisited, share links, and printable itineraries.
- Email sharing opens the traveller’s email app, as confirmed by the user. No server email delivery.
- OpenFreeMap selected for the basemap; reference road geometry from OSM/OSRM and available rail shapes from VIA Rail. See [provenance and limitations](MAPS.md).
- Saved data is a versioned local reference, not a cached fare or schedule. Past-date links are handled explicitly.
- Mobile/desktop, both themes, storage/clipboard/network recovery, print and accessibility checks.

Phase 3 was reviewed and the user requested Phase 4.

## Phase 4 — Supabase and administrator tools (partially implemented)

- Inspect the team's connected project/schema before changing anything.
- Agree on API and data ownership with the backend team; implement the real repository adapter.
- Public read access as appropriate; authenticated, authorised admin editing enforced by backend policies.
- Daily refresh jobs and visible update times; handling of manual edits versus imported schedules.
- Backups outside Supabase, as required by the vision; ownership and restore procedure agreed with the backend team.
- Integration, performance, accessibility, and deployment checks.

Supabase can be connected and inspected earlier. The phases are review boundaries, not a requirement to delay collaboration with the backend team.
