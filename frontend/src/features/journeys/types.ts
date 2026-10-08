/** The frontend contract. Map provider/GTFS records to these models in the data layer. */
export interface JourneySearch {
  origin: string
  destination: string
  date: string
  time: string
}
export interface JourneyStop {
  name: string
  city: string
  locationNote: string
  arrivalTime?: string
  departureTime?: string
  latitude?: number
  longitude?: number
}
export interface Journey {
  id: string
  providerName: string
  mode: 'coach' | 'rail' | 'shuttle'
  origin: string
  destination: string
  departureAt: string
  arrivalAt: string
  durationMinutes: number
  transfers: number
  estimatedFare: { amount: number; currency: 'CAD' } | null
  stops: JourneyStop[]
  providerUrl: string | null
  isSample: boolean
  timeZone: string
  updatedAt: string
  geometry?: { type: 'LineString'; coordinates: [number, number][] }
}
export interface JourneyRepository {
  search(criteria: JourneySearch, signal?: AbortSignal): Promise<Journey[]>
}
