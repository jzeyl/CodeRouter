# Frontend integration boundary

For the implemented Phase 4 adapter/admin screens, proposed schema and current deployment blockers, see [Phase 4 status](PHASE4.md).

Preview mode uses `src/features/journeys/repository.ts` to load `/data/sample-journeys.json` and materialize direct example itineraries. In preview mode, the journey repository contacts no remote service; the optional map loads OpenFreeMap basemap resources. Freshness timestamps are relative to fixture load time, solely to demonstrate current/old schedule states.

`src/features/journeys/types.ts` defines the frontend's journey and search contracts. `live-repository.ts` implements `JourneyRepository.search` against the proposed Supabase contract. Reconcile this contract with the hosted schema before activation. Components should not depend directly on raw GTFS or database table layouts.

- Full timestamp strings must include an offset/time zone. Display and search time-zone semantics will be agreed with the backend team before live scheduling, including Ontario routes spanning time zones.
- Fares may be null. Display unavailable fares honestly; never infer a zero-dollar fare.
- Each journey includes an update timestamp and an official provider URL. Validate external URLs before rendering booking links.
- The user selected direct services only. Transfer planning remains out of scope. Map reference coordinates are stored separately from operational stops; replace them with verified provider coordinates before release.
- The preview city list is a UI fixture, not a coverage guarantee. In live mode, the form loads the backend's published cities.

## Phase 3 persistence and sharing

Saved journeys use localStorage key `moveon:saved:v1`. Each entry stores search criteria, a service ID and a display name. It stores no schedule/fare snapshot. Revisit uses a separate query with staleTime zero and refetchOnMount always; fixture fetches use cache no-store. Production IDs must be stable and distinguish service/date as appropriate. Refresh failures do not present cached fares as current. Browser storage failure is surfaced; storage events synchronize open tabs. Maximum 100 local entries.

Shared links contain the date, origin, destination, earliest departure and service ID. They must resolve on the deployed origin; localhost links are only useful on the same machine. Deploy SPA rewrites for /search, /saved and /print. A past/invalid dated share is rejected rather than opening a new dated itinerary. Email is a mailto link handled by the user's mail client. The print route fetches current data and requires an explicit print action.

See [map sources](MAPS.md) for external network dependencies, attribution and geographic limitations. Preview geometry is not the future backend routing adapter.

## Activating the live connection

Copy `.env.example` to `.env.local` and supply the team's project URL and browser-safe publishable key once the schema/access approach is agreed. The admin route uses these values for Supabase Auth. Public live data requires VITE_DATA_SOURCE=supabase and a deployed/verified database contract; adding credentials alone does not activate live search.

Never use secret/service-role keys in `VITE_` variables: Vite exposes them to the browser. Database row-level security and backend authorisation must protect admin operations. Hiding controls in the frontend is not authorisation.

The frontend will support the team's existing schema/API. Hosted schema changes require inspection of the correct project. Ingestion and external backups remain unconfigured until their source and destination are chosen.
