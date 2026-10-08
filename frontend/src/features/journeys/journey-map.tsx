import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Map, Marker, NavigationControl, LngLatBounds, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Button } from '@/components/ui/button'
import { clockTime, modeLabels } from './format'
import type { Journey } from './types'

setWorkerUrl(workerUrl)
type Geography = {
  cities: Record<string, [number, number]>
  routes: Record<string, { road: [number, number][]; rail?: [number, number][] }>
}
function stopPoint(
  data: Geography | undefined,
  journey: Journey,
  index: number,
): [number, number] | undefined {
  const stop = journey.stops[index]
  return journey.isSample
    ? data?.cities[stop.city]
    : Number.isFinite(stop.longitude) && Number.isFinite(stop.latitude)
      ? [stop.longitude!, stop.latitude!]
      : undefined
}
function geometry(data: Geography | undefined, journey: Journey) {
  if (!journey.isSample) return journey.geometry?.coordinates ?? []
  if (!data) return []
  const forward = data.routes[`${journey.origin}|${journey.destination}`]
  const route = forward ?? data.routes[`${journey.destination}|${journey.origin}`]
  const points = route?.[journey.mode === 'rail' ? 'rail' : 'road'] ?? []
  return forward ? points : [...points].reverse()
}

export default function JourneyMap({
  journeys,
  selectedId,
  onSelect,
}: {
  journeys: Journey[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const selectRef = useRef(onSelect)
  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [stopIndex, setStopIndex] = useState(0)
  const query = useQuery({
    queryKey: ['geography'],
    enabled: journeys.some((journey) => journey.isSample),
    queryFn: async ({ signal }) => {
      const response = await fetch('/data/geography.json', { signal })
      if (!response.ok) throw new Error('Geography unavailable')
      return (await response.json()) as Geography
    },
    staleTime: Infinity,
    retry: 1,
  })
  const selected = journeys.find((x) => x.id === selectedId) ?? journeys[0]
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark')),
    )
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!container.current) return
    setReady(false)
    setError('')
    let map: Map
    try {
      map = new Map({
        container: container.current,
        style: `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`,
        center: [-78.2, 44.6],
        zoom: 6,
        attributionControl: { compact: true },
        canvasContextAttributes: { preserveDrawingBuffer: true },
      })
      mapRef.current = map
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.scrollZoom.disable()
      map.on('error', () =>
        setError(
          'Some map details couldn’t load. The journey list and stop information are still available.',
        ),
      )
      map.on('load', () => {
        const css = getComputedStyle(document.documentElement)
        for (const layer of map.getStyle().layers) {
          if (layer.type === 'background')
            map.setPaintProperty(
              layer.id,
              'background-color',
              css.getPropertyValue('--map-land').trim(),
            )
          if (layer.type === 'fill' && layer.id === 'landuse_residential')
            map.setPaintProperty(layer.id, 'fill-color', css.getPropertyValue('--map-land').trim())
          if (layer.type === 'fill' && ['landcover_wood', 'landuse_park'].includes(layer.id))
            map.setPaintProperty(layer.id, 'fill-color', css.getPropertyValue('--map-park').trim())
          if (dark && layer.type === 'symbol' && layer.layout?.['text-field']) {
            map.setPaintProperty(
              layer.id,
              'text-color',
              css.getPropertyValue('--muted-foreground').trim(),
            )
            map.setPaintProperty(
              layer.id,
              'text-halo-color',
              css.getPropertyValue('--map-land').trim(),
            )
          }
          if (layer.type === 'fill' && layer.id === 'water')
            map.setPaintProperty(layer.id, 'fill-color', css.getPropertyValue('--map-water').trim())
        }
        map.addSource('journeys', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-halo',
          type: 'line',
          source: 'journeys',
          paint: { 'line-color': css.getPropertyValue('--map-route-halo').trim(), 'line-width': 9 },
        })
        for (const mode of ['coach', 'rail', 'shuttle']) {
          map.addLayer({
            id: `route-${mode}`,
            type: 'line',
            source: 'journeys',
            filter: ['==', ['get', 'mode'], mode],
            paint: {
              'line-color': css.getPropertyValue(`--map-${mode}`).trim(),
              'line-width': 4,
              'line-opacity': ['case', ['get', 'selected'], 1, 0.35],
              ...(mode !== 'coach'
                ? { 'line-dasharray': mode === 'rail' ? [3, 2] : [0.6, 1.5] }
                : {}),
            },
          })
          map.on('click', `route-${mode}`, (event) => {
            const id = event.features?.[0]?.properties?.id
            if (typeof id === 'string') selectRef.current(id)
          })
          map.on('mouseenter', `route-${mode}`, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', `route-${mode}`, () => {
            map.getCanvas().style.cursor = ''
          })
        }
        map
          .getCanvas()
          .setAttribute(
            'aria-label',
            'Ontario journey map. Use the journey selector and stop list for a text alternative.',
          )
        setReady(true)
      })
    } catch {
      // WebGL initialization is external state; report its synchronous failure to the UI.
      // oxlint-disable-next-line react/set-state-in-effect
      setError(
        'Interactive maps aren’t supported in this browser. Use the journey list and stops below.',
      )
      return
    }
    const timeout = window.setTimeout(() => {
      if (!map.loaded())
        setError('The map is taking longer to load. You can continue using the journey list.')
    }, 15000)
    return () => {
      window.clearTimeout(timeout)
      map.remove()
      mapRef.current = null
    }
  }, [dark, attempt])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !selected) return
    const data = query.data
    const features = [...journeys]
      .sort((a, b) => Number(a.id === selected.id) - Number(b.id === selected.id))
      .flatMap((journey) => {
        const coordinates = geometry(data, journey)
        return coordinates.length
          ? [
              {
                type: 'Feature' as const,
                properties: {
                  id: journey.id,
                  mode: journey.mode,
                  selected: journey.id === selected.id,
                },
                geometry: { type: 'LineString' as const, coordinates },
              },
            ]
          : []
      })
    ;(map.getSource('journeys') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
    const bounds = new LngLatBounds()
    const points = geometry(data, selected)
    points.forEach((point) => bounds.extend(point))
    const markers = selected.stops.flatMap((stop, index) => {
      const point = stopPoint(data, selected, index)
      if (!point) return []
      bounds.extend(point)
      const element = document.createElement('button')
      element.className = 'map-stop-marker'
      element.textContent = `${index + 1} · ${stop.city}`
      element.setAttribute('aria-label', `Show ${stop.city} stop information`)
      element.onclick = () => setStopIndex(index)
      return [new Marker({ element, anchor: 'bottom' }).setLngLat(point).addTo(map)]
    })
    const fit = () => {
      if (!bounds.isEmpty())
        map.fitBounds(bounds, {
          padding: { top: 70, right: 100, bottom: 70, left: 60 },
          maxZoom: 10,
          duration: 0,
        })
    }
    fit()
    map.on('resize', fit)
    setStopIndex(0)
    return () => {
      map.off('resize', fit)
      markers.forEach((marker) => marker.remove())
    }
  }, [ready, query.data, journeys, selected])
  if (!selected) return null
  const stop = selected.stops[stopIndex] ?? selected.stops[0]
  return (
    <section className="journey-map-panel" aria-label="Map and stop information">
      <div className="map-panel-heading">
        <div>
          <div className="eyebrow">The lay of the land</div>
          <h2>Your journey, on the map.</h2>
        </div>
        <label>
          Journey on map
          <select value={selected.id} onChange={(e) => onSelect(e.target.value)}>
            {journeys.map((x) => (
              <option key={x.id} value={x.id}>
                {x.providerName} · {clockTime(x.departureAt, x.timeZone)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="map-legend" aria-label="Route line styles">
        <span>
          <i className="coach-swatch" />
          Coach · solid
        </span>
        <span>
          <i className="rail-swatch" />
          Rail · dashed
        </span>
        <span>
          <i className="shuttle-swatch" />
          Shuttle · dotted
        </span>
      </div>
      <div className="map-canvas" ref={container} />
      {(error || query.isError) && (
        <div className="map-error" role="status">
          {error || 'Route geography couldn’t load. Use the text itinerary below.'}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAttempt((x) => x + 1)
              if (journeys.some((journey) => journey.isSample)) void query.refetch()
            }}
          >
            Retry map
          </Button>
        </div>
      )}
      <div className="map-stop-summary">
        <strong>
          {selected.providerName} · {modeLabels[selected.mode]}
        </strong>
        <p>
          {stopIndex + 1}. {stop.city} ·{' '}
          {clockTime(stop.arrivalTime ?? stop.departureTime!, selected.timeZone)} Eastern
        </p>
        <p>
          {selected.isSample
            ? 'Reference location only. Confirm the boarding point with the provider.'
            : stop.locationNote || 'Confirm the exact boarding point with the provider.'}
        </p>
      </div>
      <ol className="map-text-stops" aria-label="Map stops as a list">
        {selected.stops.map((x, i) => (
          <li key={x.name}>
            <button
              aria-pressed={i === stopIndex}
              onClick={() => {
                setStopIndex(i)
                const point = stopPoint(query.data, selected, i)
                if (point) mapRef.current?.easeTo({ center: point, zoom: 10, duration: 0 })
              }}
            >
              {i + 1}. {x.city}
              <span>{clockTime(x.arrivalTime ?? x.departureTime!, selected.timeZone)} ET</span>
            </button>
          </li>
        ))}
      </ol>
      {!selected.isSample && (
        <p className="map-caption">
          {selected.geometry
            ? 'Provider route geometry.'
            : 'No verified route shape is available. Only stops with supplied coordinates appear on the map.'}{' '}
          Confirm boarding details with the provider.
        </p>
      )}
      {selected.isSample && (
        <p className="map-caption">
          Real geography, illustrative services.{' '}
          {query.data && !geometry(query.data, selected).length
            ? 'No verified rail shape for this corridor; only reference locations are shown for this journey. '
            : 'Lines follow reference roads or railways, not verified operator routes. '}
          Stops are approximate reference points.{' '}
          <a href="https://www.viarail.ca/en/developer-resources" target="_blank" rel="noreferrer">
            Rail geometry: VIA Rail
          </a>{' '}
          ·{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            Road geometry: © OpenStreetMap
          </a>
          .
        </p>
      )}
    </section>
  )
}
