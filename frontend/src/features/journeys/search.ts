import { isLiveData } from '@/lib/data-source'
import type { JourneySearch } from './types'

export const cities = [
  'Toronto',
  'Ottawa',
  'Kingston',
  'London',
  'Hamilton',
  'Niagara Falls',
  'Barrie',
  'Peterborough',
  'Sudbury',
  'North Bay',
] as const
export function isValidCity(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (isLiveData
      ? value.trim().length > 0 &&
        value.length <= 100 &&
        ![...value].some((character) => character.charCodeAt(0) < 32)
      : cities.some((city) => city === value))
  )
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function nextDay() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return localDate(date)
}
export function readSearch(params: URLSearchParams): JourneySearch {
  const city = (key: string, fallback: string) => {
    const value = params.get(key)
    return isValidCity(value) ? value!.trim() : fallback
  }
  const date = params.get('date') ?? ''
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) &&
    localDate(new Date(`${date}T12:00:00`)) === date &&
    date >= localDate()
  const time = params.get('time') ?? ''
  return {
    origin: city('from', 'Toronto'),
    destination: city('to', 'Ottawa'),
    date: validDate ? date : nextDay(),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '09:00',
  }
}
export function searchParams(criteria: JourneySearch) {
  return new URLSearchParams({
    from: criteria.origin,
    to: criteria.destination,
    date: criteria.date,
    time: criteria.time,
  })
}
