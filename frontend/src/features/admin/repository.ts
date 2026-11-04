import { getAdminClient } from '@/lib/supabase'
import { journeyColumns, type JourneyRow } from '@/features/journeys/live-repository'

export type JourneyWrite = Pick<
  JourneyRow,
  | 'provider_name'
  | 'mode'
  | 'origin'
  | 'destination'
  | 'departure_at'
  | 'arrival_at'
  | 'time_zone'
  | 'fare_cad'
  | 'stops'
  | 'provider_url'
  | 'published'
  | 'route_geometry'
  | 'verified_at'
>
export async function loadAdminIdentity() {
  const client = getAdminClient()
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()
  if (sessionError) throw new Error('Your session couldn’t be checked. Please try again.')
  if (!session) return null
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user)
    throw new Error('Your session could not be verified. Sign out and sign in again.')
  const membership = await client
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (membership.error)
    throw new Error(
      'Admin access could not be checked. The MoveON database setup or connection needs attention.',
    )
  return { id: user.id, email: user.email, allowed: !!membership.data }
}
export type TripStop = {
  ID: number
  stop_sequence: number
  arrival_time: string | null
  departure_time: string | null
  stop_name: string
  city_name: string | null
}
export type AdminTrip = { key: string; tripId: string; providerName: string; stops: TripStop[] }
const loadError = 'Trips couldn’t load. Check your connection and admin access, then retry.'

// Lists trips that start in the origin city and end in the destination city, with their stops in order.
export async function listAdminTrips(origin: string, destination: string, signal?: AbortSignal) {
  const client = getAdminClient()
  const matchRequest = client.rpc('find_trips_between_cities', { city1: origin, city2: destination })
  const { data: matches, error } = await (signal ? matchRequest.abortSignal(signal) : matchRequest)
  if (error || !Array.isArray(matches)) throw new Error(loadError)
  const keys = new Set(
    (matches as { trip_id: string; provider: string }[]).map((m) => `${m.provider}:${m.trip_id}`),
  )
  if (!keys.size) return []
  const providerIds = [...new Set([...keys].map((key) => Number(key.split(':')[0])))]
  const tripIds = [...new Set([...keys].map((key) => key.slice(key.indexOf(':') + 1)))]
  // shortcut: one request is capped by the API's max rows (1000 by default), page it if busy city pairs get cut off.
  const timesRequest = client
    .from('stop_times')
    .select('ID,Provider,trip_id,arrival_time,departure_time,stop_id,stop_sequence')
    .in('Provider', providerIds)
    .in('trip_id', tripIds)
    .order('stop_sequence')
  const providersRequest = client.from('Providers').select('id,Provider_name').in('id', providerIds)
  const [times, providers] = await Promise.all([
    signal ? timesRequest.abortSignal(signal) : timesRequest,
    signal ? providersRequest.abortSignal(signal) : providersRequest,
  ])
  if (times.error || providers.error) throw new Error(loadError)
  type TimeRow = Omit<TripStop, 'stop_name' | 'city_name'> & {
    Provider: number
    trip_id: string
    stop_id: number
  }
  const rows = ((times.data ?? []) as TimeRow[]).filter((row) =>
    keys.has(`${row.Provider}:${row.trip_id}`),
  )
  const stopsRequest = client
    .from('Stops')
    .select('provider,stop_id,stop_name,city_name')
    .in('provider', providerIds)
    .in('stop_id', [...new Set(rows.map((row) => row.stop_id))])
  const stops = await (signal ? stopsRequest.abortSignal(signal) : stopsRequest)
  if (stops.error) throw new Error(loadError)
  const stopByKey = new Map(
    (
      (stops.data ?? []) as {
        provider: number
        stop_id: number
        stop_name: string | null
        city_name: string | null
      }[]
    ).map((stop) => [`${stop.provider}:${stop.stop_id}`, stop]),
  )
  const providerNames = new Map(
    ((providers.data ?? []) as { id: number; Provider_name: string | null }[]).map((p) => [
      p.id,
      p.Provider_name ?? `Provider ${p.id}`,
    ]),
  )
  const trips = new Map<string, AdminTrip>()
  for (const row of rows) {
    const key = `${row.Provider}:${row.trip_id}`
    const trip = trips.get(key) ?? {
      key,
      tripId: row.trip_id,
      providerName: providerNames.get(row.Provider) ?? `Provider ${row.Provider}`,
      stops: [],
    }
    const stop = stopByKey.get(`${row.Provider}:${row.stop_id}`)
    trip.stops.push({
      ID: row.ID,
      stop_sequence: row.stop_sequence,
      arrival_time: row.arrival_time,
      departure_time: row.departure_time,
      stop_name: stop?.stop_name ?? `Stop ${row.stop_id}`,
      city_name: stop?.city_name ?? null,
    })
    trips.set(key, trip)
  }
  // The database function matches any trip through both cities; keep only trips that start in the origin and end in the destination.
  return [...trips.values()]
    .filter(
      (trip) =>
        trip.stops.length > 1 &&
        trip.stops[0].city_name === origin &&
        trip.stops[trip.stops.length - 1].city_name === destination,
    )
    .sort(
      (a, b) =>
        a.providerName.localeCompare(b.providerName) ||
        a.tripId.localeCompare(b.tripId, undefined, { numeric: true }),
    )
}

// GTFS times are HH:MM:SS and may pass 24:00:00 for trips running after midnight.
export const gtfsTimePattern = '\\d{1,2}:[0-5]\\d:[0-5]\\d'
const gtfsSeconds = (time: string) => {
  if (!new RegExp(`^${gtfsTimePattern}$`).test(time)) return NaN
  const [h, m, s] = time.split(':').map(Number)
  return h * 3600 + m * 60 + s
}
export async function updateStopTime(id: number, arrival_time: string, departure_time: string) {
  const arrival = gtfsSeconds(arrival_time)
  const departure = gtfsSeconds(departure_time)
  if (Number.isNaN(arrival) || Number.isNaN(departure))
    throw new Error('Use HH:MM:SS for both times, for example 08:05:00.')
  if (departure < arrival) throw new Error('Departure can’t be earlier than arrival.')
  const { data, error } = await getAdminClient()
    .from('stop_times')
    .update({ arrival_time, departure_time })
    .eq('ID', id)
    .select('ID')
    .maybeSingle()
  if (error)
    throw new Error('The stop time wasn’t saved. Check your connection and admin access, then retry.')
  if (!data) throw new Error('The stop time wasn’t saved. Your admin access may have been removed.')
}
export async function saveAdminJourney(payload: JourneyWrite, previous?: JourneyRow) {
  const table = getAdminClient().from('journeys')
  const request = previous
    ? table.update(payload).eq('id', previous.id).eq('updated_at', previous.updated_at)
    : table.insert(payload)
  const { data, error } = await request.select(journeyColumns).maybeSingle()
  if (error)
    throw new Error(
      'The journey wasn’t saved. Check your connection, admin access and required fields, then retry.',
    )
  if (!data)
    throw new Error(
      'This journey changed or your access was removed. Close the editor, refresh the list and reopen it before saving.',
    )
  return data as unknown as JourneyRow
}
