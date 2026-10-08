# Map geography and attribution

Phase 3 uses MapLibre GL JS with [OpenFreeMap](https://openfreemap.org/quick_start/) Positron / Dark vector basemaps. No key is needed. MapLibre and its worker load only when the map view opens. The map contacts OpenFreeMap for styles, tiles, fonts and sprites; journey search itself still uses local fixtures. Attribution remains visible. The map has no geolocation permission request.

## Reference geometry

`public/data/geography.json` is a static geographic preview captured October 7, 2026. Its shapes are not operational routes for the fictional sample providers.

- Road shapes: six corridors routed once through the OSRM public demonstration service, using its driving profile, `overview=full` and GeoJSON output. Coach/shuttle lines share these reference roads. The app does not call this demonstration routing service at runtime. Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL; routing by [OSRM](https://project-osrm.org/docs/v26.6.1/http).
- Rail shapes: segments of the [VIA Rail GTFS feed](https://www.viarail.ca/en/developer-resources), downloaded from `https://www.viarail.ca/sites/all/files/gtfs/viarail.zip`. Source available under the [Open Government Licence – Canada 2.0](https://open.canada.ca/en/open-government-licence-canada). Contains information licensed under the Open Government Licence – Canada. No endorsement by VIA Rail or the Government of Canada is implied.
- Rail extraction: select a trip containing both corridor endpoint stop IDs in forward sequence; sort its shape points and trim to the nearest points at each endpoint. Shapes are available for Toronto–Ottawa, Toronto–Kingston, Toronto–London and Toronto–Niagara Falls, and reversed for the opposite direction. There is no sourced rail shape for Toronto–Barrie or Sudbury–North Bay; the UI explicitly shows reference locations without inventing a rail line.
- Toronto, Ottawa, Kingston, London, Niagara Falls and Sudbury reference coordinates come from the feed's stops. Hamilton, Barrie and North Bay use manually chosen approximate city reference coordinates. All map markers are explicitly reference locations, **not confirmed boarding locations**. Road paths pass through the sample intermediate locations. Rail samples for London/Niagara omit the fictional Hamilton intermediate stop so their reference path and stop list agree.

## Interaction and fallback

The selected journey is retained in `mapTrip` and the view in `view`. Cards, the accessible journey selector and route clicks share that selection. Filters limit both map and list. Coach lines are solid green, rail is dashed blue, shuttle is dotted teal. The selected card has a visible outline, and markers have numbered city labels. The text stop list exposes the same cities/times without requiring map navigation. A failed basemap or unsupported WebGL leaves the normal journey list usable.

Before live release, replace preview geography with verified provider shape IDs and stop coordinates, keep their provenance and update dates, and confirm the map provider's production terms and availability. A road routing profile is not proof of a transit provider's actual route. No live feed ingestion or route planning was added in this phase.
