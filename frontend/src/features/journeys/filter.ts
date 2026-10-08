import type { Journey } from './types'
export interface JourneyFilters {
  mode: string
  budget: string
  maxDuration: string
  sort: string
}
export function readFilters(params: URLSearchParams): JourneyFilters {
  const choice = (key: string, allowed: string[], fallback: string) =>
    allowed.includes(params.get(key) ?? '') ? params.get(key)! : fallback
  return {
    mode: choice('mode', ['all', 'coach', 'rail', 'shuttle'], 'all'),
    budget: choice('budget', ['any', '40', '60', '80'], 'any'),
    maxDuration: choice('duration', ['any', '180', '300', '360'], 'any'),
    sort: choice('sort', ['departure', 'price', 'duration'], 'departure'),
  }
}
export function filterJourneys(journeys: Journey[], filters: JourneyFilters) {
  return journeys
    .filter(
      (journey) =>
        (filters.mode === 'all' || journey.mode === filters.mode) &&
        (filters.budget === 'any' ||
          (journey.estimatedFare !== null &&
            journey.estimatedFare.amount <= Number(filters.budget))) &&
        (filters.maxDuration === 'any' || journey.durationMinutes <= Number(filters.maxDuration)),
    )
    .sort((a, b) => {
      if (filters.sort === 'price')
        return (
          (a.estimatedFare?.amount ?? Infinity) - (b.estimatedFare?.amount ?? Infinity) ||
          Date.parse(a.departureAt) - Date.parse(b.departureAt)
        )
      if (filters.sort === 'duration')
        return (
          a.durationMinutes - b.durationMinutes ||
          Date.parse(a.departureAt) - Date.parse(b.departureAt)
        )
      return Date.parse(a.departureAt) - Date.parse(b.departureAt)
    })
}
