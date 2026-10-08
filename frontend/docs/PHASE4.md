# Phase 4: frontend implemented, database activation pending

## Current state

The frontend uses the MoveON URL and publishable key in `.env.local`. On October 7, 2026, a read-only check of that project's Auth settings returned HTTP 200. A read-only query for `public.moveon_journeys` returned `PGRST205` (not found in the Data API schema cache). The connected Supabase management tool denied schema access to this project. No remote tables, policies, accounts, data or jobs were created or changed.

The default traveller experience remains `VITE_DATA_SOURCE=sample`. `/admin` uses real Supabase Auth configuration, with no signup or simulated administrator bypass. The new workspace is reachable from the footer's **Service desk** link. The live adapter can be activated after the actual database contract is inspected, reconciled and verified.

Daily import feeds and external backup destinations are **undecided**, as confirmed by the user. They are explicitly shown as unconfigured. There is no scheduled import, backup, restore claim, or invented provider dataset.

## Implemented frontend

- Admin sign-in/sign-out and server-verified user identity. Access requires an enabled row in `moveon_admins`; user-editable metadata is never used as authority. Database policies must enforce the same rule.
- Inventory with status filters and pages of 20. Complete journey drafts; provider, mode, fare, official website and ordered stops; optional coordinates; direct services only.
- Publishing requires an explicit provider-verification check. Editing a published journey requires verification again. Unpublish by saving a draft. No destructive deletion UI.
- Writes include the original `updated_at` value so concurrent edits or access revocation cannot silently succeed. Failed saves retain the editor contents.
- Public searches use a separate anonymous Supabase client, even when an administrator is signed in. No fallback from live API errors to fictional sample data.
- Cities come from the live API. Invalid timestamps, chronological stop errors, negative fares and invalid coordinates fail validation. Nullable fares remain unavailable rather than zero. Times use explicit ISO timestamps with offsets; this initial contract is restricted to `America/Toronto` so existing Eastern labels remain accurate.
- Live itineraries have provider links and appropriate share/print wording. Live maps use only supplied stop coordinates and route geometry; fixture geography is never substituted.
- Build configuration rejects non-publishable frontend keys before bundling. Auth and map code load on demand.

## Proposed database contract

`supabase/proposed-schema.sql` is a **proposal, not a deployed migration**. It is designed for a fresh schema and intentionally does not overwrite existing objects. Reconcile with the team's actual schema first.

- `moveon_admins`: approved user IDs and enabled flags. Only backend administrators can grant/revoke membership. Signed-in users can read their own membership.
- `moveon_journeys`: timestamped service instances, ordered JSON stops, nullable fare, provider link, publication state, verification time, edit time and source/override metadata. JSON stops follow the `JourneyStop` frontend contract. No sample records are seeded.
- `search_moveon_journeys(p_origin, p_destination, p_date, p_time)`: published journeys for a date/earliest local time, respecting RLS.
- `moveon_cities()`: distinct cities with published services that have not ended.
- Anonymous readers see published records only. Ordinary signed-in accounts cannot write. Enabled admins can insert/update, but cannot grant membership, delete records or change ingestion provenance. Revocation is checked directly against the membership table on each write.
- A database trigger stamps modification/verification times. Manual changes to imported records set `manual_override=true`. A future importer must honour this flag; no importer exists yet.

The proposed schema is tested in a local PostgreSQL engine (PGlite) with Supabase's role names and a minimal `auth.uid()` stub. Tests exercise actual grants, policies, constraints, source override flags, public searches and concurrent updates. This does **not** verify the hosted project's Auth configuration or deployed RLS.

## Activation steps

1. Give the management connection access to the same MoveON project as `.env.local`, or have the backend owner inspect/reconcile the proposed API contract with the existing schema.
2. Create a proper migration with the Supabase CLI after inspecting its current help, apply through the project's migration process, generate types from the actual schema, and run the project's security/performance advisors.
3. Create or identify approved Auth users through the project's administrative process. Add their UUIDs to `moveon_admins` from a privileged backend connection. Keep ordinary user membership management disabled.
4. Verify anonymously that published rows are visible and drafts are hidden; verify ordinary users cannot mutate; verify an approved admin can save/unpublish; verify revocation and conflict handling on the hosted project.
5. Set `VITE_DATA_SOURCE=supabase`, restart Vite/rebuild, and verify search, city discovery, saved journeys, maps, sharing and print against real verified services. This is a build-time setting.
6. Choose approved feeds, data ownership, update schedule and an external backup destination/retention policy. Implement ingestion with manual-override protection and visible failure/update times. Add external encrypted backups and test a restore before claiming backup readiness.
7. Configure hosting SPA rewrites for `/search`, `/saved`, `/print` and `/admin`. Verify HTTPS, supported origins and production Auth settings before release.

## Tests

`npm run test:e2e` runs existing preview checks on port 5173 and Phase 4 browser integration tests on an isolated port 15174. `.env.integration` contains synthetic public credentials; all Supabase calls in those tests are intercepted. Browser tests do not create real users or write hosted data. The test server refuses to reuse an unrelated server on its port.

`npm run test:db` tests the proposed SQL in an ephemeral local database. `npm run build`, `npm run lint` and `npm run format:check` cover the frontend.

Reference: [Supabase JavaScript Auth](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth callback limitation](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).
