import { getPublicClient } from '@/lib/supabase'
import { safeProviderUrl } from './format'
import type { Journey, JourneyRepository } from './types'

/** Proposed API contract; must be reconciled with the team's schema before activation. */
export type JourneyRow = {
  id: string
  provider_name: string
  mode: Journey['mode']
  origin: string
  destination: string
  departure_at: string
  arrival_at: string
  time_zone: string
  fare_cad: number | null
  stops: Journey['stops']
  provider_url: string | null
  published: boolean
  route_geometry: Journey['geometry'] | null
  verified_at: string | null
  updated_at: string
  source_kind: 'manual' | 'import'
  manual_override: boolean
}
export const journeyColumns =
  'id,provider_name,mode,origin,destination,departure_at,arrival_at,time_zone,fare_cad,stops,provider_url,published,route_geometry,verified_at,updated_at,source_kind,manual_override'
const text = (x: unknown): x is string =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= 500
const timestamp = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(x) &&
  Number.isFinite(Date.parse(x))
export function mapJourney(row: JourneyRow): Journey {
  if (
    !row ||
    !text(row.id) ||
    !text(row.provider_name) ||
    !text(row.origin) ||
    !text(row.destination) ||
    row.origin === row.destination ||
    !['coach', 'rail', 'shuttle'].includes(row.mode) ||
    !timestamp(row.departure_at) ||
    !timestamp(row.arrival_at) ||
    Date.parse(row.arrival_at) <= Date.parse(row.departure_at) ||
    !timestamp(row.verified_at) ||
    !timestamp(row.updated_at) ||
    row.time_zone !== 'America/Toronto' ||
    (row.fare_cad !== null && (!Number.isFinite(row.fare_cad) || row.fare_cad < 0)) ||
    !Array.isArray(row.stops) ||
    row.stops.length < 2
  )
    throw new Error('Journey data has an unexpected format. Please try again later.')
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: row.time_zone }).format()
  } catch {
    throw new Error('Journey time zone is invalid.')
  }
  let previous = Date.parse(row.departure_at)
  row.stops.forEach((stop, index) => {
    if (!stop || typeof stop !== 'object') throw new Error('Journey stop data is invalid.')
    const arrival = stop.arrivalTime ?? stop.departureTime
    const departure = stop.departureTime ?? stop.arrivalTime
    if (
      !text(stop.name) ||
      !text(stop.city) ||
      typeof stop.locationNote !== 'string' ||
      !timestamp(arrival) ||
      !timestamp(departure) ||
      Date.parse(arrival) < previous ||
      Date.parse(departure) < Date.parse(arrival) ||
      Date.parse(departure) > Date.parse(row.arrival_at)
    )
      throw new Error('Journey stop data is invalid.')
    if (
      (stop.latitude != null || stop.longitude != null) &&
      (!Number.isFinite(stop.latitude) ||
        !Number.isFinite(stop.longitude) ||
        Math.abs(stop.latitude!) > 90 ||
        Math.abs(stop.longitude!) > 180)
    )
      throw new Error('Journey stop coordinates are invalid.')
    if (
      index === 0 &&
      (stop.city !== row.origin ||
        (departure !== row.departure_at && Date.parse(departure) !== Date.parse(row.departure_at)))
    )
      throw new Error('Departure stop does not match the journey.')
    if (
      index === row.stops.length - 1 &&
      (stop.city !== row.destination || Date.parse(arrival) !== Date.parse(row.arrival_at))
    )
      throw new Error('Arrival stop does not match the journey.')
    previous = Date.parse(departure)
  })
  if (
    row.route_geometry &&
    (row.route_geometry.type !== 'LineString' ||
      !Array.isArray(row.route_geometry.coordinates) ||
      row.route_geometry.coordinates.length < 2 ||
      row.route_geometry.coordinates.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          !p.every(Number.isFinite) ||
          Math.abs(p[0]) > 180 ||
          Math.abs(p[1]) > 90,
      ))
  )
    throw new Error('Route geometry is invalid.')
  return {
    id: row.id,
    providerName: row.provider_name,
    mode: row.mode,
    origin: row.origin,
    destination: row.destination,
    departureAt: row.departure_at,
    arrivalAt: row.arrival_at,
    durationMinutes: Math.round(
      (Date.parse(row.arrival_at) - Date.parse(row.departure_at)) / 60000,
    ),
    transfers: 0,
    estimatedFare: row.fare_cad === null ? null : { amount: row.fare_cad, currency: 'CAD' },
    stops: row.stops,
    providerUrl: safeProviderUrl(row.provider_url),
    isSample: false,
    timeZone: row.time_zone,
    updatedAt: row.verified_at,
    geometry: row.route_geometry ?? undefined,
  }
}
export const liveRepository: JourneyRepository = {
  async search(criteria, signal) {
    const request = getPublicClient().rpc('search_moveon_journeys', {
      p_origin: criteria.origin,
      p_destination: criteria.destination,
      p_date: criteria.date,
      p_time: criteria.time,
    })
    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    if (error) throw new Error('Live journeys couldn’t be loaded. Please try again shortly.')
    if (!Array.isArray(data)) throw new Error('Unexpected journey response.')
    // Fail closed if a misconfigured API returns drafts.
    return (data as JourneyRow[]).filter((x) => x?.published === true).map(mapJourney)
  },
}
export async function loadLiveCities(signal?: AbortSignal) {
  const request = getPublicClient().rpc('moveon_cities')
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error || !Array.isArray(data)) throw new Error('Available cities couldn’t be loaded.')
  return data
    .map((x: { city: string }) => x.city)
    .filter(text)
    .sort((a, b) => a.localeCompare(b))
}
