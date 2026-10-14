import { getPublicClient } from '@/lib/supabase'
import { safeProviderUrl } from './format'
import type { Journey, JourneyRepository, JourneyStop } from './types'

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

type TripCandidate = {
  trip_id: string | number
  provider: string | number
  city_name: string
  tripid_count: number
}
type StopTimeRow = {
  ID: number
  Provider: number
  trip_id: string
  arrival_time: string | null
  departure_time: string | null
  stop_id: number
  stop_sequence: number
  shape_dist_traveled: string | null
}
type StopRow = {
  provider: number
  stop_id: number
  stop_name: string | null
  stop_lon: number | null
  stop_lat: number | null
  city_name: string | null
}
type ProviderRow = {
  id: number
  Provider_name: string | null
  link: string | null
}
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

const gtfsTime = /^(\d+):([0-5]\d):([0-5]\d)$/
function dateAfterDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
function gtfsTimestamp(date: string, value: string) {
  const match = gtfsTime.exec(value)
  if (!match) throw new Error('Live schedule contains an invalid time.')
  const hours = Number(match[1])
  const dateWithOverflow = dateAfterDays(date, Math.floor(hours / 24))
  const clock = `${String(hours % 24).padStart(2, '0')}:${match[2]}:${match[3]}`
  const offset = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Toronto',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${dateWithOverflow}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')!
    .value.replace('GMT', '')
  return new Date(`${dateWithOverflow}T${clock}${offset}`).toISOString()
}
function gtfsMinutes(value: string) {
  const match = gtfsTime.exec(value)
  if (!match) throw new Error('Live schedule contains an invalid time.')
  return Number(match[1]) * 60 + Number(match[2])
}
function providerMode(name: string): Journey['mode'] {
  return /rail|via/i.test(name) ? 'rail' : 'coach'
}
function providerUrl(link: string | null) {
  return safeProviderUrl(link)
}

async function searchRawTrips(criteria: Parameters<JourneyRepository['search']>[0], signal?: AbortSignal) {
  const client = getPublicClient()
  const candidateRequest = client.rpc('find_trips_between_cities', {
    city1: criteria.origin,
    city2: criteria.destination,
  })
  const { data: candidates, error: candidateError } = await (
    signal ? candidateRequest.abortSignal(signal) : candidateRequest
  )
  if (candidateError) throw new Error('Live journeys couldn’t be loaded. Please try again shortly.')
  if (!Array.isArray(candidates)) throw new Error('Unexpected trip search response.')

  const trips = new Map<string, { provider: number; tripId: string }>()
  for (const candidate of candidates as TripCandidate[]) {
    const provider = Number(candidate?.provider)
    const tripId = String(candidate?.trip_id ?? '')
    if (
      Number.isInteger(provider) &&
      tripId.length > 0 &&
      Number(candidate?.tripid_count) > 1 &&
      (candidate.city_name === criteria.origin || candidate.city_name === criteria.destination)
    )
      trips.set(`${provider}:${tripId}`, { provider, tripId })
  }
  if (!trips.size) return []

  const tripValues = [...trips.values()]
  const timesRequest = client
    .from('stop_times')
    .select('ID,Provider,trip_id,arrival_time,departure_time,stop_id,stop_sequence,shape_dist_traveled')
    .in('Provider', [...new Set(tripValues.map((trip) => trip.provider))])
    .in('trip_id', [...new Set(tripValues.map((trip) => trip.tripId))])
    .order('stop_sequence', { ascending: true })
  const { data: times, error: timesError } = await (
    signal ? timesRequest.abortSignal(signal) : timesRequest
  )
  if (timesError) throw new Error('Live stop times couldn’t be loaded. Please try again shortly.')
  if (!Array.isArray(times)) throw new Error('Unexpected stop-time response.')

  const rows = times as StopTimeRow[]
  const stopIds = [...new Set(rows.map((row) => row.stop_id).filter(Number.isInteger))]
  const stopsRequest = client
    .from('Stops')
    .select('provider,stop_id,stop_name,stop_lon,stop_lat,city_name')
    .in('provider', [...new Set(rows.map((row) => row.Provider))])
    .in('stop_id', stopIds)
  const providersRequest = client
    .from('Providers')
    .select('id,Provider_name,link')
    .in('id', [...new Set(rows.map((row) => row.Provider))])
  const [stopsResult, providersResult] = await Promise.all([
    signal ? stopsRequest.abortSignal(signal) : stopsRequest,
    signal ? providersRequest.abortSignal(signal) : providersRequest,
  ])
  if (stopsResult.error || providersResult.error)
    throw new Error('Live stop metadata couldn’t be loaded. Please try again shortly.')
  const stops = (stopsResult.data ?? []) as StopRow[]
  const providers = new Map(
    ((providersResult.data ?? []) as ProviderRow[]).map((provider) => [provider.id, provider]),
  )
  const stopByKey = new Map(stops.map((stop) => [`${stop.provider}:${stop.stop_id}`, stop]))
  const grouped = new Map<string, StopTimeRow[]>()
  for (const row of rows) {
    const key = `${row.Provider}:${row.trip_id}`
    const group = grouped.get(key) ?? []
    group.push(row)
    grouped.set(key, group)
  }

  return [...grouped.entries()]
    .flatMap(([key, group]) => {
      const first = group[0]
      const last = group[group.length - 1]
      const provider = providers.get(first.Provider)
      const originStop = stopByKey.get(`${first.Provider}:${first.stop_id}`)
      const destinationStop = stopByKey.get(`${last.Provider}:${last.stop_id}`)
      if (
        !provider?.Provider_name ||
        !originStop?.city_name ||
        !destinationStop?.city_name ||
        originStop.city_name !== criteria.origin ||
        destinationStop.city_name !== criteria.destination ||
        !first.departure_time ||
        !last.arrival_time
      )
        return []
      const departureAt = gtfsTimestamp(criteria.date, first.departure_time)
      const arrivalAt = gtfsTimestamp(criteria.date, last.arrival_time)
      if (gtfsMinutes(first.departure_time) < gtfsMinutes(`${criteria.time}:00`))
        return []
      const journeyStops = group
        .sort((a, b) => a.stop_sequence - b.stop_sequence)
        .map((row): JourneyStop => {
          const stop = stopByKey.get(`${row.Provider}:${row.stop_id}`)
          if (!stop?.stop_name || !stop.city_name || !row.arrival_time || !row.departure_time)
            throw new Error('Live stop data is incomplete.')
          return {
            name: stop.stop_name,
            city: stop.city_name,
            locationNote: 'Confirm the exact boarding location with the provider.',
            arrivalTime: gtfsTimestamp(criteria.date, row.arrival_time),
            departureTime: gtfsTimestamp(criteria.date, row.departure_time),
            ...(Number.isFinite(stop.stop_lat) && Number.isFinite(stop.stop_lon)
              ? { latitude: stop.stop_lat!, longitude: stop.stop_lon! }
              : {}),
          }
        })
      if (Date.parse(arrivalAt) <= Date.parse(departureAt) || journeyStops.length < 2) return []
      return [
        {
          id: `${key}:${criteria.date}`,
          providerName: provider.Provider_name,
          mode: providerMode(provider.Provider_name),
          origin: criteria.origin,
          destination: criteria.destination,
          departureAt,
          arrivalAt,
          durationMinutes: Math.round((Date.parse(arrivalAt) - Date.parse(departureAt)) / 60000),
          transfers: 0,
          estimatedFare: null,
          stops: journeyStops,
          providerUrl: providerUrl(provider.link),
          isSample: false,
          timeZone: 'America/Toronto',
          updatedAt: new Date().toISOString(),
        } satisfies Journey,
      ]
    })
    .sort((a, b) => Date.parse(a.departureAt) - Date.parse(b.departureAt))
}

export const liveRepository: JourneyRepository = {
  async search(criteria, signal) {
    return searchRawTrips(criteria, signal)
  },
}
export async function loadLiveCities(signal?: AbortSignal) {
  const request = getPublicClient().from('Stops').select('city_name').not('city_name', 'is', null)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error || !Array.isArray(data)) throw new Error('Available cities couldn’t be loaded.')
  return [...new Set(data.map((x: { city_name: string | null }) => x.city_name).filter(text))].sort(
    (a, b) => a.localeCompare(b),
  )
}
